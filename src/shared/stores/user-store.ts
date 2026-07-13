/**
 * User state management using Zustand.
 * Handles current user and connected users state.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { ConnectionStatus, UUID } from "@/shared/types/common";
import type { User } from "@/shared/types/user";

interface UserState {
  /** Map of user connection statuses */
  readonly connectionStatuses: ReadonlyMap<UUID, ConnectionStatus>;
  /** Current local user */
  readonly currentUser: User | null;
  /** Error state */
  readonly error: string | null;
  readonly isInitialized: boolean;
  /** Loading states */
  readonly isLoading: boolean;
  /** Map of users currently typing */
  readonly typingUsers: ReadonlyMap<UUID, boolean>;
  /** Map of all known users by ID */
  readonly users: ReadonlyMap<UUID, User>;
}

interface UserActions {
  /** Clear typing status after timeout */
  clearTypingStatus: (userId: UUID) => void;
  /** Remove a user */
  removeUser: (userId: UUID) => void;
  /** Reset store to initial state */
  reset: () => void;
  /** Set connection status for a user */
  setConnectionStatus: (userId: UUID, status: ConnectionStatus) => void;
  /** Set the current user */
  setCurrentUser: (user: User) => void;
  /** Set error state */
  setError: (error: string | null) => void;
  /** Set initialized state */
  setInitialized: (isInitialized: boolean) => void;
  /** Set loading state */
  setLoading: (isLoading: boolean) => void;
  /** Set typing status for a user */
  setTypingStatus: (userId: UUID, isTyping: boolean) => void;
  /** Add or update a user */
  setUser: (user: User) => void;
  /** Add multiple users */
  setUsers: (users: readonly User[]) => void;
  /** Update the current user */
  updateCurrentUser: (updates: Partial<User>) => void;
}

type UserStore = UserState & UserActions;

const initialState: UserState = {
  connectionStatuses: new Map(),
  currentUser: null,
  error: null,
  isInitialized: false,
  isLoading: false,
  typingUsers: new Map(),
  users: new Map(),
};

export const useUserStore = create<UserStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      clearTypingStatus: (userId) => {
        set(
          (state) => {
            const newTyping = new Map(state.typingUsers);
            newTyping.delete(userId);
            return { typingUsers: newTyping };
          },
          false,
          "clearTypingStatus"
        );
      },

      removeUser: (userId) => {
        set(
          (state) => {
            const newUsers = new Map(state.users);
            newUsers.delete(userId);
            const newStatuses = new Map(state.connectionStatuses);
            newStatuses.delete(userId);
            const newTyping = new Map(state.typingUsers);
            newTyping.delete(userId);
            return {
              connectionStatuses: newStatuses,
              typingUsers: newTyping,
              users: newUsers,
            };
          },
          false,
          "removeUser"
        );
      },

      reset: () => {
        set(initialState, false, "reset");
      },

      setConnectionStatus: (userId, status) => {
        set(
          (state) => ({
            connectionStatuses: new Map(state.connectionStatuses).set(
              userId,
              status
            ),
          }),
          false,
          "setConnectionStatus"
        );
      },

      setCurrentUser: (user) => {
        set({ currentUser: user }, false, "setCurrentUser");
        get().setUser(user);
      },

      setError: (error) => {
        set({ error }, false, "setError");
      },

      setInitialized: (isInitialized) => {
        set({ isInitialized }, false, "setInitialized");
      },

      setLoading: (isLoading) => {
        set({ isLoading }, false, "setLoading");
      },

      setTypingStatus: (userId, isTyping) => {
        set(
          (state) => ({
            typingUsers: new Map(state.typingUsers).set(userId, isTyping),
          }),
          false,
          "setTypingStatus"
        );
      },

      setUser: (user) => {
        set(
          (state) => ({
            users: new Map(state.users).set(user.id, user),
          }),
          false,
          "setUser"
        );
      },

      setUsers: (users) => {
        set(
          (state) => {
            const newUsers = new Map(state.users);
            users.forEach((user) => newUsers.set(user.id, user));
            return { users: newUsers };
          },
          false,
          "setUsers"
        );
      },

      updateCurrentUser: (updates) => {
        const current = get().currentUser;
        if (current) {
          const updated = { ...current, ...updates };
          set({ currentUser: updated }, false, "updateCurrentUser");
          get().setUser(updated);
        }
      },
    }),
    { name: "user-store" }
  )
);

/** Selector for getting a user by ID */
export const selectUser = (userId: UUID) => (state: UserStore) =>
  state.users.get(userId);

/** Selector for all online users */
export const selectOnlineUsers = (state: UserStore) =>
  Array.from(state.users.values()).filter(
    (user) => state.connectionStatuses.get(user.id) === "connected"
  );

/** Selector for users who are typing */
export const selectTypingUsers = (state: UserStore) =>
  Array.from(state.typingUsers.entries())
    .filter(([, isTyping]) => isTyping)
    .map(([userId]) => state.users.get(userId))
    .filter((user): user is User => user !== undefined);
