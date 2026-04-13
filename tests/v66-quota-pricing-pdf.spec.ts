/**
 * V6.6 regression checks (quota modal, pricing route, free-tier PDF metadata).
 *
 * **Local runs:** `playwright.config.ts` sets `reuseExistingServer: !process.env.CI`. If something
 * is already listening on port 3000, tests hit that process — which may be an **old** `next dev`
 * that does not include the current `pdf-guard-core`. Then `/api/protect/pdf` can appear to return
 * the raw `public/test.pdf` (Producer still `pdf-lib …`). Fix: stop the other server or restart
 * `npm run dev` from this repo, then re-run. In CI (`CI=true`), a fresh server is started when the
 * port is free.
 */

import { test, expect, type APIResponse } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import fsSync from "node:fs";
import path from "node:path";

function originFrom(baseURL: string | undefined): string {
  return (baseURL ?? "http://localhost:3000").replace(/\/$/, "");
}

function assertCreatorGuardPdfResponse(res: APIResponse, doc: PDFDocument): void {
  expect(res.status()).toBe(200);
  expect(res.headers()["x-creator-guard-mode"]).toBe("PDF-V1.0-STABLE");

  const producer = doc.getProducer() ?? "";
  if (producer.includes("pdf-lib (https://github.com/Hopding/pdf-lib)")) {
    throw new Error(
      "PDF still has the original fixture Producer — Creator Guard did not run on the server you hit. " +
        "Stop other apps on port 3000 or restart `npm run dev` from this workspace, then re-run tests."
    );
  }

  expect(producer).toContain("Creator Guard PDF-V1.0-STABLE");
  expect(producer).toContain("CreatorGuard:FreeTierVisibleFooter=1");
}

test.describe("V6.6 quota, upgrade modal, pricing, PDF free-tier footer", () => {
  test.describe.configure({ timeout: 120_000 });

  test("portal: after 5 non-demo members, 6th add opens upgrade modal; CTA goes to /zh-TW/pricing; back link returns to zh-TW home", async ({
    page,
    context,
    baseURL,
  }) => {
    const origin = originFrom(baseURL);

    await context.addInitScript(() => {
      try {
        localStorage.clear();
      } catch {
        /* ignore */
      }
    });

    await page.goto(`${origin}/zh-TW/portal`, {
      waitUntil: "domcontentloaded",
    });

    const addTrigger = page.locator('[data-cg-portal="add-member"]');
    const loginWall = page.getByRole("button", {
      name: /使用 Google 登入|Log in with Google/,
    });

    await expect
      .poll(
        async () => {
          if (await addTrigger.isVisible().catch(() => false)) return "portal";
          if (await loginWall.isVisible().catch(() => false)) return "auth";
          return "loading";
        },
        { timeout: 45_000 }
      )
      .not.toBe("loading");

    if (await loginWall.isVisible().catch(() => false)) {
      test.skip(
        true,
        "Portal requires Google sign-in when Supabase is configured. Run with Supabase unset or complete login to exercise this test."
      );
    }

    for (let i = 1; i <= 5; i++) {
      await addTrigger.click();
      await expect(
        page.getByRole("heading", { name: "新增成員", exact: true })
      ).toBeVisible();
      await page.getByLabel("識別 ID (LINE/TG)").fill(`quota-e2e-${i}`);
      await page.getByRole("button", { name: "確認加入" }).click();
      await expect(
        page.getByRole("heading", { name: "新增成員", exact: true })
      ).toHaveCount(0, { timeout: 5_000 });
    }

    await addTrigger.click();
    await expect(page.locator("#cg-upgrade-title")).toBeVisible();
    await expect(page.locator("#cg-upgrade-title")).toHaveText(
      /已達免費方案成員上限/
    );
    await expect(
      page.getByRole("heading", { name: "新增成員", exact: true })
    ).toHaveCount(0);

    const pricingLink = page.getByRole("link", { name: "查看 Pro 方案" });
    await expect(pricingLink).toBeVisible();
    await Promise.all([
      page.waitForURL(`${origin}/zh-TW/pricing`, { timeout: 15_000 }),
      pricingLink.click(),
    ]);

    await expect(
      page.getByRole("heading", { name: "Creator Guard Pro" })
    ).toBeVisible();

    const back = page.getByRole("link", { name: /返回首頁/ });
    await expect(back).toBeVisible();
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/zh-TW", { timeout: 15_000 }),
      back.click(),
    ]);
  });

  test("API POST /api/protect/pdf with planType=free stamps Producer (free-tier marker)", async ({
    request,
    baseURL,
  }) => {
    const origin = originFrom(baseURL);
    const pdfPath = path.join(process.cwd(), "public", "test.pdf");
    const buf = fsSync.readFileSync(pdfPath);

    const res = await request.post(`${origin}/api/protect/pdf`, {
      multipart: {
        buyerEmail: "api-free-tier@example.com",
        planType: "free",
        file: {
          name: "test.pdf",
          mimeType: "application/pdf",
          buffer: buf,
        },
      },
    });

    const out = Buffer.from(await res.body());
    const doc = await PDFDocument.load(new Uint8Array(out), {
      updateMetadata: true,
    });
    assertCreatorGuardPdfResponse(res, doc);
  });

  test("pricing: /zh-TW/pricing loads; back link returns to /zh-TW", async ({
    page,
    baseURL,
  }) => {
    const origin = originFrom(baseURL);
    await page.goto(`${origin}/zh-TW/pricing`, { waitUntil: "load" });
    await expect(page).toHaveURL(/\/zh-TW\/pricing\/?$/);
    await expect(
      page.getByRole("heading", { name: "Creator Guard Pro" })
    ).toBeVisible();
    await Promise.all([
      page.waitForURL((u) => u.pathname === "/zh-TW", { timeout: 15_000 }),
      page.getByRole("link", { name: /返回首頁/ }).click(),
    ]);
  });
});
