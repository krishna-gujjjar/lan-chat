/**
 * Application header with title and connection status.
 */

import { selectConnectedPeerCount, useNetworkStore } from "@/shared/stores";
import { cn } from "@/utils/cn";

export function AppHeader() {
  const connectedPeers = useNetworkStore(selectConnectedPeerCount);
  const connectionStatus = useNetworkStore((state) => state.connectionStatus);

  const statusColor = {
    connected: "bg-green-500",
    connecting: "bg-yellow-500 animate-pulse",
    disconnected: "bg-gray-400",
  }[connectionStatus];

  return (
    <header className="flex h-12 items-center justify-between border-gray-200 border-b px-4 dark:border-dark-600">
      <div className="flex items-center gap-3">
        <h1 className="font-semibold text-gray-900 text-lg dark:text-white">
          LAN Chat
        </h1>
        <span className="text-gray-500 text-xs dark:text-gray-400">
          Offline-first desktop messaging
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", statusColor)} />
          <span className="text-gray-600 text-sm dark:text-gray-300">
            {connectedPeers} {connectedPeers === 1 ? "peer" : "peers"} online
          </span>
        </div>
      </div>
    </header>
  );
}
