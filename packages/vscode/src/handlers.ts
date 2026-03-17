import { dirname, relative } from "node:path";
import * as vscode from "vscode";
import { ensureIds } from "@vladpazych/lumen/domain/config";
import type { EditorService } from "@vladpazych/lumen/editor";
import type {
  ExtensionMessage,
  WebviewMessage,
} from "../webview/lib/messaging";
import type { DocumentBridge } from "./document";
import type { ServerConnection } from "./connection";
import {
  copyAuthToken,
  createOrUpdateModalSecret,
  describeServerSetup,
  installServerTemplate,
  revealServerFolder,
} from "./server-scaffold";
import {
  collectThumbs,
  imageThumbUri,
  pickImage,
  resolveImageParams,
} from "./adapters/vscode-images";
import { getServerSetting, getServerSource } from "./server";
import {
  createPipelineFromPrompt,
  createRunnerConfigFromPrompt,
  describeManagedWorkspaceServer,
  describeWorkspaceHome,
  initializeWorkspace,
  openRunnerConfig,
  revealAssetsFolder,
  updateWorkspaceRuntime,
  reinstallWorkspaceSkills,
} from "./workspace-home";
import type { WorkspaceSecretStore } from "./workspace-secrets";

export type HandlerContext = {
  document: vscode.TextDocument;
  documentKind: "workspace" | "config";
  panel: vscode.WebviewPanel;
  bridge: DocumentBridge;
  connection: ServerConnection;
  service: EditorService;
  context: vscode.ExtensionContext;
  workspaceSecrets: WorkspaceSecretStore;
  post(message: ExtensionMessage): void;
  onDevServerCommand: ((cmd: "start" | "stop" | "restart") => void) | null;
  getDevLogBuffer(): string[];
  activeJobs: Map<string, { progress: number; stage: "queued" | "running" }>;
};

export async function handleMessage(
  ctx: HandlerContext,
  msg: WebviewMessage,
): Promise<void> {
  switch (msg.type) {
    case "ready":
      return handleReady(ctx);
    case "updateState":
      return handleUpdateState(ctx, msg);
    case "generateRequest":
      return handleGenerate(ctx, msg);
    case "refreshSchemas":
      return handleRefreshSchemas(ctx);
    case "selectConfig":
      return handleSelectConfig(ctx, msg);
    case "pickImage":
      return handlePickImage(ctx, msg);
    case "pickImageByUri":
      return handlePickImageByUri(ctx, msg);
    case "addConfig":
      return handleAddConfig(ctx, msg);
    case "removeConfig":
      return handleRemoveConfig(ctx, msg);
    case "updateName":
      return handleUpdateName(ctx, msg);
    case "startDevServer":
      ctx.onDevServerCommand?.("start");
      return;
    case "stopDevServer":
      ctx.onDevServerCommand?.("stop");
      return;
    case "restartDevServer":
      ctx.onDevServerCommand?.("restart");
      return;
    case "installServer":
      return handleInstallServer(ctx, msg);
    case "copyAuthToken":
      return handleCopyAuthToken(ctx);
    case "saveModalCredentials":
      return handleSaveModalCredentials(ctx, msg);
    case "syncLumenAuthToModal":
      return handleSyncLumenAuthToModal(ctx);
    case "revealServer":
      return handleRevealServer(ctx);
    case "initializeWorkspace":
      return handleInitializeWorkspace(ctx);
    case "createRunnerConfig":
      return handleCreateRunnerConfig(ctx);
    case "openRunnerConfig":
      return handleOpenRunnerConfig(ctx, msg);
    case "createPipeline":
      return handleCreatePipeline(ctx);
    case "updateRuntime":
      return handleUpdateRuntime(ctx);
    case "reinstallSkills":
      return handleReinstallSkills(ctx);
    case "revealAssets":
      return handleRevealAssets(ctx);
  }
}

