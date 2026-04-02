import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || join(__dirname, "../../data");
mkdirSync(dataDir, { recursive: true });

const db = new Database(join(dataDir, "rooms.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    secret_key TEXT,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  INSERT OR IGNORE INTO rooms (id, name) VALUES ('global', 'Global Chat');
`);

export function getRooms() {
  return db
    .prepare(
      "SELECT id, name, created_at, (secret_key IS NOT NULL) as has_key FROM rooms ORDER BY created_at"
    )
    .all();
}

export function getAdminRooms() {
  return db
    .prepare("SELECT id, name, created_at, secret_key FROM rooms ORDER BY created_at")
    .all();
}

export function getRoomById(id) {
  return db.prepare("SELECT * FROM rooms WHERE id = ?").get(id);
}

export function insertRoom(id, name, secretKey) {
  db.prepare("INSERT INTO rooms (id, name, secret_key) VALUES (?, ?, ?)").run(
    id,
    name,
    secretKey
  );
}

export function deleteRoom(id) {
  db.prepare("DELETE FROM rooms WHERE id = ?").run(id);
}

export default db;
