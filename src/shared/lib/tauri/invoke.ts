/**
 * Type-safe Tauri invoke wrapper.
 * Provides compile-time type checking for IPC calls.
 */

import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import type {
  Attachment,
  Download,
  DownloadProgress,
} from "@/shared/types/attachment";
import type { PaginatedResponse, Result, UUID } from "@/shared/types/common";
import type {
  CreateMessageInput,
  MessageSearchParams,
  MessageWithDetails,
  Reaction,
} from "@/shared/types/message";
import type { NetworkStats, Peer } from "@/shared/types/network";
import type { AppSettings, UpdateSettingsInput } from "@/shared/types/settings";
import type { UpdateUserInput, User } from "@/shared/types/user";

/**
 * Command definitions mapping command names to their input/output types.
 */
interface TauriCommands {
  add_reaction: {
    input: { messageId: UUID; emoji: string };
    output: Reaction;
  };
  cancel_download: { input: { downloadId: UUID }; output: void };
  close_window: { input: undefined; output: void };
  connect_to_peer: { input: { address: string; port: number }; output: Peer };
  copy_image: { input: { path: string }; output: void };

  // Clipboard commands
  copy_text: { input: { text: string }; output: void };
  delete_message: { input: { messageId: UUID }; output: void };
  disconnect_peer: { input: { peerId: UUID }; output: void };
  edit_message: {
    input: { messageId: UUID; content: string };
    output: MessageWithDetails;
  };
  get_all_users: { input: undefined; output: readonly User[] };
  get_app_data_dir: { input: undefined; output: string };
  get_attachment: { input: { attachmentId: UUID }; output: Attachment };
  // User commands
  get_current_user: { input: undefined; output: User | null };
  get_download_location: { input: undefined; output: string };
  get_download_progress: {
    input: { downloadId: UUID };
    output: DownloadProgress;
  };
  get_messages: {
    input: { limit: number; before?: UUID };
    output: PaginatedResponse<MessageWithDetails>;
  };
  get_network_stats: { input: undefined; output: NetworkStats };

  // Network commands
  get_peers: { input: undefined; output: readonly Peer[] };

  // Settings commands
  get_settings: { input: undefined; output: AppSettings };
  get_user: { input: { userId: UUID }; output: User | null };
  has_image_in_clipboard: { input: undefined; output: boolean };

  // App lifecycle
  initialize_app: { input: { username: string }; output: User };
  maximize_window: { input: undefined; output: void };

  // Window commands
  minimize_window: { input: undefined; output: void };
  open_file: { input: { path: string }; output: void };
  paste_image: {
    input: { messageId?: UUID };
    output: Attachment;
  };
  paste_text: { input: undefined; output: string | null };
  pause_download: { input: { downloadId: UUID }; output: Download };
  pick_download_folder: { input: undefined; output: string | null };
  remove_reaction: { input: { reactionId: UUID }; output: void };
  resume_download: { input: { downloadId: UUID }; output: Download };
  save_file_as: {
    input: { attachmentId: UUID; destinationPath: string };
    output: string;
  };
  search_messages: {
    input: { params: MessageSearchParams };
    output: PaginatedResponse<MessageWithDetails>;
  };

  // Struct command arguments must be nested under the Rust parameter name.
  send_message: {
    input: { input: CreateMessageInput };
    output: MessageWithDetails;
  };
  set_avatar: { input: { filePath: string }; output: User };
  set_download_location: { input: { path: string }; output: void };
  show_in_tray: { input: undefined; output: void };

  // Notification commands
  show_notification: {
    input: { title: string; body: string };
    output: void;
  };
  start_discovery: { input: undefined; output: void };
  start_download: { input: { attachmentId: UUID }; output: Download };
  stop_discovery: { input: undefined; output: void };
  update_settings: {
    input: { input: UpdateSettingsInput };
    output: AppSettings;
  };
  update_user: { input: { input: UpdateUserInput }; output: User };

  // Attachment commands
  upload_files: {
    input: { filePaths: readonly string[]; messageId?: UUID };
    output: readonly Attachment[];
  };
}

/** Command names union type */
export type CommandName = keyof TauriCommands;

/** Get input type for a command */
export type CommandInput<T extends CommandName> = TauriCommands[T]["input"];

/** Get output type for a command */
export type CommandOutput<T extends CommandName> = TauriCommands[T]["output"];

/**
 * Type-safe invoke function.
 * Ensures command name and arguments match the expected types.
 */
export async function invoke<T extends CommandName>(
  command: T,
  ...args: CommandInput<T> extends void ? [] : [CommandInput<T>]
): Promise<Result<CommandOutput<T>, string>> {
  try {
    const result = await tauriInvoke<CommandOutput<T>>(
      command,
      args[0] as Record<string, unknown>
    );
    return { data: result, success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: message, success: false };
  }
}

/**
 * Invoke that throws on error.
 * Use when error handling is done at a higher level.
 */
export async function invokeOrThrow<T extends CommandName>(
  command: T,
  ...args: CommandInput<T> extends void ? [] : [CommandInput<T>]
): Promise<CommandOutput<T>> {
  const result = await invoke(command, ...args);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data;
}
