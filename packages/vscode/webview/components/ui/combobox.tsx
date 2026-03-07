import { useRef, useState } from "react";
import { Popover } from "@base-ui/react/popover";

import { cn } from "@/lib/utils";

type Option = { value: string; label?: string };

type ComboboxProps = {
  options: Option[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  id?: string;
};

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder,
  id,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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
      if (q) {
        handleSelect(q);
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
    // Delay to allow click on option
    setTimeout(() => {
      if (query.trim() && query.trim() !== displayValue) {
        onValueChange(query.trim());
      }
      setQuery("");
      setOpen(false);
    }, 150);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={
          <input
            ref={inputRef}
            id={id}
            type="text"
            value={open ? query : displayValue}
            placeholder={placeholder ?? "Search or type..."}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
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
                "data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95",
              )}
            >
              {filtered.map((opt) => (
                <div
                  key={opt.value}
                  role="option"
                  aria-selected={opt.value === value}
                  className={cn(
                    "flex w-full cursor-default select-none items-center rounded-sm py-1 px-2 text-[12px] outline-none",
                    "hover:bg-hover hover:text-text-primary",
                    opt.value === value && "text-primary",
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(opt.value);
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
  );
}
