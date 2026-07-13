/**
 * Application header with title and connection status.
 */

import {
  selectConnectedPeerCount,
  useNetworkStore,
} from "@/shared/stores/network-store";
import { cn } from "@/utils/cn";

export function AppHeader() {
  const connectedPeers = useNetworkStore(selectConnectedPeerCount);
  const connectionStatus = useNetworkStore((state) => state.connectionStatus);

  const statusColor =
    connectionStatus === "connected"
      ? "bg-retro-green"
      : connectionStatus === "connecting"
        ? "bg-retro-amber animate-blink"
        : "bg-retro-text-dim";

  return (
    <header className="flex h-12 items-center justify-between border-retro-border border-b-2 bg-retro-bg-light px-4">
      <div className="flex items-center gap-3">
        <h1 className="font-pixel text-retro-green text-xs tracking-wider">
          LAN CHAT
        </h1>
        <span className="hidden font-terminal text-retro-text-dim text-sm sm:inline">
          Offline P2P v0.1.0
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className={cn("status-dot", statusColor)} />
          <span className="font-terminal text-retro-text text-sm">
            {connectedPeers} ONLINE
          </span>
        </div>
      </div>
    </header>
  );
}
