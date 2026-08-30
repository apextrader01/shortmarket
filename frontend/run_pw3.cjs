const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const errors = [];
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error' || type === 'warn') errors.push('[' + type.toUpperCase() + '] ' + msg.text());
  });
  page.on('pageerror', err => {
    errors.push('[PAGEERROR] ' + err.stack);
  });
  
  // Inject mock auth BEFORE page loads using CDP
  await context.addInitScript(() => {
    // Patch the store module on load
    const origCreate = undefined; // too complex
    // Just inject token directly into localStorage
    localStorage.setItem('token', 'debug-token');
    localStorage.setItem('user', JSON.stringify({ id: 99, username: 'debuguser', balance: 100000, is_onboarded: true, is_admin: false }));
  });
  
  try {
    await page.goto('http://localhost:5173/markets', { waitUntil: 'networkidle', timeout: 15000 });
    // Wait a bit more for any delayed crashes
    await page.waitForTimeout(5000);
  } catch(e) {
    errors.push('[NAV] ' + e.message);
  }
  
  errors.forEach(e => console.log(e));
  if (errors.length === 0) console.log('NO ERRORS - PAGE LOADED OK');
  await browser.close();
})();
