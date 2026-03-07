import type * as React from "react";

import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

function Input({ className, type, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-7 w-full min-w-0 rounded-md bg-surface-3 px-2 py-1 text-[12px] text-text-primary placeholder:text-text-tertiary transition-colors duration-[50ms] outline-none",
        "focus-visible:ring-1 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-40",
        "aria-invalid:ring-1 aria-invalid:ring-destructive aria-invalid:text-destructive",
        "file:border-0 file:bg-transparent file:text-[12px] file:font-medium file:text-text-primary",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
export type { InputProps };
