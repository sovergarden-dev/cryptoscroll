import { test, expect } from "./fixtures";
import { CREATION_RETRY_MS } from "../shared/protocol";

test("jumps directly to the mobile editor and copies the exact decrypted text locally", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto("/");
  await page.getByLabel("Language / Ngôn ngữ").selectOption("vi");
  const write = page.getByRole("button", { name: "Viết ghi chú", exact: true });
  await expect(write).toBeInViewport();
  await write.click();
  const editor = page.getByLabel("Ghi chú bí mật của bạn");
  await expect(editor).toBeFocused();
  const original = "  *QA-123*\n\n# tiếng Việt 🔐\n\tend  \n";
  await editor.fill(original);
  await page.getByRole("button", { name: "Tạo ghi chú", exact: true }).click();
  const link = await page.getByLabel("Liên kết riêng tư của bạn").inputValue();
  const recipient = await browser.newContext();
  try {
    await recipient.addInitScript(() => {
      let deny = false;
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async (text: string) => {
            if (deny) throw new DOMException("Denied fixture", "NotAllowedError");
            (window as unknown as Record<string, unknown>)["copiedFixture"] = text;
            deny = true;
          },
        },
      });
    });
    const reader = await recipient.newPage();
    let reads = 0;
    reader.on("request", (req) => {
      if (req.method() === "POST" && req.url().endsWith("/read")) reads++;
    });
    await reader.goto(link);
    await reader.getByRole("button", { name: "Read and Destroy", exact: true }).click();
    const article = reader.getByRole("article");
    await expect(article.locator("em")).toHaveText("QA-123");
    const copy = reader.getByRole("button", { name: "Copy original text" });
    await copy.click();
    expect(
      await reader.evaluate(() => (window as unknown as Record<string, unknown>)["copiedFixture"]),
    ).toBe(original);
    const view = reader.getByRole("button", { name: "Show original text" });
    await view.click();
    expect(await article.textContent()).toBe(original);
    await view.click();
    await copy.click();
    await expect(reader.getByRole("status")).toContainText("Select the original text");
    expect(await article.textContent()).toBe(original);
    expect(reads).toBe(1);
    await reader.getByRole("button", { name: "Clear this screen" }).click();
    await expect(article).toHaveCount(0);
  } finally {
    await recipient.close();
  }
});

test("keeps a timed-note transport error separate from password errors", async ({ page }) => {
  await page.route("**/api/notes/*", (route) =>
    route.fulfill({
      json: {
        version: 1,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        burnAfterRead: false,
        hasPassphrase: true,
        passphraseSalt: Buffer.alloc(16, 3).toString("base64"),
      },
    }),
  );
  await page.route("**/api/notes/*/read", (route) => route.abort("internetdisconnected"));
  await page.goto("/note/" + "b".repeat(32) + "#" + Buffer.alloc(32, 4).toString("base64url"));
  await expect(page.getByRole("button", { name: "Read Note", exact: true })).toBeVisible();
  const field = page.getByLabel("This note is passphrase-protected");
  await field.fill("local fixture");
  await page.getByRole("button", { name: "Read Note", exact: true }).click();
  const error = page.getByRole("alert");
  await expect(error).toContainText("Could not reach");
  await expect(error).not.toContainText("consumed");
  await expect(field).toHaveAttribute("aria-invalid", "false");
});

test("throttles retries and accepts an in-flight acknowledgement after the recovery deadline", async ({
  page,
}) => {
  let attempts = 0;
  let deliver!: () => void;
  const acknowledgement = new Promise<void>((resolve) => {
    deliver = resolve;
  });
  await page.clock.install();
  await page.route("**/api/notes", async (route) => {
    attempts++;
    if (attempts === 1) {
      await route.fulfill({ status: 429, headers: { "Retry-After": "6" }, body: "Busy" });
      return;
    }
    await acknowledgement;
    await route.fulfill({
      status: 201,
      json: { id: "b".repeat(32), expiresAt: new Date(Date.now() + 3600000).toISOString() },
    });
  });
  await page.goto("/");
  await page.getByLabel("Your secret note").fill("late acknowledgement");
  await page.getByRole("button", { name: "Create Note", exact: true }).click();
  const retry = page.getByRole("button", { name: "Retry this creation" });
  await expect(retry).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("You can try again at");
  await page.clock.fastForward(CREATION_RETRY_MS - 12_000);
  await expect(retry).toBeEnabled();
  expect(attempts).toBe(1);
  await retry.click();
  await expect.poll(() => attempts).toBe(2);
  await page.clock.fastForward(17_000);
  await expect(retry).toBeDisabled();
  deliver();
  await expect(page.getByLabel("Your private link")).toBeVisible();
});

test("releases an unacknowledged attempt at expiry and keeps a creation cooldown after discard", async ({
  page,
}) => {
  await page.clock.install();
  let attempts = 0;
  await page.route("**/api/notes", async (route) => {
    attempts++;
    await route.fulfill({ status: 429, headers: { "Retry-After": "10" }, body: "Busy" });
  });
  await page.goto("/");
  const content = page.getByLabel("Your secret note");
  const create = page.getByRole("button", { name: "Create Note", exact: true });
  await content.fill("discard cooldown fixture");
  await create.click();
  await expect(page.getByRole("alert")).toContainText("Too many creation");
  await page.getByRole("button", { name: "Discard this attempt" }).click();
  await content.fill("expiry fixture");
  await expect(create).toBeDisabled();
  await page.clock.fastForward(10_100);
  await expect(create).toBeEnabled();
  await create.click();
  await expect(page.getByRole("alert")).toContainText("Too many creation");
  await page.clock.fastForward(CREATION_RETRY_MS + 1000);
  await expect(
    page.getByRole("heading", { name: "The creation recovery window has ended." }),
  ).toBeFocused();
  await expect(page.getByRole("button", { name: "Retry this creation" })).toHaveCount(0);
  await page.getByRole("button", { name: "Write a new note" }).click();
  await expect(content).toHaveValue("");
  expect(attempts).toBe(2);
});
