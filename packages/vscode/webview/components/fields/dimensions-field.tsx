import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { DimensionsParam } from "@lumen/core/types";

type Dims = { w: number; h: number };
type Props = {
  param: DimensionsParam;
  value: Dims | null;
  onChange: (v: Dims) => void;
};

export function DimensionsField({ param, value, onChange }: Props) {
  const current = value ?? param.default ?? { w: 1024, h: 1024 };
  const presets = param.presets ?? [];

  return (
    <div className="flex flex-col gap-2">
      {presets.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {presets.map((p) => (
            <Button
              key={p.label}
              variant={
                current.w === p.w && current.h === p.h ? "accent" : "ghost"
              }
              size="xs"
              onClick={() => onChange({ w: p.w, h: p.h })}
            >
              {p.label}
            </Button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="w-20">
          <Input
            type="number"
            value={current.w}
            min={64}
            step={64}
            onChange={(e) =>
              onChange({
                ...current,
                w: parseInt(e.target.value, 10) || current.w,
              })
            }
          />
        </div>
        <span className="text-[11px] text-text-secondary">×</span>
        <div className="w-20">
          <Input
            type="number"
            value={current.h}
            min={64}
            step={64}
            onChange={(e) =>
              onChange({
                ...current,
                h: parseInt(e.target.value, 10) || current.h,
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
