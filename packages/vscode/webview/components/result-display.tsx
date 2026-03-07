type Props = {
  imageUrl?: string;
  error?: string;
  metadata?: Record<string, unknown>;
};

function CostBadge({ metadata }: { metadata: Record<string, unknown> }) {
  const parts: string[] = [];
  if (metadata.duration_s != null) parts.push(`${metadata.duration_s}s`);
  if (metadata.cost_usd != null) parts.push(`$${metadata.cost_usd}`);
  if (metadata.gpu) parts.push(String(metadata.gpu));
  if (parts.length === 0) return null;
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-[11px] text-text-tertiary">
        {parts.join(" · ")}
      </span>
    </div>
  );
}

export function ResultDisplay({ imageUrl, error, metadata }: Props) {
  if (error) {
    return (
      <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
        <p className="text-[11px] text-destructive">{error}</p>
      </div>
    );
  }
  if (imageUrl) {
    return (
      <div>
        <img src={imageUrl} alt="Generated" className="w-full rounded-md" />
        {metadata && <CostBadge metadata={metadata} />}
      </div>
    );
  }
  return null;
}
