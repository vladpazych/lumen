import type { ProviderPort } from "@vladpazych/lumen/ports";
import type { PipelineConfig, ServerStatus } from "@vladpazych/lumen/types";
import type {
  EditorService,
  SchemaCache,
  StatusCache,
} from "@vladpazych/lumen/editor";
import type { DevServerState } from "../webview/lib/messaging";
import type { FileLogger } from "./adapters/vscode-logger";
import { httpProvider } from "./adapters/http-provider";
import { readLastUrl } from "./server-state";
import type { WorkspaceSecretStore } from "./workspace-secrets";

export type ConnectionEvents = {
  schemasChanged(serverUrl: string, pipelines: PipelineConfig[]): void;
  serverStatusChanged(serverUrl: string, status: ServerStatus): void;
  devServerStateChanged(state: DevServerState): void;
};

/**
 * Manages server connections: provider lifecycle, SSE subscriptions,
 * schema/status caches, and dev server state tracking.
 */
export class ServerConnection {
  /** Shared provider record — passed by reference to EditorService. */
  readonly providers: Record<string, ProviderPort> = {};

  schemas: SchemaCache = {};
  statuses: StatusCache = {};
  devServerState: DevServerState = "stopped";

  private service: EditorService | null = null;
  private detectedUrl: string | null = null;
  private readonly subscriptions = new Map<string, () => void>();

  constructor(
    private readonly events: ConnectionEvents,
    private readonly log: { info(msg: string): void },
    private readonly fileLog: FileLogger,
    private readonly getServerSource: () => string,
    private readonly workspaceSecrets: WorkspaceSecretStore,
  ) {
    const serverSource = this.getServerSource();
    if (serverSource) {
      this.detectedUrl = readLastUrl(serverSource);
    }
  }

  /** Set after construction to break the circular dependency with EditorService. */
  setService(service: EditorService): void {
    this.service = service;
  }

  get serverUrl(): string | null {
    return this.detectedUrl;
  }

  private syncDetectedUrlFromState(): void {
    const serverSource = this.getServerSource();
    if (!serverSource) {
      return;
    }

    const storedUrl = readLastUrl(serverSource);
    if (storedUrl) {
      this.detectedUrl = storedUrl;
    }
  }

  onUrlDetected(_source: string, url: string): void {
    this.detectedUrl = url;
    this.log.info(`[modal] detected URL: ${url}`);
  }

  async onDevServerStateChange(state: DevServerState): Promise<void> {
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
      await this.rebuildProviders();
      this.subscribeAll();
    }
  }

  // --- Provider lifecycle ---

  async rebuildProviders(): Promise<void> {
    this.syncDetectedUrlFromState();
    for (const key of Object.keys(this.providers)) {
      delete this.providers[key];
    }
    if (this.detectedUrl) {
      const authKey =
        (await this.workspaceSecrets.peekLumenAuthToken(
          this.getServerSource(),
        )) ?? undefined;
      this.providers[this.detectedUrl] = httpProvider(
        this.detectedUrl,
        authKey,
      );
    }
  }

  // --- SSE subscriptions ---

  subscribeAll(): void {
    const url = this.detectedUrl;
    if (url) this.subscribeTo(url);
  }

  private subscribeTo(url: string): void {
    if (this.subscriptions.has(url)) return;
    const provider = this.providers[url];
    if (!provider) return;

    if (provider.subscribe) {
      this.log.info(`[sse] subscribing to ${url}`);
      const dispose = provider.subscribe({
        onSchemas: (schemas) => {
          const ids = schemas.map((s) => s.id).join(", ");
          this.log.info(`[sse] ${url} schemas: ${ids}`);
          this.fileLog.append(`[sse] ${url} schemas: ${ids}\n`);
          this.schemas[url] = schemas;
          this.events.schemasChanged(url, schemas);
        },
        onStatus: (status) => {
          this.log.info(`[sse] ${url} ${status}`);
          this.fileLog.append(`[sse] ${url} ${status}\n`);
          this.statuses[url] = status;
          this.events.serverStatusChanged(url, status);
          this.detectOrphan(status);
        },
      });
      this.subscriptions.set(url, dispose);
    } else {
      this.refreshSchemas(url);
    }
  }

  unsubscribeAll(): void {
    for (const dispose of this.subscriptions.values()) dispose();
    this.subscriptions.clear();
  }

  // --- Schema refresh ---

  async refreshSchemas(serverUrl: string): Promise<void> {
    if (!this.service) return;
    const result = await this.service.refreshSchemas(
      serverUrl,
      this.schemas,
      this.statuses,
    );
    this.schemas = result.schemas;
    this.statuses = result.statuses;
    this.events.schemasChanged(serverUrl, this.schemas[serverUrl] ?? []);
    this.events.serverStatusChanged(serverUrl, this.statuses[serverUrl]);
  }

  // --- Orphan detection ---

  private detectOrphan(status: ServerStatus): void {
    if (status === "connected" && this.devServerState === "stopped") {
      this.devServerState = "orphaned";
      this.events.devServerStateChanged("orphaned");
    } else if (
      status === "disconnected" &&
      this.devServerState === "orphaned"
    ) {
      this.devServerState = "stopped";
      this.events.devServerStateChanged("stopped");
    }
  }
}
