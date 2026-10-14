// scripts/test_live_ipo_sync.js
const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 15000
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) {
          redirectUrl = 'https://www.investorgain.com' + redirectUrl;
        }
        return fetchUrl(redirectUrl).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout ' + url)); });
    req.on('error', reject);
  });
}

function cleanText(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#8377;/g, '₹')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSlug(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/\b(ltd|limited|pvt|private|services|solutions|india|technologies|technology|ipo|bse|sme|nse)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

async function testSync() {
  console.log('Fetching GMP and Subscription feeds...');
  const [gmpHtml, subHtml] = await Promise.all([
    fetchUrl('https://www.investorgain.com/report/ipo-gmp-live/331/'),
    fetchUrl('https://www.investorgain.com/report/ipo-subscription-live/333/all/')
  ]);

  console.log('GMP HTML length:', gmpHtml.length, 'Sub HTML length:', subHtml.length);

  // 1. Parse Subscriptions
  const subMap = new Map();
  const subTbody = subHtml.match(/<tbody[\s\S]*?<\/tbody>/i);
  if (subTbody) {
    const trs = [...subTbody[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)];
    for (const tr of trs) {
      const tds = [...tr[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1]);
      if (tds.length < 7) continue;
      
      const linkMatch = tds[0].match(/<a[^>]*href=['"]([^'"]*)['"][^>]*>([\s\S]*?)<\/a>/i);
      const rawName = linkMatch ? cleanText(linkMatch[2]) : cleanText(tds[0]);
      if (!rawName) continue;

      const slug = normalizeSlug(rawName);
      
      // TD 1: Total multiple + date (e.g., "1.14 14th Oct 17:11")
      const totalRaw = cleanText(tds[1]);
      const totalMatch = totalRaw.match(/^([0-9.]+)/);
      const total = totalMatch ? parseFloat(totalMatch[1]) : 0;
      const asOnMatch = totalRaw.match(/[0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+[0-9]{1,2}:[0-9]{2}/i);
      const asOn = asOnMatch ? asOnMatch[0] : '';

      const qib = parseFloat(cleanText(tds[2])) || 0;
      const snii = parseFloat(cleanText(tds[3])) || 0;
      const bnii = parseFloat(cleanText(tds[4])) || 0;
      const nii = parseFloat(cleanText(tds[5])) || 0;
      const retail = parseFloat(cleanText(tds[6])) || 0;

      subMap.set(slug, {
        rawName,
        total,
        qib,
        snii,
        bnii,
        nii,
        retail,
        asOn
      });
    }
  }
  console.log('Parsed subscriptions count:', subMap.size);

  // 2. Parse GMP Catalog
  const ipos = [];
  const gmpTbody = gmpHtml.match(/<tbody[\s\S]*?<\/tbody>/i);
  if (gmpTbody) {
    const trs = [...gmpTbody[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)];
    let idCounter = 1;
    for (const tr of trs) {
      const tds = [...tr[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1]);
      if (tds.length < 11) continue;

      const nameCell = tds[0];
      const linkMatch = nameCell.match(/<a[^>]*href=['"]([^'"]*)['"][^>]*>([\s\S]*?)<\/a>/i);
      const companyName = linkMatch ? cleanText(linkMatch[2]) : cleanText(nameCell);
      if (!companyName || companyName === 'Name') continue;

      // Category detection: SME vs MAINBOARD
      const isSme = /sme/i.test(nameCell);
      const category = isSme ? 'SME' : 'MAINBOARD';
      const badge = category;

      // Status detection:
      // O = OPEN, U = UPCOMING, C = CLOSED, L@450 (65.44%) = LISTED
      let status = 'UPCOMING';
      let listingPrice = null;
      let listingGainPct = null;

      const statusBadgeMatch = nameCell.match(/class=['"][^'"]*badge[^'"]*['"][^>]*>([A-Za-z0-9@. ()%+-]+)<\/span>/gi);
      const statusText = statusBadgeMatch ? statusBadgeMatch.map(b => cleanText(b)).join(' ') : '';
      
      const listedMatch = nameCell.match(/L@\s*([0-9.]+)\s*\(([0-9.+%-]+)\)/i);
      if (listedMatch) {
        status = 'LISTED';
        listingPrice = parseFloat(listedMatch[1]) || null;
        listingGainPct = parseFloat(listedMatch[2]) || null;
      } else if (/\bO\b/.test(statusText)) {
        status = 'OPEN';
      } else if (/\bC\b/.test(statusText)) {
        status = 'CLOSED';
      } else if (/\bU\b/.test(statusText)) {
        status = 'UPCOMING';
      }

      // GMP Parsing (TD 1)
      const gmpCell = cleanText(tds[1]);
      const gmpValMatch = gmpCell.match(/₹?\s*(-?[0-9.]+)/);
      const gmp = gmpValMatch ? parseFloat(gmpValMatch[1]) : 0;
      const gmpPctMatch = gmpCell.match(/\((-?[0-9.]+)%\)/);
      const gmpPct = gmpPctMatch ? parseFloat(gmpPctMatch[1]) : 0;

      // Price Band (TD 4)
      const priceRaw = cleanText(tds[4]).replace(/,/g, '');
      let minPrice = null;
      let maxPrice = null;
      const priceRangeMatch = priceRaw.match(/([0-9.]+)\s*[-–to ]+\s*([0-9.]+)/i);
      if (priceRangeMatch) {
        minPrice = parseFloat(priceRangeMatch[1]);
        maxPrice = parseFloat(priceRangeMatch[2]);
      } else {
        const singlePriceMatch = priceRaw.match(/([0-9.]+)/);
        if (singlePriceMatch) {
          minPrice = parseFloat(singlePriceMatch[1]);
          maxPrice = minPrice;
        }
      }
      const priceBand = (minPrice && maxPrice && minPrice !== maxPrice)
        ? `₹${minPrice} – ₹${maxPrice}`
        : (maxPrice ? `₹${maxPrice}` : 'Announced Soon');

      // Issue Size (Cr) (TD 5)
      const sizeRaw = cleanText(tds[5]);
      const sizeMatch = sizeRaw.match(/([0-9.]+)\s*Cr/i);
      const issueSizeCr = sizeMatch ? parseFloat(sizeMatch[1]) : null;

      // Lot Size (TD 6)
      const lotRaw = cleanText(tds[6]).replace(/,/g, '');
      const lotSize = parseInt(lotRaw, 10) || 1;

      // Dates: Open (TD 7), Close (TD 8), BoA (TD 9), Listing (TD 10)
      const openDate = cleanText(tds[7]) || 'Announced Soon';
      const closeDate = cleanText(tds[8]) || 'Announced Soon';
      const allotmentDate = cleanText(tds[9]) || 'Announced Soon';
      const listingDate = cleanText(tds[10]) || 'Announced Soon';

      // Last updated in table (TD 11)
      const asOn = cleanText(tds[11]);

      // Connect subscription
      const slug = normalizeSlug(companyName);
      let sub = { qib: 0, snii: 0, bnii: 0, nii: 0, retail: 0, total: 0 };
      let applications = 0;
      if (subMap.has(slug)) {
        const s = subMap.get(slug);
        sub = {
          qib: s.qib,
          snii: s.snii,
          bnii: s.bnii,
          nii: s.nii,
          retail: s.retail,
          total: s.total
        };
      }

      // Default Registrar logic
      const registrar = 'Link Intime / KFintech';
      const registrarUrl = 'https://linkintime.co.in/initial_offer/public-issues.html';

      const minInvestment = (maxPrice || minPrice || 100) * lotSize;
      const estListingPrice = listingPrice || ((maxPrice || minPrice || 0) + gmp);
      const estLotProfit = status === 'LISTED' && listingPrice && maxPrice
        ? (listingPrice - maxPrice) * lotSize
        : gmp * lotSize;

      const retailSub = sub.retail || 0;
      const retailAllotmentOddsPct = retailSub <= 0
        ? 100
        : (retailSub <= 1 ? 100 : Number(Math.max(0.15, (100 / retailSub)).toFixed(2)));

      ipos.push({
        id: idCounter++,
        name: companyName,
        badge,
        category,
        status,
        priceBand,
        minPrice,
        maxPrice,
        issuePrice: maxPrice,
        lotSize,
        issueSizeCr,
        openDate,
        closeDate,
        closingDateDisplay: closeDate,
        allotmentDate,
        listingDate,
        listingPrice,
        listingGainPct,
        gmp,
        gmpPct,
        subscription: sub,
        applications,
        asOn,
        registrar,
        registrarUrl,
        minInvestment,
        estListingPrice,
        estLotProfit,
        retailAllotmentOddsPct
      });
    }
  }

  console.log('Parsed total IPOs:', ipos.length);
  console.log('Sample Open:', ipos.filter(i => i.status === 'OPEN').slice(0, 3));
  console.log('Sample Listed:', ipos.filter(i => i.status === 'LISTED').slice(0, 3));
  console.log('Sample Upcoming:', ipos.filter(i => i.status === 'UPCOMING').slice(0, 3));
}

testSync().catch(console.error);
