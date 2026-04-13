import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function originFrom(baseURL: string | undefined): string {
  return (baseURL ?? "http://localhost:3000").replace(/\/$/, "");
}

/**
 * E2E: home → claim → protect PDF → download protected copy → verify/pdf (V3.0 forensic UI).
 * baseURL must be http://localhost:3000 (see playwright.config.ts + webServer).
 */
test.describe("PDF protect page", () => {
  test("fills email, uploads sample PDF, starts protection, and downloads", async ({
    page,
    context,
    baseURL,
  }) => {
    const origin = originFrom(baseURL);

    expect(origin).toBe("http://localhost:3000");

    await context.grantPermissions([]);

    await page.goto(`${origin}/`, { waitUntil: "load" });
    await expect(page).toHaveURL(/localhost:3000/);

    await page.goto(`${origin}/claim`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");

    await page.goto(`${origin}/protect/pdf`, { waitUntil: "load" });

    await page.locator("#member-identity-list").fill("test@creatorguard.com");

    const pdfPath = path.join(process.cwd(), "public", "test.pdf");
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(pdfPath);

    const downloadPromise = page.waitForEvent("download", {
      timeout: 120_000,
    });

    await page
      .getByRole("button", { name: /Start batch protection/i })
      .click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);

    await expect(page.locator("main p.text-sm.text-red-200")).toHaveCount(0);

    const protectedPdfPath = path.join(
      os.tmpdir(),
      `cg-protected-${Date.now()}.pdf`
    );
    await download.saveAs(protectedPdfPath);

    await page.goto(`${origin}/verify/pdf`, { waitUntil: "load" });
    await page.waitForLoadState("domcontentloaded");

    await page.locator("#verify-pdf-input").setInputFiles(protectedPdfPath);

    await page
      .getByRole("button", { name: /Scan for Fingerprints/i })
      .click();

    await expect(page.getByText("GHOST DETECTED")).toBeVisible({
      timeout: 15_000,
    });

    const reportPngButton = page.getByRole("button", {
      name: /Download report image/i,
    });
    await reportPngButton.click();
    await expect(reportPngButton).toBeEnabled({ timeout: 20_000 });
    await expect(reportPngButton).not.toContainText(/Rendering/i);

    await fs.unlink(protectedPdfPath).catch(() => {});
  });
});
