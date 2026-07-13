/**
 * Common type definitions used across the application.
 * These are base types that other domain types build upon.
 */

/** UUID string type for type safety */
export type UUID = string & { readonly __brand: unique symbol };

/** ISO 8601 date string */
export type ISODateString = string & { readonly __brand: unique symbol };

/** Result type for operations that can fail */
export type Result<T, E = Error> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

/** Async result wrapper */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

/** Pagination params */
export interface PaginationParams {
  readonly limit: number;
  readonly offset: number;
}

/** Paginated response */
export interface PaginatedResponse<T> {
  readonly hasMore: boolean;
  readonly items: readonly T[];
  readonly total: number;
}

/** Sort direction */
export type SortDirection = "asc" | "desc";

/** Base entity with common fields */
export interface BaseEntity {
  readonly createdAt: ISODateString;
  readonly id: UUID;
  readonly updatedAt: ISODateString;
}

/** Connection status for peers */
export type ConnectionStatus = "connected" | "disconnected" | "connecting";

/** Transfer status for downloads/uploads */
export type TransferStatus =
  | "pending"
  | "in_progress"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

/** Message delivery status */
export type MessageStatus =
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

/** Theme preference */
export type ThemeMode = "light" | "dark" | "system";

/** Utility type for creating branded types */
export function createUUID(value: string): UUID {
  return value as UUID;
}

/** Utility for creating ISO date strings */
export function createISODateString(date: Date): ISODateString {
  return date.toISOString() as ISODateString;
}

/** Type guard for checking if value is defined */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
