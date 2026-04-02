import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || join(__dirname, "../../data");
mkdirSync(dataDir, { recursive: true });

const db = new Database(join(dataDir, "users.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS user_sessions (
    id              TEXT PRIMARY KEY,
    username        TEXT NOT NULL,
    ip              TEXT,
    connected_at    TEXT NOT NULL,
    disconnected_at TEXT,
    last_room       TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_username ON user_sessions(username);
  CREATE INDEX IF NOT EXISTS idx_sessions_ip       ON user_sessions(ip);
`);

export function insertUserSession({ id, username, ip, connectedAt }) {
  db.prepare(
    `INSERT OR REPLACE INTO user_sessions (id, username, ip, connected_at)
     VALUES (?, ?, ?, ?)`
  ).run(id, username, ip, connectedAt);
}

export function updateUserDisconnect(id, lastRoom) {
  db.prepare(
    `UPDATE user_sessions
     SET disconnected_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), last_room = ?
     WHERE id = ?`
  ).run(lastRoom || null, id);
}

export function getAllUserSessions(limit = 500) {
  return db
    .prepare("SELECT * FROM user_sessions ORDER BY connected_at DESC LIMIT ?")
    .all(limit);
}

export default db;
