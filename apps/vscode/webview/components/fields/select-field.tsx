import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../kit/select"
import type { SelectParam } from "../../../shared/types"

type Props = { param: SelectParam; value: string; onChange: (v: string) => void }

export function SelectField({ param, value, onChange }: Props) {
  return (
    <Select value={value || null} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger>
        <SelectValue placeholder="Select..." />
      </SelectTrigger>
      <SelectContent>
        {param.options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label ?? opt.value}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
