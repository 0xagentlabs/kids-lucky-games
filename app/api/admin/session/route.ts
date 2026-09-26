import { NextRequest, NextResponse } from "next/server";
import { adminCookie, createAdminToken, isAdmin, setAdminCookie } from "../../../../lib/auth";
import { connection, ensureDatabase } from "../../../../lib/db";
import { hashPassword, verifyPassword } from "../../../../lib/password";

export async function GET(request: NextRequest) {
  if (!await isAdmin(request)) return NextResponse.json({ authenticated: false });
  await ensureDatabase();
  const [admin] = await connection()`SELECT must_change_password FROM admins WHERE username = 'admin'`;
  return NextResponse.json({ authenticated: true, mustChangePassword: Boolean(admin?.must_change_password) });
}
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { username?: string; password?: string } | null;
  if (body?.username !== "admin" || !body.password || body.password.length > 128) return NextResponse.json({ error: "用户名或密码不正确" }, { status: 401 });
  await ensureDatabase();
  const [admin] = await connection()`SELECT password_hash, must_change_password FROM admins WHERE username = 'admin'`;
  if (!admin || !await verifyPassword(body.password, String(admin.password_hash))) return NextResponse.json({ error: "用户名或密码不正确" }, { status: 401 });
  const response = NextResponse.json({ authenticated: true, mustChangePassword: Boolean(admin.must_change_password) });
  setAdminCookie(response, await createAdminToken());
  return response;
}
export async function PATCH(request: NextRequest) {
  if (!await isAdmin(request)) return NextResponse.json({ error: "登录已失效，请重新登录" }, { status: 401 });
  const body = await request.json().catch(() => null) as { password?: string } | null;
  if (!body?.password || body.password.length < 10 || body.password.length > 128) return NextResponse.json({ error: "新密码至少需要 10 个字符" }, { status: 400 });
  const passwordHash = await hashPassword(body.password);
  await ensureDatabase();
  await connection()`UPDATE admins SET password_hash = ${passwordHash}, must_change_password = FALSE, updated_at = NOW() WHERE username = 'admin'`;
  return NextResponse.json({ authenticated: true, mustChangePassword: false });
}
export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(adminCookie, "", { httpOnly: true, expires: new Date(0), path: "/" });
  return response;
}
