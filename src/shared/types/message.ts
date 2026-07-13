/**
 * Message domain types.
 * Represents chat messages and related data.
 */

import type { Attachment } from "./attachment";
import type { BaseEntity, ISODateString, MessageStatus, UUID } from "./common";
import type { User } from "./user";

/** Reaction to a message */
export interface Reaction {
  readonly createdAt: ISODateString;
  readonly emoji: string;
  readonly id: UUID;
  readonly messageId: UUID;
  readonly userId: UUID;
  readonly username: string;
}

/** Mention in a message */
export interface Mention {
  readonly id: UUID;
  readonly messageId: UUID;
  readonly userId: UUID;
  readonly username: string;
}

/** Read receipt for a message */
export interface ReadReceipt {
  readonly id: UUID;
  readonly messageId: UUID;
  readonly readAt: ISODateString;
  readonly userId: UUID;
}

/** Base message entity */
export interface Message extends BaseEntity {
  readonly content: string | null;
  readonly isDeleted: boolean;
  readonly isEdited: boolean;
  readonly replyToId: UUID | null;
  readonly senderId: UUID;
  readonly status: MessageStatus;
}

/** Message with all related data for display */
export interface MessageWithDetails extends Message {
  readonly attachments: readonly Attachment[];
  readonly mentions: readonly Mention[];
  readonly reactions: readonly Reaction[];
  readonly readBy: readonly ReadReceipt[];
  readonly replyTo: Message | null;
  readonly sender: User;
}

/** Data for creating a new message */
export interface CreateMessageInput {
  readonly attachmentIds?: readonly UUID[];
  readonly content: string;
  readonly mentionedUserIds?: readonly UUID[];
  readonly replyToId?: UUID;
}

/** Data for updating a message */
export interface UpdateMessageInput {
  readonly content: string;
}

/** Message search parameters */
export interface MessageSearchParams {
  readonly endDate?: ISODateString;
  readonly hasAttachments?: boolean;
  readonly limit?: number;
  readonly offset?: number;
  readonly query: string;
  readonly senderId?: UUID;
  readonly startDate?: ISODateString;
}

/** Grouped messages by date */
export interface MessageGroup {
  readonly date: string;
  readonly messages: readonly MessageWithDetails[];
}

/** Message event for real-time updates */
export type MessageEvent =
  | { readonly type: "created"; readonly message: MessageWithDetails }
  | { readonly type: "updated"; readonly message: MessageWithDetails }
  | { readonly type: "deleted"; readonly messageId: UUID }
  | { readonly type: "reaction_added"; readonly reaction: Reaction }
  | { readonly type: "reaction_removed"; readonly reactionId: UUID };
