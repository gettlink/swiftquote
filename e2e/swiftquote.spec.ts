import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { createLongDocumentFixture } from "../src/domain/fixtures";
import { serializeDocumentExport } from "../src/features/import-export";

const pdfOutput = resolve("output/pdf");

async function waitForSaved(page: Page) {
  await expect(page.getByRole("status").first()).toContainText(/Saved on this device|Document saved on this device/);
}

test.beforeAll(() => mkdirSync(pdfOutput, { recursive: true }));

test("creates searchable A4 and US Letter PDFs from the sample", async ({ page }) => {
  test.setTimeout(120_000);
  page.on("console", (message) => { if (message.type() === "error") console.log(`Browser error: ${message.text()}`); });
  await page.goto("/");
  await waitForSaved(page);

  const a4Download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).first().click();
  await (await a4Download).saveAs(resolve(pdfOutput, "swiftquote-sample-a4.pdf"));
  await expect(page.getByRole("status").first()).toContainText("PDF downloaded");

  await page.getByRole("button", { name: "US Letter" }).click();
  const letterDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).first().click();
  await (await letterDownload).saveAs(resolve(pdfOutput, "swiftquote-sample-letter.pdf"));
});

test("paginates a long Classic US Letter document", async ({ page }) => {
  test.setTimeout(120_000);
  const fixture = createLongDocumentFixture();
  fixture.templateId = "classic";
  fixture.pageSize = "letter";
  const importPath = resolve("output/swiftquote-long.json");
  mkdirSync(resolve("output"), { recursive: true });
  writeFileSync(importPath, serializeDocumentExport(fixture), "utf8");
  await page.goto("/");
  await page.getByRole("button", { name: "Documents" }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import JSON" }).first().click();
  await (await chooser).setFiles(importPath);
  await page.getByRole("button", { name: /Invoice SQ-1099/ }).click();
  await expect(page.getByLabel("invoice preview, page 4 of 4")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).first().click();
  await (await download).saveAs(resolve(pdfOutput, "swiftquote-long-classic-letter.pdf"));
});

test("recovers edits, converts a saved quote, and restores a deleted document", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Customer name" }).fill("Harbor Works");
  await page.getByRole("textbox", { name: "Customer reference" }).fill("CLIENT-42");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/6Xz7WQAAAABJRU5ErkJggg==", "base64");
  await page.locator('input[type="file"][accept^="image/png"]').setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
  await expect(page.getByAltText("Uploaded business logo")).toBeVisible();
  await waitForSaved(page);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Customer name" })).toHaveValue("Harbor Works");
  await expect(page.getByRole("textbox", { name: "Customer reference" })).toHaveValue("CLIENT-42");
  await expect(page.getByAltText("Uploaded business logo")).toBeVisible();

  await page.getByRole("button", { name: "Save document" }).click();
  await page.getByRole("button", { name: "Documents" }).click();
  await expect(page.getByText("Quote SQ-1001")).toBeVisible();
  await page.getByRole("button", { name: "Convert to invoice" }).click();
  await expect(page.getByRole("button", { name: "Invoice" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Documents" }).click();
  await page.getByRole("button", { name: "Delete document" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete document", exact: true }).click();
  await expect(page.getByRole("button", { name: "Undo delete" })).toBeVisible();
  await page.getByRole("button", { name: "Undo delete" }).click();
  await expect(page.getByText("Quote SQ-1001")).toBeVisible();
});

test("applies saved settings and confirms blank-document replacement", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("spinbutton", { name: "Payment terms (days)" }).fill("30");
  await page.getByRole("textbox", { name: "Business name" }).fill("Saved Studio");
  await expect(page.getByRole("status")).toContainText(/Saved on this device|Ready/);
  await page.getByRole("button", { name: "SwiftQuote" }).click();
  await page.getByRole("button", { name: "New" }).click();
  await expect(page.getByRole("dialog", { name: "Create a blank document?" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Create blank document" }).click();
  await expect(page.getByRole("textbox", { name: "Business name" })).toHaveValue("Saved Studio");
  const issue = await page.getByRole("textbox", { name: "Issue date" }).inputValue();
  const expiry = await page.getByRole("textbox", { name: "Expiry date" }).inputValue();
  expect((Date.parse(expiry) - Date.parse(issue)) / 86_400_000).toBe(30);
});

test("exports and imports JSON without accepting malformed data", async ({ page }) => {
  await page.goto("/");
  await waitForSaved(page);
  await page.getByRole("button", { name: "Save document" }).click();
  await page.getByRole("button", { name: "Documents" }).click();

  const exportDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const exported = await exportDownload;
  const jsonPath = resolve("output/swiftquote-export.json");
  mkdirSync(resolve("output"), { recursive: true });
  await exported.saveAs(jsonPath);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Clear local data" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Clear local data" }).click();
  await page.getByRole("button", { name: "Documents" }).click();
  await expect(page.getByText("No saved documents")).toBeVisible();

  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import JSON" }).first().click();
  await (await chooser).setFiles(jsonPath);
  await expect(page.getByText("Quote SQ-1001")).toBeVisible();

  const malformedChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import JSON" }).click();
  await (await malformedChooser).setFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from("{not valid") });
  await expect(page.getByRole("status").first()).toContainText(/valid JSON|supported SwiftQuote/);
  await expect(page.getByText("Quote SQ-1001")).toBeVisible();
});

test("keeps the primary flow usable across the required viewport matrix", async ({ page }) => {
  await page.goto("/");
  for (const [width, height] of [[375, 667], [390, 844], [768, 1024], [1024, 768], [1440, 900]] as const) {
    await page.setViewportSize({ width, height });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.getByRole("textbox", { name: "Quote number" })).toBeVisible();
    if (width < 1024) {
      await page.getByRole("tab", { name: "Preview" }).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByLabel(/quote preview, page 1 of/)).toBeVisible();
      await page.getByRole("tab", { name: "Edit" }).focus();
      await page.keyboard.press("Enter");
    } else {
      await expect(page.getByLabel(/quote preview, page 1 of/)).toBeVisible();
    }
  }
});
