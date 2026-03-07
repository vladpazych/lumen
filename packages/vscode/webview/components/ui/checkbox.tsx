import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon, MinusIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function Checkbox({
  className,
  indeterminate,
  ...props
}: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      indeterminate={indeterminate}
      className={cn(
        "bg-surface-3 data-checked:bg-primary data-checked:text-primary-foreground data-indeterminate:bg-primary data-indeterminate:text-primary-foreground focus-visible:ring-ring/30 flex size-4 items-center justify-center rounded-[4px] transition-shadow focus-visible:ring-[2px] peer relative shrink-0 outline-none disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="[&>svg]:size-3.5 grid place-content-center text-current transition-none"
      >
        {indeterminate ? <MinusIcon /> : <CheckIcon />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
