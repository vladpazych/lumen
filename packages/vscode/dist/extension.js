var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __moduleCache = /* @__PURE__ */ new WeakMap;
var __toCommonJS = (from) => {
  var entry = __moduleCache.get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function")
    __getOwnPropNames(from).map((key) => !__hasOwnProp.call(entry, key) && __defProp(entry, key, {
      get: () => from[key],
      enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
    }));
  __moduleCache.set(from, entry);
  return entry;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};

// src/extension.ts
var exports_extension = {};
__export(exports_extension, {
  deactivate: () => deactivate,
  activate: () => activate
});
module.exports = __toCommonJS(exports_extension);
var vscode4 = __toESM(require("vscode"));

// src/provider.ts
var import_node_fs3 = require("node:fs");
var import_node_path3 = require("node:path");
var vscode3 = __toESM(require("vscode"));

// src/api.ts
var POLL_INTERVAL_MS = 1500;
var MAX_POLL_ATTEMPTS = 200;
async function fetchPipelines(serverUrl) {
  const res = await fetch(`${serverUrl}/pipelines`);
  if (!res.ok)
    throw new Error(`GET /pipelines failed: ${res.status}`);
  const manifests = await res.json();
  const configs = await Promise.all(manifests.map(async (m) => {
    const r = await fetch(`${serverUrl}/pipelines/${m.id}`);
    if (!r.ok)
      throw new Error(`GET /pipelines/${m.id} failed: ${r.status}`);
    return await r.json();
  }));
  return configs;
}
async function generate(serverUrl, pipelineId, params) {
  const res = await fetch(`${serverUrl}/pipelines/${pipelineId}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST /pipelines/${pipelineId}/generate failed: ${res.status} ${text}`);
  }
  return await res.json();
}
async function pollRun(serverUrl, pipelineId, runId) {
  const res = await fetch(`${serverUrl}/pipelines/${pipelineId}/runs/${runId}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET /runs/${runId} failed: ${res.status} ${text}`);
  }
  return await res.json();
}
async function pollUntilDone(serverUrl, pipelineId, runId, onProgress) {
  for (let i = 0;i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const status = await pollRun(serverUrl, pipelineId, runId);
    if (status.status === "running" || status.status === "queued") {
      onProgress?.(status.status === "running" ? status.progress ?? 0 : 0);
      continue;
    }
    return status;
  }
  return {
    status: "failed",
    runId,
    error: { code: "TIMEOUT", message: "Generation timed out after 5 minutes" }
  };
}

