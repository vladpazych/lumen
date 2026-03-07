import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import type { NumberParam } from "@lumen/core/types";

type Props = {
  param: NumberParam;
  value: number | "";
  onChange: (v: number) => void;
  id: string;
};

export function NumberField({ param, value, onChange, id }: Props) {
  const useSlider =
    param.display === "slider" && param.min != null && param.max != null;

  if (useSlider) {
    const current =
      typeof value === "number" ? value : (param.default ?? param.min!);
    return (
      <div className="flex items-center gap-2">
        <Slider
          value={current}
          min={param.min}
          max={param.max}
          step={param.step ?? 0.1}
          onValueChange={(v) => onChange(v as number)}
        />
        <span className="min-w-8 text-right text-[11px] text-text-secondary tabular-nums">
          {current}
        </span>
      </div>
    );
  }

  return (
    <NumberInput
      id={id}
      min={param.min}
      max={param.max}
      step={param.step ?? 0.1}
      placeholder={param.placeholder ?? param.default?.toString()}
      value={value}
      onChange={onChange}
      parse={parseFloat}
    />
  );
}

function NumberInput({
  value,
  onChange,
  parse,
  min,
  max,
  ...props
}: {
  value: number | "";
  onChange: (v: number) => void;
  parse: (s: string) => number;
  min?: number;
  max?: number;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? (value === "" ? "" : String(value));

  const commit = (raw: string) => {
    setDraft(null);
    const n = parse(raw);
    if (isNaN(n)) return;
    const clamped =
      min != null && n < min ? min : max != null && n > max ? max : n;
    onChange(clamped);
  };

  return (
    <Input
      type="number"
      min={min}
      max={max}
      value={display}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit(e.currentTarget.value);
      }}
      {...props}
    />
  );
}
