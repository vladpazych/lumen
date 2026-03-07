import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const Accordion = AccordionPrimitive.Root;

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-b border-border last:border-b-0", className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "flex flex-1 items-center justify-between gap-4 py-3 text-left text-[13px] font-medium transition-all outline-none",
          "hover:underline",
          "focus-visible:ring-1 focus-visible:ring-ring rounded-sm",
          "disabled:pointer-events-none disabled:opacity-40",
          "[&[aria-expanded=true]>svg]:rotate-180",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon className="text-text-secondary pointer-events-none size-3.5 shrink-0 transition-transform duration-200" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionPanel({
  className,
  children,
  ...props
}: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-panel"
      className={cn(
        "overflow-hidden text-[12px] text-text-secondary",
        "data-[open]:animate-accordion-down data-[closed]:animate-accordion-up",
        className,
      )}
      {...props}
    >
      <div className="pb-3 pt-0">{children}</div>
    </AccordionPrimitive.Panel>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionPanel };
