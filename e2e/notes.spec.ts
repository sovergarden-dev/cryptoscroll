import { test, expect } from "./fixtures";

test("shares a protected one-time note across isolated desktop and mobile viewports", async ({
  page,
  browser,
  appOrigin,
}, testInfo) => {
  const transport: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => transport.push(`${request.url()} ${request.postData() ?? ""}`));
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (value: string) => {
          (window as unknown as Record<string, unknown>)["copiedFixture"] = value;
        },
      },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Write once\..*Read once\..*Vanish\./ }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: /Write once\.\s*Read once\.\s*Vanish\./ }),
  ).toBeVisible();
  await expect(page.getByLabel("Your secret note")).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("home-desktop.png"), fullPage: true });
  const secret =
    "# A private handoff\n\nXin chào, recipient 🔐\n\n![tracking](https://tracking.invalid/pixel.png)\n\n<script>window.injected = true</script>";
  const passphrase = "  separate channel phrase 🔐  ";
  await page.getByLabel("Your secret note").fill(secret);
  await page.getByRole("button", { name: "Add a passphrase Optional" }).click();
  await page.getByLabel("Passphrase", { exact: true }).fill(passphrase);
  await page.getByRole("button", { name: "Create Note", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your scroll is sealed." })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Your scroll is sealed.", exact: true }),
  ).toBeVisible();
  const url = await page.getByLabel("Your private link").inputValue();
  const parsed = new URL(url);
  expect(parsed.hash).toMatch(/^#[A-Za-z0-9_-]{43}$/);
  await expect(page.getByRole("img", { name: "QR code for this note" })).toBeVisible();
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("button", { name: "Copied!" })).toBeVisible();
  expect(
    await page.evaluate(() => (window as unknown as Record<string, unknown>)["copiedFixture"]),
  ).toBe(url);
  await page.screenshot({ path: testInfo.outputPath("success-desktop.png"), fullPage: true });
  expect(
    await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
  ).toEqual({ local: 0, session: 0 });

  const recipient = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  try {
    const note = await recipient.newPage();
    const recipientTransport: string[] = [];
    const trackerRequests: string[] = [];
    note.on("request", (request) => {
      recipientTransport.push(`${request.url()} ${request.postData() ?? ""}`);
      if (request.url().includes("tracking.invalid")) trackerRequests.push(request.url());
    });
    note.on("pageerror", (error) => errors.push(error.message));
    await note.goto(url);
    await expect(note.getByRole("heading", { name: "This is a one-time note." })).toBeVisible();
    await note.getByText("Skip to content", { exact: true }).focus();
    await note.keyboard.press("Enter");
    await expect(note).toHaveURL(url);
    await expect(note.locator("#main-content")).toBeFocused();
    await note.getByLabel("This note is passphrase-protected").focus();
    expect(recipientTransport.filter((request) => request.includes("/read "))).toHaveLength(0);
    await note.screenshot({ path: testInfo.outputPath("warning-mobile.png"), fullPage: true });
    await note.getByLabel("This note is passphrase-protected").fill("wrong passphrase");
    await note.getByRole("button", { name: "Read and Destroy" }).click();
    await expect(note.getByRole("alert")).toContainText("Wrong passphrase");
    expect(
      (
        await note.request.get(`${appOrigin}/api/notes/${parsed.pathname.split("/").at(-1)}`)
      ).status(),
    ).toBe(200);
    await note.getByLabel("This note is passphrase-protected").fill(passphrase);
    await note.getByRole("button", { name: "Read and Destroy" }).click();
    await expect(note.getByRole("article", { name: "Decrypted note" })).toContainText(
      "Xin chào, recipient 🔐",
    );
    await expect(
      note.getByRole("heading", { name: "The server copy has been destroyed." }),
    ).toBeVisible();
    await expect(note.getByRole("article").locator("img, script")).toHaveCount(0);
    expect(trackerRequests).toHaveLength(0);
    expect(
      await note.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect(
      await note.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
    ).toEqual({ local: 0, session: 0 });
    await note.screenshot({ path: testInfo.outputPath("reader-mobile.png"), fullPage: true });
    await note.getByRole("button", { name: "Clear this screen" }).click();
    await expect(
      note.getByRole("heading", { name: "This note has been permanently destroyed." }),
    ).toBeVisible();
    await expect(note.getByRole("article")).toHaveCount(0);
    await note.reload();
    await expect(
      note.getByRole("heading", { name: "This note has been permanently destroyed." }),
    ).toBeVisible();
    for (const request of [...transport, ...recipientTransport]) {
      expect(request).not.toContain(secret);
      expect(request).not.toContain(JSON.stringify(secret).slice(1, -1));
      expect(request).not.toContain("Xin chào, recipient 🔐");
      expect(request).not.toContain(passphrase);
      expect(request).not.toContain(parsed.hash.slice(1));
    }
    expect(errors).toEqual([]);
  } finally {
    await recipient.close();
  }
});

