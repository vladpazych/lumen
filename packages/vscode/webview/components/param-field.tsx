import { Stack } from "../kit/stack"
import { Text } from "../kit/text"
import type { ParamDefinition } from "@lumen/core/types"
import { BooleanField } from "./fields/boolean-field"
import { DimensionsField } from "./fields/dimensions-field"
import { IntegerField } from "./fields/integer-field"
import { NumberField } from "./fields/number-field"
import { ImageField } from "./fields/image-field"
import { PlaceholderField } from "./fields/placeholder-field"
import { PromptField } from "./fields/prompt-field"
import { SeedField } from "./fields/seed-field"
import { SelectField } from "./fields/select-field"
import { TextField } from "./fields/text-field"

type Props = {
  param: ParamDefinition
  value: unknown
  onChange: (value: unknown) => void
  onPickImage?: () => void
  isPicking?: boolean
  thumbnailUri?: string
  onDropUri?: (uri: string) => void
}

export function ParamField({ param, value, onChange, onPickImage, isPicking, thumbnailUri, onDropUri }: Props) {
  const label = param.type === "boolean" ? null : (param.label ?? param.name)

  return (
    <Stack spacing="tight">
      {label && (
        <Text variant="label" color="secondary">
          {label}
        </Text>
      )}
      {renderField(param, value, onChange, onPickImage, isPicking, thumbnailUri, onDropUri)}
    </Stack>
  )
}

function renderField(
  param: ParamDefinition,
  value: unknown,
  onChange: (v: unknown) => void,
  onPickImage?: () => void,
  isPicking?: boolean,
  thumbnailUri?: string,
  onDropUri?: (uri: string) => void,
) {
  switch (param.type) {
    case "prompt":
      return <PromptField param={param} value={(value as string) ?? ""} onChange={onChange} />
    case "text":
      return <TextField param={param} value={(value as string) ?? ""} onChange={onChange} />
    case "number":
      return <NumberField param={param} value={(value as number) ?? ""} onChange={onChange} />
    case "integer":
      return <IntegerField param={param} value={(value as number) ?? ""} onChange={onChange} />
    case "boolean":
      return <BooleanField param={param} value={(value as boolean) ?? param.default ?? false} onChange={onChange} />
    case "select":
      return <SelectField param={param} value={(value as string) ?? param.default ?? ""} onChange={onChange} />
    case "seed":
      return <SeedField value={(value as number) ?? ""} onChange={onChange} />
    case "dimensions":
      return <DimensionsField param={param} value={(value as { w: number; h: number }) ?? null} onChange={onChange} />
    case "image":
      return (
        <ImageField
          value={(value as string) ?? ""}
          onPick={onPickImage ?? (() => {})}
          onClear={() => onChange("")}
          isPicking={isPicking ?? false}
          thumbnailUri={thumbnailUri}
          onDropUri={onDropUri}
        />
      )
    case "video":
      return <PlaceholderField typeName="Video" />
  }
}
