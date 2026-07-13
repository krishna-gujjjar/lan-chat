/**
 * Button component with variants.
 */

import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly isLoading?: boolean;
  readonly size?: ButtonSize;
  readonly variant?: ButtonVariant;
}

const variantStyles: Record<ButtonVariant, string> = {
  danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
  ghost: "bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800",
  primary: "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800",
  secondary:
    "bg-gray-200 text-gray-900 hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600",
};

const sizeStyles: Record<ButtonSize, string> = {
  lg: "px-6 py-3 text-base",
  md: "px-4 py-2 text-sm",
  sm: "px-3 py-1.5 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium",
        "transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled || isLoading}
      ref={ref}
      {...props}
    >
      {isLoading ? (
        <span className="mr-2">
          <LoadingSpinner size={size} />
        </span>
      ) : null}
      {children}
    </button>
  )
);

Button.displayName = "Button";

function LoadingSpinner({ size }: { readonly size: ButtonSize }) {
  const sizeClass =
    size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4";
  return (
    <svg
      className={cn("animate-spin", sizeClass)}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        fill="currentColor"
      />
    </svg>
  );
}
