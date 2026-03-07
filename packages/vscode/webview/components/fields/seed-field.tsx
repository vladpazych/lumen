import { Shuffle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InputGroup } from "@/components/ui/input-group";

type Props = { value: number | ""; onChange: (v: number) => void; id: string };

export function SeedField({ value, onChange, id }: Props) {
  const randomize = () => onChange(Math.floor(Math.random() * 2147483647));

  return (
    <InputGroup>
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
      <Button variant="outline" size="icon-sm" onClick={randomize}>
        <Shuffle className="size-3" />
      </Button>
    </InputGroup>
  );
}
