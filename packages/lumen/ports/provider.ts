import type { GenerateResponse, PipelineConfig } from "../types";

/** Driven port — abstracts how schemas are obtained and generation is executed */
export type ProviderPort = {
  fetchSchemas(): Promise<PipelineConfig[]>;
  /** Lightweight reachability check. Defaults to fetchSchemas if not provided. */
  ping?(): Promise<void>;
  generate(
    pipelineId: string,
    params: Record<string, unknown>,
  ): Promise<GenerateResponse>;
  pollRun(pipelineId: string, runId: string): Promise<GenerateResponse>;
};
