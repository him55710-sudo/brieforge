import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "BriefForge — 막연한 아이디어를, 명확한 시작으로",
  description: "7개의 짧은 질문으로 아이디어를 구체화하고 Cursor·Codex를 위한 마스터 프롬프트를 만드세요. API 키 없이도 시작할 수 있습니다.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
