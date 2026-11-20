import { test, expect } from "./fixtures";
import { MAX_NOTE_BYTES } from "../shared/protocol";

test("an ahead-of-server device clock can still open an active timed note", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page.getByLabel("Your secret note").fill("Synthetic timed clock fixture");
  await page.getByText("1h", { exact: true }).click();
  await page.getByRole("button", { name: "Create Note", exact: true }).click();
  const link = await page.getByLabel("Your private link").inputValue();
  const recipient = await browser.newPage({ locale: "en-US" });
  try {
    await recipient.clock.install({ time: new Date(Date.now() + 3 * 3600000) });
    await recipient.goto(link);
    await recipient.getByRole("button", { name: "Read Note", exact: true }).click();
    await expect(recipient.getByRole("article")).toContainText("Synthetic timed clock fixture");
    await recipient.clock.fastForward(30_000);
    await expect(recipient.getByRole("article")).toContainText("Synthetic timed clock fixture");
    await recipient.clock.fastForward(3570_000 + 2000);
    await expect(
      recipient.getByRole("heading", {
        name: "This note expired and was automatically destroyed.",
      }),
    ).toBeVisible();
  } finally {
    await recipient.close();
  }
});

test("keeps complete input and reports UTF-8 excess until the sender shortens it", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.getByLabel("Your secret note");
  const create = page.getByRole("button", { name: "Create Note", exact: true });
  let writes = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/api/notes")) writes++;
  });
  for (const text of ["A".repeat(MAX_NOTE_BYTES), "ế".repeat(10922) + "AZ", "🔐".repeat(8192)]) {
    await editor.fill("");
    await editor.focus();
    await page.keyboard.insertText(text + "Z");
    expect((await editor.inputValue()) === text + "Z").toBe(true);
    await expect(editor).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#note-size-error")).toContainText("1 byte");
    await expect(create).toBeDisabled();
    await page.keyboard.press("Backspace");
    expect((await editor.inputValue()) === text).toBe(true);
    await expect(create).toBeEnabled();
    await expect(page.locator("#note-size-error")).toBeEmpty();
  }
  expect(writes).toBe(0);
});

test("serves Vietnamese on first visit and keeps an explicit choice for navigation", async ({
  browser,
  appOrigin,
  request,
}) => {
  const response = await request.get(appOrigin, {
    headers: { "Accept-Language": "fr-FR, vi-VN;q=0.9, en-US;q=0.6" },
  });
  const html = await response.text();
  expect(html).toMatch(/<html\b[^>]*\blang="vi"/i);
  expect(html).toContain("Ghi chú bí mật của bạn");
  const ctx = await browser.newContext({ locale: "vi-VN" });
  try {
    const page = await ctx.newPage();
    await page.route("**/api/notes/*", (route) =>
      route.fulfill({
        status: 410,
        json: { error: { code: "EXPIRED", message: "Expired fixture" } },
      }),
    );
    const url =
      appOrigin + "/note/" + "a".repeat(32) + "#" + Buffer.alloc(32, 5).toString("base64url");
    await page.goto(url);
    await expect(
      page.getByRole("heading", { name: "Ghi chú đã hết hạn và tự động bị hủy." }),
    ).toBeVisible();
    await page.getByLabel("Language / Ngôn ngữ").selectOption("en");
    expect(page.url() === url).toBe(true);
    await page.getByRole("link", { name: "Write a new note" }).click();
    await expect(page.getByLabel("Your secret note")).toBeEnabled();
    await page.reload();
    await expect(page.getByLabel("Ghi chú bí mật của bạn")).toBeEnabled();
  } finally {
    await ctx.close();
  }
});

test("checks waiting-note metadata at server expiry despite a slow device clock", async ({
  page,
}) => {
  const serverTime = Date.UTC(2026, 0, 1, 12);
  await page.clock.install({ time: new Date(serverTime - 3 * 3600000) });
  let checks = 0,
    reads = 0;
  await page.route("**/api/notes/*", (route) => {
    checks++;
    if (checks > 1)
      return route.fulfill({
        status: 410,
        json: { error: { code: "EXPIRED", message: "Expired fixture" } },
      });
    return route.fulfill({
      headers: { Date: new Date(serverTime).toUTCString() },
      json: {
        version: 1,
        expiresAt: new Date(serverTime + 10_000).toISOString(),
        burnAfterRead: true,
        hasPassphrase: false,
      },
    });
  });
  await page.route("**/api/notes/*/read", (route) => {
    reads++;
    return route.abort();
  });
  await page.goto("/note/" + "b".repeat(32) + "#" + Buffer.alloc(32, 4).toString("base64url"));
  await expect(page.getByRole("button", { name: "Read and Destroy" })).toBeEnabled();
  await page.clock.fastForward(11_000);
  await expect(
    page.getByRole("heading", { name: "This note expired and was automatically destroyed." }),
  ).toBeFocused();
  await expect(page.getByRole("button", { name: "Read and Destroy" })).toHaveCount(0);
  expect(checks).toBe(2);
  expect(reads).toBe(0);
});

test("rechecks on return, preserves typed passphrases, and retries only metadata after going offline", async ({
  page,
}) => {
  const serverTime = Date.UTC(2026, 0, 1, 12);
  await page.clock.install({ time: new Date(serverTime + 3 * 3600000) });
  let checks = 0,
    reads = 0;
  await page.route("**/api/notes/*", (route) => {
    checks++;
    if (checks === 3) return route.abort("internetdisconnected");
    if (checks >= 4)
      return route.fulfill({
        status: 410,
        json: { error: { code: "DESTROYED", message: "Retired fixture" } },
      });
    return route.fulfill({
      headers: { Date: new Date(serverTime).toUTCString() },
      json: {
        version: 1,
        expiresAt: new Date(serverTime + 3600000).toISOString(),
        burnAfterRead: false,
        hasPassphrase: true,
        passphraseSalt: Buffer.alloc(16, 1).toString("base64"),
      },
    });
  });
  await page.route("**/api/notes/*/read", (route) => {
    reads++;
    return route.abort();
  });
  await page.goto("/note/" + "c".repeat(32) + "#" + Buffer.alloc(32, 4).toString("base64url"));
  const password = page.getByLabel("This note is passphrase-protected");
  await password.fill("disposable fixture");
  await page.clock.fastForward(20_000);
  expect(checks).toBe(1);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect.poll(() => checks).toBe(2);
  await expect(page.getByRole("button", { name: "Read Note" })).toBeEnabled();
  await expect(password).toHaveValue("disposable fixture");
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })),
  );
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "This note has been permanently destroyed." }),
  ).toBeVisible();
  expect(checks).toBe(4);
  expect(reads).toBe(0);
});
