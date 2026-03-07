import { Stack } from "../../kit/stack"
import { Row } from "../../kit/row"
import { Text } from "../../kit/text"
import { Input } from "../../kit/input"
import { Button } from "../../kit/button"
import type { DimensionsParam } from "@lumen/core/types"

type Dims = { w: number; h: number }
type Props = { param: DimensionsParam; value: Dims | null; onChange: (v: Dims) => void }

export function DimensionsField({ param, value, onChange }: Props) {
  const current = value ?? param.default ?? { w: 1024, h: 1024 }
  const presets = param.presets ?? []

  return (
    <Stack spacing="snug">
      {presets.length > 0 && (
        <Row spacing="tight" wrap>
          {presets.map((p) => (
            <Button
              key={p.label}
              variant={current.w === p.w && current.h === p.h ? "accent" : "ghost"}
              size="xs"
              onClick={() => onChange({ w: p.w, h: p.h })}
            >
              {p.label}
            </Button>
          ))}
        </Row>
      )}
      <Row spacing="snug" align="center">
        <div className="w-20">
          <Input
            type="number"
            value={current.w}
            min={64}
            step={64}
            onChange={(e) => onChange({ ...current, w: parseInt(e.target.value, 10) || current.w })}
          />
        </div>
        <Text variant="caption" color="secondary">
          ×
        </Text>
        <div className="w-20">
          <Input
            type="number"
            value={current.h}
            min={64}
            step={64}
            onChange={(e) => onChange({ ...current, h: parseInt(e.target.value, 10) || current.h })}
          />
        </div>
      </Row>
    </Stack>
  )
}
