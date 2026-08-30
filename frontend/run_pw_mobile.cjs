const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 400, height: 800 } });
  const page = await context.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('PAGE ERROR:', msg.text());
  });
  page.on('pageerror', err => console.log('UNCAUGHT:', err.stack));
  await page.goto('http://localhost:5173/markets', { waitUntil: 'networkidle' });
  await browser.close();
})();
