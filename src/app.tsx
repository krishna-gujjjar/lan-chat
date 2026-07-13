/**
 * Main application component.
 * Entry point for the LAN Chat desktop application.
 */

import { AppLayout } from "@/app/layout/app-layout";
import { AppProviders } from "@/app/providers/app-providers";
import { ChatView } from "@/features/chat/components/chat-view";

export default function App() {
  return (
    <AppProviders>
      <AppLayout>
        <ChatView />
      </AppLayout>
    </AppProviders>
  );
}
