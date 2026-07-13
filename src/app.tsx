/**
 * Main application component.
 * Entry point for the LAN Chat desktop application.
 */

import { AppLayout } from "@/app/layout";
import { AppProviders } from "@/app/providers";
import { ChatView } from "@/features/chat";

export default function App() {
  return (
    <AppProviders>
      <AppLayout>
        <ChatView />
      </AppLayout>
    </AppProviders>
  );
}
