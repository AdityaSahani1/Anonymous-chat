import React, { useState } from "react";
import { Plus, Hash, Users, Globe, LogOut, Copy, Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/use-app-store";
import { useSocket, LiveRoom } from "@/hooks/use-socket";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useListRooms, useCreateRoom } from "@workspace/api-client-react";

interface CreatedRoomInfo {
  id: string;
  name: string;
  key: string;
}

export function Sidebar() {
  const { activeRoom, isSidebarOpen, setSidebarOpen, username, setUsername } = useAppStore();
  const { liveRooms, joinRoom, joinError, clearJoinError } = useSocket();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [createdRoom, setCreatedRoom] = useState<CreatedRoomInfo | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [joinRoomIdInput, setJoinRoomIdInput] = useState("");
  const [joinKeyInput, setJoinKeyInput] = useState("");

  const { data: initialRooms } = useListRooms();
  const createRoomMutation = useCreateRoom({
    mutation: {
      onSuccess: (newRoom) => {
        setIsCreateOpen(false);
        setCreatedRoom({ id: newRoom.id, name: newRoom.name, key: (newRoom as any).key || "" });
      },
    },
  });

  // Merge live rooms with initial rooms
  const mergedRoomsMap = new Map<string, LiveRoom & { hasKey?: boolean }>();
  initialRooms?.forEach(r => mergedRoomsMap.set(r.id, r as any));
  liveRooms?.forEach(r => mergedRoomsMap.set(r.id, r));
  const rooms = Array.from(mergedRoomsMap.values());

  const handleCreateRoom = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    if (!name.trim()) return;
    createRoomMutation.mutate({ data: { name } });
  };

  const handleJoinRoom = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const roomId = joinRoomIdInput.trim().toLowerCase();
    const key = joinKeyInput.trim().toUpperCase();
    if (!roomId) return;
    joinRoom(roomId, key || undefined);
  };

  const copyToClipboard = (text: string, type: "id" | "key") => {
    navigator.clipboard.writeText(text);
    if (type === "id") { setCopiedId(true); setTimeout(() => setCopiedId(false), 2000); }
    else { setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000); }
  };

  const handleLogout = () => setUsername(null);

  // If join was successful, close the dialog
  React.useEffect(() => {
    if (!joinError && joinRoomIdInput && isJoinOpen) {
      // Check if activeRoom changed to the joined room
    }
  }, [activeRoom]);

  return (
    <>
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={cn(
        "fixed md:relative inset-y-0 left-0 z-40 w-72 bg-card border-r border-border transform transition-transform duration-300 ease-in-out flex flex-col",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        {/* User Profile */}
        <div className="p-5 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Chatting as</p>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <p className="font-semibold text-base text-foreground truncate">{username}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
              title="Leave chat"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Room List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Global */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">Global</h3>
            <button
              onClick={() => { joinRoom("global"); setSidebarOpen(false); }}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all",
                activeRoom === "global"
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <Globe className="h-4 w-4 opacity-70" />
                <span className="font-medium">Global Chat</span>
              </div>
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full",
                activeRoom === "global" ? "bg-black/20" : "bg-white/10"
              )}>
                {liveRooms.find(r => r.id === "global")?.memberCount ?? 0}
              </span>
            </button>
          </div>

          {/* Private Rooms */}
          <div>
            <div className="flex items-center justify-between mb-2 px-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Private Rooms</h3>
              <button
                onClick={() => { clearJoinError(); setJoinRoomIdInput(""); setJoinKeyInput(""); setIsJoinOpen(true); }}
                className="text-xs text-primary hover:opacity-70 transition-opacity"
              >
                Join
              </button>
            </div>

            <div className="space-y-1">
              {rooms.filter(r => r.id !== "global").length === 0 ? (
                <p className="text-sm text-muted-foreground px-2 py-4 italic text-center bg-white/[0.02] rounded-lg border border-white/5">
                  No rooms yet
                </p>
              ) : (
                rooms.filter(r => r.id !== "global").map(room => (
                  <button
                    key={room.id}
                    onClick={() => {
                      // Can't join by clicking unless already in it — need key
                      if (activeRoom === room.id) return;
                      setJoinRoomIdInput(room.id);
                      setJoinKeyInput("");
                      clearJoinError();
                      setIsJoinOpen(true);
                      setSidebarOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all group",
                      activeRoom === room.id
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <Hash className="h-4 w-4 opacity-70 shrink-0" />
                      <span className="font-medium truncate">{room.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Lock className="h-3 w-3 opacity-40" />
                      <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100">
                        <Users className="h-3 w-3" />
                        <span className="text-xs">{room.memberCount ?? 0}</span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Create Room */}
        <div className="p-4 border-t border-white/5">
          <Button
            className="w-full justify-start gap-2"
            variant="secondary"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Create Private Room
          </Button>
        </div>
      </div>

      {/* Create Room Dialog */}
      <Dialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Private Room"
        description="A unique Room ID and secret Key will be generated. Share both with people you want to invite."
      >
        <form onSubmit={handleCreateRoom} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-foreground">Room Name</label>
            <Input id="name" name="name" placeholder="e.g. Secret Lair" autoFocus required maxLength={30} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createRoomMutation.isPending}>Create Room</Button>
          </div>
        </form>
      </Dialog>

      {/* Room Created — Show ID + Key */}
      <Dialog
        isOpen={!!createdRoom}
        onClose={() => { if (createdRoom) { joinRoom(createdRoom.id, createdRoom.key); } setCreatedRoom(null); setSidebarOpen(false); }}
        title="Room Created!"
        description="Share these credentials with people you want to invite. They need BOTH the Room ID and the Key."
      >
        {createdRoom && (
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="bg-secondary rounded-xl p-4 border border-white/5">
                <p className="text-xs text-muted-foreground mb-1.5 font-medium">Room ID</p>
                <div className="flex items-center justify-between gap-3">
                  <code className="text-foreground font-mono text-sm font-bold">{createdRoom.id}</code>
                  <button
                    onClick={() => copyToClipboard(createdRoom.id, "id")}
                    className="shrink-0 p-1.5 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                  >
                    {copiedId ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="bg-secondary rounded-xl p-4 border border-white/5">
                <p className="text-xs text-muted-foreground mb-1.5 font-medium">Secret Key</p>
                <div className="flex items-center justify-between gap-3">
                  <code className="text-foreground font-mono text-lg font-bold tracking-[0.25em]">{createdRoom.key}</code>
                  <button
                    onClick={() => copyToClipboard(createdRoom.key, "key")}
                    className="shrink-0 p-1.5 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                  >
                    {copiedKey ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Save these somewhere — the key won't be shown again.
            </p>

            <Button
              className="w-full"
              onClick={() => { joinRoom(createdRoom.id, createdRoom.key); setCreatedRoom(null); setSidebarOpen(false); }}
            >
              Enter Room
            </Button>
          </div>
        )}
      </Dialog>

      {/* Join Room Dialog */}
      <Dialog
        isOpen={isJoinOpen}
        onClose={() => { setIsJoinOpen(false); clearJoinError(); }}
        title="Join Private Room"
        description="Enter the Room ID and the Secret Key shared with you."
      >
        <form onSubmit={handleJoinRoom} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="joinRoomId" className="text-sm font-medium text-foreground">Room ID</label>
            <Input
              id="joinRoomId"
              value={joinRoomIdInput}
              onChange={e => setJoinRoomIdInput(e.target.value)}
              placeholder="e.g. secret-lair"
              autoFocus={!joinRoomIdInput}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="joinKey" className="text-sm font-medium text-foreground">Secret Key</label>
            <Input
              id="joinKey"
              value={joinKeyInput}
              onChange={e => setJoinKeyInput(e.target.value.toUpperCase())}
              placeholder="e.g. X7K2MQ"
              autoFocus={!!joinRoomIdInput}
              required
              maxLength={6}
              className="font-mono tracking-widest"
            />
          </div>
          {joinError && (
            <p className="text-sm text-destructive font-medium">{joinError}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => { setIsJoinOpen(false); clearJoinError(); }}>Cancel</Button>
            <Button
              type="submit"
              onClick={() => {
                // Close on next tick if no error
                setTimeout(() => {
                  if (!joinError) setIsJoinOpen(false);
                }, 300);
              }}
            >
              Join Room
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
