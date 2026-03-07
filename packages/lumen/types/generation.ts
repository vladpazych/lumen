export type OutputAsset = {
  url: string;
  type: "image" | "video";
  format?: string;
  metadata?: Record<string, unknown>;
};

export type GenerateResponse =
  | { status: "completed"; runId: string; outputs: OutputAsset[] }
  | { status: "running"; runId: string; progress?: number }
  | { status: "queued"; runId: string }
  | {
      status: "failed";
      runId: string;
      error: { code: string; message: string };
    };
