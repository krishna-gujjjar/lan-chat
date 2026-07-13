/**
 * Application sidebar with user list and navigation.
 */

import { Avatar } from "@/shared/components/ui/avatar";
import {
  selectOnlineUsers,
  selectTypingUsers,
  useUserStore,
} from "@/shared/stores/user-store";
import { cn } from "@/utils/cn";

export function AppSidebar() {
  const currentUser = useUserStore((state) => state.currentUser);
  const onlineUsers = useUserStore(selectOnlineUsers);
  const typingUsers = useUserStore(selectTypingUsers);

  const typingUserIds = new Set(typingUsers.map((u) => u.id));

  return (
    <aside className="flex w-64 flex-col border-gray-200 border-r dark:border-dark-600">
      {/* Current user section */}
      <div className="border-gray-200 border-b p-4 dark:border-dark-600">
        {currentUser ? (
          <div className="flex items-center gap-3">
            <Avatar
              alt={currentUser.username}
              isOnline={true}
              size="md"
              src={currentUser.avatarPath}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-gray-900 text-sm dark:text-white">
                {currentUser.username}
              </p>
              <p className="text-gray-500 text-xs dark:text-gray-400">You</p>
            </div>
          </div>
        ) : (
          <div className="text-gray-500 text-sm">Loading...</div>
        )}
      </div>

      {/* Online users section */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-2">
          <h2 className="font-semibold text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
            Online — {onlineUsers.length}
          </h2>
        </div>
        <ul className="space-y-1 px-2">
          {onlineUsers.map((user) => (
            <li key={user.id}>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2 py-2",
                  "hover:bg-gray-100 dark:hover:bg-dark-700",
                  "cursor-pointer transition-colors"
                )}
              >
                <Avatar
                  alt={user.username}
                  isOnline={true}
                  size="sm"
                  src={user.avatarPath}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-gray-900 text-sm dark:text-white">
                    {user.username}
                  </p>
                  {typingUserIds.has(user.id) && (
                    <p className="flex items-center gap-1 text-gray-500 text-xs dark:text-gray-400">
                      <TypingIndicator />
                      typing...
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
          {onlineUsers.length === 0 && (
            <li className="px-2 py-4 text-center text-gray-500 text-sm dark:text-gray-400">
              No other users online
            </li>
          )}
        </ul>
      </div>
    </aside>
  );
}

function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="typing-dot h-1 w-1 rounded-full bg-gray-400" />
      <span className="typing-dot h-1 w-1 rounded-full bg-gray-400" />
      <span className="typing-dot h-1 w-1 rounded-full bg-gray-400" />
    </span>
  );
}
