import { useEffect, useRef, useState } from "react";

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

  const cleaned = lines.map((l) => stripAnsi(l));

  return (
    <div className="border-t border-border">
      {open && (
        <pre className="h-[200px] overflow-y-auto px-3 py-2 text-[10px] leading-relaxed text-text-secondary">
          {cleaned.join("\n")}
          <div ref={bottomRef} />
        </pre>
      )}
      <button
        type="button"
        className={`flex w-full items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] text-text-tertiary hover:text-text-secondary ${open ? "border-t border-border" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide logs" : "Show logs"}
      </button>
    </div>
  );
}
