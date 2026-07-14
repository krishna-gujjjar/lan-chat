/**
 * Main application layout with sidebar and content area.
 */

import type { ReactNode } from "react";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

interface AppLayoutProps {
  readonly children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="app-shell">
      <div aria-hidden="true" className="noise-layer" />
      <AppHeader />
      <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
        <AppSidebar />
        <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
