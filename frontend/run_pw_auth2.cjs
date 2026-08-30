const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push('CONSOLE: ' + msg.text());
    if (msg.type() === 'warn') errors.push('WARN: ' + msg.text());
  });
  page.on('pageerror', err => {
    errors.push('PAGEERROR: ' + err.stack);
  });
  
  // Mock a logged-in user in localStorage and store
  await context.addInitScript(() => {
    localStorage.setItem('token', 'fake-token-for-testing');
    // Inject user into store initial state
    window.__DEV_MOCK_USER__ = { id: 1, username: 'test', balance: 100000, is_onboarded: true, is_admin: false };
  });
  
  try {
    await page.goto('http://localhost:5173/markets', { waitUntil: 'networkidle', timeout: 25000 });
  } catch(e) {
    errors.push('NAV_ERROR: ' + e.message);
  }
  
  errors.forEach(e => console.log(e));
  if (errors.length === 0) console.log('NO ERRORS');
  await browser.close();
})();
