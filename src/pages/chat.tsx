import React, { useState } from "react";
import { Menu, LogOut, Wifi, WifiOff, AlertTriangle, Shield } from "lucide-react";
import { useLocation } from "wouter";
import { Sidebar } from "@/components/chat/sidebar";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { useSocket } from "@/hooks/use-socket";
import { useAppStore } from "@/store/use-app-store";
import { Button } from "@/components/ui/button";

export default function Chat() {
  const { setSidebarOpen, activeRoom, setUsername } = useAppStore();
  const [senderDisappearMs, setSenderDisappearMs] = useState(0);
  const [, navigate] = useLocation();
  const {
    isConnected, messages, liveRooms,
    sendMessage, markViewed, leaveCurrentRoom,
    kickedReason, dismissKicked,
  } = useSocket();

  const isAdminAlias = !!sessionStorage.getItem("adminToken");

  const currentRoomInfo = liveRooms.find(r => r.id === activeRoom);
  const roomName = currentRoomInfo?.name || (activeRoom === "global" ? "Global Chat" : activeRoom);
  const memberCount = currentRoomInfo?.memberCount ?? 0;

  const handleSendMessage = (text: string, disappearAfterMs: number) => {
    sendMessage(text, disappearAfterMs);
  };

  const handleBackToAdmin = () => {
    navigate("/admin");
  };

  if (kickedReason) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center bg-card border border-destructive/30 rounded-2xl p-8">
          <div className="w-14 h-14 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Removed from Chat</h2>
          <p className="text-muted-foreground text-sm mb-6">{kickedReason}</p>
          <Button
            className="w-full"
            variant="secondary"
            onClick={() => { dismissKicked(); setUsername(null); }}
          >
            Return to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 relative bg-black/20">
        {/* Admin alias banner */}
        {isAdminAlias && (
          <div className="bg-indigo-950/80 border-b border-indigo-800/60 px-4 py-1.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-indigo-300 text-xs">
              <Shield className="h-3 w-3" />
              <span>Admin mode — chatting with an alias</span>
            </div>
            <button
              onClick={handleBackToAdmin}
              className="text-indigo-400 hover:text-indigo-200 text-xs flex items-center gap-1 transition-colors"
            >
              ← Back to Admin
            </button>
          </div>
        )}

        <header className="h-16 shrink-0 flex items-center justify-between px-4 border-b border-white/5 bg-card/50 backdrop-blur-md z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground rounded-lg"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div>
              <h2 className="font-semibold text-lg leading-tight flex items-center gap-2">
                {roomName}
                {isConnected ? (
                  <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5 text-destructive animate-pulse" />
                )}
              </h2>
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                {memberCount} {memberCount === 1 ? "member" : "members"} online
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeRoom !== "global" && (
              <Button
                variant="secondary"
                size="sm"
                onClick={leaveCurrentRoom}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Leave Room</span>
              </Button>
            )}
          </div>
        </header>

        {!isConnected && (
          <div className="bg-destructive/10 border-b border-destructive/20 text-destructive text-xs py-1.5 px-4 text-center font-medium">
            Connecting to server...
          </div>
        )}

        <div className="flex-1 relative flex flex-col overflow-hidden">
          <MessageList
            messages={messages}
            onMessageViewed={(id, roomId) => markViewed(id, roomId)}
            senderDisappearMs={senderDisappearMs}
          />
          <ChatInput
            onSendMessage={handleSendMessage}
            isConnected={isConnected}
            onDisappearTimeChange={setSenderDisappearMs}
          />
        </div>
      </main>
    </div>
  );
}
