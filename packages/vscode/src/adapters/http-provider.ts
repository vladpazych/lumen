import type { ProviderCallbacks, ProviderPort } from "@lumen/core/ports";
import type { GenerateResponse, PipelineConfig } from "@lumen/core/types";

const RECONNECT_MS = 3_000;

function parseSSEFrame(frame: string): { event: string; data: string } | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:"))
      dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

/** ProviderPort adapter for HTTP servers exposing the lumen REST contract */
export function httpProvider(
  serverUrl: string,
  authKey?: string,
): ProviderPort {
  const authHeaders: Record<string, string> = authKey
    ? { Authorization: `Bearer ${authKey}` }
    : {};

  return {
    async ping(): Promise<void> {
      const res = await fetch(`${serverUrl}/pipelines`, {
        headers: authHeaders,
      });
      if (!res.ok) throw new Error(`GET /pipelines failed: ${res.status}`);
    },

    subscribe(callbacks: ProviderCallbacks): () => void {
      let abortController = new AbortController();
      let disposed = false;
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

      const scheduleReconnect = () => {
        if (disposed) return;
        reconnectTimer = setTimeout(() => {
          abortController = new AbortController();
          connect();
        }, RECONNECT_MS);
      };

      const connect = async () => {
        if (disposed) return;
        try {
          const res = await fetch(`${serverUrl}/pipelines/events`, {
            signal: abortController.signal,
            headers: { Accept: "text/event-stream", ...authHeaders },
          });
          if (!res.ok || !res.body) {
            callbacks.onStatus("disconnected");
            scheduleReconnect();
            return;
          }
          callbacks.onStatus("connected");

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const frames = buffer.split("\n\n");
            buffer = frames.pop() ?? "";
            for (const frame of frames) {
              const parsed = parseSSEFrame(frame);
              if (parsed?.event === "schemas") {
                callbacks.onSchemas(
                  JSON.parse(parsed.data) as PipelineConfig[],
                );
              }
            }
          }
          // Stream ended — server closed
          if (!disposed) {
            callbacks.onStatus("disconnected");
            scheduleReconnect();
          }
        } catch (err: unknown) {
          if (disposed) return;
          if (err instanceof DOMException && err.name === "AbortError") return;
          callbacks.onStatus("disconnected");
          scheduleReconnect();
        }
      };

      connect();

      return () => {
        disposed = true;
        abortController.abort();
        if (reconnectTimer) clearTimeout(reconnectTimer);
      };
    },

    async fetchSchemas(): Promise<PipelineConfig[]> {
      const res = await fetch(`${serverUrl}/pipelines`, {
        headers: authHeaders,
      });
      if (!res.ok) throw new Error(`GET /pipelines failed: ${res.status}`);
      return (await res.json()) as PipelineConfig[];
    },

    async generate(
      pipelineId: string,
      params: Record<string, unknown>,
    ): Promise<GenerateResponse> {
      const res = await fetch(`${serverUrl}/pipelines/${pipelineId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(params),
      });
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
        { headers: authHeaders },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`GET /runs/${runId} failed: ${res.status} ${text}`);
      }
      return (await res.json()) as GenerateResponse;
    },
  };
}
