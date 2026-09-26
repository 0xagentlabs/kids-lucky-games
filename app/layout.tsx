import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "星愿乐园｜每日幸运小游戏",
  description: "适合小朋友的转盘抽奖和对对碰小游戏。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
