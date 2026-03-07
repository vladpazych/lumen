import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-[12px] font-medium transition-colors duration-[50ms] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 [&_svg:not([class*='size-'])]:size-3 [&_svg]:pointer-events-none [&_svg]:shrink-0 shrink-0 select-none border border-transparent",
  {
    variants: {
      variant: {
        default:
          "bg-surface-3 text-text-primary hover:bg-surface-3/80 active:bg-surface-2",
        accent:
          "bg-primary/15 text-primary border-primary/30 hover:bg-primary/25 active:bg-primary/35",
        outline:
          "border-border-strong bg-surface-1 hover:bg-surface-2 active:bg-surface-3 text-text-primary",
        ghost:
          "hover:bg-hover active:bg-active text-text-secondary hover:text-text-primary",
        destructive:
          "bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/25 active:bg-destructive/35",
        link: "text-primary underline-offset-4 hover:underline",
        success:
          "bg-success/15 text-success border-success/30 hover:bg-success/25 active:bg-success/35",
      },
      size: {
        default: "h-7 gap-1.5 px-2.5 py-1",
        xs: "min-h-6 gap-1 px-1.5 text-[11px] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-6 gap-1 px-2 text-[11px]",
        lg: "h-8 gap-2 px-3",
        icon: "size-7",
        "icon-xs": "size-5 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-6",
        "icon-lg": "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface ButtonProps
  extends ButtonPrimitive.Props, VariantProps<typeof buttonVariants> {
  align?: "left";
  grow?: boolean;
  children?: React.ReactNode;
}

function Button({
  className,
  variant,
  size,
  align,
  grow,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(
        buttonVariants({ variant, size, className }),
        align === "left" && "justify-start",
        grow && "flex-1 shrink",
      )}
      {...props}
    />
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
