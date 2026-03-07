import { useState, useRef } from "react";
import type {
  LumenConfig,
  PipelineConfig,
  ServerStatus,
} from "@lumen/core/types";
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
  result?: {
    imageUrl?: string;
    error?: string;
    metadata?: Record<string, unknown>;
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
  const description = schema?.description ?? null;

  const [draft, setDraft] = useState(title);
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
              {description && (
                <p className="text-[11px] text-text-secondary">{description}</p>
              )}
              <PipelineForm
                pipeline={schema}
                values={config.params}
                onParamChange={onParamChange}
                onPickImage={onPickImage}
                isPickingImage={isPickingImage}
                imageThumbs={imageThumbs}
                onPickImageByUri={onPickImageByUri}
              />
              <GenerateSection
                loading={isGenerating}
                progress={progress}
                hasQuality={schema.params.some((p) => p.name === "quality")}
                onPreview={() =>
                  onGenerate({ ...config.params, quality: "preview" })
                }
                onGenerate={() =>
                  onGenerate({ ...config.params, quality: "full" })
                }
              />
              {result && (
                <ResultDisplay
                  imageUrl={result.imageUrl}
                  error={result.error}
                  metadata={result.metadata}
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
