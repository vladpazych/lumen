import type { GenerateResponse } from "../types";
import type { ProviderPort } from "../ports";

const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 200; // ~5 minutes
const MAX_CONSECUTIVE_ERRORS = 3;

export type PollProgress = {
  progress: number;
  stage: "queued" | "running";
};

/** Poll a provider until generation completes or fails */
export async function pollUntilDone(
  provider: ProviderPort,
  pipelineId: string,
  runId: string,
  onProgress?: (info: PollProgress) => void,
): Promise<GenerateResponse> {
  let consecutiveErrors = 0;

  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));

    let status: GenerateResponse;
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
          error: { code: "POLL_ERROR", message: msg },
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

    return status; // completed or failed
  }

  return {
    status: "failed",
    runId,
    error: { code: "TIMEOUT", message: "Generation timed out after 5 minutes" },
  };
}
