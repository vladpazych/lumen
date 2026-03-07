import { Textarea } from "../../kit/textarea"
import type { PromptParam } from "@lumen/core/types"

type Props = { param: PromptParam; value: string; onChange: (v: string) => void }

export function PromptField({ param, value, onChange }: Props) {
  return (
    <Textarea
      rows={4}
      placeholder={param.default ?? "Enter prompt..."}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
