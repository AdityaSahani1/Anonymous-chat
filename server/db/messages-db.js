import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || join(__dirname, "../../data");
mkdirSync(dataDir, { recursive: true });

const db = new Database(join(dataDir, "messages.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id                TEXT PRIMARY KEY,
    room_id           TEXT NOT NULL,
    username          TEXT NOT NULL,
    text              TEXT NOT NULL,
    timestamp         TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    deleted           INTEGER DEFAULT 0,
    deleted_by_admin  INTEGER DEFAULT 0,
    disappear_after_ms INTEGER,
    ip                TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_messages_room_id  ON messages(room_id);
  CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
  CREATE INDEX IF NOT EXISTS idx_messages_username  ON messages(username);
`);

export function insertMessage({ id, roomId, username, text, timestamp, disappearAfterMs, ip }) {
  db.prepare(
    `INSERT INTO messages (id, room_id, username, text, timestamp, disappear_after_ms, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, roomId, username, text, timestamp, disappearAfterMs || null, ip);
}

export function getMessagesByRoom(roomId, adminView = false) {
  if (adminView) {
    return db
      .prepare(
        `SELECT id, room_id, username, text, timestamp, deleted, deleted_by_admin, disappear_after_ms, ip
         FROM messages WHERE room_id = ? ORDER BY timestamp`
      )
      .all(roomId);
  }
  return db
    .prepare(
      `SELECT id, room_id, username, text, timestamp, deleted, disappear_after_ms
       FROM messages WHERE room_id = ? AND deleted_by_admin = 0
       ORDER BY timestamp LIMIT 150`
    )
    .all(roomId);
}

export function getMessageCountByRoom() {
  return db
    .prepare("SELECT room_id, COUNT(*) as total FROM messages GROUP BY room_id")
    .all();
}

export function markMessageFaded(id) {
  db.prepare("UPDATE messages SET deleted = 1 WHERE id = ? AND deleted = 0").run(id);
}

export function markMessageDeletedByAdmin(id) {
  db.prepare("UPDATE messages SET deleted = 1, deleted_by_admin = 1 WHERE id = ?").run(id);
}

export default db;
