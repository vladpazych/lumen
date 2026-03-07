import { Input } from "@/components/ui/input";
import type { IntegerParam } from "@lumen/core/types";

type Props = {
  param: IntegerParam;
  value: number | "";
  onChange: (v: number) => void;
  id: string;
};

export function IntegerField({ param, value, onChange, id }: Props) {
  return (
    <Input
      id={id}
      type="number"
      min={param.min}
      max={param.max}
      step={1}
      placeholder={param.placeholder ?? param.default?.toString()}
      value={value}
      onChange={(e) => {
        const n = parseInt(e.target.value, 10);
        if (!isNaN(n)) onChange(n);
      }}
    />
  );
}
