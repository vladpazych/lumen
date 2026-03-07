import { Input } from "../../kit/input"
import { Textarea } from "../../kit/textarea"
import type { TextParam } from "@lumen/core/types"

type Props = { param: TextParam; value: string; onChange: (v: string) => void }

export function TextField({ param, value, onChange }: Props) {
  if (param.multiline) {
    return <Textarea rows={3} placeholder={param.default} value={value} onChange={(e) => onChange(e.target.value)} />
  }
  return <Input type="text" placeholder={param.default} value={value} onChange={(e) => onChange(e.target.value)} />
}
