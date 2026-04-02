-- ============================================================
-- COSMOS CHAT — Database Schema (SQLite)
-- ============================================================
-- The server uses four separate SQLite database files,
-- each managed by its own module in server/db/.
-- All tables are created automatically on startup via
-- CREATE TABLE IF NOT EXISTS — no manual setup required.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- FILE: data/rooms.db   (managed by server/db/rooms-db.js)
-- ────────────────────────────────────────────────────────────

-- All chat rooms. The global room (id='global') is seeded
-- automatically and cannot be deleted.
CREATE TABLE IF NOT EXISTS rooms (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  secret_key TEXT,                    -- NULL = public room; set = private room with key
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO rooms (id, name) VALUES ('global', 'Global Chat');

-- ────────────────────────────────────────────────────────────
-- FILE: data/messages.db   (managed by server/db/messages-db.js)
-- ────────────────────────────────────────────────────────────

-- All messages ever sent, including faded (self-destructed)
-- and admin-deleted ones.
CREATE TABLE IF NOT EXISTS messages (
  id                TEXT    PRIMARY KEY,
  room_id           TEXT    NOT NULL,
  username          TEXT    NOT NULL,
  text              TEXT    NOT NULL,
  timestamp         TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted           INTEGER DEFAULT 0,   -- 1 when self-destruct timer fires
  deleted_by_admin  INTEGER DEFAULT 0,   -- 1 when admin manually deletes
  disappear_after_ms INTEGER,            -- self-destruct delay in ms; NULL = permanent
  ip                TEXT                 -- sender IP (admin-visible only)
);

CREATE INDEX IF NOT EXISTS idx_messages_room_id  ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_username  ON messages(username);

-- ────────────────────────────────────────────────────────────
-- FILE: data/users.db   (managed by server/db/users-db.js)
-- ────────────────────────────────────────────────────────────

-- Historical record of every user session (connection → disconnection).
-- Unlike the in-memory connectedUsers map, this persists across restarts.
CREATE TABLE IF NOT EXISTS user_sessions (
  id              TEXT PRIMARY KEY,        -- socket ID
  username        TEXT NOT NULL,
  ip              TEXT,
  connected_at    TEXT NOT NULL,
  disconnected_at TEXT,                    -- NULL while still connected
  last_room       TEXT                     -- last room the user was in
);

CREATE INDEX IF NOT EXISTS idx_sessions_username ON user_sessions(username);
CREATE INDEX IF NOT EXISTS idx_sessions_ip       ON user_sessions(ip);

-- ────────────────────────────────────────────────────────────
-- FILE: data/audit.db   (managed by server/db/audit-db.js)
-- ────────────────────────────────────────────────────────────

-- Log of all admin actions for accountability and review.
CREATE TABLE IF NOT EXISTS audit_log (
  id        TEXT PRIMARY KEY,
  action    TEXT NOT NULL,   -- 'kick_user' | 'delete_message' | 'delete_room'
  target    TEXT,            -- username, message ID, or room ID
  detail    TEXT,            -- additional context (e.g. kick reason, room name)
  timestamp TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_action    ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);

-- ============================================================
-- Notes on ephemeral data (NOT stored in the database)
-- ============================================================
-- Live connected users are tracked in-memory (Map keyed by
-- socket ID). This means the live user list resets on server
-- restart, but user_sessions.db preserves the history.
-- ============================================================
