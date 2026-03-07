import type { GenerateResponse, PipelineConfig, ServerStatus } from "../types";

export type ProviderCallbacks = {
  onSchemas(schemas: PipelineConfig[]): void;
  onStatus(status: ServerStatus): void;
};

/** Driven port — abstracts how schemas are obtained and generation is executed */
export type ProviderPort = {
  fetchSchemas(): Promise<PipelineConfig[]>;
  /** Lightweight reachability check. Defaults to fetchSchemas if not provided. */
  ping?(): Promise<void>;
  /** Subscribe to live schema updates via SSE. Returns a dispose function. */
  subscribe?(callbacks: ProviderCallbacks): () => void;
  generate(
    pipelineId: string,
    params: Record<string, unknown>,
  ): Promise<GenerateResponse>;
  pollRun(pipelineId: string, runId: string): Promise<GenerateResponse>;
};
