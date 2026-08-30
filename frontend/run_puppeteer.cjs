const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('PAGE ERROR:', msg.text());
    }
  });

  page.on('pageerror', err => {
    console.log('UNCAUGHT EXCEPTION:', err.toString());
  });

  try {
    await page.goto('http://localhost:5173/markets', { waitUntil: 'networkidle2', timeout: 10000 });
    console.log('Page loaded successfully without crashing.');
  } catch (err) {
    console.log('Navigation error:', err.message);
  }

  await browser.close();
})();
