import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
await page.goto(process.env.FLUX_TEST_URL || "http://localhost:3000");
await page.locator(".empty-state").first().waitFor();
let failures = [];
for (const width of [1440, 390, 320]) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(250);
  for (const view of ["studio", "queue", "history"]) {
    await page.evaluate((view) => (location.hash = view), view);
    await page.waitForTimeout(100);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    failures.push(
      ...result.violations.map((v) => ({
        width,
        view,
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    );
  }
  await page.locator("#account-button").click();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  failures.push(
    ...result.violations.map((v) => ({
      width,
      view: "auth",
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  );
  await page.keyboard.press("Escape");
}
console.log(JSON.stringify(failures, null, 2));
await browser.close();
if (failures.length) process.exit(1);
console.log(
  "PASS: axe WCAG A/AA scans for all pages and auth dialog at desktop, mobile and narrow mobile.",
);