// src/providers/fal.ts
var import_node_crypto = require("node:crypto");
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var vscode = __toESM(require("vscode"));
var FAL_PROVIDER_URL = "provider://fal";
var ASPECT_RATIO_OPTIONS = [
  { value: "1:1", label: "1:1 Square" },
  { value: "16:9", label: "16:9 Landscape" },
  { value: "9:16", label: "9:16 Portrait" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
  { value: "3:2", label: "3:2" },
  { value: "2:3", label: "2:3" },
  { value: "4:5", label: "4:5" },
  { value: "5:4", label: "5:4" },
  { value: "21:9", label: "21:9 Ultrawide" }
];
var sharedParams = (resolutionOptions) => [
  {
    type: "select",
    name: "aspect_ratio",
    label: "Aspect Ratio",
    default: "1:1",
    options: ASPECT_RATIO_OPTIONS,
    group: "basic"
  },
  { type: "integer", name: "num_images", label: "Images", default: 1, min: 1, max: 4, group: "basic" },
  { type: "seed", name: "seed", label: "Seed", group: "advanced" },
  {
    type: "select",
    name: "output_format",
    label: "Format",
    default: "png",
    options: [{ value: "png" }, { value: "jpeg" }, { value: "webp" }],
    group: "advanced"
  },
  {
    type: "select",
    name: "resolution",
    label: "Resolution",
    default: "1K",
    options: resolutionOptions,
    group: "advanced"
  },
  { type: "boolean", name: "enable_web_search", label: "Web Search", default: false, group: "advanced" }
];
var falPipelines = [
  {
    id: "nano-banana",
    name: "Nano Banana",
    description: "Gemini 2.5 Flash image generation via fal.ai",
    category: "image",
    params: [
      { type: "prompt", name: "prompt", label: "Prompt", required: true, group: "basic" },
      ...sharedParams([{ value: "1K" }, { value: "2K" }])
    ],
    output: { type: "image", format: "png" }
  },
  {
    id: "nano-banana-2",
    name: "Nano Banana 2",
    description: "Gemini 3.1 Flash image generation via fal.ai",
    category: "image",
    params: [
      { type: "prompt", name: "prompt", label: "Prompt", required: true, group: "basic" },
      { type: "image", name: "image_urls", label: "Reference Image", group: "basic" },
      ...sharedParams([{ value: "0.5K" }, { value: "1K" }, { value: "2K" }, { value: "4K" }])
    ],
    output: { type: "image", format: "png" }
  },
  {
    id: "nano-banana-pro",
    name: "Nano Banana Pro",
    description: "Gemini 3 Pro high-quality image generation via fal.ai",
    category: "image",
    params: [
      { type: "prompt", name: "prompt", label: "Prompt", required: true, group: "basic" },
      ...sharedParams([{ value: "1K" }, { value: "2K" }, { value: "4K" }])
    ],
    output: { type: "image", format: "png" }
  }
];
var MODEL_MAP = {
  "nano-banana": "fal-ai/nano-banana",
  "nano-banana-2": "fal-ai/nano-banana-2",
  "nano-banana-pro": "fal-ai/nano-banana-pro"
};
var UPLOAD_CACHE_KEY = "lumen.fal.uploadCache";
var CONTENT_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif"
};
async function uploadImage(apiKey, filePath, storage) {
  const bytes = import_node_fs.readFileSync(filePath);
  const hash = import_node_crypto.createHash("sha256").update(bytes).digest("hex");
  const cache = storage.get(UPLOAD_CACHE_KEY, {});
  if (cache[hash])
    return cache[hash];
  const name = import_node_path.basename(filePath);
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
  const initRes = await fetch("https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3", {
    method: "POST",
    headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content_type: contentType, file_name: name })
  });
  if (!initRes.ok) {
    const text = await initRes.text().catch(() => initRes.statusText);
    throw new Error(`fal upload failed: ${initRes.status} ${text}`);
  }
  const { upload_url, file_url } = await initRes.json();
  const putRes = await fetch(upload_url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: bytes
  });
  if (!putRes.ok) {
    throw new Error(`fal upload PUT failed: ${putRes.status}`);
  }
  cache[hash] = file_url;
  await storage.update(UPLOAD_CACHE_KEY, cache);
  return file_url;
}
async function getApiKey(secrets) {
  return secrets.get("lumen.fal.apiKey");
}
async function promptAndStoreApiKey(secrets) {
  const key = await vscode.window.showInputBox({
    prompt: "Enter your fal.ai API key",
    placeHolder: "fal_...",
    password: true,
    ignoreFocusOut: true
  });
  if (!key)
    return false;
  await secrets.store("lumen.fal.apiKey", key);
  return true;
}
async function generate2(apiKey, pipelineId, params) {
  const model = MODEL_MAP[pipelineId];
  if (!model) {
    return {
      status: "failed",
      runId: "",
      error: { code: "UNKNOWN_PIPELINE", message: `Unknown fal pipeline: ${pipelineId}` }
    };
  }
  const body = { ...params };
  if (!body.seed)
    delete body.seed;
  const imageUrl = body.image_urls;
  const hasImage = typeof imageUrl === "string" && imageUrl.length > 0;
  if (hasImage) {
    body.image_urls = [imageUrl];
  } else {
    delete body.image_urls;
  }
  const endpoint = hasImage ? `${model}/edit` : model;
  const res = await fetch(`https://fal.run/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    let message = `fal.ai error ${res.status}`;
    try {
      const err = await res.json();
      message = err.detail ?? err.message ?? message;
    } catch {}
    return { status: "failed", runId: "", error: { code: "FAL_ERROR", message } };
  }
  const data = await res.json();
  return {
    status: "completed",
    runId: crypto.randomUUID().slice(0, 12),
    outputs: data.images.map((img) => ({
      url: img.url,
      type: "image",
      format: img.content_type.split("/")[1] ?? "png",
      metadata: { seed: data.seed }
    }))
  };
}

// src/server.ts
var import_node_fs2 = require("node:fs");
var import_node_path2 = require("node:path");
var import_node_child_process = require("node:child_process");
var vscode2 = __toESM(require("vscode"));
function resolveSource(raw) {
  const root = vscode2.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
  return raw.replace(/\$\{workspaceFolder\}/g, root);
}
function getServers() {
  const raw = vscode2.workspace.getConfiguration("lumen").get("servers", []);
  return raw.map((s) => ({
    ...s,
    source: s.source ? resolveSource(s.source) : undefined
  }));
}
function pidFile(serverPath) {
  return import_node_path2.join(serverPath, ".dev.pid");
}
function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
function readPid(serverPath) {
  const file = pidFile(serverPath);
  if (!import_node_fs2.existsSync(file))
    return null;
  const pid = parseInt(import_node_fs2.readFileSync(file, "utf-8").trim(), 10);
  if (isNaN(pid) || !isAlive(pid)) {
    try {
      import_node_fs2.unlinkSync(file);
    } catch {}
    return null;
  }
  return pid;
}

class ServerManager {
  output;
  onChange;
  constructor(output, onChange) {
    this.output = output;
    this.onChange = onChange;
  }
  getState(sourcePath) {
    if (!sourcePath)
      return "stopped";
    return readPid(sourcePath) !== null ? "running" : "stopped";
  }
  start(sourcePath) {
    if (!sourcePath) {
      vscode2.window.showErrorMessage("No server with source configured in lumen.servers");
      return;
    }
    if (readPid(sourcePath) !== null) {
      vscode2.window.showWarningMessage("Dev server is already running");
      return;
    }
    this.output.appendLine(`[dev] Starting bun dev in ${sourcePath}`);
    this.output.show(true);
    const child = import_node_child_process.spawn("bun", ["dev"], {
      cwd: sourcePath,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
      env: {
        ...process.env,
        PATH: `${process.env.PATH}:${process.env.HOME}/.bun/bin`
      }
    });
    if (child.pid) {
      import_node_fs2.writeFileSync(pidFile(sourcePath), String(child.pid));
    }
    child.stdout?.on("data", (d) => this.output.append(d.toString()));
    child.stderr?.on("data", (d) => this.output.append(d.toString()));
    child.on("close", (code) => {
      this.output.appendLine(`[dev] Exited with code ${code}`);
      try {
        import_node_fs2.unlinkSync(pidFile(sourcePath));
      } catch {}
      this.onChange();
    });
    child.on("error", (err) => {
      this.output.appendLine(`[dev] Error: ${err.message}`);
      try {
        import_node_fs2.unlinkSync(pidFile(sourcePath));
      } catch {}
      this.onChange();
    });
    child.unref();
    this.onChange();
  }
  stop(sourcePath) {
    if (!sourcePath)
      return;
    const pid = readPid(sourcePath);
    if (pid === null) {
      vscode2.window.showWarningMessage("Dev server is not running");
      return;
    }
    this.output.appendLine(`[dev] Killing PID ${pid}`);
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      process.kill(pid, "SIGTERM");
    }
    try {
      import_node_fs2.unlinkSync(pidFile(sourcePath));
    } catch {}
    this.onChange();
  }
}

// src/provider.ts
var log = vscode3.window.createOutputChannel("Lumen");
var HEALTH_POLL_MS = 1e4;

class LumenEditorProvider {
  context;
  static viewType = "lumen.stateViewer";
  panels = new Set;
  schemas = {};
  serverStatuses = {};
  devServerState = "stopped";
  healthTimer = null;
  falApiKey = null;
  onDevServerCommand = null;
  static register(provider) {
    return vscode3.window.registerCustomEditorProvider(LumenEditorProvider.viewType, provider, {
      supportsMultipleEditorsPerDocument: false
    });
  }
  constructor(context) {
    this.context = context;
  }
  getDevServer() {
    return getServers().find((s) => s.source) ?? null;
  }
  getAllServerUrls() {
    const urls = getServers().map((s) => s.url);
    if (this.falApiKey)
      urls.push(FAL_PROVIDER_URL);
    return urls;
  }
  getServerNames() {
    const names = {};
    for (const s of getServers()) {
      names[s.url] = s.name;
    }
    return names;
  }
  async refreshFalApiKey() {
    const prev = this.falApiKey;
    this.falApiKey = await getApiKey(this.context.secrets) ?? null;
    if (this.falApiKey && !prev) {
      this.refreshSchemas(FAL_PROVIDER_URL);
    } else if (!this.falApiKey && prev) {
      delete this.schemas[FAL_PROVIDER_URL];
      delete this.serverStatuses[FAL_PROVIDER_URL];
      this.broadcastToAll({
        type: "schemaRefresh",
        serverUrl: FAL_PROVIDER_URL,
        pipelines: []
      });
    }
  }
  onDevServerStateChange(state) {
    this.devServerState = state;
    this.broadcastToAll({ type: "devServerStatus", state });
    if (state === "running") {
      for (const url of this.getAllServerUrls())
        this.refreshSchemas(url);
    }
  }
  async resolveCustomTextEditor(document, webviewPanel) {
    this.panels.add(webviewPanel);
    const resourceRoots = [
      vscode3.Uri.file(import_node_path3.join(this.context.extensionPath, "dist", "webview")),
      vscode3.Uri.file(import_node_path3.dirname(document.uri.fsPath)),
      ...(vscode3.workspace.workspaceFolders ?? []).map((f) => f.uri)
    ];
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: resourceRoots
    };
    webviewPanel.webview.html = this.getHtml(webviewPanel.webview);
    let updatingFromWebview = false;
    const postConfigs = () => {
      if (updatingFromWebview)
        return;
      const configs = this.parseDocument(document);
      this.postMessage(webviewPanel, { type: "configsUpdated", configs });
    };
    for (const url of this.getAllServerUrls()) {
      if (!this.schemas[url]) {
        this.refreshSchemas(url);
      }
    }
    if (this.panels.size === 1)
      this.startHealthPolling();
    webviewPanel.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case "ready": {
          log.appendLine("[ready] webview ready");
          const configs = this.parseDocument(document);
          if (this.ensureIds(configs)) {
            updatingFromWebview = true;
            await this.writeDocument(document, configs);
            updatingFromWebview = false;
          }
          for (const url of this.getAllServerUrls()) {
            if (!this.schemas[url])
              this.schemas[url] = [];
          }
          const devServer = this.getDevServer();
          this.postMessage(webviewPanel, {
            type: "init",
            schemas: this.schemas,
            configs,
            serverStatuses: this.serverStatuses,
            serverNames: this.getServerNames(),
            devServerState: this.devServerState,
            devServerUrl: devServer?.url ?? null
          });
          const docDir = import_node_path3.dirname(document.uri.fsPath);
          const thumbs = {};
          for (const config of configs) {
            for (const val of Object.values(config.params)) {
              if (typeof val === "string" && val && !val.startsWith("http")) {
                const uri = this.imageThumbUri(val, docDir, webviewPanel.webview);
                if (uri)
                  thumbs[val] = uri;
              }
            }
          }
          if (Object.keys(thumbs).length > 0) {
            this.postMessage(webviewPanel, { type: "imageThumbs", thumbs });
          }
          break;
        }
        case "updateState": {
          const configs = this.parseDocument(document);
          const idx = configs.findIndex((c) => c.id === msg.configId);
          if (idx >= 0) {
            configs[idx] = {
              ...configs[idx],
              params: { ...configs[idx].params, [msg.paramName]: msg.value }
            };
            updatingFromWebview = true;
            await this.writeDocument(document, configs);
            updatingFromWebview = false;
          }
          break;
        }
        case "generateRequest": {
          const { requestId, configId, service, pipeline, params } = msg;
          const handleComplete = async (response) => {
            if (response.status === "completed") {
              for (const output of response.outputs) {
                output.url = await this.saveAsset(output.url, document.uri, output.format ?? "png", webviewPanel);
              }
              const meta = response.outputs[0]?.metadata;
              if (meta?.seed != null) {
                const configs = this.parseDocument(document);
                const idx = configs.findIndex((c) => c.id === configId);
                if (idx >= 0) {
                  configs[idx] = {
                    ...configs[idx],
                    params: { ...configs[idx].params, seed: meta.seed }
                  };
                  updatingFromWebview = true;
                  await this.writeDocument(document, configs);
                  updatingFromWebview = false;
                  postConfigs();
                }
              }
            }
            this.postMessage(webviewPanel, {
              type: "generateResult",
              requestId,
              configId,
              service,
              pipeline,
              response
            });
          };
          try {
            const response = await this.doGenerate(service, pipeline, params, document.uri);
            if (response.status === "running" || response.status === "queued") {
              pollUntilDone(service, pipeline, response.runId, (progress) => {
                this.postMessage(webviewPanel, {
                  type: "generateProgress",
                  requestId,
                  configId,
                  service,
                  pipeline,
                  progress
                });
              }).then(handleComplete).catch((err) => {
                this.postMessage(webviewPanel, {
                  type: "generateResult",
                  requestId,
                  configId,
                  service,
                  pipeline,
                  error: err instanceof Error ? err.message : String(err)
                });
              });
            } else {
              await handleComplete(response);
            }
          } catch (err) {
            this.postMessage(webviewPanel, {
              type: "generateResult",
              requestId,
              configId,
              service,
              pipeline,
              error: err instanceof Error ? err.message : String(err)
            });
          }
          break;
        }
        case "refreshSchemas": {
          for (const url of this.getAllServerUrls()) {
            this.refreshSchemas(url);
          }
          break;
        }
        case "selectConfig": {
          this.context.workspaceState.update(`focusIndex:${document.uri.toString()}`, msg.index);
          break;
        }
        case "pickImage": {
          const { requestId, configId, service, pipeline, paramName } = msg;
          try {
            const docDir = import_node_path3.dirname(document.uri.fsPath);
            const pickedPath = await this.pickImageWithFileBrowser(docDir);
            const thumbUri = pickedPath ? this.imageThumbUri(pickedPath, docDir, webviewPanel.webview) : undefined;
            this.postMessage(webviewPanel, {
              type: "imagePicked",
              requestId,
              configId,
              service,
              pipeline,
              paramName,
              url: pickedPath,
              thumbnailUri: thumbUri
            });
          } catch (err) {
            this.postMessage(webviewPanel, {
              type: "imagePicked",
              requestId,
              configId,
              service,
              pipeline,
              paramName,
              error: err instanceof Error ? err.message : String(err)
            });
          }
          break;
        }
        case "pickImageByUri": {
          const { requestId, configId, service, pipeline, paramName, uri } = msg;
          try {
            const docDir = import_node_path3.dirname(document.uri.fsPath);
            const fsPath = vscode3.Uri.parse(uri).fsPath;
            const rel = import_node_path3.relative(docDir, fsPath);
            const relPath = rel.startsWith(".") ? rel : `./${rel}`;
            const thumbUri = this.imageThumbUri(relPath, docDir, webviewPanel.webview);
            this.postMessage(webviewPanel, {
              type: "imagePicked",
              requestId,
              configId,
              service,
              pipeline,
              paramName,
              url: relPath,
              thumbnailUri: thumbUri
            });
          } catch (err) {
            this.postMessage(webviewPanel, {
              type: "imagePicked",
              requestId,
              configId,
              service,
              pipeline,
              paramName,
              error: err instanceof Error ? err.message : String(err)
            });
          }
          break;
        }
        case "addConfig": {
          const configs = this.parseDocument(document);
          configs.push(msg.config);
          updatingFromWebview = true;
          await this.writeDocument(document, configs);
          updatingFromWebview = false;
          break;
        }
        case "updateName": {
          const configs = this.parseDocument(document);
          const idx = configs.findIndex((c) => c.id === msg.configId);
          if (idx >= 0) {
            configs[idx] = { ...configs[idx], name: msg.name };
            updatingFromWebview = true;
            await this.writeDocument(document, configs);
            updatingFromWebview = false;
          }
          break;
        }
        case "startDevServer":
          this.onDevServerCommand?.("start");
          break;
        case "stopDevServer":
          this.onDevServerCommand?.("stop");
          break;
      }
    });
    const changeListener = vscode3.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() === document.uri.toString()) {
        postConfigs();
      }
    });
    const configListener = vscode3.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("lumen.servers")) {
        for (const url of this.getAllServerUrls()) {
          if (!this.schemas[url]) {
            this.refreshSchemas(url);
          }
        }
      }
    });
    const distPath = import_node_path3.join(this.context.extensionPath, "dist", "webview");
    const distWatcher = vscode3.workspace.createFileSystemWatcher(import_node_path3.join(distPath, "**/*"));
    const distListener = distWatcher.onDidChange(() => {
      webviewPanel.webview.html = this.getHtml(webviewPanel.webview);
    });
    webviewPanel.onDidDispose(() => {
      this.panels.delete(webviewPanel);
      changeListener.dispose();
      configListener.dispose();
      distListener.dispose();
      distWatcher.dispose();
      if (this.panels.size === 0)
        this.stopHealthPolling();
    });
  }
  startHealthPolling() {
    if (this.healthTimer)
      return;
    this.pollHealth();
    this.healthTimer = setInterval(() => this.pollHealth(), HEALTH_POLL_MS);
  }
  stopHealthPolling() {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }
  async pollHealth() {
    for (const url of this.getAllServerUrls()) {
      if (url.startsWith("provider://"))
        continue;
      const prev = this.serverStatuses[url];
      try {
        const res = await fetch(`${url}/pipelines`, {
          signal: AbortSignal.timeout(5000)
        });
        if (res.ok) {
          this.serverStatuses[url] = "connected";
          if (prev !== "connected")
            this.refreshSchemas(url);
        } else {
          this.serverStatuses[url] = "error";
        }
      } catch {
        this.serverStatuses[url] = "disconnected";
      }
      if (this.serverStatuses[url] !== prev) {
        this.broadcastToAll({
          type: "serverStatus",
          serverUrl: url,
          status: this.serverStatuses[url]
        });
      }
    }
  }
  async refreshSchemas(serverUrl) {
    if (serverUrl === FAL_PROVIDER_URL) {
      this.schemas[serverUrl] = falPipelines;
      this.serverStatuses[serverUrl] = "connected";
      this.broadcastToAll({
        type: "schemaRefresh",
        serverUrl,
        pipelines: falPipelines
      });
      this.broadcastToAll({
        type: "serverStatus",
        serverUrl,
        status: "connected"
      });
      return;
    }
    try {
      const pipelines = await fetchPipelines(serverUrl);
      this.schemas[serverUrl] = pipelines;
      this.serverStatuses[serverUrl] = "connected";
      this.broadcastToAll({ type: "schemaRefresh", serverUrl, pipelines });
      this.broadcastToAll({
        type: "serverStatus",
        serverUrl,
        status: "connected"
      });
    } catch (err) {
      log.appendLine(`[schema] Failed to fetch from ${serverUrl}: ${err}`);
      this.serverStatuses[serverUrl] = "error";
      this.schemas[serverUrl] = [];
      this.broadcastToAll({ type: "serverStatus", serverUrl, status: "error" });
    }
  }
  async doGenerate(serverUrl, pipelineId, params, documentUri) {
    if (serverUrl === FAL_PROVIDER_URL) {
      if (!this.falApiKey)
        throw new Error("fal.ai API key not set. Run 'Lumen: Set fal.ai API Key'.");
      const resolved = { ...params };
      const imageVal = resolved.image_urls;
      if (imageVal && !imageVal.startsWith("http")) {
        const absPath = import_node_path3.resolve(import_node_path3.dirname(documentUri.fsPath), imageVal);
        if (!import_node_fs3.existsSync(absPath))
          throw new Error(`Reference image not found: ${imageVal}`);
        resolved.image_urls = await uploadImage(this.falApiKey, absPath, this.context.globalState);
      }
      return generate2(this.falApiKey, pipelineId, resolved);
    }
    return generate(serverUrl, pipelineId, params);
  }
  ensureIds(configs) {
    let assigned = false;
    for (const config of configs) {
      if (!config.id) {
        config.id = crypto.randomUUID();
        assigned = true;
      }
    }
    return assigned;
  }
  parseDocument(document) {
    const text = document.getText().trim();
    if (!text || text === "[]" || text === "{}")
      return [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed))
        return parsed;
      if (typeof parsed === "object" && parsed !== null) {
        return this.migrateOldFormat(parsed);
      }
      return [];
    } catch {
      return [];
    }
  }
  migrateOldFormat(raw) {
    const configs = [];
    for (const [key, value] of Object.entries(raw)) {
      if (key.startsWith("_") || typeof value !== "object" || value === null)
        continue;
      const pipelines = value;
      for (const [pipelineId, params] of Object.entries(pipelines)) {
        if (typeof params !== "object" || params === null)
          continue;
        configs.push({
          id: crypto.randomUUID(),
          service: key,
          pipeline: pipelineId,
          params
        });
      }
    }
    return configs;
  }
  async writeDocument(document, configs) {
    const text = JSON.stringify(configs, null, 2) + `
`;
    const edit = new vscode3.WorkspaceEdit;
    edit.replace(document.uri, new vscode3.Range(0, 0, document.lineCount, 0), text);
    await vscode3.workspace.applyEdit(edit);
  }
  pickImageWithFileBrowser(docDir) {
    const IMAGE_EXT = /\.(png|jpg|jpeg|webp|gif)$/i;
    return new Promise((resolve2) => {
      let currentDir = docDir;
      let settled = false;
      const done = (path) => {
        if (settled)
          return;
        settled = true;
        resolve2(path);
      };
      const buildItems = () => {
        const items = [
          { label: "$(arrow-up) ../", alwaysShow: true, dirName: ".." }
        ];
        try {
          const entries = import_node_fs3.readdirSync(currentDir, { withFileTypes: true }).filter((e) => !e.name.startsWith(".")).sort((a, b) => {
            if (a.isDirectory() !== b.isDirectory())
              return a.isDirectory() ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              items.push({
                label: `$(folder) ${entry.name}`,
                alwaysShow: true,
                dirName: entry.name
              });
            } else if (IMAGE_EXT.test(entry.name)) {
              const abs = import_node_path3.join(currentDir, entry.name);
              const rel = import_node_path3.relative(docDir, abs);
              const norm = rel.startsWith(".") ? rel : `./${rel}`;
              items.push({
                label: entry.name,
                description: norm,
                alwaysShow: true,
                imagePath: norm
              });
            }
          }
        } catch {}
        return items;
      };
      const qp = vscode3.window.createQuickPick();
      qp.title = "Pick reference image";
      const navigateTo = (dir) => {
        currentDir = dir;
        const rel = import_node_path3.relative(docDir, dir);
        qp.placeholder = (rel || ".") + "/";
        qp.value = "";
        qp.items = buildItems();
      };
      qp.onDidAccept(() => {
        const item = qp.activeItems[0];
        if (!item)
          return;
        if (item.dirName) {
          navigateTo(import_node_path3.join(currentDir, item.dirName));
        } else if (item.imagePath) {
          done(item.imagePath);
          qp.hide();
        }
      });
      qp.onDidHide(() => {
        done(undefined);
        qp.dispose();
      });
      navigateTo(docDir);
      qp.show();
    });
  }
  imageThumbUri(relPath, docDir, webview) {
    if (!relPath || relPath.startsWith("http"))
      return;
    const absPath = import_node_path3.resolve(docDir, relPath);
    if (!import_node_fs3.existsSync(absPath))
      return;
    return webview.asWebviewUri(vscode3.Uri.file(absPath)).toString();
  }
  postMessage(panel, message) {
    panel.webview.postMessage(message);
  }
  broadcastToAll(message) {
    for (const panel of this.panels) {
      this.postMessage(panel, message);
    }
  }
  async saveAsset(url, documentUri, format, panel) {
    const dir = import_node_path3.dirname(documentUri.fsPath);
    const base = import_node_path3.basename(documentUri.fsPath, ".lumen");
    const now = new Date;
    const pad = (n) => String(n).padStart(2, "0");
    const timestamp = `${String(now.getFullYear()).slice(2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filePath = import_node_path3.join(dir, `${base}-${timestamp}.${format}`);
    let buffer;
    if (url.startsWith("data:")) {
      const base64 = url.split(",")[1];
      buffer = Buffer.from(base64, "base64");
    } else {
      const res = await fetch(url);
      if (!res.ok)
        throw new Error(`Failed to download asset: ${res.status}`);
      buffer = Buffer.from(await res.arrayBuffer());
    }
    import_node_fs3.writeFileSync(filePath, buffer);
    log.appendLine(`[asset] Saved ${filePath}`);
    const webviewUri = panel.webview.asWebviewUri(vscode3.Uri.file(filePath));
    return webviewUri.toString();
  }
  getHtml(webview) {
    const distPath = import_node_path3.join(this.context.extensionPath, "dist", "webview");
    let html;
    try {
      html = import_node_fs3.readFileSync(import_node_path3.join(distPath, "index.html"), "utf-8");
    } catch {
      return "<html><body><p>Webview not built. Run <code>bun run build</code>.</p></body></html>";
    }
    const baseUri = webview.asWebviewUri(vscode3.Uri.file(distPath));
    html = html.replace(/(href|src)="\.?\/?/g, `$1="${baseUri.toString()}/`);
    html = html.replace(/ crossorigin/g, "");
    html = html.replace(' type="module"', " defer");
    log.appendLine(`[html] ${html.substring(0, 600)}`);
    return html;
  }
}

// src/extension.ts
function activeDocumentUri() {
  const textUri = vscode4.window.activeTextEditor?.document.uri;
  if (textUri)
    return textUri;
  const tab = vscode4.window.tabGroups.activeTabGroup.activeTab;
  if (tab?.input instanceof vscode4.TabInputCustom)
    return tab.input.uri;
  return;
}
function devSourcePath() {
  return getServers().find((s) => s.source)?.source ?? "";
}
function activate(context) {
  const output = vscode4.window.createOutputChannel("Lumen Server");
  const provider = new LumenEditorProvider(context);
  const serverManager = new ServerManager(output, () => {
    provider.onDevServerStateChange(serverManager.getState(devSourcePath()));
  });
  const initialSource = devSourcePath();
  if (initialSource) {
    provider.onDevServerStateChange(serverManager.getState(initialSource));
  }
  provider.refreshFalApiKey();
  context.subscriptions.push(LumenEditorProvider.register(provider), vscode4.commands.registerCommand("lumen.openPreview", () => {
    const uri = vscode4.window.activeTextEditor?.document.uri;
    if (!uri)
      return;
    vscode4.commands.executeCommand("vscode.openWith", uri, "lumen.stateViewer");
  }), vscode4.commands.registerCommand("lumen.openAsJson", () => {
    const uri = activeDocumentUri();
    if (!uri)
      return;
    vscode4.commands.executeCommand("vscode.openWith", uri, "default");
  }), vscode4.commands.registerCommand("lumen.startServer", () => serverManager.start(devSourcePath())), vscode4.commands.registerCommand("lumen.stopServer", () => serverManager.stop(devSourcePath())), vscode4.commands.registerCommand("lumen.setFalApiKey", async () => {
    const set = await promptAndStoreApiKey(context.secrets);
    if (set)
      await provider.refreshFalApiKey();
  }), output);
  provider.onDevServerCommand = (cmd) => {
    const source = devSourcePath();
    if (cmd === "start")
      serverManager.start(source);
    else
      serverManager.stop(source);
  };
}
function deactivate() {}

//# debugId=EE196DF14CE80CB964756E2164756E21
//# sourceMappingURL=extension.js.map
