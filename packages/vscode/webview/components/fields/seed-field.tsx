import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = { value: number | ""; onChange: (v: number) => void; id: string };

export function SeedField({ value, onChange, id }: Props) {
  const randomize = () => onChange(Math.floor(Math.random() * 2147483647));

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <Input
          id={id}
          type="number"
          min={0}
          step={1}
          placeholder="Random"
          value={value}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (!isNaN(n)) onChange(n);
          }}
        />
      </div>
      <Button variant="ghost" size="sm" onClick={randomize}>
        ⟳
      </Button>
    </div>
  );
}
