import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import pg from "pg";
import { v4 as uuidv4 } from "uuid";
import { randomBytes } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { Pool } = pg;

const ADMIN_TOKEN = randomBytes(16).toString("hex");
console.log("\n╔══════════════════════════════════════════════╗");
console.log("║          COSMOS CHAT SERVER STARTED          ║");
console.log("╠══════════════════════════════════════════════╣");
console.log(`║  ADMIN TOKEN: ${ADMIN_TOKEN}  ║`);
console.log("╚══════════════════════════════════════════════╝\n");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      secret_key  TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id           TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      username          TEXT NOT NULL,
      text              TEXT NOT NULL,
      timestamp         TIMESTAMPTZ DEFAULT NOW(),
      deleted           BOOLEAN DEFAULT FALSE,
      deleted_by_admin  BOOLEAN DEFAULT FALSE,
      disappear_after_ms INTEGER,
      ip                TEXT
    );

    INSERT INTO rooms (id, name) VALUES ('global', 'Global Chat')
    ON CONFLICT (id) DO NOTHING;
  `);
  console.log("✓ Database schema ready");
}

const connectedUsers = new Map();

const app = express();
app.use(express.json());

const verifyAdmin = (req, res, next) => {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) return res.status(403).json({ error: "Forbidden" });
  next();
};

function getOnlineCountForRoom(roomId) {
  let count = 0;
  for (const user of connectedUsers.values()) {
    if (user.roomId === roomId && !user.isAdmin) count++;
  }
  return count;
}

app.post("/api/chat/admin/auth", (req, res) => {
  const { token } = req.body || {};
  res.json({ ok: token === ADMIN_TOKEN });
});

app.get("/api/chat/rooms", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, created_at, (secret_key IS NOT NULL) AS has_key
       FROM rooms ORDER BY created_at`
    );
    res.json(
      result.rows.map((r) => ({
        id: r.id,
        name: r.name,
        memberCount: getOnlineCountForRoom(r.id),
        hasKey: r.has_key,
        createdAt: r.created_at,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list rooms" });
  }
});

app.post("/api/chat/rooms", async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: "Name required" });
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const id = `${slug}-${randomBytes(3).toString("hex")}`;
    const secretKey = randomBytes(3).toString("hex").toUpperCase();
    await pool.query(
      "INSERT INTO rooms (id, name, secret_key) VALUES ($1, $2, $3)",
      [id, name.trim(), secretKey]
    );
    broadcastRoomsList();
    res.json({ id, name: name.trim(), key: secretKey });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create room" });
  }
});

