import { useState, useRef } from "react";
import type {
  LumenConfig,
  OutputAsset,
  PipelineConfig,
  ServerStatus,
} from "@vladpazych/lumen/types";
import { GenerateSection } from "@/components/generate-section";
import { PipelineForm } from "@/components/pipeline-form";
import { ResultDisplay } from "@/components/result-display";
import { ChevronDownIcon } from "lucide-react";

type Props = {
  config: LumenConfig;
  schema?: PipelineConfig;
  status: ServerStatus;
  open: boolean;
  onToggle: () => void;
  isGenerating: boolean;
  progress?: number;
  stage?: "queued" | "running";
  result?: {
    outputs?: OutputAsset[];
    error?: string;
  };
  onParamChange: (paramName: string, value: unknown) => void;
  onGenerate: (params: Record<string, unknown>) => void;
  onPickImage: (paramName: string) => void;
  onPickImageByUri: (paramName: string, uri: string) => void;
  onRename: (name: string) => void;
  onRemove: () => void;
  isPickingImage: boolean;
  imageThumbs: Record<string, string>;
};

export function ConfigCard({
  config,
  schema,
  status,
  open,
  onToggle,
  isGenerating,
  progress,
  stage,
  result,
  onParamChange,
  onGenerate,
  onPickImage,
  onPickImageByUri,
  onRename,
  onRemove,
  isPickingImage,
  imageThumbs,
}: Props) {
  const fallbackTitle = schema?.name ?? config.pipeline;
  const title = config.name ?? fallbackTitle;
  const pipelineName = schema?.name ?? config.pipeline;

  const [draft, setDraft] = useState(title);
  const [hasErrors, setHasErrors] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const commitRename = () => {
    inputRef.current?.blur();
    const trimmed = draft.trim();
    if (trimmed && trimmed !== title) onRename(trimmed);
    else setDraft(title);
  };

  return (
    <div className="rounded-md border border-border bg-card">
      {/* Header */}
      <div
        className={`flex w-full items-start gap-2 px-3 py-2.5 cursor-pointer group hover:bg-hover rounded-t-md ${open ? "border-b border-border" : ""}`}
        onClick={onToggle}
      >
        <ChevronDownIcon
          className={`size-3.5 shrink-0 text-text-tertiary transition-transform duration-150 mt-0.5 ${open ? "rotate-0" : "-rotate-90"}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <div className="flex-1 min-w-0">
              <span className="inline-grid min-w-[4ch] max-w-full -mx-0.5">
                <span
                  aria-hidden
                  className="col-start-1 row-start-1 invisible whitespace-pre text-[13px] font-medium px-0.5 pointer-events-none select-none"
                >
                  {draft || " "}
                </span>
                <input
                  ref={inputRef}
                  className="col-start-1 row-start-1 min-w-0 bg-transparent text-[13px] font-medium text-text-primary outline-none cursor-text rounded-sm px-0.5 hover:bg-hover focus:bg-surface-3 focus:ring-1 focus:ring-ring/50"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") {
                      setDraft(title);
                      inputRef.current?.blur();
                    }
                  }}
                  onFocus={(e) => {
                    e.stopPropagation();
                    e.target.select();
                  }}
                  onBlur={commitRename}
                  onClick={(e) => e.stopPropagation()}
                />
              </span>
            </div>
            <span
              className="text-[11px] text-text-tertiary hover:text-text-primary opacity-0 group-hover:opacity-100 transition-opacity px-1 shrink-0 cursor-pointer"
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
            >
              ✕
            </span>
          </div>
          <span className="block text-[11px] text-text-tertiary truncate h-4">
            {pipelineName}
          </span>
        </div>
      </div>

      {/* Body */}
      {open && (
        <div className="px-3 pt-3 pb-3">
          {schema ? (
            <div className="flex flex-col gap-4">
              <PipelineForm
                pipeline={schema}
                values={config.params}
                onParamChange={onParamChange}
                onPickImage={onPickImage}
                isPickingImage={isPickingImage}
                imageThumbs={imageThumbs}
                onPickImageByUri={onPickImageByUri}
                onValidation={setHasErrors}
              />
              <GenerateSection
                loading={isGenerating}
                progress={progress}
                stage={stage}
                tier={schema.tier}
                hasQuality={schema.params.some((p) => p.name === "quality")}
                disabled={hasErrors}
                onPreview={() =>
                  onGenerate({ ...config.params, quality: "preview" })
                }
                onGenerate={() =>
                  onGenerate({ ...config.params, quality: "full" })
                }
              />
              {result && (
                <ResultDisplay
                  outputs={result.outputs}
                  error={result.error}
                />
              )}
            </div>
          ) : (
            <p className="text-[11px] text-text-tertiary py-1">
              {status === "disconnected"
                ? "Start server to edit"
                : "Loading pipeline…"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
