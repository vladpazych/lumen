import { Radio } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import type * as React from "react";

import { cn } from "@/lib/utils";

function RadioGroup({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive>) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  );
}

function RadioGroupItem({
  className,
  children,
  ...props
}: Radio.Root.Props & { children?: React.ReactNode }) {
  return (
    <label
      className={cn(
        "flex items-center gap-2 cursor-pointer text-[12px] text-text-primary",
        "has-[[data-disabled]]:cursor-not-allowed has-[[data-disabled]]:opacity-40",
        className,
      )}
    >
      <Radio.Root
        data-slot="radio-group-item"
        className="size-4 shrink-0 rounded-full border border-border-strong bg-surface-3 transition-colors data-checked:border-primary data-checked:bg-primary/15 outline-none focus-visible:ring-1 focus-visible:ring-ring"
        {...props}
      >
        <Radio.Indicator className="flex items-center justify-center size-full">
          <span className="size-2 rounded-full bg-primary" />
        </Radio.Indicator>
      </Radio.Root>
      {children}
    </label>
  );
}

export { RadioGroup, RadioGroupItem };
