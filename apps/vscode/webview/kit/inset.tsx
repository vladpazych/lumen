import * as React from "react"

import { cn } from "./utils"
import {
  paddingMap,
  paddingXMap,
  paddingYMap,
  paddingTopMap,
  paddingBottomMap,
  paddingLeftMap,
  paddingRightMap,
  type Spacing,
} from "./tokens"

interface InsetProps {
  spacing?: Spacing
  horizontal?: Spacing
  vertical?: Spacing
  top?: Spacing
  bottom?: Spacing
  left?: Spacing
  right?: Spacing
  children?: React.ReactNode
}

const Inset = React.forwardRef<HTMLDivElement, InsetProps>(
  ({ spacing = "normal", horizontal, vertical, top, bottom, left, right, children }, ref) => {
    const hasSideSpacing =
      horizontal !== undefined ||
      vertical !== undefined ||
      top !== undefined ||
      bottom !== undefined ||
      left !== undefined ||
      right !== undefined

    return (
      <div
        ref={ref}
        className={cn(
          !hasSideSpacing && paddingMap[spacing],
          horizontal !== undefined && paddingXMap[horizontal],
          vertical !== undefined && paddingYMap[vertical],
          top !== undefined && paddingTopMap[top],
          bottom !== undefined && paddingBottomMap[bottom],
          left !== undefined && paddingLeftMap[left],
          right !== undefined && paddingRightMap[right],
        )}
      >
        {children}
      </div>
    )
  },
)

Inset.displayName = "Inset"

export { Inset }
export type { InsetProps }
