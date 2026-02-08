import { cn } from "@/lib/utils";

export function SkeletonBlock({ className }) {
  return <div className={cn("animate-pulse rounded-md bg-[var(--surface-3)]", className)} aria-hidden="true" />;
}
