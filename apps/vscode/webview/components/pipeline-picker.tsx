import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../kit/select"
import type { PipelineConfig } from "../../shared/types"

type Props = {
  pipelines: PipelineConfig[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function PipelinePicker({ pipelines, selectedId, onSelect }: Props) {
  if (pipelines.length === 0) return null

  return (
    <Select value={selectedId} onValueChange={(value) => value && onSelect(value)}>
      <SelectTrigger>
        <SelectValue placeholder="Select pipeline..." />
      </SelectTrigger>
      <SelectContent>
        {pipelines.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