test("supports timed rereads, missing keys, network recovery, reduced motion and a themed 404", async ({
  page,
  browser,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByLabel("Your secret note")).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("home-mobile.png"), fullPage: true });
  expect(
    await page
      .locator(".animate-ember")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  await page.getByLabel("Your secret note").fill("Timed note survives repeat reads.");
  await page.getByText("24h", { exact: true }).click();
  await page.route("**/api/notes", (route) => route.abort("internetdisconnected"));
  await page.getByRole("button", { name: "Create Note", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Could not reach");
  await expect(page.getByLabel("Your secret note")).toHaveCount(0);
  await page.unroute("**/api/notes");
  await page.getByRole("button", { name: "Retry this creation", exact: true }).click();
  const link = page.getByLabel("Your private link");
  await expect(link).toBeVisible();
  const url = await link.inputValue();
  const recipient = await browser.newContext();
  try {
    const note = await recipient.newPage();
    await note.goto(url.split("#")[0]!);
    await expect(note.getByRole("heading")).toContainText("key is missing");
    await note.goto(url);
    await note.getByRole("button", { name: "Read Note", exact: true }).click();
    await expect(note.getByRole("article")).toContainText("Timed note survives repeat reads.");
    await note.reload();
    await note.getByRole("button", { name: "Read Note", exact: true }).click();
    await expect(note.getByRole("article")).toContainText("Timed note survives repeat reads.");
  } finally {
    await recipient.close();
  }
  await page.goto("/lost-scroll");
  await expect(
    page.getByRole("heading", { name: "These are not the scrolls you're looking for." }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("not-found-mobile.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("enforces fresh production script nonces while the editor hydrates", async ({
  page,
  appOrigin,
}) => {
  await page.route(`${appOrigin}/`, async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      "</head>",
      '<script id="untrusted-fixture">window.__untrustedScriptExecuted = true</script></head>',
    );
    await route.fulfill({ response, body });
  });
  const response = await page.goto("/");
  const policy = response!.headers()["content-security-policy"] ?? "";
  const nonce = policy.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toMatch(/^[A-Za-z0-9+/=]{24,}$/);
  expect(policy).not.toContain("'unsafe-eval'");
  await expect(page.getByLabel("Your secret note")).toBeEnabled();
  const scriptNonces = await page
    .locator("script:not(#untrusted-fixture)")
    .evaluateAll((scripts) =>
      scripts
        .filter(
          (script): script is HTMLScriptElement =>
            script instanceof HTMLScriptElement &&
            (!script.type || script.type === "module" || script.type === "text/javascript"),
        )
        .map((script) => script.nonce),
    );
  expect(scriptNonces.length).toBeGreaterThan(0);
  expect(scriptNonces.every((value) => value === nonce)).toBe(true);
  expect(
    await page.evaluate(
      () => (window as unknown as Record<string, unknown>)["__untrustedScriptExecuted"],
    ),
  ).toBeUndefined();
  const second = await page.request.get("/");
  const secondNonce = second.headers()["content-security-policy"]?.match(/'nonce-([^']+)'/)?.[1];
  expect(secondNonce).toMatch(/^[A-Za-z0-9+/=]{24,}$/);
  expect(secondNonce).not.toBe(nonce);
});

