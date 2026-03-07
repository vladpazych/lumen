import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type Props = {
  loading: boolean;
  progress?: number;
  stage?: "queued" | "running";
  hasQuality?: boolean;
  disabled?: boolean;
  onPreview?: () => void;
  onGenerate: () => void;
};

function formatElapsed(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export function GenerateSection({
  loading,
  progress,
  stage,
  hasQuality,
  disabled,
  onPreview,
  onGenerate,
}: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!loading) {
      setElapsed(0);
      return;
    }
    const t0 = Date.now();
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - t0) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [loading]);

  const hasProgress = progress !== undefined && progress > 0;

  if (loading) {
    const label = stage === "queued" ? "Queued" : "Generating";
    const pct = hasProgress ? Math.round(progress * 100) : null;

    return (
      <div className="flex flex-col gap-2">
        {hasProgress && <Progress value={progress * 100} />}
        <div className="flex items-center gap-2 text-[11px] text-text-secondary">
          <Loader2 className="size-3 animate-spin" />
          <span>
            {label}
            {pct != null && <span className="text-text-primary"> {pct}%</span>}
          </span>
          <span className="ml-auto tabular-nums text-text-tertiary">
            {formatElapsed(elapsed)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {hasQuality && onPreview ? (
        <div className="flex gap-2">
          <Button
            variant="outline"
            grow
            disabled={disabled}
            onClick={onPreview}
          >
            Preview
          </Button>
          <Button
            variant="accent"
            grow
            disabled={disabled}
            onClick={onGenerate}
          >
            Generate
          </Button>
        </div>
      ) : (
        <Button variant="accent" grow disabled={disabled} onClick={onGenerate}>
          Generate
        </Button>
      )}
    </div>
  );
}
