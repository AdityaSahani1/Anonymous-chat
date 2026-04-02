import React, { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { cn, getUsernameColorClasses, getInitials } from "@/lib/utils";
import { useAppStore } from "@/store/use-app-store";
import {
  Trash2, UserX, Key, Users, MessageSquare, RefreshCw, Shield,
  Eye, EyeOff, Globe, Menu, X, LogOut, MessageCircle, ArrowLeft,
} from "lucide-react";

interface AdminRoom {
  id: string;
  name: string;
  memberCount: number;
  createdAt: string;
  totalMessages: number;
  hasKey: boolean;
  secretKey?: string;
}

interface AdminMessage {
  id: string;
  username: string;
  text: string;
  roomId: string;
  timestamp: string;
  deleted: boolean;
  deletedByAdmin?: boolean;
  ip?: string;
  disappearAfterMs?: number;
}

interface AdminUser {
  socketId: string;
  username: string;
  ip: string;
  connectedAt: string;
  activeRoom: string;
  sameIpUsers: string[];
}

function AdminLogin({ onAuth, expiredSession }: { onAuth: (token: string) => void; expiredSession?: boolean }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/chat/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        onAuth(token.trim());
      } else {
        setError("Invalid token. Check the server console/logs.");
      }
    } catch {
      setError("Connection error. Make sure the server is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="text-gray-500 text-sm mt-1">Enter the token from server startup logs</p>
        </div>

        {expiredSession && (
          <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-amber-400 text-sm">
            Session expired — server was restarted. Enter the new token shown in the server logs.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Paste admin token..."
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 font-mono text-sm pr-12"
              autoFocus
              required
            />
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {error && <p className="text-red-400 text-sm font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading || !token.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {loading ? "Verifying..." : "Access Admin Panel"}
          </button>
        </form>

        <p className="text-gray-700 text-xs text-center mt-6">Token regenerates on each server restart</p>
      </div>
    </div>
  );
}

type AdminTab = "messages" | "users";

function Dashboard({ adminToken, onLogout }: { adminToken: string; onLogout: () => void }) {
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [liveCount, setLiveCount] = useState<Record<string, number>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [tab, setTab] = useState<AdminTab>("messages");
  const [showSecretKeys, setShowSecretKeys] = useState(false);
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [aliasDialogOpen, setAliasDialogOpen] = useState(false);
  const [aliasInput, setAliasInput] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();
  const setUsername = useAppStore(state => state.setUsername);

  const fetchRooms = useCallback(() => {
    fetch("/api/chat/admin/rooms", { headers: { "x-admin-token": adminToken } })
      .then(r => {
        if (r.status === 403) { onLogout(); return null; }
        return r.json();
      })
      .then(data => data && setRooms(data))
      .catch(console.error);
  }, [adminToken, onLogout]);

  const fetchUsers = useCallback(() => {
    fetch("/api/chat/admin/users", { headers: { "x-admin-token": adminToken } })
      .then(r => {
        if (r.status === 403) { onLogout(); return null; }
        return r.json();
      })
      .then(data => data && setUsers(data))
      .catch(console.error);
  }, [adminToken, onLogout]);

  useEffect(() => {
    fetchRooms();
    fetchUsers();
    const interval = setInterval(fetchUsers, 10000);
    return () => clearInterval(interval);
  }, [fetchRooms, fetchUsers]);

  useEffect(() => {
    const socket = io({
      query: { adminToken, username: "__admin__" },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));
    socket.on("admin_auth_failed", () => onLogout());

    socket.on("admin_history", (msgs: AdminMessage[]) => setMessages(msgs));

    socket.on("message", (msg: AdminMessage) => {
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
    });

    socket.on("message_faded", ({ messageId }: { messageId: string }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, deleted: true } : m));
    });

    socket.on("message_deleted", ({ messageId }: { messageId: string }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, deleted: true, deletedByAdmin: true } : m));
    });

    socket.on("room_update", (update: { roomId: string; memberCount: number }) => {
      setLiveCount(prev => ({ ...prev, [update.roomId]: update.memberCount }));
    });

    socket.on("rooms_list", (updatedRooms: AdminRoom[]) => {
      const counts: Record<string, number> = {};
      updatedRooms.forEach(r => { counts[r.id] = r.memberCount; });
      setLiveCount(counts);
      fetchRooms();
    });

    return () => { socket.disconnect(); };
  }, [adminToken, fetchRooms, onLogout]);

  const handleSelectRoom = (roomId: string) => {
    setSelectedRoom(roomId);
    setMessages([]);
    setTab("messages");
    setMobileSidebarOpen(false);
    fetch(`/api/chat/admin/messages/${roomId}`, { headers: { "x-admin-token": adminToken } })
      .then(r => r.json())
      .then(setMessages)
      .catch(console.error);
    socketRef.current?.emit("admin_join_room", roomId);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleDeleteMessage = (messageId: string, roomId: string) => {
    socketRef.current?.emit("admin_delete_message", { messageId, roomId });
  };

  const handleKickUser = (username: string) => {
    if (!window.confirm(`Kick user "${username}"? They will be disconnected.`)) return;
    socketRef.current?.emit("admin_kick_user", { username, reason: "You have been removed by an administrator." });
    setTimeout(fetchUsers, 1000);
  };

  const handleDeleteRoom = async (roomId: string) => {
    const res = await fetch(`/api/chat/admin/rooms/${roomId}`, {
      method: "DELETE",
      headers: { "x-admin-token": adminToken },
    });
    if (res.ok) {
      setConfirmDeleteRoom(null);
      if (selectedRoom === roomId) setSelectedRoom(null);
      fetchRooms();
    }
  };

  const handleEnterChat = (e: React.FormEvent) => {
    e.preventDefault();
    const alias = aliasInput.trim();
    if (alias.length < 2) return;
    setUsername(alias);
    navigate("/");
  };

  const selectedRoomInfo = rooms.find(r => r.id === selectedRoom);

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-mono text-sm overflow-hidden">

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 transition-transform duration-300 ease-in-out",
        "fixed md:relative inset-y-0 left-0 z-40 w-72",
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Shield className="h-4 w-4 text-indigo-400" /> Admin Panel
            </h1>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                isConnected ? "bg-emerald-900 text-emerald-400" : "bg-red-900 text-red-400"
              )}>
                {isConnected ? "LIVE" : "OFFLINE"}
              </span>
              <button
                className="md:hidden p-1 text-gray-500 hover:text-gray-300"
                onClick={() => setMobileSidebarOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-[11px] text-gray-500">Invisible · not counted in rooms</p>
            <button
              onClick={() => setShowSecretKeys(s => !s)}
              title={showSecretKeys ? "Hide secret keys" : "Show secret keys"}
              className="text-gray-600 hover:text-yellow-400 transition-colors"
            >
              {showSecretKeys ? <EyeOff className="h-3.5 w-3.5" /> : <Key className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {rooms.length === 0 ? (
            <p className="text-gray-600 text-xs p-4 text-center">No rooms yet</p>
          ) : rooms.map(room => (
            <div key={room.id} className="relative group mb-1">
              <button
                onClick={() => handleSelectRoom(room.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg transition-colors pr-8",
                  selectedRoom === room.id
                    ? "bg-indigo-900/60 border border-indigo-700/50"
                    : "hover:bg-gray-800 border border-transparent"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white truncate">{room.name}</span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full ml-2 shrink-0",
                    (liveCount[room.id] ?? room.memberCount) > 0
                      ? "bg-emerald-900/60 text-emerald-400"
                      : "bg-gray-800 text-gray-600"
                  )}>
                    {liveCount[room.id] ?? room.memberCount}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {room.id === "global" ? (
                    <span className="text-blue-500 text-[10px] flex items-center gap-0.5">
                      <Globe className="h-2.5 w-2.5" />global
                    </span>
                  ) : (
                    <span className="text-gray-600 text-[10px]">#{room.id.slice(-8)}</span>
                  )}
                  {room.hasKey && (
                    <span className="text-yellow-600 text-[10px] flex items-center gap-0.5">
                      <Key className="h-2.5 w-2.5" />
                      {showSecretKeys && room.secretKey
                        ? <span className="font-bold tracking-widest">{room.secretKey}</span>
                        : "keyed"}
                    </span>
                  )}
                  <span className="text-gray-600 text-[10px]">{room.totalMessages} msgs</span>
                </div>
              </button>

              {room.id !== "global" && (
                <button
                  onClick={() => setConfirmDeleteRoom(room.id)}
                  title="Delete room"
                  className="absolute right-2 top-3 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all p-1 rounded"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-gray-800 space-y-2">
          {/* Enter chat as user */}
          <button
            onClick={() => setAliasDialogOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-900/40 border border-indigo-700/40 text-indigo-300 hover:bg-indigo-900/60 transition-colors text-xs font-semibold"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Enter Chat as User
          </button>
          <div className="text-[10px] text-gray-600 space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Users className="h-3 w-3" />
              <span>{users.length} users online now</span>
            </div>
            <div>Invisible to all users. Not counted in member stats.</div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-1.5 text-gray-400 hover:text-white"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-bold text-white flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-indigo-400" /> Admin Panel
          </h1>
          <button
            onClick={onLogout}
            className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {/* Desktop sign-out in top-right corner */}
        <div className="hidden md:flex absolute top-3 right-4 z-10">
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors text-xs"
            title="Sign out of admin"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>

        {!selectedRoom ? (
          <div className="flex-1 flex items-center justify-center text-gray-700">
            <div className="text-center px-4">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-lg font-semibold text-gray-500">Select a room to monitor</p>
              <p className="text-gray-700 text-xs mt-1">Full history · faded messages · IP tracking · moderation tools</p>
            </div>
          </div>
        ) : (
          <>
            <header className="h-14 flex items-center px-4 md:px-6 border-b border-gray-800 bg-gray-900/50 shrink-0 gap-3">
              <button
                className="md:hidden p-1 text-gray-500 hover:text-white mr-1"
                onClick={() => { setSelectedRoom(null); }}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-white flex items-center gap-2 flex-wrap text-sm">
                  {selectedRoomInfo?.name}
                  {selectedRoomInfo?.hasKey && (
                    <span className="text-yellow-600 text-xs flex items-center gap-1">
                      <Key className="h-3 w-3" />
                      {showSecretKeys && selectedRoomInfo?.secretKey
                        ? <span className="font-mono tracking-widest">{selectedRoomInfo.secretKey}</span>
                        : "Private"}
                    </span>
                  )}
                </h2>
                <p className="text-[11px] text-gray-500">
                  {messages.length} total · {messages.filter(m => m.deleted).length} faded/deleted
                </p>
              </div>

              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => setTab("messages")}
                  className={cn(
                    "px-2 md:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 md:gap-1.5 transition-colors",
                    tab === "messages"
                      ? "bg-indigo-900/60 text-indigo-300 border border-indigo-700/50"
                      : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Messages</span>
                </button>
                <button
                  onClick={() => { setTab("users"); fetchUsers(); }}
                  className={cn(
                    "px-2 md:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 md:gap-1.5 transition-colors",
                    tab === "users"
                      ? "bg-indigo-900/60 text-indigo-300 border border-indigo-700/50"
                      : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
                  )}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Users & IPs</span>
                </button>
                <button
                  onClick={() => { fetchRooms(); fetchUsers(); if (selectedRoom) handleSelectRoom(selectedRoom); }}
                  className="p-1.5 text-gray-600 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </header>

            {tab === "messages" && (
              <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-1.5">
                {messages.length === 0 ? (
                  <p className="text-gray-700 text-center py-8">No messages yet.</p>
                ) : messages.map(msg => {
                  const colorClasses = getUsernameColorClasses(msg.username);
                  return (
                    <div key={msg.id} className={cn(
                      "flex gap-2 md:gap-3 items-start p-2.5 rounded-lg group",
                      msg.deletedByAdmin
                        ? "opacity-30 bg-red-950/30 border border-red-900/30"
                        : msg.deleted
                          ? "opacity-40 bg-orange-950/20 border border-orange-900/20"
                          : "bg-gray-900/40 hover:bg-gray-900/60"
                    )}>
                      <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5",
                        colorClasses
                      )}>
                        {getInitials(msg.username)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5 md:gap-2 mb-0.5 flex-wrap">
                          <span className={cn("text-xs font-bold", colorClasses.split(" ")[0])}>
                            {msg.username}
                          </span>
                          {msg.ip && (
                            <span className="text-[10px] text-cyan-700 font-mono bg-cyan-900/20 px-1.5 py-0.5 rounded">
                              {msg.ip}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-600">
                            {format(msg.timestamp, "MMM d, h:mm:ss a")}
                          </span>
                          {msg.deletedByAdmin && (
                            <span className="text-[10px] text-red-500/70 bg-red-900/30 px-1.5 py-0.5 rounded">DELETED</span>
                          )}
                          {msg.deleted && !msg.deletedByAdmin && (
                            <span className="text-[10px] text-orange-500/70 bg-orange-900/30 px-1.5 py-0.5 rounded">FADED</span>
                          )}
                          {msg.disappearAfterMs !== undefined && (
                            <span className="text-[10px] text-gray-700">⏱ {msg.disappearAfterMs / 1000}s</span>
                          )}
                        </div>
                        <p className="text-gray-300 text-sm whitespace-pre-wrap break-words leading-relaxed">
                          {msg.text}
                        </p>
                      </div>

                      {!msg.deleted && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={() => handleKickUser(msg.username)}
                            title={`Kick ${msg.username}`}
                            className="p-1.5 text-gray-600 hover:text-orange-400 hover:bg-orange-900/20 rounded transition-colors"
                          >
                            <UserX className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMessage(msg.id, msg.roomId)}
                            title="Delete message"
                            className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            )}

            {tab === "users" && (
              <div className="flex-1 overflow-y-auto p-3 md:p-4">
                <div className="space-y-2">
                  {users.length === 0 ? (
                    <p className="text-gray-600 text-center py-8">No users connected.</p>
                  ) : users.map(user => (
                    <div key={user.socketId} className="bg-gray-900/50 rounded-lg p-3 border border-gray-800 flex items-start justify-between gap-3 group">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                          getUsernameColorClasses(user.username)
                        )}>
                          {getInitials(user.username)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-0.5">
                            <span className="font-bold text-white text-sm">{user.username}</span>
                            <span className="text-[10px] bg-cyan-900/30 text-cyan-400 font-mono px-2 py-0.5 rounded">
                              {user.ip}
                            </span>
                            {user.activeRoom && (
                              <span className="text-[10px] text-gray-500">
                                in #{user.activeRoom === "global" ? "global" : user.activeRoom.slice(-8)}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-600">
                            Connected {format(user.connectedAt, "h:mm:ss a")}
                          </div>
                          {user.sameIpUsers.length > 0 && (
                            <div className="mt-1 text-[11px] text-yellow-600 bg-yellow-900/20 px-2 py-1 rounded flex items-center gap-1">
                              <span>⚠</span>
                              Same IP as: {user.sameIpUsers.map(n => `"${n}"`).join(", ")}
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleKickUser(user.username)}
                        title={`Kick ${user.username}`}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-900/20 rounded transition-all shrink-0"
                      >
                        <UserX className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-3 bg-gray-900/50 rounded-lg border border-gray-800 text-[11px] text-gray-600">
                  <p className="font-semibold text-gray-400 mb-2">IP Tracking Notes</p>
                  <p>Same-IP detection helps identify if multiple nicknames are from the same device. Stored in memory only — resets on server restart.</p>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Delete room confirmation */}
      {confirmDeleteRoom && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-xs">
            <h3 className="text-white font-bold text-lg mb-2">Delete Room?</h3>
            <p className="text-gray-400 text-sm mb-6">
              All users in this room will be moved to Global Chat. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteRoom(null)}
                className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteRoom(confirmDeleteRoom)}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors text-sm font-semibold"
              >
                Delete Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enter Chat as User dialog */}
      {aliasDialogOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center shrink-0">
                <MessageCircle className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">Enter Chat as User</h3>
                <p className="text-gray-500 text-xs mt-0.5">Choose an alias — you'll appear as a normal user</p>
              </div>
            </div>

            <form onSubmit={handleEnterChat} className="space-y-4">
              <input
                autoFocus
                type="text"
                value={aliasInput}
                onChange={e => setAliasInput(e.target.value)}
                placeholder="Alias nickname..."
                maxLength={20}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 text-sm"
                required
              />
              <div className="bg-indigo-950/40 border border-indigo-800/40 rounded-lg px-3 py-2 text-[11px] text-indigo-400">
                Your admin session stays active. Navigate back to <strong>/admin</strong> anytime to return to this panel.
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setAliasDialogOpen(false); setAliasInput(""); }}
                  className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={aliasInput.trim().length < 2}
                  className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors text-sm font-semibold"
                >
                  Enter Chat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [adminToken, setAdminToken] = useState<string | null>(() =>
    sessionStorage.getItem("adminToken")
  );
  const [sessionExpired, setSessionExpired] = useState(false);

  const handleAuth = (token: string) => {
    sessionStorage.setItem("adminToken", token);
    setAdminToken(token);
    setSessionExpired(false);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("adminToken");
    setAdminToken(null);
    setSessionExpired(true);
  };

  if (!adminToken) return <AdminLogin onAuth={handleAuth} expiredSession={sessionExpired} />;
  return <Dashboard adminToken={adminToken} onLogout={handleLogout} />;
}
