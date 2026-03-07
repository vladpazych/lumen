import { Textarea } from "@/components/ui/textarea";
import type { PromptParam } from "@lumen/core/types";

type Props = {
  param: PromptParam;
  value: string;
  onChange: (v: string) => void;
  id: string;
};

export function PromptField({ param, value, onChange, id }: Props) {
  return (
    <Textarea
      id={id}
      rows={4}
      placeholder={param.placeholder ?? param.default ?? "Enter prompt..."}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
