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
var vscode6 = __toESM(require("vscode"));

// src/provider.ts
var import_node_fs6 = require("node:fs");
var import_node_path6 = require("node:path");
var vscode5 = __toESM(require("vscode"));

// ../lumen/domain/generation.ts
var POLL_INTERVAL_MS = 1500;
var MAX_POLL_ATTEMPTS = 200;
var MAX_CONSECUTIVE_ERRORS = 3;
async function pollUntilDone(provider, pipelineId, runId, onProgress) {
  let consecutiveErrors = 0;
  for (let i = 0;i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    let status;
    try {
      status = await provider.pollRun(pipelineId, runId);
      consecutiveErrors = 0;
    } catch (err) {
      consecutiveErrors++;
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          status: "failed",
          runId,
          error: { code: "POLL_ERROR", message: msg }
        };
      }
      continue;
    }
    if (status.status === "queued") {
      onProgress?.({ progress: 0, stage: "queued" });
      continue;
    }
    if (status.status === "running") {
      onProgress?.({ progress: status.progress ?? 0, stage: "running" });
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

// ../lumen/services/editor.ts
function editorService(ports) {
  const { providers, assets, logger } = ports;
  async function refreshSchemas(serviceUrl, schemas, statuses) {
    const provider = providers[serviceUrl];
    if (!provider) {
      return { schemas, statuses };
    }
    try {
      const pipelines = await provider.fetchSchemas();
      return {
        schemas: { ...schemas, [serviceUrl]: pipelines },
        statuses: { ...statuses, [serviceUrl]: "connected" }
      };
    } catch (err) {
      logger.error(`[schema] Failed to fetch from ${serviceUrl}: ${err}`);
      return {
        schemas: { ...schemas, [serviceUrl]: [] },
        statuses: { ...statuses, [serviceUrl]: "error" }
      };
    }
  }
  async function refreshAllSchemas(serviceUrls, schemas, statuses) {
    let s = schemas;
    let st = statuses;
    for (const url of serviceUrls) {
      const result = await refreshSchemas(url, s, st);
      s = result.schemas;
      st = result.statuses;
    }
    return { schemas: s, statuses: st };
  }
  async function generate(serviceUrl, pipelineId, params, documentUri, onProgress) {
    const provider = providers[serviceUrl];
    if (!provider) {
      return {
        status: "failed",
        runId: "",
        error: {
          code: "NO_PROVIDER",
          message: `No provider for ${serviceUrl}`
        }
      };
    }
    let response = await provider.generate(pipelineId, params);
    if (response.status === "running" || response.status === "queued") {
      response = await pollUntilDone(provider, pipelineId, response.runId, onProgress);
    }
    if (response.status === "completed") {
      for (const output of response.outputs) {
        output.url = await assets.save(output.url, documentUri, output.format ?? "png");
      }
    }
    return response;
  }
  return { refreshSchemas, refreshAllSchemas, generate };
}

// src/adapters/vscode-assets.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
function vscodeAssetStore(deps) {
  return {
    async save(url, documentUri, format) {
      const dir = import_node_path.dirname(documentUri);
      const base = import_node_path.basename(documentUri, ".lumen");
      const now = new Date;
      const pad = (n) => String(n).padStart(2, "0");
      const timestamp = `${String(now.getFullYear()).slice(2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const filePath = import_node_path.join(dir, `${base}-${timestamp}.${format}`);
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
      import_node_fs.writeFileSync(filePath, buffer);
      deps.logger.info(`[asset] Saved ${filePath}`);
      return deps.toWebviewUri(filePath);
    }
  };
}

// src/adapters/vscode-logger.ts
var import_node_fs2 = require("node:fs");
function vscodeLogger(channel) {
  return {
    info(message) {
      channel.appendLine(message);
    },
    error(message) {
      channel.appendLine(`[ERROR] ${message}`);
    }
  };
}
var ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]|\x1b].*?\x07/g;
function fileLogger(getPath) {
  return {
    append(text) {
      const path = getPath();
      if (!path)
        return;
      try {
        import_node_fs2.appendFileSync(path, text.replace(ANSI_RE, ""));
      } catch {}
    }
  };
}

// src/document.ts
var vscode = __toESM(require("vscode"));

// ../lumen/domain/config.ts
function parseConfigs(text) {
  const trimmed = text.trim();
  if (!trimmed || trimmed === "[]" || trimmed === "{}")
    return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed))
      return parsed;
    if (typeof parsed === "object" && parsed !== null) {
      return migrateOldFormat(parsed);
    }
    return [];
  } catch {
    return [];
  }
}
function serializeConfigs(configs) {
  return JSON.stringify(configs, null, 2) + `
`;
}
function ensureIds(configs) {
  let assigned = false;
  const existingIds = new Set(configs.map((c) => c.id).filter(Boolean));
  for (const config of configs) {
    if (!config.id) {
      config.id = generateSlugId(config.pipeline, existingIds);
      existingIds.add(config.id);
      assigned = true;
    }
  }
  return assigned;
}
function generateSlugId(base, existingIds) {
  const slug = toKebab(base);
  if (!existingIds.has(slug))
    return slug;
  for (let i = 2;; i++) {
    const candidate = `${slug}-${i}`;
    if (!existingIds.has(candidate))
      return candidate;
  }
}
function toKebab(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function migrateOldFormat(raw) {
  const configs = [];
  const existingIds = new Set;
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith("_") || typeof value !== "object" || value === null)
      continue;
    const pipelines = value;
    for (const [pipelineId, params] of Object.entries(pipelines)) {
      if (typeof params !== "object" || params === null)
        continue;
      const id = generateSlugId(pipelineId, existingIds);
      existingIds.add(id);
      configs.push({
        id,
        service: key,
        pipeline: pipelineId,
        params
      });
    }
  }
  return configs;
}

// src/document.ts
class DocumentBridge {
  updating = false;
  get isUpdating() {
    return this.updating;
  }
  read(document) {
    return parseConfigs(document.getText());
  }
  async write(document, configs) {
    const text = serializeConfigs(configs);
    const edit = new vscode.WorkspaceEdit;
    edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), text);
    this.updating = true;
    try {
      await vscode.workspace.applyEdit(edit);
    } finally {
      this.updating = false;
    }
  }
}

// src/connection.ts
var import_node_fs4 = require("node:fs");
var import_node_path3 = require("node:path");

// src/adapters/http-provider.ts
var RECONNECT_MS = 3000;
function parseSSEFrame(frame) {
  let event = "message";
  const dataLines = [];
  for (const line of frame.split(`
`)) {
    if (line.startsWith("event:"))
      event = line.slice(6).trim();
    else if (line.startsWith("data:"))
      dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0)
    return null;
  return { event, data: dataLines.join(`
`) };
}
function httpProvider(serverUrl, authKey) {
  const authHeaders = authKey ? { Authorization: `Bearer ${authKey}` } : {};
  return {
    async ping() {
      const res = await fetch(`${serverUrl}/pipelines`, {
        headers: authHeaders
      });
      if (!res.ok)
        throw new Error(`GET /pipelines failed: ${res.status}`);
    },
    subscribe(callbacks) {
      let abortController = new AbortController;
      let disposed = false;
      let reconnectTimer = null;
      const scheduleReconnect = () => {
        if (disposed)
          return;
        reconnectTimer = setTimeout(() => {
          abortController = new AbortController;
          connect();
        }, RECONNECT_MS);
      };
      const connect = async () => {
        if (disposed)
          return;
        try {
          const res = await fetch(`${serverUrl}/pipelines/events`, {
            signal: abortController.signal,
            headers: { Accept: "text/event-stream", ...authHeaders }
          });
          if (!res.ok || !res.body) {
            callbacks.onStatus("disconnected");
            scheduleReconnect();
            return;
          }
          callbacks.onStatus("connected");
          const reader = res.body.getReader();
          const decoder = new TextDecoder;
          let buffer = "";
          for (;; ) {
            const { done, value } = await reader.read();
            if (done)
              break;
            buffer += decoder.decode(value, { stream: true });
            const frames = buffer.split(`

`);
            buffer = frames.pop() ?? "";
            for (const frame of frames) {
              const parsed = parseSSEFrame(frame);
              if (parsed?.event === "schemas") {
                callbacks.onSchemas(JSON.parse(parsed.data));
              }
            }
          }
          if (!disposed) {
            callbacks.onStatus("disconnected");
            scheduleReconnect();
          }
        } catch (err) {
          if (disposed)
            return;
          if (err instanceof DOMException && err.name === "AbortError")
            return;
          callbacks.onStatus("disconnected");
          scheduleReconnect();
        }
      };
      connect();
      return () => {
        disposed = true;
        abortController.abort();
        if (reconnectTimer)
          clearTimeout(reconnectTimer);
      };
    },
    async fetchSchemas() {
      const res = await fetch(`${serverUrl}/pipelines`, {
        headers: authHeaders
      });
      if (!res.ok)
        throw new Error(`GET /pipelines failed: ${res.status}`);
      return await res.json();
    },
    async generate(pipelineId, params) {
      const res = await fetch(`${serverUrl}/pipelines/${pipelineId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(params)
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`POST /pipelines/${pipelineId}/generate failed: ${res.status} ${text}`);
      }
      return await res.json();
    },
    async pollRun(pipelineId, runId) {
      const res = await fetch(`${serverUrl}/pipelines/${pipelineId}/runs/${runId}`, { headers: authHeaders });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`GET /runs/${runId} failed: ${res.status} ${text}`);
      }
      return await res.json();
    }
  };
}

