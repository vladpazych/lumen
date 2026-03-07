import { Combobox } from "@/components/ui/combobox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { SelectParam } from "@lumen/core/types";

type Props = {
  param: SelectParam;
  value: string;
  onChange: (v: string) => void;
  id: string;
};

export function SelectField({ param, value, onChange, id }: Props) {
  const display = param.display ?? "dropdown";

  if (display === "radio") {
    return (
      <RadioGroup
        value={value}
        onValueChange={(v) => v != null && onChange(v as string)}
      >
        {param.options.map((opt) => (
          <RadioGroupItem key={opt.value} value={opt.value}>
            {opt.label ?? opt.value}
          </RadioGroupItem>
        ))}
      </RadioGroup>
    );
  }

  if (display === "toggle") {
    return (
      <ToggleGroup
        value={value ? [value] : []}
        onValueChange={(vals) => {
          const next = (vals as string[]).find((v) => v !== value);
          if (next != null) onChange(next);
        }}
      >
        {param.options.map((opt) => (
          <ToggleGroupItem key={opt.value} value={opt.value}>
            {opt.label ?? opt.value}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    );
  }

  return (
    <Combobox
      options={param.options}
      value={value}
      onValueChange={onChange}
      placeholder={param.placeholder}
      allowCustom={param.allowCustom}
      id={id}
    />
  );
}
