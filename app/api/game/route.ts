import { NextRequest, NextResponse } from "next/server";

type Prize = { id: string; name: string; chance: number; color: string };
let prizes: Prize[] = [
  { id: "star", name: "星星贴纸", chance: 35, color: "#ff8a3d" },
  { id: "candy", name: "水果糖", chance: 30, color: "#ffd35a" },
  { id: "badge", name: "勇气徽章", chance: 20, color: "#60c7ff" },
  { id: "toy", name: "神秘玩具", chance: 10, color: "#9c7cff" },
  { id: "crown", name: "超级大奖", chance: 5, color: "#ff70a6" },
];
const cookieName = "star_prize_last_draw";
const dateKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
export async function GET() { return NextResponse.json({ prizes, dailyLimit: 1 }); }
export async function POST(request: NextRequest) {
  const today = dateKey();
  if (request.cookies.get(cookieName)?.value === today) return NextResponse.json({ error: "今天的机会已经用过啦，明天再来吧！" }, { status: 429 });
  let roll = Math.random() * 100;
  const prize = prizes.find(item => (roll -= item.chance) < 0) ?? prizes[prizes.length - 1];
  const response = NextResponse.json({ prize });
  response.cookies.set(cookieName, today, { httpOnly: true, sameSite: "lax", maxAge: 172800, path: "/" });
  return response;
}
export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null) as { prizes?: Prize[] } | null;
  const next = body?.prizes;
  if (!Array.isArray(next) || next.length < 2 || next.some(p => !p.id || !p.name?.trim() || p.chance < 0) || Math.abs(next.reduce((sum, p) => sum + p.chance, 0) - 100) > .001) return NextResponse.json({ error: "奖品配置无效，概率合计需为 100%" }, { status: 400 });
  prizes = next.map(p => ({ ...p, name: p.name.trim() }));
  return NextResponse.json({ prizes });
}
