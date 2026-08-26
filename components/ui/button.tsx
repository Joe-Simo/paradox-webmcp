import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "geist-button",
  {
    variants: {
      variant: {
        default: "geist-button-primary",
        secondary: "geist-button-secondary",
        tertiary: "geist-button-tertiary",
        error: "geist-button-error",
      },
      size: {
        default: "geist-button-medium",
        sm: "geist-button-small",
        lg: "geist-button-large",
        icon: "geist-button-icon",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
