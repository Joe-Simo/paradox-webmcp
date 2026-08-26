import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("geist-badge", {
  variants: {
    tone: {
      gray: "geist-badge-gray",
      blue: "geist-badge-blue",
      green: "geist-badge-green",
      amber: "geist-badge-amber",
      red: "geist-badge-red",
    },
  },
  defaultVariants: { tone: "gray" },
});

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
