const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
  page.on('pageerror', error => console.error('BROWSER_ERROR:', error));
  page.on('requestfailed', request => console.error('REQUEST_FAILED:', request.url(), request.failure().errorText));
  
  console.log('Navigating to http://localhost:4173 ...');
  try {
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle0' });
    console.log('Page loaded successfully.');
  } catch (err) {
    console.error('Failed to load page:', err);
  }
  
  await browser.close();
  process.exit(0);
})();
