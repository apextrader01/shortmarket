const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Capture ALL console errors and page errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push('CONSOLE: ' + msg.text());
  });
  page.on('pageerror', err => {
    errors.push('PAGEERROR: ' + err.stack);
  });
  
  // Mock a logged-in user in localStorage
  await context.addInitScript(() => {
    localStorage.setItem('token', 'fake-token-for-testing');
  });
  
  try {
    await page.goto('http://localhost:5173/markets', { waitUntil: 'networkidle', timeout: 20000 });
  } catch(e) {
    errors.push('NAV_ERROR: ' + e.message);
  }
  
  // Print errors
  errors.forEach(e => console.log(e));
  if (errors.length === 0) console.log('NO ERRORS FOUND');
  await browser.close();
})();
