import type * as React from "react";

import { cn } from "@/lib/utils";

function InputGroup({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="input-group"
      className={cn(
        "flex items-stretch",
        "[&>*]:rounded-none",
        "[&>*:first-child]:rounded-l-md",
        "[&>*:last-child]:rounded-r-md",
        "[&>*:not(:first-child)]:border-l-0",
        "[&>[data-slot=input]]:flex-1 [&>[data-slot=input]]:min-w-0",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function InputGroupAddon({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="input-group-addon"
      className={cn(
        "flex items-center justify-center bg-surface-2 border border-border-strong px-1.5 text-text-secondary",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { InputGroup, InputGroupAddon };
