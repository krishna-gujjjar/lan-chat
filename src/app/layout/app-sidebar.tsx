/**
 * Application sidebar with user list and navigation.
 */

import { useMemo } from "react";
import { useUserStore } from "@/shared/stores/user-store";
import type { User } from "@/shared/types/user";
import { cn } from "@/utils/cn";

export function AppSidebar() {
  const currentUser = useUserStore((state) => state.currentUser);
  const users = useUserStore((state) => state.users);
  const connectionStatuses = useUserStore((state) => state.connectionStatuses);
  const typingUsersMap = useUserStore((state) => state.typingUsers);

  const onlineUsers = useMemo(
    () =>
      users.filter(
        (user) => connectionStatuses[user.id] === "connected" && !user.isLocal
      ),
    [users, connectionStatuses]
  );

  const typingUserIds = useMemo(
    () =>
      new Set(
        Object.entries(typingUsersMap)
          .filter(([, isTyping]) => isTyping)
          .map(([userId]) => userId)
      ),
    [typingUsersMap]
  );

  return (
    <aside className="flex w-64 flex-col border-retro-border border-r-2 bg-retro-bg-light">
      {/* Current user section */}
      <div className="border-retro-border border-b-2 p-4">
        {currentUser ? (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-retro-border bg-retro-bg font-pixel text-retro-green text-xs">
              {currentUser.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-pixel text-retro-text text-xs">
                {currentUser.username}
              </p>
              <p className="font-terminal text-retro-green text-sm">YOU</p>
            </div>
          </div>
        ) : (
          <div className="font-terminal text-retro-text-dim text-sm">
            Loading...
          </div>
        )}
      </div>

      {/* Online users section */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3">
          <h2 className="font-pixel text-[0.6rem] text-retro-text-dim uppercase tracking-widest">
            Peers — {onlineUsers.length}
          </h2>
        </div>
        <ul className="space-y-1 px-2">
          {onlineUsers.map((user: User) => (
            <li key={user.id}>
              <div
                className={cn(
                  "flex items-center gap-3 px-2 py-2",
                  "border border-transparent",
                  "hover:border-retro-border hover:bg-retro-bg",
                  "cursor-pointer transition-colors"
                )}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-retro-border bg-retro-bg font-pixel text-[0.5rem] text-retro-text">
                  {user.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-pixel text-[0.6rem] text-retro-text">
                    {user.username}
                  </p>
                  {typingUserIds.has(user.id) ? (
                    <p className="flex items-center gap-1 font-terminal text-retro-green text-sm">
                      <TypingIndicator />
                      typing...
                    </p>
                  ) : (
                    <p className="font-terminal text-retro-text-dim text-sm">
                      Online
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
          {onlineUsers.length === 0 ? (
            <li className="px-2 py-4 text-center font-terminal text-retro-text-dim text-sm">
              No peers detected on LAN
            </li>
          ) : null}
        </ul>
      </div>
    </aside>
  );
}

function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="typing-dot h-1 w-1 bg-retro-green" />
      <span className="typing-dot h-1 w-1 bg-retro-green" />
      <span className="typing-dot h-1 w-1 bg-retro-green" />
    </span>
  );
}
