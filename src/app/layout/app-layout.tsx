/** Main application layout with peer roster and diagnostics. */
import { type ReactNode, useState } from "react";
import { NetworkDebugPanel } from "@/features/network/components/network-debug-panel";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

interface AppLayoutProps { readonly children: ReactNode; }

export function AppLayout({ children }: AppLayoutProps) {
  const [debugOpen, setDebugOpen] = useState(false);
  return (
    <div className="app-shell">
      <div className="noise-layer" aria-hidden="true" />
      <AppHeader onDebug={() => setDebugOpen(true)} />
      <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
        <AppSidebar />
        <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
      {debugOpen ? <NetworkDebugPanel onClose={() => setDebugOpen(false)} /> : null}
    </div>
  );
}