app.get("/api/chat/admin/rooms", verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.name, r.created_at, r.secret_key,
              COUNT(m.id)::int AS total_messages
       FROM rooms r
       LEFT JOIN messages m ON m.room_id = r.id
       GROUP BY r.id, r.name, r.created_at, r.secret_key
       ORDER BY r.created_at`
    );
    res.json(
      result.rows.map((r) => ({
        id: r.id,
        name: r.name,
        memberCount: getOnlineCountForRoom(r.id),
        createdAt: r.created_at,
        totalMessages: r.total_messages,
        hasKey: !!r.secret_key,
        secretKey: r.secret_key,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list rooms" });
  }
});

app.get("/api/chat/admin/messages/:roomId", verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, room_id, username, text, timestamp, deleted,
              deleted_by_admin, disappear_after_ms, ip
       FROM messages WHERE room_id = $1 ORDER BY timestamp`,
      [req.params.roomId]
    );
    res.json(
      result.rows.map((m) => ({
        id: m.id,
        username: m.username,
        text: m.text,
        roomId: m.room_id,
        timestamp: m.timestamp,
        deleted: m.deleted,
        deletedByAdmin: m.deleted_by_admin,
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
  const ipMap = new Map();
  for (const user of connectedUsers.values()) {
    if (!ipMap.has(user.ip)) ipMap.set(user.ip, []);
    ipMap.get(user.ip).push(user.username);
  }
  const users = Array.from(connectedUsers.entries()).map(([socketId, user]) => ({
    socketId,
    username: user.username,
    ip: user.ip,
    connectedAt: user.connectedAt,
    activeRoom: user.roomId || "global",
    sameIpUsers: (ipMap.get(user.ip) || []).filter((n) => n !== user.username),
  }));
  res.json(users);
});

app.delete("/api/chat/admin/rooms/:roomId", verifyAdmin, async (req, res) => {
  const { roomId } = req.params;
  if (roomId === "global")
    return res.status(400).json({ error: "Cannot delete global room" });
  try {
    await pool.query("DELETE FROM rooms WHERE id = $1", [roomId]);
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

async function broadcastRoomsList(target) {
  try {
    const result = await pool.query(
      "SELECT id, name, created_at, (secret_key IS NOT NULL) AS has_key FROM rooms ORDER BY created_at"
    );
    const rooms = result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      memberCount: getOnlineCountForRoom(r.id),
      createdAt: r.created_at,
      hasKey: r.has_key,
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

io.on("connection", async (socket) => {
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

    socket.on("admin_join_room", async (roomId) => {
      socket.join(roomId);
      try {
        const result = await pool.query(
          `SELECT id, room_id, username, text, timestamp, deleted,
                  deleted_by_admin, disappear_after_ms, ip
           FROM messages WHERE room_id = $1 ORDER BY timestamp`,
          [roomId]
        );
        socket.emit(
          "admin_history",
          result.rows.map((m) => ({
            id: m.id,
            username: m.username,
            text: m.text,
            roomId: m.room_id,
            timestamp: m.timestamp,
            deleted: m.deleted,
            deletedByAdmin: m.deleted_by_admin,
            ip: m.ip,
            disappearAfterMs: m.disappear_after_ms,
          }))
        );
      } catch (err) {
        console.error(err);
      }
    });

    socket.on("admin_delete_message", async ({ messageId, roomId }) => {
      try {
        await pool.query(
          "UPDATE messages SET deleted = TRUE, deleted_by_admin = TRUE WHERE id = $1",
          [messageId]
        );
        io.to(roomId).emit("message_deleted", { messageId, roomId });
      } catch (err) {
        console.error(err);
      }
    });

    socket.on("admin_kick_user", ({ username: targetUsername, reason }) => {
      for (const [sid, user] of connectedUsers.entries()) {
        if (user.username === targetUsername) {
          io.to(sid).emit("kicked", {
            reason: reason || "You have been removed by an administrator.",
          });
          setTimeout(() => {
            io.sockets.sockets.get(sid)?.disconnect(true);
          }, 300);
        }
      }
    });

    await broadcastRoomsList(socket);
    return;
  }

  if (!username || typeof username !== "string" || username.trim().length < 2) {
    socket.disconnect();
    return;
  }

  connectedUsers.set(socket.id, {
    username: username.trim(),
    ip,
    roomId: "global",
    connectedAt: new Date().toISOString(),
    isAdmin: false,
  });

  socket.on("join_room", async ({ roomId, key }) => {
    if (!roomId) return;

    if (roomId !== "global") {
      try {
        const result = await pool.query(
          "SELECT secret_key FROM rooms WHERE id = $1",
          [roomId]
        );
        if (!result.rows.length) {
          socket.emit("join_error", { message: "Room not found." });
          return;
        }
        const room = result.rows[0];
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
      const result = await pool.query(
        `SELECT id, room_id, username, text, timestamp, deleted, disappear_after_ms
         FROM messages
         WHERE room_id = $1 AND deleted_by_admin = FALSE
         ORDER BY timestamp
         LIMIT 150`,
        [roomId]
      );
      socket.emit(
        "room_history",
        result.rows.map((m) => ({
          id: m.id,
          username: m.username,
          text: m.text,
          roomId: m.room_id,
          timestamp: m.timestamp,
          deleted: m.deleted,
          disappearAfterMs: m.disappear_after_ms,
          senderSocketId: null,
        }))
      );
    } catch (err) {
      console.error(err);
    }

    broadcastRoomUpdate(roomId);
    await broadcastRoomsList();
  });

  socket.on("leave_room", (roomId) => {
    socket.leave(roomId);
    const user = connectedUsers.get(socket.id);
    if (user) user.roomId = "global";
    broadcastRoomUpdate(roomId);
  });

  socket.on("send_message", async ({ roomId, text, disappearAfterMs }) => {
    if (!text?.trim()) return;
    const user = connectedUsers.get(socket.id);
    if (!user) return;

    const msgId = uuidv4();
    const timestamp = new Date().toISOString();

    try {
      await pool.query(
        `INSERT INTO messages (id, room_id, username, text, timestamp, disappear_after_ms, ip)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          msgId,
          roomId,
          user.username,
          text.trim(),
          timestamp,
          disappearAfterMs || null,
          ip,
        ]
      );
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
      setTimeout(async () => {
        try {
          await pool.query(
            "UPDATE messages SET deleted = TRUE WHERE id = $1 AND deleted = FALSE",
            [msgId]
          );
          io.to(roomId).emit("message_faded", { messageId: msgId, roomId });
        } catch (err) {
          console.error(err);
        }
      }, disappearAfterMs);
    }
  });

  socket.on("message_viewed", () => {});

  socket.on("disconnect", async () => {
    const user = connectedUsers.get(socket.id);
    if (user?.roomId) broadcastRoomUpdate(user.roomId);
    connectedUsers.delete(socket.id);
    await broadcastRoomsList();
  });

  await broadcastRoomsList(socket);
});

// In production: serve the built React app from dist/public
const isProduction = process.env.NODE_ENV === "production";
const staticDir = join(__dirname, "..", "dist", "public");

if (isProduction && existsSync(staticDir)) {
  app.use(express.static(staticDir));
  // SPA fallback — send index.html for any non-API route
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api/") && !req.path.startsWith("/socket.io/")) {
      res.sendFile(join(staticDir, "index.html"));
    }
  });
  console.log(`✓ Serving static files from ${staticDir}`);
}

// Render uses PORT; local dev uses SERVER_PORT
const PORT = Number(process.env.PORT || process.env.SERVER_PORT || 3001);

initDb()
  .then(() => {
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`✓ Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
