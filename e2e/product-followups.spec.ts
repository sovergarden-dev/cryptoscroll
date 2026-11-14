import { readFile } from "node:fs/promises";
import { test, expect } from "./fixtures";
import jsQR from "jsqr";

test("recovers a lost acknowledgement with the same envelope and refreshes the count", async ({
  page,
}) => {
  let countFailed = false;
  await page.route("**/api/stats", async (route) => {
    if (!countFailed) {
      countFailed = true;
      await route.abort("internetdisconnected");
    } else await route.continue();
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("Note count unavailable");
  await page.getByRole("button", { name: "Refresh note count" }).click();
  await expect(page.getByRole("status")).toContainText("notes sealed");
  const before = Number((await page.getByRole("status").innerText()).replace(/\D/g, ""));
  const envelopes: string[] = [];
  let firstId = "";
  await page.route("**/api/notes", async (route) => {
    envelopes.push(route.request().postData()!);
    if (envelopes.length === 1) {
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      firstId = (await response.json()).id;
      await route.abort("internetdisconnected");
    } else await route.continue();
  });
  await page.getByLabel("Your secret note").fill("Lost acknowledgement fixture 🔐");
  await page.getByLabel("Expire if unread after").selectOption("1h");
  await page.getByRole("button", { name: "Create Note", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Could not reach");
  await expect(page.getByRole("heading", { name: "Confirming your sealed note" })).toBeFocused();
  await expect(page.getByLabel("Your private link")).toHaveCount(0);
  await page.getByRole("button", { name: "Retry this creation" }).click();
  await expect(page.getByRole("heading", { name: "Your scroll is sealed." })).toBeFocused();
  const url = await page.getByLabel("Your private link").inputValue();
  expect(new URL(url).pathname.endsWith(firstId)).toBe(true);
  expect(envelopes).toHaveLength(2);
  expect(envelopes[1]).toBe(envelopes[0]);
  const sent = JSON.parse(envelopes[0]!);
  expect(sent.burnAfterRead).toBe(true);
  expect(Date.parse(sent.expiresAt) - Date.parse(sent.creationToken.issuedAt)).toBeGreaterThan(
    3_590_000,
  );
  expect(Date.parse(sent.expiresAt) - Date.parse(sent.creationToken.issuedAt)).toBeLessThanOrEqual(
    3_600_000,
  );
  await page.getByRole("button", { name: "Create another note" }).click();
  await expect(page.getByLabel("Your secret note")).toBeFocused();
  await expect(page.getByRole("status")).toContainText(
    `${(before + 1).toLocaleString("en-US")} notes sealed`,
  );
});

test("keeps the full capability in native sharing and a decodable downloaded PNG", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    let shares = 0;
    Object.defineProperty(navigator, "share", {
      value: async (data: ShareData) => {
        const fixture = window as unknown as Record<string, unknown>;
        fixture["sharedFixture"] = data;
        shares++;
        if (shares === 1) throw new DOMException("Cancelled fixture", "AbortError");
        if (shares === 3) throw new DOMException("Denied fixture", "NotAllowedError");
      },
    });
  });
  await page.goto("/");
  await page.getByLabel("Your secret note").fill("Sharing fixture only");
  await page.getByRole("button", { name: "Create Note", exact: true }).click();
  const link = page.getByLabel("Your private link");
  await expect(link).toBeVisible();
  const url = await link.inputValue();
  const share = page.getByRole("button", { name: "Share link", exact: true });
  await share.click();
  await expect(share).toBeEnabled();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await share.click();
  await expect(page.getByRole("status")).toContainText("Sharing opened");
  expect(
    await page.evaluate(() => (window as unknown as Record<string, unknown>)["sharedFixture"]),
  ).toEqual({ title: "CryptoScroll", url });
  await share.click();
  await expect(page.getByRole("alert")).toContainText("Copy the link instead");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save QR image" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("cryptoscroll-qr.png");
  const output = testInfo.outputPath("synthetic-qr.png");
  await download.saveAs(output);
  const dataUrl = `data:image/png;base64,${(await readFile(output)).toString("base64")}`;
  const pixels = await page.evaluate(async (source) => {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    return {
      data: Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data),
      width: canvas.width,
      height: canvas.height,
    };
  }, dataUrl);
  expect(jsQR(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height)?.data).toBe(url);
  expect(
    await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
  ).toEqual({ local: 0, session: 0 });
});

test("supports Vietnamese, accessible state transitions and unchanged links while switching language", async ({
  page,
  browser,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByLabel("Language / Ngôn ngữ").selectOption("vi");
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  await page
    .getByLabel("Ghi chú bí mật của bạn")
    .fill("# Kiểm tra tiếng Việt\n\nNội dung chỉ dùng để kiểm thử 🔐");
  await page.getByRole("button", { name: "Thêm mật khẩu Tùy chọn" }).click();
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Mật khẩu thử nghiệm riêng");
  await page.screenshot({
    path: testInfo.outputPath("vietnamese-editor-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Tạo ghi chú", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ghi chú đã được mã hóa." })).toBeFocused();
  const url = await page.getByLabel("Liên kết riêng tư của bạn").inputValue();
  await page.getByLabel("Language / Ngôn ngữ").selectOption("en");
  await expect(page.getByLabel("Your private link")).toHaveValue(url);
  await page.getByLabel("Language / Ngôn ngữ").selectOption("vi");
  await page.screenshot({
    path: testInfo.outputPath("vietnamese-share-mobile.png"),
    fullPage: true,
  });
  const recipient = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const note = await recipient.newPage();
    await note.goto(url);
    await expect(note.getByRole("heading", { name: "This is a one-time note." })).toBeFocused();
    await note.getByLabel("Language / Ngôn ngữ").selectOption("vi");
    await expect(note).toHaveURL(url);
    await note.getByLabel("Ghi chú này có mật khẩu bảo vệ").fill("sai mật khẩu");
    await note.getByRole("button", { name: "Đọc và hủy" }).click();
    await expect(note.getByRole("alert")).toContainText("Sai mật khẩu");
    await expect(note.getByRole("alert")).toBeFocused();
    await note.getByLabel("Ghi chú này có mật khẩu bảo vệ").fill("Mật khẩu thử nghiệm riêng");
    await note.getByRole("button", { name: "Đọc và hủy" }).click();
    await expect(note.getByRole("heading", { name: "Bản trên máy chủ đã bị hủy." })).toBeFocused();
    await expect(note.getByRole("article", { name: "Ghi chú đã giải mã" })).toContainText(
      "Nội dung chỉ dùng để kiểm thử 🔐",
    );
    await note.getByRole("button", { name: "Xóa nội dung trên màn hình" }).focus();
    await note.keyboard.press("Enter");
    await expect(
      note.getByRole("heading", { name: "Ghi chú này đã bị hủy vĩnh viễn." }),
    ).toBeFocused();
    await expect(note.getByRole("article")).toHaveCount(0);
    await note.getByRole("link", { name: "Viết ghi chú mới" }).click();
    await expect(note.getByLabel("Ghi chú bí mật của bạn")).toBeVisible();
    await expect(note.locator("html")).toHaveAttribute("lang", "vi");
    expect(
      await note.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  } finally {
    await recipient.close();
  }
});
