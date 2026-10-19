import { createClient } from "@libsql/client";

const dbUrl = process.env.DATABASE_URL || "file:sqlite.db";
const dbAuthToken = process.env.DATABASE_AUTH_TOKEN;

const db = createClient({
  url: dbUrl,
  ...(dbAuthToken ? { authToken: dbAuthToken } : {})
});

// Initialize database schema
db.executeMultiple(`
  CREATE TABLE IF NOT EXISTS user (
      id TEXT NOT NULL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT DEFAULT 'user'
  );

  CREATE TABLE IF NOT EXISTS session (
      id TEXT NOT NULL PRIMARY KEY,
      expires_at INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES user(id)
  );

  CREATE TABLE IF NOT EXISTS roll (
      id TEXT NOT NULL PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      die1 INTEGER NOT NULL,
      die2 INTEGER NOT NULL,
      die3 INTEGER NOT NULL,
      die4 INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES user(id),
      UNIQUE(user_id, date)
  );

  CREATE TABLE IF NOT EXISTS exemption (
      id TEXT NOT NULL PRIMARY KEY,
      user_id TEXT NOT NULL,
      season_id TEXT NOT NULL,
      chore_code TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES user(id),
      UNIQUE(user_id, season_id, chore_code)
  );

  CREATE TABLE IF NOT EXISTS manual_points (
      id TEXT NOT NULL PRIMARY KEY,
      user_id TEXT NOT NULL,
      season_id TEXT NOT NULL,
      chore_code TEXT NOT NULL,
      points INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES user(id),
      UNIQUE(user_id, season_id, chore_code)
  );

  CREATE TABLE IF NOT EXISTS settings (
      key TEXT NOT NULL PRIMARY KEY,
      value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS password_reset_log (
      id TEXT NOT NULL PRIMARY KEY,
      username TEXT NOT NULL,
      created_at TEXT NOT NULL
  );

  -- Casi todas las consultas filtran las tiradas por fecha
  CREATE INDEX IF NOT EXISTS idx_roll_date ON roll(date);
`).catch(console.error);

// Migrations
(async () => {
  // Base en un archivo local (VPS): modo WAL para que las lecturas no esperen a las
  // escrituras, y espera de hasta 5 s si la base está ocupada en vez de fallar.
  if (dbUrl.startsWith("file:")) {
      try {
          await db.execute("PRAGMA journal_mode = WAL");
          await db.execute("PRAGMA busy_timeout = 5000");
      } catch (e) {
          console.error("No se pudo configurar SQLite:", e);
      }
  }

  try {
      await db.execute("ALTER TABLE user ADD COLUMN role TEXT DEFAULT 'user'");
  } catch (e) {}

  try {
      await db.execute("ALTER TABLE user ADD COLUMN display_name TEXT");
      await db.execute("UPDATE user SET display_name = username WHERE display_name IS NULL");
  } catch (e) {}

  try {
      await db.execute("ALTER TABLE roll ADD COLUMN time TEXT");
  } catch (e) {
      // Column probably already exists, ignore
  }
  
  try {
      await db.execute({
          sql: "UPDATE user SET role = 'admin' WHERE username = ?",
          args: ["ldoliri"]
      });
  } catch (e) {
      console.error("Failed to upgrade ldoliri to admin:", e);
  }

  try {
      const testerRes = await db.execute("SELECT id FROM user WHERE username = 'lomitotester'");
      if (testerRes.rows.length === 0) {
          const { hash } = await import('bcryptjs');
          const pass = await hash('lomitotester', 10);
          await db.execute({
              sql: "INSERT INTO user (id, username, password_hash, avatar_url, role) VALUES (?, ?, ?, ?, ?)",
              args: ['tester-lomito-id', 'lomitotester', pass, 'https://api.dicebear.com/7.x/avataaars/svg?seed=lomitotester', 'tester']
          });
          console.log("Created lomitotester account");
      }
  } catch (e) {
      console.error("Failed to create lomitotester:", e);
  }
})();

export default db;
