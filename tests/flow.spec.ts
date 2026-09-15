import { test, expect } from "@playwright/test";

test("preset survey → brief → copy/download → restore → delete", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.screenshot({ path: "/tmp/briefforge-desktop.png", fullPage: true });
  await page.getByRole("button", { name: /공모전 스카우트 프롬프트 만들기/ }).click();
  for (let i = 0; i < 6; i++) await page.getByRole("button", { name: "다음 질문" }).click();
  await page.getByRole("button", { name: "마스터 브리프 생성" }).click();
  await expect(page.getByRole("heading", { name: "이제, 만들 준비가 됐어요." })).toBeVisible();
  await expect(page.locator("article")).toContainText("scout-results.json");
  await expect(page.locator("article")).toContainText("적합도 A/B");
  await page.getByRole("button", { name: "브리프 복사", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("스카우트 운영 명세");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: ".md 다운로드" }).click();
  expect((await download).suggestedFilename()).toBe("briefforge-contest-scout.md");
  await page.reload();
  await page.getByRole("button", { name: "공모전·해커톤 스카우트", exact: true }).click();
  await expect(page.getByRole("heading", { name: "이제, 만들 준비가 됐어요." })).toBeVisible();
  await page.getByRole("button", { name: "저장된 브리프 삭제" }).click();
  expect(await page.evaluate(() => localStorage.getItem("briefforge:last-brief:v1"))).toBeNull();
});

test("mobile generic flow works with backend unreachable, supports editing and recent restore", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/**", route => route.abort());
  await page.goto("/");
  await page.screenshot({ path: "/tmp/briefforge-mobile.png", fullPage: true });
  await page.getByLabel("만들고 싶은 앱이나 서비스").fill("책을 읽고 감상을 기록하는 독서 앱");
  await page.getByRole("button", { name: "내 아이디어 구체화하기" }).click();
  await expect(page.getByRole("button", { name: "다음 질문" })).toBeDisabled();
  for (let i = 0; i < 7; i++) {
    await page.getByLabel("나의 답변").fill(`사용자가 직접 정한 요구사항 ${i + 1}`);
    await page.getByRole("button", { name: i === 6 ? "마스터 브리프 생성" : "다음 질문" }).click();
  }
  await expect(page.locator("article")).toContainText("사용자가 직접 정한 요구사항 7");
  await page.getByRole("button", { name: "답변 수정하기" }).click();
  await expect(page.getByLabel("나의 답변")).toHaveValue("사용자가 직접 정한 요구사항 1");
  await page.reload();
  await page.getByRole("button", { name: "최근 브리프 열기" }).click();
  await expect(page.locator("article")).toContainText("독서 앱");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("corrupt storage and privacy dialog are handled", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("briefforge:last-brief:v1", '{"broken":true}'));
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("이전 저장 형식");
  await page.getByRole("button", { name: "개인정보 안내", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
