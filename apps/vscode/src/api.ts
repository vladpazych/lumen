import type { GenerateResponse, PipelineConfig } from "../shared/types"

const POLL_INTERVAL_MS = 1500
const MAX_POLL_ATTEMPTS = 200 // ~5 minutes

export async function fetchPipelines(serverUrl: string): Promise<PipelineConfig[]> {
  const res = await fetch(`${serverUrl}/pipelines`)
  if (!res.ok) throw new Error(`GET /pipelines failed: ${res.status}`)
  const manifests = (await res.json()) as { id: string }[]

  const configs = await Promise.all(
    manifests.map(async (m) => {
      const r = await fetch(`${serverUrl}/pipelines/${m.id}`)
      if (!r.ok) throw new Error(`GET /pipelines/${m.id} failed: ${r.status}`)
      return (await r.json()) as PipelineConfig
    }),
  )
  return configs
}

export async function generate(
  serverUrl: string,
  pipelineId: string,
  params: Record<string, unknown>,
): Promise<GenerateResponse> {
  const res = await fetch(`${serverUrl}/pipelines/${pipelineId}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`POST /pipelines/${pipelineId}/generate failed: ${res.status} ${text}`)
  }
  return (await res.json()) as GenerateResponse
}

export async function pollRun(serverUrl: string, pipelineId: string, runId: string): Promise<GenerateResponse> {
  const res = await fetch(`${serverUrl}/pipelines/${pipelineId}/runs/${runId}`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GET /runs/${runId} failed: ${res.status} ${text}`)
  }
  return (await res.json()) as GenerateResponse
}

export async function pollUntilDone(
  serverUrl: string,
  pipelineId: string,
  runId: string,
  onProgress?: (progress: number) => void,
): Promise<GenerateResponse> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    const status = await pollRun(serverUrl, pipelineId, runId)

    if (status.status === "running" || status.status === "queued") {
      onProgress?.(status.status === "running" ? (status.progress ?? 0) : 0)
      continue
    }

    return status // completed or failed
  }

  return {
    status: "failed",
    runId,
    error: { code: "TIMEOUT", message: "Generation timed out after 5 minutes" },
  }
}
