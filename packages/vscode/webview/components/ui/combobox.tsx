import { useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type Option = { value: string; label?: string };

type ComboboxProps = {
  options: Option[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  allowCustom?: boolean;
  id?: string;
};

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder,
  allowCustom = false,
  id,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const displayValue =
    options.find((o) => o.value === value)?.label ?? value ?? "";

  const filtered = options.filter((o) => {
    const text = (o.label ?? o.value).toLowerCase();
    return text.includes(query.toLowerCase());
  });

  const handleSelect = (val: string) => {
    onValueChange(val);
    setQuery("");
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (!open) setOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const q = query.trim();
      if (allowCustom && q) {
        handleSelect(q);
      } else if (filtered.length > 0) {
        handleSelect(filtered[0].value);
      }
    } else if (e.key === "Escape") {
      setQuery("");
      setOpen(false);
    }
  };

  const handleFocus = () => {
    setQuery("");
    setOpen(true);
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (allowCustom && query.trim() && query.trim() !== displayValue) {
        onValueChange(query.trim());
      }
      setQuery("");
      setOpen(false);
    }, 150);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        value={open ? query : displayValue}
        placeholder={
          placeholder ?? (allowCustom ? "Search or type..." : "Search...")
        }
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(
          "flex h-7 w-full rounded-md bg-surface-3 px-2 py-1 text-[12px] text-text-primary transition-colors outline-none placeholder:text-text-tertiary hover:bg-surface-3/80 focus-visible:ring-1 focus-visible:ring-ring",
          "pr-6",
        )}
        autoComplete="off"
      />
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 size-3 text-text-secondary" />
      {open && filtered.length > 0 && (
        <div
          className={cn(
            "absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-surface-raised p-1 shadow-md",
          )}
        >
          {filtered.map((opt) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={cn(
                "relative flex w-full cursor-default select-none items-center rounded-sm py-1 pl-2 pr-7 text-[12px] outline-none",
                "hover:bg-hover hover:text-text-primary",
                opt.value === value && "text-primary",
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(opt.value);
              }}
            >
              {opt.label ?? opt.value}
              {opt.value === value && (
                <Check className="absolute right-2 size-3" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
