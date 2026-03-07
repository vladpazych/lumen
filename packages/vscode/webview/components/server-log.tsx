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

  return (
    <>
      <button
        type="button"
        className="w-full border-t border-border pt-2 text-[10px] text-text-tertiary hover:text-text-secondary text-left"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide logs" : "Show logs"}
      </button>
      {open && (
        <pre className="h-[200px] overflow-y-auto bg-card rounded p-2 text-[10px] leading-relaxed text-text-secondary">
          {lines.map((l) => stripAnsi(l)).join("\n")}
          <div ref={bottomRef} />
        </pre>
      )}
    </>
  );
}
