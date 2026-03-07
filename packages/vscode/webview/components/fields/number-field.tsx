import { Input } from "../../kit/input"
import type { NumberParam } from "@lumen/core/types"

type Props = { param: NumberParam; value: number | ""; onChange: (v: number) => void }

export function NumberField({ param, value, onChange }: Props) {
  return (
    <Input
      type="number"
      min={param.min}
      max={param.max}
      step={param.step ?? 0.1}
      placeholder={param.default?.toString()}
      value={value}
      onChange={(e) => {
        const n = parseFloat(e.target.value)
        if (!isNaN(n)) onChange(n)
      }}
    />
  )
}
