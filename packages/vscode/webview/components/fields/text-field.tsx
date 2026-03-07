import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TextParam } from "@lumen/core/types";

type Props = {
  param: TextParam;
  value: string;
  onChange: (v: string) => void;
  id: string;
};

export function TextField({ param, value, onChange, id }: Props) {
  if (param.multiline) {
    return (
      <Textarea
        id={id}
        rows={3}
        placeholder={param.default}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <Input
      id={id}
      type="text"
      placeholder={param.default}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
