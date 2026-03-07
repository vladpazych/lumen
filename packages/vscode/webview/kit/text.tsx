import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "./utils"

const textVariants = cva("", {
  variants: {
    variant: {
      micro: "text-[10px] font-normal",
      caption: "text-[11px] font-normal",
      label: "text-[11px] font-medium uppercase tracking-wider",
      body: "text-[12px] font-normal",
      title: "text-[13px] font-semibold",
      display: "text-[15px] font-semibold",
      lead: "text-[17px] font-normal leading-relaxed",
      heading: "text-[20px] font-semibold leading-snug",
      hero: "text-[34px] font-bold leading-tight",
    },
    font: {
      prose: "font-prose",
    },
    color: {
      primary: "text-text-primary",
      secondary: "text-text-secondary",
      tertiary: "text-text-tertiary",
      disabled: "text-text-disabled",
      destructive: "text-destructive",
      inherit: "",
    },
    weight: {
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
    },
    align: {
      left: "text-left",
      center: "text-center",
      right: "text-right",
    },
    truncate: {
      true: "truncate",
      false: "",
    },
    balance: {
      true: "text-balance",
      false: "",
    },
  },
  compoundVariants: [
    { font: "prose", variant: "body", className: "text-[15px] font-normal leading-relaxed" },
    { font: "prose", variant: "title", className: "text-[26px] font-semibold leading-tight" },
  ],
  defaultVariants: {
    variant: "body",
    color: "primary",
  },
})

type TextIntent = "helper" | "heading" | "metric" | "timestamp" | "label"

const intentMap: Record<
  TextIntent,
  {
    variant: VariantProps<typeof textVariants>["variant"]
    color: VariantProps<typeof textVariants>["color"]
  }
> = {
  helper: { variant: "caption", color: "tertiary" },
  heading: { variant: "title", color: "primary" },
  metric: { variant: "display", color: "primary" },
  timestamp: { variant: "micro", color: "tertiary" },
  label: { variant: "label", color: "tertiary" },
}

type TextElement = "span" | "p" | "div" | "h1" | "h2" | "h3" | "h4" | "label"
type TextColor = "primary" | "secondary" | "tertiary" | "disabled" | "destructive" | "inherit"
type TextFont = "prose"

interface TextProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "color">, Omit<VariantProps<typeof textVariants>, "color"> {
  as?: TextElement
  color?: TextColor | null
  font?: TextFont
  intent?: TextIntent
}

const Text = React.forwardRef<HTMLElement, TextProps>(
  (
    { as: Component = "span", className, variant, font, color, weight, align, truncate, balance, intent, ...props },
    ref,
  ) => {
    const intentDefaults = intent ? intentMap[intent] : undefined
    const resolvedVariant = variant ?? intentDefaults?.variant
    const resolvedColor = color ?? intentDefaults?.color

    return (
      <Component
        // @ts-expect-error - ref types vary by element
        ref={ref}
        data-slot="text"
        className={cn(
          textVariants({
            variant: resolvedVariant,
            font,
            color: resolvedColor,
            weight,
            align,
            truncate,
            balance,
          }),
          className,
        )}
        {...props}
      />
    )
  },
)

Text.displayName = "Text"

export { Text, textVariants }
export type { TextProps, TextIntent }
