import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { randomBytes } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";

import {
  getRooms,
  getAdminRooms,
  getRoomById,
  insertRoom,
  deleteRoom,
} from "./db/rooms-db.js";

import {
  insertMessage,
  getMessagesByRoom,
  getMessageCountByRoom,
  markMessageFaded,
  markMessageDeletedByAdmin,
} from "./db/messages-db.js";

import {
  insertUserSession,
  updateUserDisconnect,
  getAllUserSessions,
} from "./db/users-db.js";

import { logAudit, getAuditLog } from "./db/audit-db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
if (!ADMIN_TOKEN) {
  console.error(
    "ERROR: ADMIN_TOKEN environment variable is not set. Please set it before starting the server."
  );
  process.exit(1);
}

console.log("\n╔══════════════════════════════════════════════╗");
console.log("║          COSMOS CHAT SERVER STARTED          ║");
console.log("╠══════════════════════════════════════════════╣");
console.log("║  Admin token loaded from environment         ║");
console.log("╚══════════════════════════════════════════════╝\n");
console.log("✓ Database modules ready (SQLite)");

const connectedUsers = new Map();

const app = express();
app.use(express.json());

const verifyAdmin = (req, res, next) => {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) return res.status(403).json({ error: "Forbidden" });
  next();
};

function getOnlineCountForRoom(roomId) {
  const room = io?.sockets?.adapter?.rooms?.get(roomId);
  if (!room) return 0;
  let count = 0;
  for (const socketId of room) {
    const user = connectedUsers.get(socketId);
    if (user && !user.isAdmin) count++;
  }
  return count;
}

app.post("/api/chat/admin/auth", (req, res) => {
  const { token } = req.body || {};
  res.json({ ok: token === ADMIN_TOKEN });
});

app.get("/api/chat/rooms", (req, res) => {
  try {
    const rows = getRooms();
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        memberCount: getOnlineCountForRoom(r.id),
        hasKey: !!r.has_key,
        createdAt: r.created_at,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list rooms" });
  }
});

app.post("/api/chat/rooms", (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: "Name required" });
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const id = `${slug}-${randomBytes(3).toString("hex")}`;
    const secretKey = randomBytes(3).toString("hex").toUpperCase();
    insertRoom(id, name.trim(), secretKey);
    broadcastRoomsList();
    res.json({ id, name: name.trim(), key: secretKey });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create room" });
  }
});

app.get("/api/chat/admin/rooms", verifyAdmin, (req, res) => {
  try {
    const rows = getAdminRooms();
    const countRows = getMessageCountByRoom();
    const countMap = {};
    for (const c of countRows) countMap[c.room_id] = c.total;
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        memberCount: getOnlineCountForRoom(r.id),
        createdAt: r.created_at,
        totalMessages: countMap[r.id] || 0,
        hasKey: !!r.secret_key,
        secretKey: r.secret_key || null,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list rooms" });
  }
});

