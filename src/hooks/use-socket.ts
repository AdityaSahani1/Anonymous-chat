import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppStore } from '../store/use-app-store';

export interface ChatMessage {
  id: string;
  username: string;
  text: string;
  roomId: string;
  timestamp: string;
  deleted?: boolean;
  senderSocketId?: string;
  disappearAfterMs?: number;
}

export interface LiveRoom {
  id: string;
  name: string;
  memberCount: number;
  createdAt?: string;
  hasKey?: boolean;
}

export function useSocket() {
  const { username, activeRoom, setActiveRoom } = useAppStore();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [liveRooms, setLiveRooms] = useState<LiveRoom[]>([]);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [kickedReason, setKickedReason] = useState<string | null>(null);
  const activeRoomRef = useRef(activeRoom);
  const pendingKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  useEffect(() => {
    if (!username) return;

    const socket = io({
      query: { username },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join_room', { roomId: activeRoomRef.current, key: pendingKeyRef.current });
    });

    socket.on('disconnect', () => setIsConnected(false));

    socket.on('join_success', ({ roomId }: { roomId: string }) => {
      setActiveRoom(roomId);
      setJoinError(null);
    });

    socket.on('join_error', ({ message }: { message: string }) => {
      setJoinError(message);
    });

    socket.on('room_history', (history: ChatMessage[]) => {
      if (!history.length) return;
      const roomId = history[0].roomId;
      setMessages(prev => ({
        ...prev,
        [roomId]: history,
      }));
    });

    socket.on('message', (msg: ChatMessage) => {
      setMessages(prev => {
        const roomMessages = prev[msg.roomId] || [];
        if (roomMessages.some(m => m.id === msg.id)) return prev;
        return { ...prev, [msg.roomId]: [...roomMessages, msg] };
      });
    });

    socket.on('message_faded', ({ messageId, roomId }: { messageId: string; roomId: string }) => {
      setMessages(prev => {
        const msgs = prev[roomId];
        if (!msgs) return prev;
        return { ...prev, [roomId]: msgs.map(m => m.id === messageId ? { ...m, deleted: true } : m) };
      });
    });

    socket.on('message_deleted', ({ messageId, roomId }: { messageId: string; roomId: string }) => {
      setMessages(prev => {
        const msgs = prev[roomId];
        if (!msgs) return prev;
        return { ...prev, [roomId]: msgs.map(m => m.id === messageId ? { ...m, deleted: true } : m) };
      });
    });

    socket.on('rooms_list', (rooms: LiveRoom[]) => {
      setLiveRooms(rooms);
    });

    socket.on('room_update', (update: { roomId: string; memberCount: number }) => {
      setLiveRooms(prev =>
        prev.map(r => r.id === update.roomId ? { ...r, memberCount: update.memberCount } : r)
      );
    });

    socket.on('room_deleted', ({ roomId }: { roomId: string }) => {
      setActiveRoom('global');
      setMessages(prev => {
        const next = { ...prev };
        delete next[roomId];
        return next;
      });
    });

    socket.on('kicked', ({ reason }: { reason: string }) => {
      setKickedReason(reason || 'You have been removed by an admin.');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [username]);

  const sendMessage = useCallback((text: string, disappearAfterMs?: number) => {
    if (!socketRef.current || !text.trim() || !activeRoom) return;
    socketRef.current.emit('send_message', { roomId: activeRoom, text, disappearAfterMs });
  }, [activeRoom]);

  const markViewed = useCallback((messageId: string, roomId: string) => {
    socketRef.current?.emit('message_viewed', { messageId, roomId });
  }, []);

  const joinRoom = useCallback((roomId: string, key?: string) => {
    if (!socketRef.current) return;
    setJoinError(null);
    pendingKeyRef.current = key;
    socketRef.current.emit('join_room', { roomId, key });
  }, []);

  const leaveCurrentRoom = useCallback(() => {
    if (activeRoom === 'global' || !socketRef.current) return;
    socketRef.current.emit('leave_room', activeRoom);
    setActiveRoom('global');
    socketRef.current.emit('join_room', { roomId: 'global' });
  }, [activeRoom, setActiveRoom]);

  const dismissKicked = useCallback(() => setKickedReason(null), []);

  return {
    isConnected,
    messages: messages[activeRoom] || [],
    liveRooms,
    joinError,
    kickedReason,
    clearJoinError: () => setJoinError(null),
    dismissKicked,
    sendMessage,
    markViewed,
    joinRoom,
    leaveCurrentRoom,
    activeRoom,
  };
}