async function handleReady(ctx: HandlerContext): Promise<void> {
  const { document, panel, bridge, connection } = ctx;
  const workspaceHome = describeWorkspaceHome();
  const managedServer = describeManagedWorkspaceServer(ctx.context);
  const managedAuth = await ctx.workspaceSecrets.describeAuth(
    managedServer.authSecretName,
    managedServer.serverPath,
  );

  if (ctx.documentKind === "workspace") {
    ctx.post({
      type: "init",
      documentKind: "workspace",
      schemas: connection.schemas,
      configs: [],
      serverStatuses: connection.statuses,
      devServerState: connection.devServerState,
      devServerUrl: connection.serverUrl,
      serverSetup: managedServer,
      workspaceHome,
      workspaceAuth: managedAuth,
    });

    const bufferedLog = ctx.getDevLogBuffer();
    if (bufferedLog.length > 0) {
      ctx.post({ type: "devServerLog", text: bufferedLog.join("\n") });
    }
    return;
  }

  const configs = bridge.read(document);
  if (ensureIds(configs)) {
    await bridge.write(document, configs);
  }

  const url = connection.serverUrl;
  if (url && !connection.schemas[url]) connection.schemas[url] = [];
  const currentSetup = describeServerSetup(
    ctx.context,
    getServerSource(),
    getServerSetting(),
  );

  ctx.post({
    type: "init",
    documentKind: "config",
    schemas: connection.schemas,
    configs,
    serverStatuses: connection.statuses,
    devServerState: connection.devServerState,
    devServerUrl: url,
    serverSetup: currentSetup,
    workspaceHome,
    workspaceAuth: await ctx.workspaceSecrets.describeAuth(
      currentSetup.authSecretName,
      currentSetup.serverPath,
    ),
  });

  const bufferedLog = ctx.getDevLogBuffer();
  if (bufferedLog.length > 0) {
    ctx.post({ type: "devServerLog", text: bufferedLog.join("\n") });
  }

  // Restore active generation state
  const configIds = new Set(configs.map((c) => c.id));
  for (const [configId, job] of ctx.activeJobs) {
    if (configIds.has(configId)) {
      ctx.post({
        type: "generateProgress",
        requestId: "",
        configId,
        service: "",
        pipeline: "",
        progress: job.progress,
        stage: job.stage,
      });
    }
  }

  const docDir = dirname(document.uri.fsPath);
  const thumbs = collectThumbs(
    connection.schemas,
    configs,
    docDir,
    panel.webview,
  );
  if (Object.keys(thumbs).length > 0) {
    ctx.post({ type: "imageThumbs", thumbs });
  }
}

async function handleUpdateState(
  ctx: HandlerContext,
  msg: Extract<WebviewMessage, { type: "updateState" }>,
): Promise<void> {
  const configs = ctx.bridge.read(ctx.document);
  const idx = configs.findIndex((c) => c.id === msg.configId);
  if (idx >= 0) {
    configs[idx] = {
      ...configs[idx],
      params: { ...configs[idx].params, [msg.paramName]: msg.value },
    };
    await ctx.bridge.write(ctx.document, configs);
  }
}

