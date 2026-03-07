import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import type * as React from "react";

import { cn } from "@/lib/utils";

function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <TooltipPrimitive.Provider>{children}</TooltipPrimitive.Provider>;
}

function Tooltip({ children, ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root {...props}>{children}</TooltipPrimitive.Root>;
}

function TooltipTrigger({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>) {
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      className={cn("cursor-default", className)}
      {...props}
    />
  );
}

function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Popup> & {
  sideOffset?: number;
}) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner sideOffset={sideOffset}>
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "bg-surface-raised text-text-secondary z-50 max-w-56 rounded-md border border-border px-2.5 py-1.5 text-[11px] leading-snug shadow-md",
            "data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95",
            className,
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
