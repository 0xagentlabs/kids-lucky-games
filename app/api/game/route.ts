import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "../../../lib/auth";
import { connection, ensureDatabase, getSettings, type Prize } from "../../../lib/db";

const visitorCookie = "star_prize_visitor";
const dateKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
export async function GET(request: NextRequest) {
  try {
    const settings = await getSettings();
    const visitorId = request.cookies.get(visitorCookie)?.value;
    let usedToday = 0;
    if (visitorId) {
      const [row] = await connection()`SELECT used_count FROM daily_usage WHERE visitor_id = ${visitorId} AND draw_date = ${dateKey()}::date`;
      usedToday = Number(row?.used_count || 0);
    }
    return NextResponse.json({ ...settings, usedToday, remainingToday: Math.max(0, settings.dailyLimit - usedToday) });
  }
  catch { return NextResponse.json({ error: "暂时无法读取抽奖规则" }, { status: 503 }); }
}
export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    const sql = connection();
    const visitorId = request.cookies.get(visitorCookie)?.value || randomUUID();
    const today = dateKey();
    const settings = await getSettings();
    const usage = await sql`INSERT INTO daily_usage (visitor_id, draw_date, used_count) VALUES (${visitorId}, ${today}::date, 1) ON CONFLICT (visitor_id, draw_date) DO UPDATE SET used_count = daily_usage.used_count + 1 WHERE daily_usage.used_count < ${settings.dailyLimit} RETURNING used_count`;
    if (!usage.length) return NextResponse.json({ error: "今天的机会已经用完啦，明天再来吧！", remainingToday: 0 }, { status: 429 });
    const usedToday = Number(usage[0].used_count);
    const prizes = settings.prizes;
    let roll = Math.random() * 100;
    const prize = prizes.find(item => (roll -= item.chance) < 0) ?? prizes[prizes.length - 1];
    await sql`INSERT INTO draws (visitor_id, draw_date, prize_id) VALUES (${visitorId}, ${today}::date, ${prize.id})`;
    const response = NextResponse.json({ prize, remainingToday: Math.max(0, settings.dailyLimit - usedToday) });
    response.cookies.set(visitorCookie, visitorId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 31536000, path: "/" });
    return response;
  } catch { return NextResponse.json({ error: "抽奖服务暂时不可用，请稍后再试" }, { status: 503 }); }
}
export async function PUT(request: NextRequest) {
  if (!await isAdmin(request)) return NextResponse.json({ error: "请先以管理员身份登录" }, { status: 401 });
  const body = await request.json().catch(() => null) as { prizes?: Prize[]; dailyLimit?: number } | null;
  const next = body?.prizes;
  const dailyLimit = Number(body?.dailyLimit);
  if (!Array.isArray(next) || next.length < 2 || next.length > 12 || next.some(p => !p.id || !p.name?.trim() || p.name.trim().length > 20 || !/^#[0-9a-f]{6}$/i.test(p.color) || !Number.isFinite(p.chance) || p.chance < 0) || Math.abs(next.reduce((sum, p) => sum + p.chance, 0) - 100) > .001 || !Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 20) return NextResponse.json({ error: "请设置 2–12 个奖项、1–20 次机会，且概率合计为 100%" }, { status: 400 });
  try {
    await ensureDatabase();
    const sql = connection();
    for (let position = 0; position < next.length; position += 1) {
      const prize = next[position];
      await sql`INSERT INTO prizes (id, name, chance, color, position, active, updated_at) VALUES (${prize.id}, ${prize.name.trim()}, ${prize.chance}, ${prize.color}, ${position}, TRUE, NOW()) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, chance = EXCLUDED.chance, color = EXCLUDED.color, position = EXCLUDED.position, active = TRUE, updated_at = NOW()`;
    }
    const activeIds = new Set(next.map(prize => prize.id));
    const current = await sql`SELECT id FROM prizes WHERE active = TRUE`;
    for (const row of current) if (!activeIds.has(String(row.id))) await sql`UPDATE prizes SET active = FALSE, updated_at = NOW() WHERE id = ${String(row.id)}`;
    await sql`UPDATE app_settings SET daily_limit = ${dailyLimit}, updated_at = NOW() WHERE id = 1`;
    return NextResponse.json(await getSettings());
  } catch { return NextResponse.json({ error: "保存失败，请稍后重试" }, { status: 503 }); }
}
