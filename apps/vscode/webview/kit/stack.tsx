import * as React from "react"

import { cn } from "./utils"
import { gapMap, fixedWidthMap, type FixedWidth, type Spacing } from "./tokens"

type Align = "start" | "center" | "end" | "stretch"
type Justify = "start" | "center" | "end" | "between"

interface StackProps {
  spacing?: Spacing
  align?: Align
  justify?: Justify
  width?: FixedWidth
  grow?: boolean
  scroll?: boolean
  children?: React.ReactNode
}

const alignMap = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
} as const

const justifyMap = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
} as const

const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  ({ spacing = "normal", align, justify, width, grow, scroll, children }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col",
          gapMap[spacing],
          align && alignMap[align],
          justify && justifyMap[justify],
          width && fixedWidthMap[width],
          grow && "flex-1 min-w-0",
          scroll && "overflow-auto min-h-0",
        )}
      >
        {children}
      </div>
    )
  },
)

Stack.displayName = "Stack"

export { Stack }
export type { StackProps }
