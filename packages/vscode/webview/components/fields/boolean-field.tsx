import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { BooleanParam } from "@vladpazych/lumen/types";

type Props = {
  param: BooleanParam;
  value: boolean;
  onChange: (v: boolean) => void;
  id: string;
};

export function BooleanField({ param, value, onChange, id }: Props) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 cursor-pointer">
      <Checkbox
        id={id}
        checked={value}
        onCheckedChange={(checked) => onChange(checked as boolean)}
      />
      <Label htmlFor={id}>{param.label ?? param.name}</Label>
    </label>
  );
}