// src/server.ts
var import_node_crypto = require("node:crypto");
var import_node_fs3 = require("node:fs");
var import_node_path2 = require("node:path");
var import_node_child_process = require("node:child_process");
var vscode2 = __toESM(require("vscode"));
function getServerSource() {
  const raw = vscode2.workspace.getConfiguration("lumen").get("server", "lumen-server");
  const root = vscode2.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
  return raw.replace(/\$\{workspaceFolder\}/g, root);
}
function authKeyFile(serverPath) {
  return import_node_path2.join(serverPath, ".authkey");
}
function ensureAuthKey(serverPath) {
  const file = authKeyFile(serverPath);
  if (import_node_fs3.existsSync(file)) {
    return import_node_fs3.readFileSync(file, "utf-8").trim();
  }
  const key = import_node_crypto.randomBytes(32).toString("hex");
  import_node_fs3.writeFileSync(file, key + `
`);
  return key;
}
function readAuthKey(serverPath) {
  const file = authKeyFile(serverPath);
  if (!import_node_fs3.existsSync(file))
    return null;
  const key = import_node_fs3.readFileSync(file, "utf-8").trim();
  return key || null;
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
  if (!import_node_fs3.existsSync(file))
    return null;
  const pid = parseInt(import_node_fs3.readFileSync(file, "utf-8").trim(), 10);
  if (isNaN(pid) || !isAlive(pid)) {
    try {
      import_node_fs3.unlinkSync(file);
    } catch {}
    return null;
  }
  return pid;
}
var REBUILD_START = /Creating objects|Initializing|Building image/;
var REBUILD_DONE = /Created web function serve|Serving app/;
var MODAL_URL_RE = /https:\/\/\S+\.modal\.run/;

