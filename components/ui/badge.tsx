import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-flex items-center rounded-sm border border-[var(--line)] bg-white/50 px-2 py-0.5 font-mono text-[11px] tracking-tight", className)} {...props} />;
}
