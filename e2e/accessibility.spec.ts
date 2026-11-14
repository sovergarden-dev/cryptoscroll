import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./fixtures";

test("audits the editor, sharing, revoke, warning, reader, cleared and recovery states", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const results: { state: string; violations: string[]; incomplete: string[] }[] = [];
  async function audit(state: string) {
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    results.push({
      state,
      violations: scan.violations.map((entry) => entry.id),
      incomplete: scan.incomplete.map((entry) => entry.id),
    });
    expect(scan.violations).toEqual([]);
  }
  try {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.getByLabel("Language / Ngôn ngữ").selectOption("vi");
    await page.getByLabel("Ghi chú bí mật của bạn").fill("# Ghi chú kiểm thử\n\nNội dung mẫu 🔐");
    await page.getByRole("button", { name: "Thêm mật khẩu Tùy chọn" }).click();
    await page.getByLabel("Mật khẩu", { exact: true }).fill("Mật khẩu kiểm thử");
    await audit("editor");
    await page.getByRole("button", { name: "Tạo ghi chú", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Ghi chú đã được mã hóa." })).toBeFocused();
    const url = await page.getByLabel("Liên kết riêng tư của bạn").inputValue();
    await audit("sharing");
    await page.getByRole("button", { name: "Thu hồi ghi chú", exact: true }).click();
    await audit("revoke dialog");
    await page.getByRole("button", { name: "Giữ ghi chú" }).click();
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "This is a one-time note." })).toBeVisible();
    await page.getByLabel("Language / Ngôn ngữ").selectOption("vi");
    await audit("warning");
    await page.getByLabel("Ghi chú này có mật khẩu bảo vệ").fill("Mật khẩu kiểm thử");
    await page.getByRole("button", { name: "Đọc và hủy" }).click();
    await expect(page.getByRole("article")).toBeVisible();
    await audit("reader");
    await page.getByRole("button", { name: "Xóa nội dung trên màn hình" }).click();
    await audit("cleared");
    await page.getByRole("link", { name: "Viết ghi chú mới" }).click();
    await page.getByLabel("Ghi chú bí mật của bạn").fill("Synthetic recovery audit");
    await page.route("**/api/notes", (route) => route.abort("internetdisconnected"));
    await page.getByRole("button", { name: "Tạo ghi chú", exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await audit("recovery");
  } finally {
    await testInfo.attach("accessibility-summary", {
      body: JSON.stringify(results),
      contentType: "application/json",
    });
  }
});
