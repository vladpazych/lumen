import { useEffect, useRef, useState } from "react";

// Strip ANSI escape codes for clean display
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?\x07|\[[\d;]*[A-Za-z]/g;
function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}

type Props = {
  lines: string[];
};

export function ServerLog({ lines }: Props) {
  const [open, setOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines.length, open]);

  if (lines.length === 0) return null;

  return (
    <div className="mt-1">
      <button
        type="button"
        className="text-[10px] text-text-tertiary hover:text-text-secondary"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide logs" : "Show logs"}
      </button>
      {open && (
        <pre className="mt-1 max-h-48 overflow-auto rounded bg-surface-secondary p-2 text-[10px] leading-relaxed text-text-secondary">
          {lines.map((l) => stripAnsi(l)).join("\n")}
          <div ref={bottomRef} />
        </pre>
      )}
    </div>
  );
}
