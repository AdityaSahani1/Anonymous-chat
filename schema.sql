-- ============================================================
-- COSMOS CHAT — Database Schema
-- ============================================================
-- This file documents the full database schema.
-- The server (server/index.js) auto-creates these tables on
-- startup via CREATE TABLE IF NOT EXISTS.
-- ============================================================

-- Rooms
-- Stores all chat rooms. The global room (id='global') is
-- seeded automatically and cannot be deleted.
CREATE TABLE IF NOT EXISTS rooms (
  id          TEXT        PRIMARY KEY,           -- slug-based ID, e.g. "my-room-a1b2c3"
  name        TEXT        NOT NULL,              -- display name
  secret_key  TEXT,                              -- 6-char uppercase hex; NULL = public (global)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the always-present global room
INSERT INTO rooms (id, name)
  VALUES ('global', 'Global Chat')
  ON CONFLICT (id) DO NOTHING;

-- Messages
-- All messages ever sent, including faded (self-destructed)
-- and admin-deleted ones. Regular users receive only
-- non-admin-deleted messages; admins see everything.
CREATE TABLE IF NOT EXISTS messages (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id           TEXT        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  username          TEXT        NOT NULL,        -- nickname used at time of send
  text              TEXT        NOT NULL,        -- message content
  timestamp         TIMESTAMPTZ DEFAULT NOW(),
  deleted           BOOLEAN     DEFAULT FALSE,   -- TRUE when self-destruct timer fires
  deleted_by_admin  BOOLEAN     DEFAULT FALSE,   -- TRUE when admin manually deletes
  disappear_after_ms INTEGER,                    -- self-destruct delay in ms; NULL = permanent
  ip                TEXT                         -- sender IP (admin-visible only)
);

-- ============================================================
-- Notes on ephemeral data (NOT stored in the database)
-- ============================================================
-- Connected users are tracked in-memory only (Map keyed by
-- socket ID). This means:
--   • User lists reset on server restart (expected for anon app)
--   • IP tracking for same-IP detection is session-only
--   • The admin token regenerates on every server restart
-- ============================================================

-- Useful indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_room_id   ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp  ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_username   ON messages(username);
