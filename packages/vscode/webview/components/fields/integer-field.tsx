import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import type { IntegerParam } from "@lumen/core/types";

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
    const current =
      typeof value === "number" ? value : (param.default ?? param.min!);
    return (
      <div className="flex items-center gap-2">
        <Slider
          value={current}
          min={param.min}
          max={param.max}
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
