import { Input } from "@/components/ui/input";
import type { NumberParam } from "@lumen/core/types";

type Props = {
  param: NumberParam;
  value: number | "";
  onChange: (v: number) => void;
  id: string;
};

export function NumberField({ param, value, onChange, id }: Props) {
  return (
    <Input
      id={id}
      type="number"
      min={param.min}
      max={param.max}
      step={param.step ?? 0.1}
      placeholder={param.default?.toString()}
      value={value}
      onChange={(e) => {
        const n = parseFloat(e.target.value);
        if (!isNaN(n)) onChange(n);
      }}
    />
  );
}
