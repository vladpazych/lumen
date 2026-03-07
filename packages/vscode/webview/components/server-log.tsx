import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

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
  const lastLine = cleaned[cleaned.length - 1] ?? "";

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
        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[10px] text-text-tertiary hover:text-text-secondary ${open ? "border-t border-border" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        {!open && <span className="min-w-0 flex-1 truncate">{lastLine}</span>}
        {open && <span className="flex-1">Hide logs</span>}
        {open ? (
          <ChevronDown className="size-3 shrink-0" />
        ) : (
          <ChevronUp className="size-3 shrink-0" />
        )}
      </button>
    </div>
  );
}