async function handleGenerate(
  ctx: HandlerContext,
  msg: Extract<WebviewMessage, { type: "generateRequest" }>,
): Promise<void> {
  const { document, bridge, connection, service } = ctx;
  const { requestId, configId, service: svc, pipeline, params } = msg;
  const docDir = dirname(document.uri.fsPath);
  const resolved = resolveImageParams(
    connection.schemas,
    svc,
    pipeline,
    params,
    docDir,
  );

  ctx.activeJobs.set(configId, { progress: 0, stage: "queued" });

  try {
    const response = await service.generate(
      svc,
      pipeline,
      resolved,
      document.uri.fsPath,
      (info) => {
        ctx.activeJobs.set(configId, {
          progress: info.progress,
          stage: info.stage,
        });
        ctx.post({
          type: "generateProgress",
          requestId,
          configId,
          service: svc,
          pipeline,
          progress: info.progress,
          stage: info.stage,
        });
      },
    );

    ctx.activeJobs.delete(configId);

    if (response.status === "completed") {
      const meta = response.outputs[0]?.metadata;
      if (meta?.seed != null) {
        const configs = bridge.read(document);
        const idx = configs.findIndex((c) => c.id === configId);
        if (idx >= 0) {
          configs[idx] = {
            ...configs[idx],
            params: { ...configs[idx].params, seed: meta.seed },
          };
          await bridge.write(document, configs);
        }
      }
    }

    ctx.post({
      type: "generateResult",
      requestId,
      configId,
      service: svc,
      pipeline,
      response,
    });
  } catch (err) {
    ctx.activeJobs.delete(configId);
    ctx.post({
      type: "generateResult",
      requestId,
      configId,
      service: svc,
      pipeline,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function handleRefreshSchemas(ctx: HandlerContext): Promise<void> {
  const url = ctx.connection.serverUrl;
  if (url) {
    await ctx.connection.refreshSchemas(url);
  }
}

async function handleSelectConfig(
  ctx: HandlerContext,
  msg: Extract<WebviewMessage, { type: "selectConfig" }>,
): Promise<void> {
  ctx.context.workspaceState.update(
    `focusIndex:${ctx.document.uri.toString()}`,
    msg.index,
  );
}

async function handlePickImage(
  ctx: HandlerContext,
  msg: Extract<WebviewMessage, { type: "pickImage" }>,
): Promise<void> {
  const { requestId, configId, service, pipeline, paramName } = msg;
  try {
    const docDir = dirname(ctx.document.uri.fsPath);
    const pickedPath = await pickImage(docDir);
    const thumbUri = pickedPath
      ? imageThumbUri(pickedPath, docDir, ctx.panel.webview)
      : undefined;
    ctx.post({
      type: "imagePicked",
      requestId,
      configId,
      service,
      pipeline,
      paramName,
      url: pickedPath,
      thumbnailUri: thumbUri,
    });
  } catch (err) {
    ctx.post({
      type: "imagePicked",
      requestId,
      configId,
      service,
      pipeline,
      paramName,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function handlePickImageByUri(
  ctx: HandlerContext,
  msg: Extract<WebviewMessage, { type: "pickImageByUri" }>,
): Promise<void> {
  const { requestId, configId, service, pipeline, paramName, uri } = msg;
  try {
    const docDir = dirname(ctx.document.uri.fsPath);
    const fsPath = vscode.Uri.parse(uri).fsPath;
    const rel = relative(docDir, fsPath);
    const relPath = rel.startsWith(".") ? rel : `./${rel}`;
    const thumbUri = imageThumbUri(relPath, docDir, ctx.panel.webview);
    ctx.post({
      type: "imagePicked",
      requestId,
      configId,
      service,
      pipeline,
      paramName,
      url: relPath,
      thumbnailUri: thumbUri,
    });
  } catch (err) {
    ctx.post({
      type: "imagePicked",
      requestId,
      configId,
      service,
      pipeline,
      paramName,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function handleAddConfig(
  ctx: HandlerContext,
  msg: Extract<WebviewMessage, { type: "addConfig" }>,
): Promise<void> {
  const configs = ctx.bridge.read(ctx.document);
  configs.push(msg.config);
  await ctx.bridge.write(ctx.document, configs);
}

async function handleRemoveConfig(
  ctx: HandlerContext,
  msg: Extract<WebviewMessage, { type: "removeConfig" }>,
): Promise<void> {
  const configs = ctx.bridge.read(ctx.document);
  const filtered = configs.filter((c) => c.id !== msg.configId);
  if (filtered.length !== configs.length) {
    await ctx.bridge.write(ctx.document, filtered);
  }
}

async function handleUpdateName(
  ctx: HandlerContext,
  msg: Extract<WebviewMessage, { type: "updateName" }>,
): Promise<void> {
  const configs = ctx.bridge.read(ctx.document);
  const idx = configs.findIndex((c) => c.id === msg.configId);
  if (idx >= 0) {
    configs[idx] = { ...configs[idx], name: msg.name };
    await ctx.bridge.write(ctx.document, configs);
  }
}

async function handleInstallServer(
  ctx: HandlerContext,
  msg: Extract<WebviewMessage, { type: "installServer" }>,
): Promise<void> {
  try {
    const setup = await installServerTemplate({
      context: ctx.context,
      workspaceSecrets: ctx.workspaceSecrets,
      serverSetting: msg.serverSetting,
      pipelinePackIds: msg.pipelinePackIds,
      skillPackIds: msg.skillPackIds,
      initGit: msg.initGit,
    });
    ctx.connection.unsubscribeAll();
    await ctx.connection.rebuildProviders();
    ctx.connection.subscribeAll();
    ctx.post({ type: "serverSetup", setup });
    postWorkspaceHome(ctx);
    await postWorkspaceAuth(ctx, setup.serverPath, setup.authSecretName);
    vscode.window.showInformationMessage("Lumen server installed");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to install server: ${message}`);
  }
}

async function handleCopyAuthToken(ctx: HandlerContext): Promise<void> {
  try {
    const token = await copyAuthToken(ctx.workspaceSecrets, getServerSource());
    await vscode.env.clipboard.writeText(token);
    vscode.window.showInformationMessage("Copied Lumen auth token");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(message);
  }
}

async function handleSaveModalCredentials(
  ctx: HandlerContext,
  msg: Extract<WebviewMessage, { type: "saveModalCredentials" }>,
): Promise<void> {
  try {
    const tokenId = msg.tokenId.trim();
    const tokenSecret = msg.tokenSecret.trim();
    if (!tokenId || !tokenSecret) {
      throw new Error("Enter both Modal token ID and token secret");
    }

    await ctx.workspaceSecrets.saveModalCredentials(tokenId, tokenSecret);
    await postWorkspaceAuth(ctx);
    vscode.window.showInformationMessage("Saved Modal credentials for this workspace");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to save Modal credentials: ${message}`);
  }
}

async function handleSyncLumenAuthToModal(ctx: HandlerContext): Promise<void> {
  try {
    const setup = describeServerSetup(
      ctx.context,
      getServerSource(),
      getServerSetting(),
    );
    await createOrUpdateModalSecret(
      ctx.workspaceSecrets,
      setup.serverPath,
      setup.authSecretName,
    );
    await postWorkspaceAuth(ctx, setup.serverPath, setup.authSecretName);
    vscode.window.showInformationMessage(
      `Synced Lumen auth to Modal secret ${setup.authSecretName}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to sync Lumen auth to Modal: ${message}`);
  }
}

async function handleRevealServer(_: HandlerContext): Promise<void> {
  try {
    await revealServerFolder(getServerSource());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(message);
  }
}

function postWorkspaceHome(ctx: HandlerContext): void {
  ctx.post({
    type: "workspaceHome",
    home: describeWorkspaceHome(),
  });
}

async function postWorkspaceAuth(
  ctx: HandlerContext,
  serverPath?: string,
  modalSecretName?: string,
): Promise<void> {
  const currentSetup =
    ctx.documentKind === "workspace" && !serverPath
      ? describeManagedWorkspaceServer(ctx.context)
      : describeServerSetup(
          ctx.context,
          serverPath ?? getServerSource(),
          getServerSetting(),
        );
  ctx.post({
    type: "workspaceAuth",
    auth: await ctx.workspaceSecrets.describeAuth(
      modalSecretName ?? currentSetup.authSecretName,
      currentSetup.serverPath,
    ),
  });
}

async function handleInitializeWorkspace(ctx: HandlerContext): Promise<void> {
  try {
    const result = await initializeWorkspace(ctx.context, ctx.workspaceSecrets);
    ctx.connection.unsubscribeAll();
    await ctx.connection.rebuildProviders();
    ctx.connection.subscribeAll();
    ctx.post({ type: "serverSetup", setup: result.setup });
    ctx.post({ type: "workspaceHome", home: result.home });
    await postWorkspaceAuth(
      ctx,
      result.setup.serverPath,
      result.setup.authSecretName,
    );
    vscode.window.showInformationMessage("Lumen workspace initialized");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to initialize workspace: ${message}`);
  }
}

async function handleCreateRunnerConfig(ctx: HandlerContext): Promise<void> {
  try {
    const home = await createRunnerConfigFromPrompt();
    ctx.post({ type: "workspaceHome", home });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to create config: ${message}`);
  }
}

async function handleOpenRunnerConfig(
  _: HandlerContext,
  msg: Extract<WebviewMessage, { type: "openRunnerConfig" }>,
): Promise<void> {
  try {
    await openRunnerConfig(msg.uri);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to open config: ${message}`);
  }
}

async function handleCreatePipeline(_: HandlerContext): Promise<void> {
  try {
    const created = await createPipelineFromPrompt();
    if (created) {
      vscode.window.showInformationMessage(
        "Pipeline created. Restart the dev server to reload schemas.",
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to create pipeline: ${message}`);
  }
}

async function handleUpdateRuntime(ctx: HandlerContext): Promise<void> {
  try {
    const setup = await updateWorkspaceRuntime(ctx.context);
    ctx.post({ type: "serverSetup", setup });
    await postWorkspaceAuth(ctx, setup.serverPath, setup.authSecretName);
    vscode.window.showInformationMessage("Lumen runtime updated");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to update runtime: ${message}`);
  }
}

async function handleReinstallSkills(ctx: HandlerContext): Promise<void> {
  try {
    const setup = await reinstallWorkspaceSkills(ctx.context);
    ctx.post({ type: "serverSetup", setup });
    postWorkspaceHome(ctx);
    await postWorkspaceAuth(ctx, setup.serverPath, setup.authSecretName);
    vscode.window.showInformationMessage("Lumen skills reinstalled");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to reinstall skills: ${message}`);
  }
}

async function handleRevealAssets(_: HandlerContext): Promise<void> {
  try {
    await revealAssetsFolder();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(message);
  }
}