class ServerManager {
  output;
  onChange;
  onLog;
  onUrl;
  trackedState = "stopped";
  constructor(output, onChange, onLog, onUrl) {
    this.output = output;
    this.onChange = onChange;
    this.onLog = onLog;
    this.onUrl = onUrl;
  }
  getState(sourcePath) {
    if (!sourcePath)
      return "stopped";
    if (this.trackedState !== "stopped")
      return this.trackedState;
    return readPid(sourcePath) !== null ? "running" : "stopped";
  }
  setState(state) {
    if (this.trackedState === state)
      return;
    this.trackedState = state;
    this.onChange();
  }
  start(sourcePath) {
    if (!sourcePath) {
      vscode2.window.showErrorMessage("No lumen.server configured");
      return;
    }
    if (readPid(sourcePath) !== null) {
      vscode2.window.showWarningMessage("Dev server is already running");
      return;
    }
    ensureAuthKey(sourcePath);
    this.output.appendLine(`[dev] Syncing deps and starting server in ${sourcePath}`);
    this.output.show(true);
    this.setState("starting");
    const shell = process.env.SHELL || "/bin/zsh";
    const child = import_node_child_process.spawn(shell, ["-l", "-c", "uv sync && exec bun dev"], {
      cwd: sourcePath,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true
    });
    if (child.pid) {
      import_node_fs3.writeFileSync(pidFile(sourcePath), String(child.pid));
    }
    const handleOutput = (chunk) => {
      const text = chunk.toString();
      this.output.append(text);
      this.onLog(text);
      const urlMatch = text.match(MODAL_URL_RE);
      if (urlMatch)
        this.onUrl(sourcePath, urlMatch[0]);
      if (REBUILD_DONE.test(text)) {
        this.setState("running");
      } else if (REBUILD_START.test(text)) {
        this.setState("rebuilding");
      }
    };
    child.stdout?.on("data", handleOutput);
    child.stderr?.on("data", handleOutput);
    child.on("close", (code) => {
      this.output.appendLine(`[dev] Exited with code ${code}`);
      try {
        import_node_fs3.unlinkSync(pidFile(sourcePath));
      } catch {}
      this.setState("stopped");
    });
    child.on("error", (err) => {
      this.output.appendLine(`[dev] Error: ${err.message}`);
      try {
        import_node_fs3.unlinkSync(pidFile(sourcePath));
      } catch {}
      this.setState("error");
    });
    child.unref();
  }
  sendSignal(pid, sig) {
    try {
      process.kill(-pid, sig);
    } catch {
      try {
        process.kill(pid, sig);
      } catch {}
    }
  }
  killProcess(pid) {
    this.sendSignal(pid, "SIGINT");
    return new Promise((resolve) => {
      let elapsed = 0;
      const interval = setInterval(() => {
        elapsed += 500;
        if (!isAlive(pid)) {
          clearInterval(interval);
          resolve();
          return;
        }
        if (elapsed === 4000)
          this.sendSignal(pid, "SIGTERM");
        if (elapsed === 8000)
          this.sendSignal(pid, "SIGKILL");
        if (elapsed >= 1e4) {
          clearInterval(interval);
          this.output.appendLine(`[dev] PID ${pid} did not exit after 10s`);
          resolve();
        }
      }, 500);
    });
  }
  async stop(sourcePath) {
    if (!sourcePath)
      return;
    const pid = readPid(sourcePath);
    if (pid === null) {
      vscode2.window.showWarningMessage("Dev server is not running");
      return;
    }
    this.output.appendLine(`[dev] Stopping PID ${pid}`);
    try {
      import_node_fs3.unlinkSync(pidFile(sourcePath));
    } catch {}
    this.setState("stopping");
    await this.killProcess(pid);
    this.setState("stopped");
    this.output.appendLine("[dev] Process stopped");
  }
  async restart(sourcePath) {
    if (!sourcePath)
      return;
    const pid = readPid(sourcePath);
    if (pid !== null) {
      this.output.appendLine(`[dev] Restarting — stopping PID ${pid}`);
      try {
        import_node_fs3.unlinkSync(pidFile(sourcePath));
      } catch {}
      this.setState("stopping");
      await this.killProcess(pid);
      this.output.appendLine("[dev] Old process stopped");
    }
    this.setState("stopped");
    this.start(sourcePath);
  }
}

