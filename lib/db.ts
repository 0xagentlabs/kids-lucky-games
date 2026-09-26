import { neon } from "@neondatabase/serverless";
import { hashPassword } from "./password";

export type Prize = { id: string; name: string; chance: number; color: string };
export type GameSettings = { prizes: Prize[]; dailyLimit: number };
const defaults: Prize[] = [
  { id: "star", name: "星星贴纸", chance: 35, color: "#ff8a3d" },
  { id: "candy", name: "水果糖", chance: 30, color: "#ffd35a" },
  { id: "badge", name: "勇气徽章", chance: 20, color: "#60c7ff" },
  { id: "toy", name: "神秘玩具", chance: 10, color: "#9c7cff" },
  { id: "crown", name: "超级大奖", chance: 5, color: "#ff70a6" },
];
export const connection = () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
};
let initialization: Promise<void> | null = null;
export function ensureDatabase() {
  if (!initialization) initialization = initialize().catch(error => { initialization = null; throw error; });
  return initialization;
}
async function initialize() {
  const sql = connection();
  await sql`CREATE TABLE IF NOT EXISTS admins (username TEXT PRIMARY KEY, password_hash TEXT NOT NULL, must_change_password BOOLEAN NOT NULL DEFAULT TRUE, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS prizes (id TEXT PRIMARY KEY, name TEXT NOT NULL, chance NUMERIC(6,3) NOT NULL CHECK (chance >= 0 AND chance <= 100), color TEXT NOT NULL, position INTEGER NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`ALTER TABLE prizes ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`;
  await sql`CREATE TABLE IF NOT EXISTS app_settings (id SMALLINT PRIMARY KEY CHECK (id = 1), daily_limit INTEGER NOT NULL CHECK (daily_limit BETWEEN 1 AND 20), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`INSERT INTO app_settings (id, daily_limit) VALUES (1, 1) ON CONFLICT DO NOTHING`;
  await sql`CREATE TABLE IF NOT EXISTS draws (id BIGSERIAL PRIMARY KEY, visitor_id TEXT NOT NULL, draw_date DATE NOT NULL, prize_id TEXT NOT NULL REFERENCES prizes(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`ALTER TABLE draws DROP CONSTRAINT IF EXISTS draws_visitor_id_draw_date_key`;
  await sql`CREATE INDEX IF NOT EXISTS draws_visitor_day_idx ON draws(visitor_id, draw_date)`;
  await sql`CREATE TABLE IF NOT EXISTS daily_usage (visitor_id TEXT NOT NULL, draw_date DATE NOT NULL, used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0), PRIMARY KEY (visitor_id, draw_date))`;
  await sql`INSERT INTO daily_usage (visitor_id, draw_date, used_count) SELECT visitor_id, draw_date, COUNT(*)::int FROM draws GROUP BY visitor_id, draw_date ON CONFLICT (visitor_id, draw_date) DO UPDATE SET used_count = GREATEST(daily_usage.used_count, EXCLUDED.used_count)`;
  const [{ count: adminCount }] = await sql`SELECT COUNT(*)::int AS count FROM admins`;
  if (Number(adminCount) === 0) {
    const passwordHash = await hashPassword(process.env.ADMIN_INITIAL_PASSWORD || "admin");
    await sql`INSERT INTO admins (username, password_hash, must_change_password) VALUES ('admin', ${passwordHash}, TRUE) ON CONFLICT DO NOTHING`;
  }
  const [{ count: prizeCount }] = await sql`SELECT COUNT(*)::int AS count FROM prizes`;
  if (Number(prizeCount) === 0) for (let position = 0; position < defaults.length; position += 1) {
    const prize = defaults[position];
    await sql`INSERT INTO prizes (id, name, chance, color, position, active) VALUES (${prize.id}, ${prize.name}, ${prize.chance}, ${prize.color}, ${position}, TRUE) ON CONFLICT DO NOTHING`;
  }
}
export async function getSettings(): Promise<GameSettings> {
  await ensureDatabase();
  const sql = connection();
  const rows = await sql`SELECT id, name, chance::float8 AS chance, color FROM prizes WHERE active = TRUE ORDER BY position`;
  const [settings] = await sql`SELECT daily_limit FROM app_settings WHERE id = 1`;
  return {
    prizes: rows.map(row => ({ id: String(row.id), name: String(row.name), chance: Number(row.chance), color: String(row.color) })),
    dailyLimit: Number(settings.daily_limit),
  };
}
