import { useEffect, useState } from "react";
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

function formatStatus(
  elapsed: number,
  progress?: number,
  stage?: "queued" | "running",
): string {
  const label = stage === "queued" ? "Queued" : "Generating";
  if (progress && progress > 0) {
    const pct = Math.round(progress * 100);
    return `${label}... ${pct}% · ${elapsed}s`;
  }
  return `${label}... ${elapsed}s`;
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

  const showProgress = loading && progress !== undefined && progress > 0;
  const statusText = formatStatus(elapsed, progress, stage);

  return (
    <div className="flex flex-col gap-2">
      {showProgress && <Progress value={progress * 100} />}
      {hasQuality && onPreview ? (
        <div className="flex gap-2">
          <Button
            variant="outline"
            grow
            disabled={loading || disabled}
            onClick={onPreview}
          >
            {loading ? statusText : "Preview"}
          </Button>
          <Button
            variant="accent"
            grow
            disabled={loading || disabled}
            onClick={onGenerate}
          >
            {loading ? statusText : "Generate"}
          </Button>
        </div>
      ) : (
        <Button
          variant="accent"
          grow
          disabled={loading || disabled}
          onClick={onGenerate}
        >
          {loading ? statusText : "Generate"}
        </Button>
      )}
    </div>
  );
}
