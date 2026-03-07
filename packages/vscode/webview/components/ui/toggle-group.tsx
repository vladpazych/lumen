import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { Toggle } from "@base-ui/react/toggle";
import type * as React from "react";

import { cn } from "@/lib/utils";

function ToggleGroup({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive>) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      className={cn("flex flex-wrap gap-1", className)}
      {...props}
    />
  );
}

function ToggleGroupItem({
  className,
  ...props
}: Toggle.Props & { children?: React.ReactNode }) {
  return (
    <Toggle
      data-slot="toggle-group-item"
      className={cn(
        "inline-flex items-center justify-center min-h-6 gap-1 px-1.5 text-[11px] font-medium rounded-md border border-transparent transition-colors select-none",
        "bg-surface-3 text-text-primary hover:bg-surface-3/80 active:bg-surface-2",
        "data-pressed:bg-primary/15 data-pressed:text-primary data-pressed:border-primary/30",
        "outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
