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
    <div className="flex h-screen flex-col bg-retro-bg">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <main className="retro-border flex-1 overflow-hidden border-t-0 border-l-0">
          {children}
        </main>
      </div>
    </div>
  );
}
