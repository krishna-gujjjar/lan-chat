/**
 * Main application component.
 * Entry point for the LAN Chat desktop application.
 */

import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { useEffect, useState } from "react";
import { AppLayout } from "@/app/layout/app-layout";
import { AppProviders } from "@/app/providers/app-providers";
import { ChatView } from "@/features/chat/components/chat-view";
import { useTauriEvents } from "@/shared/hooks/use-tauri-events";
import { invokeOrThrow } from "@/shared/lib/tauri/invoke";
import { useMessageStore } from "@/shared/stores/message-store";
import { useNetworkStore } from "@/shared/stores/network-store";
import { useUserStore } from "@/shared/stores/user-store";

function AppContent() {
  useTauriEvents();

  const setCurrentUser = useUserStore((state) => state.setCurrentUser);
  const setUsers = useUserStore((state) => state.setUsers);
  const setMessages = useMessageStore((state) => state.addMessages);
  const setPeers = useNetworkStore((state) => state.setPeers);
  const [isReady, setIsReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupUsername, setSetupUsername] = useState("");

  // Load initial data
  useEffect(() => {
    async function init() {
      try {
        if (!(await isPermissionGranted())) {
          await requestPermission();
        }
        const user = await invokeOrThrow("get_current_user");
        if (user) {
          setCurrentUser(user);
          // Load messages
          const messages = await invokeOrThrow("get_messages", { limit: 50 });
          if (messages.items) {
            setMessages([...messages.items]);
          }
          // Load peers
          const peers = await invokeOrThrow("get_peers");
          setPeers([...peers]);
          // Load users
          const users = await invokeOrThrow("get_all_users");
          setUsers([...users]);
        } else {
          setNeedsSetup(true);
        }
      } catch (e) {
        console.error("Init error:", e);
        setNeedsSetup(true);
      } finally {
        setIsReady(true);
      }
    }

    init();
  }, [setCurrentUser, setMessages, setPeers, setUsers]);

  const handleSetup = async () => {
    const username = setupUsername.trim();
    if (!username || username.length < 2) return;

    try {
      const user = await invokeOrThrow("initialize_app", { username });
      setCurrentUser(user);
      setNeedsSetup(false);
    } catch (e) {
      console.error("Setup error:", e);
    }
  };

  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-retro-bg">
        <div className="text-center">
          <p className="font-pixel text-retro-green text-sm animate-blink">
            LOADING...
          </p>
        </div>
      </div>
    );
  }

  if (needsSetup) {
    return (
      <div className="flex h-screen items-center justify-center bg-retro-bg p-4">
        <div className="w-full max-w-md retro-panel p-6">
          <h1 className="font-pixel text-retro-green text-center text-sm mb-2">
            LAN CHAT
          </h1>
          <p className="text-retro-text-dim text-center mb-6 font-terminal text-lg">
            Offline P2P Messaging
          </p>

          <div className="space-y-4">
            <div>
              <label className="block font-pixel text-retro-text text-xs mb-2">
                ENTER USERNAME
              </label>
              <input
                type="text"
                value={setupUsername}
                onChange={(e) => setSetupUsername(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSetup();
                }}
                placeholder="Your handle..."
                className="retro-input"
                maxLength={32}
                autoFocus
              />
            </div>

            <button
              onClick={handleSetup}
              disabled={setupUsername.trim().length < 2}
              className="retro-button retro-button-primary w-full"
            >
              CONNECT TO LAN
            </button>

            <p className="text-retro-text-dim text-center text-sm font-terminal">
              Press ENTER to confirm
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <ChatView />
    </AppLayout>
  );
}

export default function App() {
  return (
    <AppProviders>
      <AppContent />
      <div className="crt-overlay" />
    </AppProviders>
  );
}
