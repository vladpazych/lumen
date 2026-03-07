import type { GenerateResponse } from "../types";
import type { ProviderPort } from "../ports";

const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 200; // ~5 minutes

/** Poll a provider until generation completes or fails */
export async function pollUntilDone(
  provider: ProviderPort,
  pipelineId: string,
  runId: string,
  onProgress?: (progress: number) => void,
): Promise<GenerateResponse> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const status = await provider.pollRun(pipelineId, runId);

    if (status.status === "running" || status.status === "queued") {
      onProgress?.(status.status === "running" ? (status.progress ?? 0) : 0);
      continue;
    }

    return status; // completed or failed
  }

  return {
    status: "failed",
    runId,
    error: { code: "TIMEOUT", message: "Generation timed out after 5 minutes" },
  };
}
