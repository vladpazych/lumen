import * as React from "react"

import { cn } from "./utils"
import { gapMap, fixedWidthMap, type FixedWidth, type Spacing } from "./tokens"

type Align = "start" | "center" | "end" | "stretch"
type Justify = "start" | "center" | "end" | "between"

interface RowProps {
  spacing?: Spacing
  align?: Align
  justify?: Justify
  wrap?: boolean
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

const Row = React.forwardRef<HTMLDivElement, RowProps>(
  ({ spacing = "normal", align = "center", justify, wrap, width, grow, scroll, children }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-row",
          gapMap[spacing],
          alignMap[align],
          justify && justifyMap[justify],
          wrap && "flex-wrap",
          width && fixedWidthMap[width],
          grow && "flex-1 min-h-0 min-w-0",
          scroll && "overflow-auto min-w-0",
        )}
      >
        {children}
      </div>
    )
  },
)

Row.displayName = "Row"

export { Row }
export type { RowProps }
