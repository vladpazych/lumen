import type * as React from "react";

import { cn } from "@/lib/utils";

function Progress({
  className,
  value,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { value?: number }) {
  return (
    <div
      data-slot="progress"
      className={cn(
        "relative h-1 w-full overflow-hidden rounded-full bg-surface-3",
        className,
      )}
      {...props}
    >
      <div
        className="bg-primary h-full transition-all duration-300 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }}
      />
    </div>
  );
}

export { Progress };
