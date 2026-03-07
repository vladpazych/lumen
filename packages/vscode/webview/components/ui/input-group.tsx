import type * as React from "react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button, type ButtonProps } from "@/components/ui/button";

function InputGroup({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        "flex h-7 w-full items-center rounded-md border border-border-strong bg-surface-3 transition-colors",
        "has-[[data-slot=input-group-control]:focus-visible]:ring-1 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50",
        className,
      )}
      {...props}
    />
  );
}

function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        "flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0",
        className,
      )}
      {...props}
    />
  );
}

function InputGroupButton({
  className,
  variant = "ghost",
  size = "icon-sm",
  ...props
}: ButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      className={cn(
        "h-full rounded-none border-0 shadow-none last:rounded-r-[calc(var(--radius-md)-1px)]",
        className,
      )}
      {...props}
    />
  );
}

function InputGroupAddon({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="input-group-addon"
      className={cn(
        "flex items-center justify-center px-1.5 text-text-secondary [&>svg:not([class*='size-'])]:size-3",
        className,
      )}
      {...props}
    />
  );
}

export { InputGroup, InputGroupInput, InputGroupButton, InputGroupAddon };
