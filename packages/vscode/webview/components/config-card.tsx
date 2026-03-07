import { useState, useRef, useEffect } from "react";
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
  const description = schema?.description ?? null;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitRename = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== title) onRename(trimmed);
  };

  const cancelRename = () => {
    setEditing(false);
    setDraft(title);
  };

  return (
    <div className="rounded-md border border-border bg-card">
      {/* Header */}
      <button
        type="button"
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left group"
        onClick={onToggle}
      >
        <ChevronDownIcon
          className={`size-3.5 shrink-0 text-text-tertiary transition-transform duration-150 mt-0.5 ${open ? "rotate-0" : "-rotate-90"}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            {editing ? (
              <input
                ref={inputRef}
                className="flex-1 bg-transparent text-[13px] font-medium text-text-primary outline-none border-b border-border"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") cancelRename();
                  e.stopPropagation();
                }}
                onBlur={commitRename}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className="flex-1 text-[13px] font-medium text-text-primary truncate"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setDraft(title);
                  setEditing(true);
                }}
              >
                {title}
              </span>
            )}
            <span
              className="text-[11px] text-text-tertiary hover:text-text-primary opacity-0 group-hover:opacity-100 transition-opacity px-1 shrink-0"
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
            {description ?? "\u00A0"}
          </span>
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="px-3 pb-3">
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
