/**
 * User domain types.
 * Represents users in the chat application.
 */

import type {
  BaseEntity,
  ConnectionStatus,
  ISODateString,
  UUID,
} from "./common";

/** User entity representing a chat participant */
export interface User extends BaseEntity {
  readonly avatarPath: string | null;
  readonly isLocal: boolean;
  readonly lastSeenAt: ISODateString | null;
  readonly username: string;
}

/** User with online status for display */
export interface UserWithStatus extends User {
  readonly connectionStatus: ConnectionStatus;
}

/** Data required to create a new user */
export interface CreateUserInput {
  readonly avatarPath?: string;
  readonly username: string;
}

/** Data for updating user profile */
export interface UpdateUserInput {
  readonly avatarPath?: string | null;
  readonly username?: string;
}

/** User presence information */
export interface UserPresence {
  readonly isOnline: boolean;
  readonly isTyping: boolean;
  readonly lastSeenAt: ISODateString;
  readonly userId: UUID;
}

/** Typing indicator event */
export interface TypingIndicator {
  readonly isTyping: boolean;
  readonly timestamp: ISODateString;
  readonly userId: UUID;
  readonly username: string;
}

/** Local user settings stored in the app */
export interface LocalUserProfile {
  readonly avatarPath: string | null;
  readonly userId: UUID;
  readonly username: string;
}
