import { useState, useRef, useEffect } from "react"
import { Stack } from "../kit/stack"
import { Row } from "../kit/row"
import { Inset } from "../kit/inset"
import { Text } from "../kit/text"
import { StatusDot } from "../kit/status-dot"
import { AccordionTrigger, AccordionPanel } from "../kit/accordion"
import type { LumenConfig, PipelineConfig, ServerStatus } from "../../shared/types"
import { GenerateButton } from "./generate-button"
import { PipelineForm } from "./pipeline-form"
import { ResultDisplay } from "./result-display"

type Props = {
  config: LumenConfig
  schema?: PipelineConfig
  status: ServerStatus
  isGenerating: boolean
  progress?: number
  result?: { imageUrl?: string; error?: string; metadata?: Record<string, unknown> }
  onParamChange: (paramName: string, value: unknown) => void
  onGenerate: (params: Record<string, unknown>) => void
  onPickImage: (paramName: string) => void
  onPickImageByUri: (paramName: string, uri: string) => void
  onRename: (name: string) => void
  isPickingImage: boolean
  imageThumbs: Record<string, string>
}

const statusVariant = {
  connected: "success",
  error: "destructive",
  disconnected: "muted",
} as const

function shortenUrl(url: string): string {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/^provider:\/\//, "")
    .replace(/\/$/, "")
}

function promptSummary(config: LumenConfig, schema?: PipelineConfig): string | null {
  if (!schema) return null
  const promptParam = schema.params.find((p) => p.type === "prompt")
  if (!promptParam) return null
  const value = config.params[promptParam.name]
  if (typeof value !== "string" || value.length === 0) return null
  return value.length > 80 ? value.slice(0, 80) + "..." : value
}

export function ConfigCard({
  config,
  schema,
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
  const fallbackTitle = `${shortenUrl(config.service)} / ${schema?.name ?? config.pipeline}`
  const title = config.name ?? fallbackTitle
  const summary = promptSummary(config, schema)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commitRename = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== title) onRename(trimmed)
  }

  const cancelRename = () => {
    setEditing(false)
    setDraft(title)
  }

  return (
    <>
      <AccordionTrigger>
        <Row spacing="snug" align="center" grow>
          {editing ? (
            <input
              ref={inputRef}
              className="bg-transparent text-[13px] font-medium text-text-primary outline-none border-b border-border w-full"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename()
                if (e.key === "Escape") cancelRename()
                e.stopPropagation()
              }}
              onBlur={commitRename}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              onDoubleClick={(e) => {
                e.stopPropagation()
                setDraft(title)
                setEditing(true)
              }}
            >
              <Text variant="caption" weight="medium" truncate>
                {title}
              </Text>
            </span>
          )}
          <StatusDot variant={statusVariant[status]} size="xs" />
        </Row>
      </AccordionTrigger>
      <AccordionPanel>
        <div data-slot="config-card-collapsed">
          {summary && (
            <Text variant="caption" color="tertiary" truncate>
              {summary}
            </Text>
          )}
        </div>
        {schema ? (
          <Stack spacing="relaxed">
            {schema.description && (
              <Text variant="caption" color="secondary">
                {schema.description}
              </Text>
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
            <GenerateButton
              loading={isGenerating}
              progress={progress}
              hasQuality={schema.params.some((p) => p.name === "quality")}
              onPreview={() => onGenerate({ ...config.params, quality: "preview" })}
              onGenerate={() => onGenerate({ ...config.params, quality: "full" })}
            />
            {result && <ResultDisplay imageUrl={result.imageUrl} error={result.error} metadata={result.metadata} />}
          </Stack>
        ) : (
          <Inset spacing="normal">
            <Text variant="caption" color="tertiary">
              Connect to {shortenUrl(config.service)} to edit
            </Text>
          </Inset>
        )}
      </AccordionPanel>
    </>
  )
}