// src/connection.ts
class ServerConnection {
  events;
  log;
  fileLog;
  getServerSource;
  providers = {};
  schemas = {};
  statuses = {};
  devServerState = "stopped";
  service = null;
  detectedUrl = null;
  subscriptions = new Map;
  constructor(events, log, fileLog, getServerSource2) {
    this.events = events;
    this.log = log;
    this.fileLog = fileLog;
    this.getServerSource = getServerSource2;
    this.loadCachedSchemas();
  }
  setService(service) {
    this.service = service;
  }
  get serverUrl() {
    return this.detectedUrl;
  }
  onUrlDetected(_source, url) {
    this.detectedUrl = url;
    this.log.info(`[modal] detected URL: ${url}`);
  }
  onDevServerStateChange(state) {
    const url = this.detectedUrl;
    if (state === "stopped" && url && this.statuses[url] === "connected") {
      this.devServerState = "orphaned";
      this.events.devServerStateChanged("orphaned");
    } else {
      this.devServerState = state;
      this.events.devServerStateChanged(state);
    }
    if (state === "running") {
      this.unsubscribeAll();
      this.rebuildProviders();
      this.subscribeAll();
    }
  }
  rebuildProviders() {
    for (const key of Object.keys(this.providers)) {
      delete this.providers[key];
    }
    if (this.detectedUrl) {
      const authKey = readAuthKey(this.getServerSource()) ?? undefined;
      this.providers[this.detectedUrl] = httpProvider(this.detectedUrl, authKey);
    }
  }
  subscribeAll() {
    const url = this.detectedUrl;
    if (url)
      this.subscribeTo(url);
  }
  subscribeTo(url) {
    if (this.subscriptions.has(url))
      return;
    const provider = this.providers[url];
    if (!provider)
      return;
    if (provider.subscribe) {
      this.log.info(`[sse] subscribing to ${url}`);
      const dispose = provider.subscribe({
        onSchemas: (schemas) => {
          const ids = schemas.map((s) => s.id).join(", ");
          this.log.info(`[sse] ${url} schemas: ${ids}`);
          this.fileLog.append(`[sse] ${url} schemas: ${ids}
`);
          this.schemas[url] = schemas;
          this.writeSchemaFile(url);
          this.events.schemasChanged(url, schemas);
        },
        onStatus: (status) => {
          this.log.info(`[sse] ${url} ${status}`);
          this.fileLog.append(`[sse] ${url} ${status}
`);
          this.statuses[url] = status;
          this.events.serverStatusChanged(url, status);
          this.detectOrphan(status);
        }
      });
      this.subscriptions.set(url, dispose);
    } else {
      this.refreshSchemas(url);
    }
  }
  unsubscribeAll() {
    for (const dispose of this.subscriptions.values())
      dispose();
    this.subscriptions.clear();
  }
  async refreshSchemas(serverUrl) {
    if (!this.service)
      return;
    const result = await this.service.refreshSchemas(serverUrl, this.schemas, this.statuses);
    this.schemas = result.schemas;
    this.statuses = result.statuses;
    this.writeSchemaFile(serverUrl);
    this.events.schemasChanged(serverUrl, this.schemas[serverUrl] ?? []);
    this.events.serverStatusChanged(serverUrl, this.statuses[serverUrl]);
  }
  detectOrphan(status) {
    if (status === "connected" && this.devServerState === "stopped") {
      this.devServerState = "orphaned";
      this.events.devServerStateChanged("orphaned");
    } else if (status === "disconnected" && this.devServerState === "orphaned") {
      this.devServerState = "stopped";
      this.events.devServerStateChanged("stopped");
    }
  }
  loadCachedSchemas() {
    if (Object.keys(this.schemas).length > 0)
      return;
    const source = this.getServerSource();
    if (!source)
      return;
    const file = import_node_path3.join(source, "lumen.schema.json");
    if (!import_node_fs4.existsSync(file))
      return;
    try {
      const data = JSON.parse(import_node_fs4.readFileSync(file, "utf-8"));
      if (Array.isArray(data) && data.length > 0) {
        const key = "_cached";
        this.schemas[key] = data;
      }
    } catch {}
  }
  writeSchemaFile(serverUrl) {
    const source = this.getServerSource();
    if (!source)
      return;
    const dest = import_node_path3.join(source, "lumen.schema.json");
    try {
      const schemas = this.schemas[serverUrl] ?? [];
      import_node_fs4.writeFileSync(dest, JSON.stringify(schemas, null, 2) + `
`);
    } catch {}
  }
}

