export type Spacing = "none" | "snug" | "tight" | "normal" | "relaxed" | "loose"

export const gapMap = {
  none: "gap-0",
  snug: "gap-0.5",
  tight: "gap-1",
  normal: "gap-2",
  relaxed: "gap-3",
  loose: "gap-4",
} as const

export const paddingMap = {
  none: "p-0",
  snug: "p-1",
  tight: "p-2",
  normal: "p-4",
  relaxed: "p-6",
  loose: "p-8",
} as const

export const paddingXMap = {
  none: "px-0",
  snug: "px-1",
  tight: "px-2",
  normal: "px-4",
  relaxed: "px-6",
  loose: "px-8",
} as const

export const paddingYMap = {
  none: "py-0",
  snug: "py-1",
  tight: "py-2",
  normal: "py-4",
  relaxed: "py-6",
  loose: "py-8",
} as const

export const paddingTopMap = {
  none: "pt-0",
  snug: "pt-1",
  tight: "pt-2",
  normal: "pt-4",
  relaxed: "pt-6",
  loose: "pt-8",
} as const

export const paddingBottomMap = {
  none: "pb-0",
  snug: "pb-1",
  tight: "pb-2",
  normal: "pb-4",
  relaxed: "pb-6",
  loose: "pb-8",
} as const

export const paddingLeftMap = {
  none: "pl-0",
  snug: "pl-1",
  tight: "pl-2",
  normal: "pl-4",
  relaxed: "pl-6",
  loose: "pl-8",
} as const

export const paddingRightMap = {
  none: "pr-0",
  snug: "pr-1",
  tight: "pr-2",
  normal: "pr-4",
  relaxed: "pr-6",
  loose: "pr-8",
} as const

export type FixedWidth = "xs" | "sm" | "md"

export const fixedWidthMap = {
  xs: "w-64 shrink-0",
  sm: "w-80 shrink-0",
  md: "w-96 shrink-0",
} as const
