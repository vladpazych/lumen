import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type Props = {
  loading: boolean;
  progress?: number;
  hasQuality?: boolean;
  onPreview?: () => void;
  onGenerate: () => void;
};

function formatStatus(elapsed: number, progress?: number): string {
  if (progress && progress > 0) {
    const pct = Math.round(progress * 100);
    return `${pct}% · ${elapsed}s`;
  }
  return `${elapsed}s`;
}

export function GenerateSection({
  loading,
  progress,
  hasQuality,
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

  return (
    <div className="flex flex-col gap-2">
      {showProgress && <Progress value={progress * 100} />}
      {hasQuality && onPreview ? (
        <div className="flex gap-2">
          <Button variant="outline" grow disabled={loading} onClick={onPreview}>
            {loading ? formatStatus(elapsed, progress) : "Preview"}
          </Button>
          <Button variant="accent" grow disabled={loading} onClick={onGenerate}>
            {loading ? formatStatus(elapsed, progress) : "Generate"}
          </Button>
        </div>
      ) : (
        <Button variant="accent" grow disabled={loading} onClick={onGenerate}>
          {loading
            ? `Generating... ${formatStatus(elapsed, progress)}`
            : "Generate"}
        </Button>
      )}
    </div>
  );
}
