import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "BriefForge — 막연한 아이디어를, 명확한 시작으로",
  description: "10개 질문과 준비물 체크로 아이디어를 구체화하고 Codex·Claude를 위한 마스터 프롬프트를 만드세요. API 키 없이도 시작할 수 있습니다.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
