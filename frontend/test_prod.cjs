const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
  page.on('pageerror', error => console.error('BROWSER_ERROR:', error));
  page.on('requestfailed', request => console.error('REQUEST_FAILED:', request.url(), request.failure().errorText));
  
  console.log('Navigating to https://34-93-99-22.nip.io ...');
  try {
    await page.goto('https://34-93-99-22.nip.io', { waitUntil: 'networkidle0' });
    console.log('Page loaded successfully.');
  } catch (err) {
    console.error('Failed to load page:', err);
  }
  
  await browser.close();
  process.exit(0);
})();
