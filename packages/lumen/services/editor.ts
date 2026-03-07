import type { GenerateResponse, PipelineConfig, ServerStatus } from "../types";
import type { EditorPorts } from "../ports";
import { pollUntilDone } from "../domain/generation";

export type SchemaCache = Record<string, PipelineConfig[]>;
export type StatusCache = Record<string, ServerStatus>;

export type EditorService = {
  /** Fetch schemas from a single provider, update caches */
  refreshSchemas(
    serviceUrl: string,
    schemas: SchemaCache,
    statuses: StatusCache,
  ): Promise<{ schemas: SchemaCache; statuses: StatusCache }>;

  /** Refresh all providers */
  refreshAllSchemas(
    serviceUrls: string[],
    schemas: SchemaCache,
    statuses: StatusCache,
  ): Promise<{ schemas: SchemaCache; statuses: StatusCache }>;

  /** Health-check all non-virtual providers */
  pollHealth(
    serviceUrls: string[],
    statuses: StatusCache,
  ): Promise<{
    statuses: StatusCache;
    changed: { url: string; status: ServerStatus }[];
    reconnected: string[];
  }>;

  /** Run generation, poll if async, save assets */
  generate(
    serviceUrl: string,
    pipelineId: string,
    params: Record<string, unknown>,
    documentUri: string,
    onProgress?: (progress: number) => void,
  ): Promise<GenerateResponse>;
};

export function editorService(ports: EditorPorts): EditorService {
  const { providers, assets, logger } = ports;

  async function refreshSchemas(
    serviceUrl: string,
    schemas: SchemaCache,
    statuses: StatusCache,
  ): Promise<{ schemas: SchemaCache; statuses: StatusCache }> {
    const provider = providers[serviceUrl];
    if (!provider) {
      return { schemas, statuses };
    }
    try {
      const pipelines = await provider.fetchSchemas();
      return {
        schemas: { ...schemas, [serviceUrl]: pipelines },
        statuses: { ...statuses, [serviceUrl]: "connected" },
      };
    } catch (err) {
      logger.error(`[schema] Failed to fetch from ${serviceUrl}: ${err}`);
      return {
        schemas: { ...schemas, [serviceUrl]: [] },
        statuses: { ...statuses, [serviceUrl]: "error" },
      };
    }
  }

  async function refreshAllSchemas(
    serviceUrls: string[],
    schemas: SchemaCache,
    statuses: StatusCache,
  ): Promise<{ schemas: SchemaCache; statuses: StatusCache }> {
    let s = schemas;
    let st = statuses;
    for (const url of serviceUrls) {
      const result = await refreshSchemas(url, s, st);
      s = result.schemas;
      st = result.statuses;
    }
    return { schemas: s, statuses: st };
  }

  async function pollHealth(
    serviceUrls: string[],
    statuses: StatusCache,
  ): Promise<{
    statuses: StatusCache;
    changed: { url: string; status: ServerStatus }[];
    reconnected: string[];
  }> {
    const newStatuses = { ...statuses };
    const changed: { url: string; status: ServerStatus }[] = [];
    const reconnected: string[] = [];

    for (const url of serviceUrls) {
      // Virtual providers (provider://) don't need health checks
      if (url.startsWith("provider://")) continue;

      const prev = statuses[url];
      const provider = providers[url];
      if (!provider) continue;

      try {
        if (provider.ping) {
          await provider.ping();
        } else {
          await provider.fetchSchemas();
        }
        newStatuses[url] = "connected";
        if (prev !== "connected") reconnected.push(url);
      } catch {
        newStatuses[url] = "disconnected";
      }

      if (newStatuses[url] !== prev) {
        changed.push({ url, status: newStatuses[url] });
      }
    }

    return { statuses: newStatuses, changed, reconnected };
  }

  async function generate(
    serviceUrl: string,
    pipelineId: string,
    params: Record<string, unknown>,
    documentUri: string,
    onProgress?: (progress: number) => void,
  ): Promise<GenerateResponse> {
    const provider = providers[serviceUrl];
    if (!provider) {
      return {
        status: "failed",
        runId: "",
        error: {
          code: "NO_PROVIDER",
          message: `No provider for ${serviceUrl}`,
        },
      };
    }

    let response = await provider.generate(pipelineId, params);

    if (response.status === "running" || response.status === "queued") {
      response = await pollUntilDone(
        provider,
        pipelineId,
        response.runId,
        onProgress,
      );
    }

    if (response.status === "completed") {
      for (const output of response.outputs) {
        output.url = await assets.save(
          output.url,
          documentUri,
          output.format ?? "png",
        );
      }
    }

    return response;
  }

  return { refreshSchemas, refreshAllSchemas, pollHealth, generate };
}
