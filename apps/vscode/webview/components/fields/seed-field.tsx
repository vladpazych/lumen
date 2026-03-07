import { Row } from "../../kit/row"
import { Input } from "../../kit/input"
import { Button } from "../../kit/button"

type Props = { value: number | ""; onChange: (v: number) => void }

export function SeedField({ value, onChange }: Props) {
  const randomize = () => onChange(Math.floor(Math.random() * 2147483647))

  return (
    <Row spacing="snug">
      <div className="flex-1">
        <Input
          type="number"
          min={0}
          step={1}
          placeholder="Random"
          value={value}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10)
            if (!isNaN(n)) onChange(n)
          }}
        />
      </div>
      <Button variant="ghost" size="sm" onClick={randomize}>
        ⟳
      </Button>
    </Row>
  )
}
