/** Peer roster for the shared room. */
import { Radio, Search, Settings2 } from "lucide-react";
import { useMemo } from "react";
import { useNetworkStore } from "@/shared/stores/network-store";
import { useUserStore } from "@/shared/stores/user-store";
import type { Peer } from "@/shared/types/network";

export function AppSidebar() {
  const currentUser = useUserStore((state) => state.currentUser);
  const peers = useNetworkStore((state) => state.peers);
  const typing = useUserStore((state) => state.typingUsers);
  const visiblePeers = useMemo(
    () =>
      [...peers].sort((a, b) => Number(b.isConnected) - Number(a.isConnected)),
    [peers]
  );

  return (
    <aside className="sidebar-shell">
      <section className="profile-card">
        <PixelAvatar local name={currentUser?.username ?? "?"} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-pixel text-[0.62rem] text-retro-text">
            {currentUser?.username ?? "LOADING"}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-retro-green text-xs uppercase tracking-widest">
            <span className="status-pulse" /> transmitter ready
          </p>
        </div>
        <button
          aria-label="Open settings"
          className="icon-button"
          type="button"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </section>

      <div className="sidebar-search">
        <Search className="h-3.5 w-3.5" />
        <span>SEARCH PEERS</span>
        <kbd>/</kbd>
      </div>

      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="section-label">ACTIVE NODES</h2>
        <span className="counter-badge">
          {visiblePeers.length.toString().padStart(2, "0")}
        </span>
      </div>

      <ul className="flex-1 space-y-1 overflow-y-auto px-2">
        {visiblePeers.map((user: Peer, index) => (
          <li
            className="peer-row"
            key={user.id}
            style={{ animationDelay: `${index * 55}ms` }}
          >
            <PixelAvatar name={user.username} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-pixel text-[0.58rem] text-retro-text">
                {user.username}
              </p>
              <p className="mt-1 text-retro-text-dim text-xs uppercase tracking-widest">
                {typing[user.userId] ? (
                  <>
                    <TypingDots /> transmitting
                  </>
                ) : user.isConnected ? (
                  "signal stable"
                ) : (
                  "discovered"
                )}
              </p>
            </div>
            <span
              className={
                user.isConnected
                  ? "h-2 w-2 bg-retro-green shadow-[0_0_8px_var(--color-retro-green)]"
                  : "h-2 w-2 bg-retro-amber"
              }
            />
          </li>
        ))}
        {visiblePeers.length === 0 && <EmptyPeers />}
      </ul>

      <footer className="sidebar-footer">
        <Radio className="h-3.5 w-3.5 text-retro-amber" />
        <span>AUTO-SCAN 42421</span>
        <span className="ml-auto animate-blink text-retro-amber">●</span>
      </footer>
    </aside>
  );
}

function PixelAvatar({
  name,
  local = false,
}: {
  readonly name: string;
  readonly local?: boolean;
}) {
  return (
    <div
      className={local ? "pixel-avatar-frame is-local" : "pixel-avatar-frame"}
    >
      <span>{name.slice(0, 2).toUpperCase()}</span>
      <i />
    </div>
  );
}

function EmptyPeers() {
  return (
    <li className="mx-2 mt-4 border border-retro-border border-dashed p-5 text-center">
      <Radio className="mx-auto mb-3 h-5 w-5 animate-signal text-retro-text-dim" />
      <p className="font-pixel text-[0.55rem] text-retro-text-dim">
        SCANNING LAN...
      </p>
      <p className="mt-2 text-retro-text-dim text-xs leading-relaxed">
        No other nodes in range
      </p>
    </li>
  );
}

function TypingDots() {
  return (
    <span className="mr-1 inline-flex gap-0.5">
      <i className="typing-dot" />
      <i className="typing-dot" />
      <i className="typing-dot" />
    </span>
  );
}
