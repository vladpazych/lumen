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
  collectThumbs,
  imageThumbUri,
  pickImage,
  resolveImageParams,
} from "./adapters/vscode-images";

export type HandlerContext = {
  document: vscode.TextDocument;
  panel: vscode.WebviewPanel;
  bridge: DocumentBridge;
  connection: ServerConnection;
  service: EditorService;
  context: vscode.ExtensionContext;
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
  }
}

async function handleReady(ctx: HandlerContext): Promise<void> {
  const { document, panel, bridge, connection } = ctx;
  const configs = bridge.read(document);
  if (ensureIds(configs)) {
    await bridge.write(document, configs);
  }

  const url = connection.serverUrl;
  if (url && !connection.schemas[url]) connection.schemas[url] = [];

  ctx.post({
    type: "init",
    schemas: connection.schemas,
    configs,
    serverStatuses: connection.statuses,
    devServerState: connection.devServerState,
    devServerUrl: url,
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
  if (url) ctx.connection.refreshSchemas(url);
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
