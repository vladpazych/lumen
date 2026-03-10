import { useRef, useState } from "react";
import { X } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import type { TagsParam } from "@vladpazych/lumen/types";

import { cn } from "@/lib/utils";

type Props = {
  param: TagsParam;
  value: string[];
  onChange: (v: string[]) => void;
  id: string;
};

export function TagsField({ param, value, onChange, id }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const allowCustom = param.allowCustom !== false;
  const options = param.options ?? [];
  const atMax = param.max != null && value.length >= param.max;

  const filtered = options.filter((o) => {
    if (value.includes(o.value)) return false;
    const text = (o.label ?? o.value).toLowerCase();
    return text.includes(query.toLowerCase());
  });

  const addTag = (tag: string) => {
    if (!tag || value.includes(tag)) return;
    if (atMax) return;
    onChange([...value, tag]);
    setQuery("");
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((v) => v !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const q = query.trim();
      if (q && allowCustom) {
        addTag(q);
      } else if (q && filtered.length > 0) {
        addTag(filtered[0].value);
      }
    } else if (e.key === "Backspace" && !query && value.length > 0) {
      removeTag(value[value.length - 1]);
    } else if (e.key === "Escape") {
      setQuery("");
      setOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((tag) => {
            const opt = options.find((o) => o.value === tag);
            return (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px] text-text-primary"
              >
                {opt?.label ?? tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-0.5 rounded-sm hover:bg-hover text-text-tertiary hover:text-text-primary"
                >
                  <X className="size-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
      {!atMax && (
        <Popover.Root open={open && filtered.length > 0} onOpenChange={setOpen}>
          <Popover.Trigger
            render={
              <input
                ref={inputRef}
                id={id}
                type="text"
                value={query}
                placeholder={
                  param.placeholder ??
                  (allowCustom ? "Type to add..." : "Select...")
                }
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (!open) setOpen(true);
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                className="flex h-7 w-full rounded-md bg-surface-3 px-2 py-1 text-[12px] text-text-primary transition-colors outline-none placeholder:text-text-tertiary hover:bg-surface-3/80 focus-visible:ring-1 focus-visible:ring-ring"
                autoComplete="off"
              />
            }
          />
          {filtered.length > 0 && (
            <Popover.Portal>
              <Popover.Positioner sideOffset={4} side="bottom" align="start">
                <Popover.Popup
                  className={cn(
                    "bg-surface-raised text-text-primary z-50 min-w-36 max-h-48 overflow-y-auto rounded-md border border-border shadow-md p-1",
                    "data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0",
                  )}
                >
                  {filtered.map((opt) => (
                    <div
                      key={opt.value}
                      role="option"
                      aria-selected={false}
                      className="flex w-full cursor-default select-none items-center rounded-sm py-1 px-2 text-[12px] outline-none hover:bg-hover hover:text-text-primary"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addTag(opt.value);
                      }}
                    >
                      {opt.label ?? opt.value}
                    </div>
                  ))}
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          )}
        </Popover.Root>
      )}
    </div>
  );
}
