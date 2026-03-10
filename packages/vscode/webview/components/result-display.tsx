import type { OutputAsset } from "@vladpazych/lumen/types";

type Props = {
  outputs?: OutputAsset[];
  error?: string;
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

export function ResultDisplay({ outputs, error }: Props) {
  if (error) {
    return (
      <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
        <p className="text-[11px] text-destructive">{error}</p>
      </div>
    );
  }
  if (outputs && outputs.length > 0) {
    const metadata = outputs.find((output) => output.metadata)?.metadata;
    const multi = outputs.length > 1;
    return (
      <div className="flex flex-col gap-2">
        <div className={multi ? "grid grid-cols-2 gap-2" : ""}>
          {outputs.map((output, index) =>
            output.type === "video" ? (
              <video
                key={`${output.url}-${index}`}
                src={output.url}
                controls
                className="w-full rounded-md"
              />
            ) : (
              <img
                key={`${output.url}-${index}`}
                src={output.url}
                alt={`Generated ${index + 1}`}
                className="w-full rounded-md"
              />
            ),
          )}
        </div>
        {metadata && <CostBadge metadata={metadata} />}
      </div>
    );
  }
  return null;
}
