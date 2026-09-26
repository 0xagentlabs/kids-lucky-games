import { SignJWT, jwtVerify } from "jose";
import type { NextRequest, NextResponse } from "next/server";

export const adminCookie = "star_admin_session";
const secret = () => {
  if (!process.env.AUTH_SECRET && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is not configured");
  return new TextEncoder().encode(process.env.AUTH_SECRET || "local-development-only-change-me");
};
export async function createAdminToken() {
  return new SignJWT({ role: "admin" }).setProtectedHeader({ alg: "HS256" }).setSubject("admin").setIssuedAt().setExpirationTime("8h").sign(secret());
}
export async function isAdmin(request: NextRequest) {
  const token = request.cookies.get(adminCookie)?.value;
  if (!token) return false;
  try { const { payload } = await jwtVerify(token, secret()); return payload.sub === "admin" && payload.role === "admin"; }
  catch { return false; }
}
export function setAdminCookie(response: NextResponse, token: string) {
  response.cookies.set(adminCookie, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: 28800, path: "/" });
}
