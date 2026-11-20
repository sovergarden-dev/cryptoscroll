import { test, expect } from "./fixtures";

test("keeps an independent receipt for later revocation in a separate browser", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page.getByLabel("Your secret note").fill("Synthetic receipt lifecycle");
  await page.getByText("1h", { exact: true }).click();
  await page.getByRole("button", { name: "Add a passphrase Optional" }).click();
  await page.getByLabel("Passphrase", { exact: true }).fill("separate fixture");
  await page.getByRole("button", { name: "Create Note", exact: true }).click();
  const reading = await page.getByLabel("Your private link").inputValue();
  await expect(page.getByLabel("Sender’s revocation receipt")).toHaveCount(0);
  await page.getByRole("button", { name: "Keep a revocation receipt" }).click();
  const receipt = await page.getByLabel("Sender’s revocation receipt").inputValue();
  const token = new URL(receipt).hash.slice(1);
  expect(token.length).toBe(43);
  expect(new URL(reading).hash.slice(1) === token).toBe(false);
  expect(new URL(receipt).pathname).toMatch(/^\/revoke\/[a-f0-9]{32}$/);
  await page.close();
  const next = await browser.newContext();
  try {
    const management = await next.newPage();
    let reads = 0,
      deletions = 0,
      rawInTraffic = false;
    management.on("request", (req) => {
      const url = req.url();
      if (req.method() === "POST" && url.endsWith("/read")) reads++;
      if (req.method() === "DELETE") deletions++;
      const transmitted = [url, req.postData() ?? "", JSON.stringify(req.headers())].join(" ");
      if (transmitted.includes(token)) rawInTraffic = true;
    });
    await management.goto(receipt);
    await expect(management.getByRole("heading", { name: "Revoke a sent note" })).toBeFocused();
    await expect(management.getByRole("article")).toHaveCount(0);
    await management.getByRole("button", { name: "Revoke note", exact: true }).click();
    await management.getByRole("button", { name: "Keep note" }).click();
    expect(deletions).toBe(0);
    const recipient = await next.newPage();
    await recipient.goto(reading);
    await expect(recipient.getByRole("button", { name: "Read Note", exact: true })).toBeVisible();
    await expect(recipient.getByRole("button", { name: "Revoke note" })).toHaveCount(0);
    await management.getByRole("button", { name: "Revoke note", exact: true }).click();
    const dialog = management.getByRole("alertdialog");
    await dialog.getByLabel("Passphrase to revoke").fill("incorrect fixture");
    await dialog.getByRole("button", { name: "Revoke note", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Wrong passphrase");
    await dialog.getByLabel("Passphrase to revoke").fill("separate fixture");
    await dialog.getByRole("button", { name: "Revoke note", exact: true }).click();
    await expect(management.getByRole("heading", { name: "Note revoked." })).toBeVisible();
    expect(reads).toBe(0);
    expect(deletions).toBe(2);
    expect(rawInTraffic).toBe(false);
    await recipient.reload();
    await expect(
      recipient.getByRole("heading", { name: "This note has been permanently destroyed." }),
    ).toBeVisible();
  } finally {
    await next.close();
  }
});
