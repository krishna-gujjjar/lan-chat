/**
 * Input component with variants.
 */

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly error?: string;
  readonly label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, label, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full">
        {label && (
          <label
            className="mb-1 block font-medium text-gray-700 text-sm dark:text-gray-300"
            htmlFor={inputId}
          >
            {label}
          </label>
        )}
        <input
          className={cn(
            "w-full rounded-lg border px-3 py-2 text-sm",
            "bg-white dark:bg-gray-800",
            "text-gray-900 dark:text-gray-100",
            "placeholder:text-gray-500 dark:placeholder:text-gray-400",
            "focus:outline-none focus:ring-2 focus:ring-blue-500",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error
              ? "border-red-500 focus:ring-red-500"
              : "border-gray-300 dark:border-gray-600",
            className
          )}
          id={inputId}
          ref={ref}
          {...props}
        />
        {error && <p className="mt-1 text-red-500 text-sm">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
