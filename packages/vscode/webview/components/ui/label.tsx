import type * as React from "react";

import { cn } from "@/lib/utils";

function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      data-slot="label"
      className={cn(
        "text-[11px] font-medium text-text-secondary select-none",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
