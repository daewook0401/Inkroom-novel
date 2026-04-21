import Database from "@tauri-apps/plugin-sql";

const DB_URL = "sqlite:inkroom.db";
const STATE_KEY = "inkroom-state";

export function isDesktopRuntime() {
  return Boolean(globalThis.__TAURI_INTERNALS__);
}

async function openDb() {
  const db = await Database.load(DB_URL);
  await db.execute(
    "CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)",
  );
  return db;
}

export async function loadDesktopState() {
  if (!isDesktopRuntime()) return null;
  const db = await openDb();
  const rows = await db.select("SELECT value FROM app_state WHERE key = $1", [STATE_KEY]);
  if (!rows.length) return null;
  return JSON.parse(rows[0].value);
}

export async function saveDesktopState(state) {
  if (!isDesktopRuntime()) return;
  const db = await openDb();
  await db.execute(
    "INSERT INTO app_state (key, value, updated_at) VALUES ($1, $2, $3) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    [STATE_KEY, JSON.stringify(state), new Date().toISOString()],
  );
}