app.get("/api/chat/admin/messages/:roomId", verifyAdmin, (req, res) => {
  try {
    const rows = getMessagesByRoom(req.params.roomId, true);
    res.json(
      rows.map((m) => ({
        id: m.id,
        username: m.username,
        text: m.text,
        roomId: m.room_id,
        timestamp: m.timestamp,
        deleted: !!m.deleted,
        deletedByAdmin: !!m.deleted_by_admin,
        ip: m.ip,
        disappearAfterMs: m.disappear_after_ms,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get messages" });
  }
});

app.get("/api/chat/admin/users", verifyAdmin, (req, res) => {
  try {
    const ipMap = new Map();
    for (const user of connectedUsers.values()) {
      if (!ipMap.has(user.ip)) ipMap.set(user.ip, []);
      ipMap.get(user.ip).push(user.username);
    }

    const sessions = getAllUserSessions();

    const result = sessions.map((session) => {
      const liveUser = connectedUsers.get(session.id);
      const isLive = !!liveUser;
      return {
        socketId: session.id,
        username: session.username,
        ip: session.ip,
        connectedAt: session.connected_at,
        disconnectedAt: session.disconnected_at || null,
        activeRoom: liveUser?.roomId || session.last_room || null,
        status: isLive ? "online" : "offline",
        sameIpUsers: isLive
          ? (ipMap.get(session.ip) || []).filter((n) => n !== session.username)
          : [],
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get users" });
  }
});

app.get("/api/chat/admin/audit-log", verifyAdmin, (req, res) => {
  try {
    res.json(getAuditLog());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get audit log" });
  }
});

app.delete("/api/chat/admin/rooms/:roomId", verifyAdmin, (req, res) => {
  const { roomId } = req.params;
  if (roomId === "global")
    return res.status(400).json({ error: "Cannot delete global room" });
  try {
    deleteRoom(roomId);
    logAudit({
      id: uuidv4(),
      action: "delete_room",
      target: roomId,
      detail: null,
    });
    io.to(roomId).emit("room_deleted", { roomId });
    broadcastRoomsList();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete room" });
  }
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

function broadcastRoomsList(target) {
  try {
    const rows = getRooms();
    const rooms = rows.map((r) => ({
      id: r.id,
      name: r.name,
      memberCount: getOnlineCountForRoom(r.id),
      createdAt: r.created_at,
      hasKey: !!r.has_key,
    }));
    if (target) {
      target.emit("rooms_list", rooms);
    } else {
      io.emit("rooms_list", rooms);
    }
  } catch (err) {
    console.error("broadcastRoomsList error:", err);
  }
}

function broadcastRoomUpdate(roomId) {
  const count = getOnlineCountForRoom(roomId);
  io.emit("room_update", { roomId, memberCount: count });
}

io.on("connection", (socket) => {
  const query = socket.handshake.query;
  const username = query.username;
  const adminToken = query.adminToken;
  const ip =
    (socket.handshake.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    socket.handshake.address ||
    "unknown";

  const isAdmin = adminToken === ADMIN_TOKEN;

  if (isAdmin) {
    socket.join("__admin_room__");

    socket.on("admin_join_room", (roomId) => {
      socket.join(roomId);
      try {
        const rows = getMessagesByRoom(roomId, true);
        socket.emit(
          "admin_history",
          rows.map((m) => ({
            id: m.id,
            username: m.username,
            text: m.text,
            roomId: m.room_id,
            timestamp: m.timestamp,
            deleted: !!m.deleted,
            deletedByAdmin: !!m.deleted_by_admin,
            ip: m.ip,
            disappearAfterMs: m.disappear_after_ms,
          }))
        );
      } catch (err) {
        console.error(err);
      }
    });

    socket.on("admin_delete_message", ({ messageId, roomId }) => {
      try {
        markMessageDeletedByAdmin(messageId);
        logAudit({
          id: uuidv4(),
          action: "delete_message",
          target: messageId,
          detail: `room:${roomId}`,
        });
        io.to(roomId).emit("message_deleted", { messageId, roomId });
      } catch (err) {
        console.error(err);
      }
    });

    socket.on("admin_kick_user", ({ username: targetUsername, reason }) => {
      for (const [sid, user] of connectedUsers.entries()) {
        if (user.username === targetUsername) {
          logAudit({
            id: uuidv4(),
            action: "kick_user",
            target: targetUsername,
            detail: reason || null,
          });
          io.to(sid).emit("kicked", {
            reason: reason || "You have been removed by an administrator.",
          });
          setTimeout(() => {
            io.sockets.sockets.get(sid)?.disconnect(true);
          }, 300);
        }
      }
    });

    broadcastRoomsList(socket);
    return;
  }

  if (!username || typeof username !== "string" || username.trim().length < 2) {
    socket.disconnect();
    return;
  }

  const connectedAt = new Date().toISOString();
  connectedUsers.set(socket.id, {
    username: username.trim(),
    ip,
    roomId: null,
    connectedAt,
    isAdmin: false,
  });

  insertUserSession({ id: socket.id, username: username.trim(), ip, connectedAt });

  socket.on("join_room", ({ roomId, key }) => {
    if (!roomId) return;

    if (roomId !== "global") {
      try {
        const room = getRoomById(roomId);
        if (!room) {
          socket.emit("join_error", { message: "Room not found." });
          return;
        }
        if (room.secret_key && room.secret_key !== key?.toUpperCase()) {
          socket.emit("join_error", { message: "Invalid room key." });
          return;
        }
      } catch (err) {
        socket.emit("join_error", { message: "Server error." });
        return;
      }
    }

    const user = connectedUsers.get(socket.id);
    if (user?.roomId && user.roomId !== roomId) {
      socket.leave(user.roomId);
      broadcastRoomUpdate(user.roomId);
    }

    socket.join(roomId);
    if (user) user.roomId = roomId;

    socket.emit("join_success", { roomId });

    try {
      const rows = getMessagesByRoom(roomId, false);
      socket.emit(
        "room_history",
        rows.map((m) => ({
          id: m.id,
          username: m.username,
          text: m.text,
          roomId: m.room_id,
          timestamp: m.timestamp,
          deleted: !!m.deleted,
          disappearAfterMs: m.disappear_after_ms,
          senderSocketId: null,
        }))
      );
    } catch (err) {
      console.error(err);
    }

    broadcastRoomUpdate(roomId);
    broadcastRoomsList();
  });

  socket.on("leave_room", (roomId) => {
    socket.leave(roomId);
    const user = connectedUsers.get(socket.id);
    if (user) user.roomId = null;
    broadcastRoomUpdate(roomId);
  });

  socket.on("send_message", ({ roomId, text, disappearAfterMs }) => {
    if (!text?.trim()) return;
    const user = connectedUsers.get(socket.id);
    if (!user) return;

    const msgId = uuidv4();
    const timestamp = new Date().toISOString();

    try {
      insertMessage({
        id: msgId,
        roomId,
        username: user.username,
        text: text.trim(),
        timestamp,
        disappearAfterMs: disappearAfterMs || null,
        ip,
      });
    } catch (err) {
      console.error(err);
    }

    const msg = {
      id: msgId,
      username: user.username,
      text: text.trim(),
      roomId,
      timestamp,
      senderSocketId: socket.id,
      disappearAfterMs: disappearAfterMs || undefined,
    };

    io.to(roomId).emit("message", msg);

    if (disappearAfterMs && disappearAfterMs > 0) {
      setTimeout(() => {
        try {
          markMessageFaded(msgId);
          io.to(roomId).emit("message_faded", { messageId: msgId, roomId });
        } catch (err) {
          console.error(err);
        }
      }, disappearAfterMs);
    }
  });

  socket.on("message_viewed", () => {});

  socket.on("disconnect", () => {
    const user = connectedUsers.get(socket.id);
    if (user?.roomId) broadcastRoomUpdate(user.roomId);
    updateUserDisconnect(socket.id, user?.roomId || null);
    connectedUsers.delete(socket.id);
    broadcastRoomsList();
  });

  broadcastRoomsList(socket);
});

const isProduction = process.env.NODE_ENV === "production";
const staticDir = join(__dirname, "..", "dist", "public");

if (isProduction && existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api/") && !req.path.startsWith("/socket.io/")) {
      res.sendFile(join(staticDir, "index.html"));
    }
  });
  console.log(`✓ Serving static files from ${staticDir}`);
}

const PORT = Number(process.env.PORT || process.env.SERVER_PORT || 3001);

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`✓ Server listening on port ${PORT}`);
});
