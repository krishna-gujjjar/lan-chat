/**
 * Time formatting utilities for messages.
 */

import type { ISODateString } from "@/shared/types";

/**
 * Format message timestamp for display.
 * Shows time for today, date for older messages.
 */
export function formatMessageTime(timestamp: ISODateString): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const isThisYear = date.getFullYear() === now.getFullYear();
  if (isThisYear) {
    return date.toLocaleDateString(undefined, {
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
    });
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format timestamp as relative time (e.g., "5 minutes ago").
 */
export function formatRelativeTime(timestamp: ISODateString): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return "just now";
  }
  if (diffMin < 60) {
    return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  }
  if (diffHour < 24) {
    return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;
  }
  if (diffDay < 7) {
    return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  }

  return date.toLocaleDateString();
}

/**
 * Format date for message grouping.
 */
export function formatDateGroup(timestamp: ISODateString): string {
  const date = new Date(timestamp);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === now.toDateString()) {
    return "Today";
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

/**
 * Check if two timestamps are on the same day.
 */
export function isSameDay(a: ISODateString, b: ISODateString): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}
