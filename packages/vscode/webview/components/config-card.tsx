import { useState, useRef, useEffect } from "react";
import { AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import { StatusDot } from "@/components/status-dot";
import type {
  LumenConfig,
  PipelineConfig,
  ServerStatus,
} from "@lumen/core/types";
import { GenerateSection } from "@/components/generate-section";
import { PipelineForm } from "@/components/pipeline-form";
import { ResultDisplay } from "@/components/result-display";

type Props = {
  config: LumenConfig;
  schema?: PipelineConfig;
  serverName?: string;
  status: ServerStatus;
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
  isPickingImage: boolean;
  imageThumbs: Record<string, string>;
};

const statusVariant = {
  connected: "success",
  error: "destructive",
  disconnected: "muted",
} as const;

function shortenUrl(url: string): string {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/^provider:\/\//, "")
    .replace(/\/$/, "");
}

function promptSummary(
  config: LumenConfig,
  schema?: PipelineConfig,
): string | null {
  if (!schema) return null;
  const promptParam = schema.params.find((p) => p.type === "prompt");
  if (!promptParam) return null;
  const value = config.params[promptParam.name];
  if (typeof value !== "string" || value.length === 0) return null;
  return value.length > 80 ? value.slice(0, 80) + "..." : value;
}

export function ConfigCard({
  config,
  schema,
  serverName,
  status,
  isGenerating,
  progress,
  result,
  onParamChange,
  onGenerate,
  onPickImage,
  onPickImageByUri,
  onRename,
  isPickingImage,
  imageThumbs,
}: Props) {
  const serverLabel = serverName ?? shortenUrl(config.service);
  const fallbackTitle = `${serverLabel} / ${schema?.name ?? config.pipeline}`;
  const title = config.name ?? fallbackTitle;
  const summary = promptSummary(config, schema);

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
    <>
      <AccordionTrigger>
        <div className="flex flex-1 items-center gap-2">
          {editing ? (
            <input
              ref={inputRef}
              className="bg-transparent text-[13px] font-medium text-text-primary outline-none border-b border-border w-full"
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
              className="text-[13px] font-medium text-text-primary truncate"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setDraft(title);
                setEditing(true);
              }}
            >
              {title}
            </span>
          )}
          <StatusDot variant={statusVariant[status]} size="xs" />
        </div>
      </AccordionTrigger>
      <AccordionPanel>
        <div data-slot="config-card-collapsed">
          {summary && (
            <p className="text-[11px] text-text-tertiary truncate">{summary}</p>
          )}
        </div>
        {schema ? (
          <div className="flex flex-col gap-4">
            {schema.description && (
              <p className="text-[11px] text-text-secondary">
                {schema.description}
              </p>
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
          <div className="p-3">
            <p className="text-[11px] text-text-tertiary">
              Connect to {serverLabel} to edit
            </p>
          </div>
        )}
      </AccordionPanel>
    </>
  );
}
