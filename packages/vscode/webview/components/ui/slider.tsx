import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import type * as React from "react";

import { cn } from "@/lib/utils";

type SliderProps = Omit<
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>,
  "children"
> & {
  className?: string;
};

function Slider({ className, ...props }: SliderProps) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn("flex w-full touch-none items-center py-1", className)}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex h-4 w-full cursor-pointer items-center">
        <SliderPrimitive.Track className="relative h-1 w-full rounded-full bg-surface-3">
          <SliderPrimitive.Indicator className="absolute h-full rounded-full bg-primary" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="absolute size-3.5 rounded-full border border-primary/50 bg-primary shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40" />
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
