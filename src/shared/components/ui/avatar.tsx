/**
 * Avatar component for user display.
 */

import { cn } from "@/utils/cn";

export type AvatarSize = "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  readonly alt: string;
  readonly className?: string;
  readonly isOnline?: boolean;
  readonly size?: AvatarSize;
  readonly src?: string | null;
}

const sizeStyles: Record<AvatarSize, string> = {
  lg: "h-12 w-12 text-base",
  md: "h-10 w-10 text-sm",
  sm: "h-8 w-8 text-xs",
  xl: "h-16 w-16 text-lg",
};

const indicatorSizes: Record<AvatarSize, string> = {
  lg: "h-3 w-3 border-2",
  md: "h-2.5 w-2.5 border-2",
  sm: "h-2 w-2 border",
  xl: "h-4 w-4 border-2",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getColorFromName(name: string): string {
  const colors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-amber-500",
    "bg-yellow-500",
    "bg-lime-500",
    "bg-green-500",
    "bg-emerald-500",
    "bg-teal-500",
    "bg-cyan-500",
    "bg-sky-500",
    "bg-blue-500",
    "bg-indigo-500",
    "bg-violet-500",
    "bg-purple-500",
    "bg-fuchsia-500",
    "bg-pink-500",
  ];
  const hash = name
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

export function Avatar({
  src,
  alt,
  size = "md",
  className,
  isOnline,
}: AvatarProps) {
  const initials = getInitials(alt);
  const bgColor = getColorFromName(alt);

  return (
    <div className={cn("relative inline-block", className)}>
      {src ? (
        <img
          alt={alt}
          className={cn("rounded-full object-cover", sizeStyles[size])}
          src={src}
        />
      ) : (
        <div
          className={cn(
            "flex items-center justify-center rounded-full font-medium text-white",
            sizeStyles[size],
            bgColor
          )}
        >
          {initials}
        </div>
      )}
      {isOnline !== undefined && (
        <span
          className={cn(
            "absolute right-0 bottom-0 rounded-full border-white dark:border-gray-900",
            indicatorSizes[size],
            isOnline ? "bg-green-500" : "bg-gray-400"
          )}
        />
      )}
    </div>
  );
}
