import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || join(__dirname, "../../data");
mkdirSync(dataDir, { recursive: true });

const db = new Database(join(dataDir, "audit.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS audit_log (
    id        TEXT PRIMARY KEY,
    action    TEXT NOT NULL,
    target    TEXT,
    detail    TEXT,
    timestamp TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX IF NOT EXISTS idx_audit_action    ON audit_log(action);
  CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
`);

export function logAudit({ id, action, target, detail }) {
  db.prepare(
    "INSERT INTO audit_log (id, action, target, detail) VALUES (?, ?, ?, ?)"
  ).run(id, action, target || null, detail || null);
}

export function getAuditLog(limit = 500) {
  return db
    .prepare("SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?")
    .all(limit);
}

export default db;
