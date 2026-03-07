import type * as React from "react"

import { cn } from "./utils"

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-16 w-full field-sizing-content rounded-md bg-surface-3 px-2 py-1.5 text-[12px] text-text-primary placeholder:text-text-tertiary transition-colors duration-[50ms] resize-none outline-none",
        "focus-visible:ring-1 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-40",
        "aria-invalid:ring-1 aria-invalid:ring-destructive aria-invalid:text-destructive",
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
export type { TextareaProps }
