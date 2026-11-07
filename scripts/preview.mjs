import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
});
page.on('pageerror', (e) => console.log('PAGE_ERROR', e.message));
await page.goto(process.env.FLUX_ORIGIN || 'http://localhost:3000');
await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
console.log(await page.title());
await browser.close();
