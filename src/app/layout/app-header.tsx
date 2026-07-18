/** Application title bar and live transport status. */
import { Bug, Wifi, WifiOff } from "lucide-react";
import {
  selectConnectedPeerCount,
  useNetworkStore,
} from "@/shared/stores/network-store";

export function AppHeader({ onDebug }: { readonly onDebug: () => void }) {
  const connectedPeers = useNetworkStore(selectConnectedPeerCount);
  const connectionStatus = useNetworkStore((state) => state.connectionStatus);
  const isOnline = connectedPeers > 0 || connectionStatus === "connected";

  return (
    <header className="app-titlebar">
      <div className="flex min-w-0 items-center gap-3">
        <div aria-hidden="true" className="brand-pixel">
          <span />
          <span />
          <span />
        </div>
        <div className="min-w-0">
          <h1 className="truncate font-pixel text-[0.7rem] tracking-[0.16em] text-retro-green">
            ZENPAWS // LINK
          </h1>
          <p className="hidden text-[0.7rem] uppercase tracking-[0.18em] text-retro-text-dim sm:block">
            local mesh terminal
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="titlebar-chip hidden md:flex">
          <span className="text-retro-cyan">ROOM</span>
          <span>#LOBBY-01</span>
        </div>
        <div
          className="titlebar-chip"
          role="status"
          aria-label={`${connectedPeers} peers online`}
        >
          {isOnline ? (
            <Wifi className="h-3.5 w-3.5 text-retro-green" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-retro-text-dim" />
          )}
          <span className={isOnline ? "text-retro-green" : "text-retro-text-dim"}>
            {connectedPeers.toString().padStart(2, "0")} ONLINE
          </span>
        </div>
        <button className="icon-button" onClick={onDebug} title="Network debugger" type="button"><Bug className="h-4 w-4" /></button>
        <div aria-hidden="true" className="window-controls">
          <i />
          <i />
          <i />
        </div>
      </div>
    </header>
  );
}
