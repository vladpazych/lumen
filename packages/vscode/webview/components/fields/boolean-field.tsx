import { Row } from "../../kit/row"
import { Text } from "../../kit/text"
import { Checkbox } from "../../kit/checkbox"
import type { BooleanParam } from "../../../shared/types"

type Props = { param: BooleanParam; value: boolean; onChange: (v: boolean) => void }

export function BooleanField({ param, value, onChange }: Props) {
  return (
    <label className="cursor-pointer">
      <Row spacing="snug">
        <Checkbox checked={value} onCheckedChange={(checked) => onChange(checked as boolean)} />
        <Text variant="caption" color="secondary">
          {param.label ?? param.name}
        </Text>
      </Row>
    </label>
  )
}
