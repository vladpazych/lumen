import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { SelectParam } from "@lumen/core/types";

type Props = {
  param: SelectParam;
  value: string;
  onChange: (v: string) => void;
  id: string;
};

export function SelectField({ param, value, onChange, id }: Props) {
  return (
    <Select value={value || null} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger id={id}>
        <SelectValue placeholder="Select..." />
      </SelectTrigger>
      <SelectContent>
        {param.options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label ?? opt.value}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
