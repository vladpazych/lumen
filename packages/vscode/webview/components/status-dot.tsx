import { cn } from "@/lib/utils";

type StatusDotVariant =
  | "muted"
  | "warning"
  | "success"
  | "destructive"
  | "primary"
  | "info";

interface StatusDotProps {
  variant?: StatusDotVariant;
  size?: "xs" | "sm" | "md";
  className?: string;
}

const variantMap: Record<StatusDotVariant, string> = {
  muted: "bg-text-secondary",
  warning: "bg-warning",
  success: "bg-success",
  destructive: "bg-destructive",
  primary: "bg-primary",
  info: "bg-info",
};

const sizeMap = {
  xs: "size-1.5",
  sm: "size-2",
  md: "size-2.5",
};

function StatusDot({
  variant = "muted",
  size = "sm",
  className,
}: StatusDotProps) {
  return (
    <div
      className={cn(
        "rounded-full shrink-0",
        variantMap[variant],
        sizeMap[size],
        className,
      )}
    />
  );
}

export { StatusDot };
export type { StatusDotProps, StatusDotVariant };