// src/handlers.ts
var import_node_path5 = require("node:path");
var vscode4 = __toESM(require("vscode"));

// src/adapters/vscode-images.ts
var import_node_fs5 = require("node:fs");
var import_node_path4 = require("node:path");
var vscode3 = __toESM(require("vscode"));
function resolveImageParams(schemas, service, pipelineId, params, docDir) {
  const schema = schemas[service]?.find((p) => p.id === pipelineId);
  if (!schema)
    return params;
  const resolved = { ...params };
  for (const param of schema.params) {
    if (param.type !== "image")
      continue;
    const val = resolved[param.name];
    if (typeof val !== "string" || !val)
      continue;
    if (val.startsWith("http") || val.startsWith("data:"))
      continue;
    const absPath = import_node_path4.resolve(docDir, val);
    if (!import_node_fs5.existsSync(absPath))
      continue;
    const bytes = import_node_fs5.readFileSync(absPath);
    const ext = absPath.split(".").pop()?.toLowerCase() ?? "png";
    const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
    resolved[param.name] = `data:${mime};base64,${bytes.toString("base64")}`;
  }
  return resolved;
}
function imageThumbUri(relPath, docDir, webview) {
  if (!relPath || relPath.startsWith("http"))
    return;
  const absPath = import_node_path4.resolve(docDir, relPath);
  if (!import_node_fs5.existsSync(absPath))
    return;
  return webview.asWebviewUri(vscode3.Uri.file(absPath)).toString();
}
function collectThumbs(configs, docDir, webview) {
  const thumbs = {};
  for (const config of configs) {
    for (const val of Object.values(config.params)) {
      if (typeof val === "string" && val && !val.startsWith("http")) {
        const uri = imageThumbUri(val, docDir, webview);
        if (uri)
          thumbs[val] = uri;
      }
    }
  }
  return thumbs;
}
function pickImage(docDir) {
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
        const entries = import_node_fs5.readdirSync(currentDir, { withFileTypes: true }).filter((e) => !e.name.startsWith(".")).sort((a, b) => {
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
            const abs = import_node_path4.join(currentDir, entry.name);
            const rel = import_node_path4.relative(docDir, abs);
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
      const rel = import_node_path4.relative(docDir, dir);
      qp.placeholder = (rel || ".") + "/";
      qp.value = "";
      qp.items = buildItems();
    };
    qp.onDidAccept(() => {
      const item = qp.activeItems[0];
      if (!item)
        return;
      if (item.dirName) {
        navigateTo(import_node_path4.join(currentDir, item.dirName));
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

// src/handlers.ts
async function handleMessage(ctx, msg) {
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
async function handleReady(ctx) {
  const { document, panel, bridge, connection } = ctx;
  const configs = bridge.read(document);
  if (ensureIds(configs)) {
    await bridge.write(document, configs);
  }
  const url = connection.serverUrl;
  if (url && !connection.schemas[url])
    connection.schemas[url] = [];
  ctx.post({
    type: "init",
    schemas: connection.schemas,
    configs,
    serverStatuses: connection.statuses,
    devServerState: connection.devServerState,
    devServerUrl: url
  });
  const bufferedLog = ctx.getDevLogBuffer();
  if (bufferedLog.length > 0) {
    ctx.post({ type: "devServerLog", text: bufferedLog.join(`
`) });
  }
  const docDir = import_node_path5.dirname(document.uri.fsPath);
  const thumbs = collectThumbs(configs, docDir, panel.webview);
  if (Object.keys(thumbs).length > 0) {
    ctx.post({ type: "imageThumbs", thumbs });
  }
}
async function handleUpdateState(ctx, msg) {
  const configs = ctx.bridge.read(ctx.document);
  const idx = configs.findIndex((c) => c.id === msg.configId);
  if (idx >= 0) {
    configs[idx] = {
      ...configs[idx],
      params: { ...configs[idx].params, [msg.paramName]: msg.value }
    };
    await ctx.bridge.write(ctx.document, configs);
  }
}
async function handleGenerate(ctx, msg) {
  const { document, bridge, connection, service } = ctx;
  const { requestId, configId, service: svc, pipeline, params } = msg;
  const docDir = import_node_path5.dirname(document.uri.fsPath);
  const resolved = resolveImageParams(connection.schemas, svc, pipeline, params, docDir);
  try {
    const response = await service.generate(svc, pipeline, resolved, document.uri.fsPath, (info) => {
      ctx.post({
        type: "generateProgress",
        requestId,
        configId,
        service: svc,
        pipeline,
        progress: info.progress,
        stage: info.stage
      });
    });
    if (response.status === "completed") {
      const meta = response.outputs[0]?.metadata;
      if (meta?.seed != null) {
        const configs = bridge.read(document);
        const idx = configs.findIndex((c) => c.id === configId);
        if (idx >= 0) {
          configs[idx] = {
            ...configs[idx],
            params: { ...configs[idx].params, seed: meta.seed }
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
      response
    });
  } catch (err) {
    ctx.post({
      type: "generateResult",
      requestId,
      configId,
      service: svc,
      pipeline,
      error: err instanceof Error ? err.message : String(err)
    });
  }
}
async function handleRefreshSchemas(ctx) {
  const url = ctx.connection.serverUrl;
  if (url)
    ctx.connection.refreshSchemas(url);
}
async function handleSelectConfig(ctx, msg) {
  ctx.context.workspaceState.update(`focusIndex:${ctx.document.uri.toString()}`, msg.index);
}
async function handlePickImage(ctx, msg) {
  const { requestId, configId, service, pipeline, paramName } = msg;
  try {
    const docDir = import_node_path5.dirname(ctx.document.uri.fsPath);
    const pickedPath = await pickImage(docDir);
    const thumbUri = pickedPath ? imageThumbUri(pickedPath, docDir, ctx.panel.webview) : undefined;
    ctx.post({
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
    ctx.post({
      type: "imagePicked",
      requestId,
      configId,
      service,
      pipeline,
      paramName,
      error: err instanceof Error ? err.message : String(err)
    });
  }
}
async function handlePickImageByUri(ctx, msg) {
  const { requestId, configId, service, pipeline, paramName, uri } = msg;
  try {
    const docDir = import_node_path5.dirname(ctx.document.uri.fsPath);
    const fsPath = vscode4.Uri.parse(uri).fsPath;
    const rel = import_node_path5.relative(docDir, fsPath);
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
      thumbnailUri: thumbUri
    });
  } catch (err) {
    ctx.post({
      type: "imagePicked",
      requestId,
      configId,
      service,
      pipeline,
      paramName,
      error: err instanceof Error ? err.message : String(err)
    });
  }
}
async function handleAddConfig(ctx, msg) {
  const configs = ctx.bridge.read(ctx.document);
  configs.push(msg.config);
  await ctx.bridge.write(ctx.document, configs);
}
async function handleRemoveConfig(ctx, msg) {
  const configs = ctx.bridge.read(ctx.document);
  const filtered = configs.filter((c) => c.id !== msg.configId);
  if (filtered.length !== configs.length) {
    await ctx.bridge.write(ctx.document, filtered);
  }
}
async function handleUpdateName(ctx, msg) {
  const configs = ctx.bridge.read(ctx.document);
  const idx = configs.findIndex((c) => c.id === msg.configId);
  if (idx >= 0) {
    configs[idx] = { ...configs[idx], name: msg.name };
    await ctx.bridge.write(ctx.document, configs);
  }
}

// src/provider.ts
class LumenEditorProvider {
  context;
  static viewType = "lumen.stateViewer";
  panels = new Set;
  log;
  fileLog;
  service;
  connection;
  devLogBuffer = [];
  onDevServerCommand = null;
  static register(provider) {
    return vscode5.window.registerCustomEditorProvider(LumenEditorProvider.viewType, provider, { supportsMultipleEditorsPerDocument: false });
  }
  constructor(context) {
    this.context = context;
    this.log = vscode5.window.createOutputChannel("Lumen");
    const logger = vscodeLogger(this.log);
    this.fileLog = fileLogger(() => {
      const p = vscode5.workspace.getConfiguration("lumen").get("logFile");
      if (p)
        return p;
      const source = getServerSource();
      return source ? import_node_path6.join(source, "lumen.log") : undefined;
    });
    const assets = vscodeAssetStore({
      logger,
      toWebviewUri: (filePath) => {
        const panel = this.panels.values().next().value;
        if (!panel)
          return filePath;
        return panel.webview.asWebviewUri(vscode5.Uri.file(filePath)).toString();
      }
    });
    const connectionEvents = {
      schemasChanged: (serverUrl, pipelines) => {
        this.broadcastToAll({
          type: "schemaRefresh",
          serverUrl,
          pipelines
        });
      },
      serverStatusChanged: (serverUrl, status) => {
        this.broadcastToAll({ type: "serverStatus", serverUrl, status });
      },
      devServerStateChanged: (state) => {
        this.broadcastToAll({ type: "devServerStatus", state });
      }
    };
    this.connection = new ServerConnection(connectionEvents, logger, this.fileLog, getServerSource);
    this.service = editorService({
      providers: this.connection.providers,
      assets,
      secrets: { get: async () => {
        return;
      }, set: async () => {} },
      logger
    });
    this.connection.setService(this.service);
  }
  onDevServerStateChange(state) {
    this.connection.onDevServerStateChange(state);
  }
  onServerUrlDetected(source, url) {
    this.connection.onUrlDetected(source, url);
  }
  broadcastDevServerLog(text) {
    const lines = text.split(`
`);
    this.devLogBuffer.push(...lines);
    if (this.devLogBuffer.length > 200) {
      this.devLogBuffer.splice(0, this.devLogBuffer.length - 200);
    }
    this.broadcastToAll({ type: "devServerLog", text });
    this.fileLog.append(text);
  }
  getDevLogBuffer() {
    return this.devLogBuffer;
  }
  async resolveCustomTextEditor(document, webviewPanel) {
    this.panels.add(webviewPanel);
    this.connection.rebuildProviders();
    const resourceRoots = [
      vscode5.Uri.file(import_node_path6.join(this.context.extensionPath, "dist", "webview")),
      vscode5.Uri.file(import_node_path6.dirname(document.uri.fsPath)),
      ...(vscode5.workspace.workspaceFolders ?? []).map((f) => f.uri)
    ];
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: resourceRoots
    };
    webviewPanel.webview.html = this.getHtml(webviewPanel.webview);
    const bridge = new DocumentBridge;
    const postConfigs = () => {
      if (bridge.isUpdating)
        return;
      const configs = bridge.read(document);
      webviewPanel.webview.postMessage({
        type: "configsUpdated",
        configs
      });
    };
    if (this.panels.size === 1)
      this.connection.subscribeAll();
    const handlerCtx = {
      document,
      panel: webviewPanel,
      bridge,
      connection: this.connection,
      service: this.service,
      context: this.context,
      post: (msg) => webviewPanel.webview.postMessage(msg),
      onDevServerCommand: this.onDevServerCommand,
      getDevLogBuffer: () => this.devLogBuffer
    };
    webviewPanel.webview.onDidReceiveMessage((msg) => {
      handlerCtx.onDevServerCommand = this.onDevServerCommand;
      handleMessage(handlerCtx, msg);
    });
    const changeListener = vscode5.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() === document.uri.toString()) {
        postConfigs();
      }
    });
    const configListener = vscode5.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("lumen.server")) {
        this.connection.unsubscribeAll();
        this.connection.rebuildProviders();
        this.connection.subscribeAll();
      }
    });
    const docWatcher = vscode5.workspace.createFileSystemWatcher(document.uri.fsPath);
    const docListener = docWatcher.onDidChange(() => postConfigs());
    const distPath = import_node_path6.join(this.context.extensionPath, "dist", "webview");
    const distWatcher = vscode5.workspace.createFileSystemWatcher(import_node_path6.join(distPath, "**/*"));
    const distListener = distWatcher.onDidChange(() => {
      webviewPanel.webview.html = this.getHtml(webviewPanel.webview);
    });
    webviewPanel.onDidDispose(() => {
      this.panels.delete(webviewPanel);
      changeListener.dispose();
      configListener.dispose();
      docListener.dispose();
      docWatcher.dispose();
      distListener.dispose();
      distWatcher.dispose();
      if (this.panels.size === 0)
        this.connection.unsubscribeAll();
    });
  }
  broadcastToAll(message) {
    for (const panel of this.panels) {
      panel.webview.postMessage(message);
    }
  }
  getHtml(webview) {
    const distPath = import_node_path6.join(this.context.extensionPath, "dist", "webview");
    let html;
    try {
      html = import_node_fs6.readFileSync(import_node_path6.join(distPath, "index.html"), "utf-8");
    } catch {
      return "<html><body><p>Webview not built. Run <code>bun run build</code>.</p></body></html>";
    }
    const baseUri = webview.asWebviewUri(vscode5.Uri.file(distPath));
    html = html.replace(/(href|src)="\.?\/?/g, `$1="${baseUri.toString()}/`);
    html = html.replace(/ crossorigin/g, "");
    html = html.replace(' type="module"', " defer");
    return html;
  }
}

// src/extension.ts
function activeDocumentUri() {
  const textUri = vscode6.window.activeTextEditor?.document.uri;
  if (textUri)
    return textUri;
  const tab = vscode6.window.tabGroups.activeTabGroup.activeTab;
  if (tab?.input instanceof vscode6.TabInputCustom)
    return tab.input.uri;
  return;
}
function activate(context) {
  const output = vscode6.window.createOutputChannel("Lumen Server");
  const provider = new LumenEditorProvider(context);
  const serverManager = new ServerManager(output, () => {
    provider.onDevServerStateChange(serverManager.getState(getServerSource()));
  }, (text) => {
    provider.broadcastDevServerLog(text);
  }, (source2, url) => {
    provider.onServerUrlDetected(source2, url);
  });
  const source = getServerSource();
  if (source) {
    provider.onDevServerStateChange(serverManager.getState(source));
  }
  context.subscriptions.push(LumenEditorProvider.register(provider), vscode6.commands.registerCommand("lumen.openPreview", () => {
    const uri = vscode6.window.activeTextEditor?.document.uri;
    if (!uri)
      return;
    vscode6.commands.executeCommand("vscode.openWith", uri, "lumen.stateViewer");
  }), vscode6.commands.registerCommand("lumen.openAsJson", () => {
    const uri = activeDocumentUri();
    if (!uri)
      return;
    vscode6.commands.executeCommand("vscode.openWith", uri, "default");
  }), vscode6.commands.registerCommand("lumen.startServer", () => serverManager.start(getServerSource())), vscode6.commands.registerCommand("lumen.stopServer", () => serverManager.stop(getServerSource())), output);
  provider.onDevServerCommand = (cmd) => {
    const source2 = getServerSource();
    if (cmd === "start") {
      serverManager.start(source2);
    } else if (cmd === "restart") {
      serverManager.restart(source2);
    } else {
      serverManager.stop(source2);
    }
  };
}
function deactivate() {}

//# debugId=DC983F3BDB04CAFC64756E2164756E21
//# sourceMappingURL=extension.js.map