test("revokes a protected note only after confirmation and a correct passphrase", async ({
  page,
  appOrigin,
  browser,
}) => {
  const passphrase = "A separate revocation fixture phrase";
  const requests: string[] = [];
  page.on("request", (request) =>
    requests.push(
      JSON.stringify({
        method: request.method(),
        url: request.url(),
        headers: request.headers(),
        body: request.postData(),
      }),
    ),
  );
  await page.goto("/");
  await page.getByLabel("Your secret note").fill("A disposable protected note for revocation.");
  await page.getByText("1h", { exact: true }).click();
  await page.getByRole("button", { name: "Add a passphrase Optional" }).click();
  await page.getByLabel("Passphrase", { exact: true }).fill(passphrase);
  await page.getByRole("button", { name: "Create Note", exact: true }).click();
  const link = page.getByLabel("Your private link");
  await expect(link).toBeVisible();
  const privateUrl = await link.inputValue();
  const parsed = new URL(privateUrl);
  const endpoint = `${appOrigin}/api/notes/${parsed.pathname.split("/").at(-1)}`;
  const trigger = page.getByRole("button", { name: "Revoke note", exact: true });
  await expect(trigger).toBeVisible({ timeout: 5000 });
  await trigger.click();
  const confirmation = page.getByRole("alertdialog", { name: "Revoke this note?", exact: true });
  await expect(confirmation.getByRole("button", { name: "Keep note" })).toBeFocused();
  for (const key of ["Tab", "Tab", "Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab"]) {
    await page.keyboard.press(key);
    expect(await confirmation.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(
      true,
    );
  }
  await confirmation.getByRole("button", { name: "Keep note" }).click();
  await expect(confirmation).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect((await page.request.get(endpoint)).status()).toBe(200);
  await page.keyboard.press("Enter");
  await confirmation.getByLabel("Passphrase to revoke").fill("wrong fixture phrase");
  await confirmation.getByRole("button", { name: "Revoke note", exact: true }).click();
  await expect(confirmation.getByRole("alert")).toContainText("Wrong passphrase");
  expect((await page.request.get(endpoint)).status()).toBe(200);
  await page.route(endpoint, (route) =>
    route.request().method() === "DELETE" ? route.abort("internetdisconnected") : route.continue(),
  );
  await confirmation.getByLabel("Passphrase to revoke").fill(passphrase);
  await confirmation.getByRole("button", { name: "Revoke note", exact: true }).click();
  await expect(confirmation.getByRole("alert")).toContainText("could not be confirmed");
  await expect(page.getByRole("heading", { name: "Note revoked.", exact: true })).toHaveCount(0);
  await page.unroute(endpoint);
  await confirmation.getByLabel("Passphrase to revoke").fill(passphrase);
  await confirmation.getByRole("button", { name: "Revoke note", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Note revoked.", exact: true })).toBeFocused();
  await expect(link).toHaveCount(0);
  expect((await page.request.get(endpoint)).status()).toBe(410);
  expect(requests.some((request) => request.includes('/read"'))).toBe(false);
  for (const request of requests) {
    expect(request).not.toContain(passphrase);
    expect(request).not.toContain(parsed.hash.slice(1));
  }
  const recipient = await browser.newContext();
  try {
    const note = await recipient.newPage();
    await note.goto(privateUrl);
    await expect(
      note.getByRole("heading", { name: "This note has been permanently destroyed." }),
    ).toBeVisible();
  } finally {
    await recipient.close();
  }
  await page.getByRole("button", { name: "Create another note" }).click();
  await expect(page.getByLabel("Your secret note")).toHaveValue("");
});
