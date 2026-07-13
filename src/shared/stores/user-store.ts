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
  connectionStatuses: Record<UUID, ConnectionStatus>;
  /** Current local user */
  currentUser: User | null;
  /** Error state */
  error: string | null;
  isInitialized: boolean;
  /** Loading states */
  isLoading: boolean;
  /** Map of users currently typing */
  typingUsers: Record<UUID, boolean>;
  /** Array of all known users */
  users: User[];
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
  setUsers: (users: User[]) => void;
  /** Update the current user */
  updateCurrentUser: (updates: Partial<User>) => void;
}

type UserStore = UserState & UserActions;

const initialState: UserState = {
  connectionStatuses: {},
  currentUser: null,
  error: null,
  isInitialized: false,
  isLoading: false,
  typingUsers: {},
  users: [],
};

export const useUserStore = create<UserStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      clearTypingStatus: (userId) => {
        set(
          (state) => {
            const newTyping = { ...state.typingUsers };
            delete newTyping[userId];
            return { typingUsers: newTyping };
          },
          false,
          "clearTypingStatus"
        );
      },

      removeUser: (userId) => {
        set(
          (state) => {
            const newStatuses = { ...state.connectionStatuses };
            delete newStatuses[userId];
            const newTyping = { ...state.typingUsers };
            delete newTyping[userId];
            return {
              connectionStatuses: newStatuses,
              typingUsers: newTyping,
              users: state.users.filter((u) => u.id !== userId),
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
            connectionStatuses: {
              ...state.connectionStatuses,
              [userId]: status,
            },
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
            typingUsers: { ...state.typingUsers, [userId]: isTyping },
          }),
          false,
          "setTypingStatus"
        );
      },

      setUser: (user) => {
        set(
          (state) => {
            const index = state.users.findIndex((u) => u.id === user.id);
            if (index >= 0) {
              const newUsers = [...state.users];
              newUsers[index] = user;
              return { users: newUsers };
            }
            return { users: [...state.users, user] };
          },
          false,
          "setUser"
        );
      },

      setUsers: (users) => {
        set({ users }, false, "setUsers");
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
