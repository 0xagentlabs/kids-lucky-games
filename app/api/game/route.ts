import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "../../../lib/auth";
import { connection, ensureDatabase, getPrizes, type Prize } from "../../../lib/db";

const visitorCookie = "star_prize_visitor";
const dateKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
export async function GET() {
  try { return NextResponse.json({ prizes: await getPrizes(), dailyLimit: 1 }); }
  catch { return NextResponse.json({ error: "暂时无法读取抽奖规则" }, { status: 503 }); }
}
export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    const sql = connection();
    const visitorId = request.cookies.get(visitorCookie)?.value || randomUUID();
    const today = dateKey();
    const existing = await sql`SELECT 1 FROM draws WHERE visitor_id = ${visitorId} AND draw_date = ${today}::date`;
    if (existing.length) return NextResponse.json({ error: "今天的机会已经用过啦，明天再来吧！" }, { status: 429 });
    const prizes = await getPrizes();
    let roll = Math.random() * 100;
    const prize = prizes.find(item => (roll -= item.chance) < 0) ?? prizes[prizes.length - 1];
    try { await sql`INSERT INTO draws (visitor_id, draw_date, prize_id) VALUES (${visitorId}, ${today}::date, ${prize.id})`; }
    catch { return NextResponse.json({ error: "今天的机会已经用过啦，明天再来吧！" }, { status: 429 }); }
    const response = NextResponse.json({ prize });
    response.cookies.set(visitorCookie, visitorId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 31536000, path: "/" });
    return response;
  } catch { return NextResponse.json({ error: "抽奖服务暂时不可用，请稍后再试" }, { status: 503 }); }
}
export async function PUT(request: NextRequest) {
  if (!await isAdmin(request)) return NextResponse.json({ error: "请先以管理员身份登录" }, { status: 401 });
  const body = await request.json().catch(() => null) as { prizes?: Prize[] } | null;
  const next = body?.prizes;
  if (!Array.isArray(next) || next.length < 2 || next.some(p => !p.id || !p.name?.trim() || !/^#[0-9a-f]{6}$/i.test(p.color) || !Number.isFinite(p.chance) || p.chance < 0) || Math.abs(next.reduce((sum, p) => sum + p.chance, 0) - 100) > .001) return NextResponse.json({ error: "奖品配置无效，概率合计需为 100%" }, { status: 400 });
  try {
    await ensureDatabase();
    const sql = connection();
    for (let position = 0; position < next.length; position += 1) {
      const prize = next[position];
      await sql`INSERT INTO prizes (id, name, chance, color, position, updated_at) VALUES (${prize.id}, ${prize.name.trim()}, ${prize.chance}, ${prize.color}, ${position}, NOW()) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, chance = EXCLUDED.chance, color = EXCLUDED.color, position = EXCLUDED.position, updated_at = NOW()`;
    }
    return NextResponse.json({ prizes: await getPrizes() });
  } catch { return NextResponse.json({ error: "保存失败，请稍后重试" }, { status: 503 }); }
}
