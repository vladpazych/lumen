import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import type { IntegerParam } from "@vladpazych/lumen/types";

type Props = {
  param: IntegerParam;
  value: number | "";
  onChange: (v: number) => void;
  id: string;
};

export function IntegerField({ param, value, onChange, id }: Props) {
  const useSlider =
    param.display === "slider" && param.min != null && param.max != null;

  if (useSlider) {
    const min = param.min;
    const max = param.max;
    const current = typeof value === "number" ? value : (param.default ?? min);
    return (
      <div className="flex items-center gap-2">
        <Slider
          value={current}
          min={min}
          max={max}
          step={1}
          onValueChange={(v) => onChange(v as number)}
        />
        <span className="min-w-8 text-right text-[11px] text-text-secondary tabular-nums">
          {current}
        </span>
      </div>
    );
  }

  return (
    <IntegerInput
      id={id}
      min={param.min}
      max={param.max}
      placeholder={param.placeholder ?? param.default?.toString()}
      value={value}
      onChange={onChange}
    />
  );
}

function IntegerInput({
  value,
  onChange,
  min,
  max,
  ...props
}: {
  value: number | "";
  onChange: (v: number) => void;
  min?: number;
  max?: number;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? (value === "" ? "" : String(value));

  const commit = (raw: string) => {
    setDraft(null);
    const n = parseInt(raw, 10);
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
      step={1}
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
