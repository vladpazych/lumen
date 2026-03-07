import type { ProviderPort } from "@lumen/core/ports";
import type { GenerateResponse, PipelineConfig } from "@lumen/core/types";

/** ProviderPort adapter for HTTP servers exposing the lumen REST contract */
export function httpProvider(serverUrl: string): ProviderPort {
  return {
    async fetchSchemas(): Promise<PipelineConfig[]> {
      const res = await fetch(`${serverUrl}/pipelines`);
      if (!res.ok) throw new Error(`GET /pipelines failed: ${res.status}`);
      const manifests = (await res.json()) as { id: string }[];

      return Promise.all(
        manifests.map(async (m) => {
          const r = await fetch(`${serverUrl}/pipelines/${m.id}`);
          if (!r.ok)
            throw new Error(`GET /pipelines/${m.id} failed: ${r.status}`);
          return (await r.json()) as PipelineConfig;
        }),
      );
    },

    async generate(
      pipelineId: string,
      params: Record<string, unknown>,
    ): Promise<GenerateResponse> {
      const res = await fetch(
        `${serverUrl}/pipelines/${pipelineId}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `POST /pipelines/${pipelineId}/generate failed: ${res.status} ${text}`,
        );
      }
      return (await res.json()) as GenerateResponse;
    },

    async pollRun(
      pipelineId: string,
      runId: string,
    ): Promise<GenerateResponse> {
      const res = await fetch(
        `${serverUrl}/pipelines/${pipelineId}/runs/${runId}`,
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`GET /runs/${runId} failed: ${res.status} ${text}`);
      }
      return (await res.json()) as GenerateResponse;
    },
  };
}
