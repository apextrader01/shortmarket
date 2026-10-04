// frontend/src/utils/seoEngine.js
// 🚀 Dynamic Google Search SEO, Canonical URL & JSON-LD Rich Snippet Engine

export const SEO_ROUTES = {
  '/': {
    title: "SkandX | India's #1 Real-Time Paper Trading, Financial Calculators & Algo Terminal",
    description: 'Practice NSE, BSE & MCX Options, Futures & Equity paper trading with ₹10,00,000 virtual capital. Includes SIP, Loan EMI, MTF, Brokerage calculators, Wealth OS & Tax Hub, and SkandX Algo Bridge.',
    keywords: 'paper trading india, virtual trading nse, sip calculator, reducing loan emi calculator, algo trading india, option chain simulator, skandx',
    category: 'FinanceApplication'
  },
  '/paper-trading': {
    title: 'Free Paper Trading India — Live NSE, BSE & MCX Options & Futures Simulator | SkandX',
    description: 'Trade NSE Nifty, BankNifty Options, Futures, Stocks & MCX Commodities risk-free with ₹10,00,000 virtual capital and real-time WebSocket ticks on SkandX.',
    keywords: 'paper trading india, free option trading simulator, nifty paper trading app, virtual stock trading india, live option chain paper trade',
    category: 'FinanceApplication'
  },
  '/markets': {
    title: 'Live NSE/BSE Markets & Paper Trading Terminal | SkandX',
    description: 'Real-time NSE, BSE & MCX paper trading terminal with ₹10L virtual capital, option chain Greeks, bracket orders, and instant execution.',
    keywords: 'live paper trading terminal, nse virtual trading, nifty option paper trading, skandx markets',
    category: 'FinanceApplication'
  },
  '/calculators': {
    title: 'Financial Calculators Suite — SIP, Loan EMI, MTF, Brokerage & Options Greeks | SkandX',
    description: 'Free institutional financial calculators: SIP & Step-Up Calculator, Reducing & Fixed Interest Loan EMI, MTF 4x Leverage, Stock Average Price, Mutual Funds, NSE Brokerage & Black-Scholes Greeks with PDF & Excel download.',
    keywords: 'financial calculators india, sip calculator, loan emi calculator, reducing interest loan calculator, fixed interest loan calculator, mtf calculator, brokerage calculator',
    category: 'FinanceApplication'
  },
  '/calculators/sip': {
    title: 'SIP Calculator & Step-Up SIP Wealth Compounder (With PDF & Excel Schedule) | SkandX',
    description: 'Calculate mutual fund SIP returns with annual Step-Up %. View year-by-year compounding schedule, invested vs wealth gained chart, and download PDF or Excel reports.',
    keywords: 'sip calculator, step up sip calculator, mutual fund return calculator, monthly sip calculator india, sip excel download',
    category: 'FinanceApplication'
  },
  '/calculators/lumpsum': {
    title: 'Lumpsum Investment Calculator — Compounding & CAGR Growth Table | SkandX',
    description: 'Calculate one-time lumpsum mutual fund and equity returns with year-by-year compounding tables, interactive charts, and instant PDF/Excel export.',
    keywords: 'lumpsum calculator, mutual fund lumpsum return calculator, compound interest calculator india, cagr calculator',
    category: 'FinanceApplication'
  },
  '/calculators/reducing-loan': {
    title: 'Reducing Balance Loan EMI Calculator — Home, Car & Personal Loan Amortization | SkandX',
    description: 'Calculate monthly EMI for Home Loan, Car Loan, and Personal Loan using the reducing balance interest method. View year-by-year principal vs interest amortization table and download PDF/Excel.',
    keywords: 'reducing balance loan calculator, home loan emi calculator, car loan emi calculator, loan amortization schedule excel, reducing interest rate calculator',
    category: 'FinanceApplication'
  },
  '/calculators/fixed-loan': {
    title: 'Fixed / Flat Interest Rate Loan Calculator — Flat vs Effective Reducing Rate | SkandX',
    description: 'Calculate Flat / Fixed interest rate loan EMI, total interest outgo, and compare equivalent reducing balance APR with year-by-year repayment schedule in PDF & Excel.',
    keywords: 'flat interest rate calculator, fixed rate loan emi calculator, flat vs reducing interest calculator, commercial loan calculator',
    category: 'FinanceApplication'
  },
  '/calculators/average-price': {
    title: 'Stock Average Share Price Calculator — Multi-Tranche Equity Averaging | SkandX',
    description: 'Calculate weighted average buy price across multiple stock tranches, target breakeven price, and required shares to average down on NSE/BSE stocks.',
    keywords: 'stock average calculator, share price averaging calculator, average down stock calculator india, equity average price calculator',
    category: 'FinanceApplication'
  },
  '/calculators/mtf': {
    title: 'MTF Calculator (Margin Trading Facility 4x Leverage & Holding Interest) | SkandX',
    description: 'Calculate Margin Trading Facility (MTF) 4x leverage funding, daily interest cost, statutory charges, net ROI, and breakeven stock price.',
    keywords: 'mtf calculator, margin trading facility calculator, pay later stock interest calculator, 4x leverage equity calculator',
    category: 'FinanceApplication'
  },
  '/calculators/mutual-funds': {
    title: 'Mutual Fund Returns & Direct vs Regular Plan Commission Calculator | SkandX',
    description: 'Compare Direct vs Regular mutual fund expense ratios and calculate how much commission you save over 5 to 30 years with year-by-year compounding tables.',
    keywords: 'direct vs regular mutual fund calculator, mutual fund expense ratio calculator, mutual fund return calculator india',
    category: 'FinanceApplication'
  },
  '/calculators/brokerage': {
    title: 'NSE/BSE Brokerage, STT & Regulatory Tax Calculator (Oct 2024 Mandate) | SkandX',
    description: 'Calculate exact STT, Exchange Transaction Charges, SEBI Turnover Fees, Stamp Duty, GST, Breakeven points, and Net P&L for Intraday, Delivery, Futures & Options.',
    keywords: 'brokerage calculator india, f&o stt calculator, option trading tax calculator, intraday breakeven calculator',
    category: 'FinanceApplication'
  },
  '/calculators/position-sizing': {
    title: 'Position Sizing & Stop-Loss Risk Management Calculator | SkandX',
    description: 'Calculate exact share or F&O lot quantity based on account capital, risk percentage per trade, entry price, and stop-loss distance.',
    keywords: 'position size calculator india, risk reward calculator, stop loss quantity calculator, trading risk calculator',
    category: 'FinanceApplication'
  },
  '/calculators/black-scholes': {
    title: 'Black-Scholes Option Pricing & Greeks Calculator (Delta, Gamma, Theta, Vega) | SkandX',
    description: 'Institutional Black-Scholes Call & Put option pricing calculator with live Delta, Gamma, Theta, Vega, Rho Greeks and Strike Sensitivity Matrix.',
    keywords: 'black scholes calculator, option greeks calculator, delta theta vega calculator, nifty option pricing calculator',
    category: 'FinanceApplication'
  },
  '/wealth-hub': {
    title: 'Wealth OS & Tax Hub — Net Worth, 50/30/20 Budget, HLV Insurance & FY25 Tax Harvesting | SkandX',
    description: '360° Personal Finance & Tax Command Center: Multi-asset Net Worth tracker, 50/30/20 Budget Leak Detector, Actuarial Term/Health HLV Gap, and FY25 STCG 20% / LTCG 12.5% Tax-Loss Harvesting.',
    keywords: 'wealth management calculator india, tax loss harvesting calculator india, stcg ltcg tax calculator fy25, human life value insurance calculator, 50 30 20 budget calculator',
    category: 'FinanceApplication'
  },
  '/algo': {
    title: 'SkandX Algo — Multi-Broker Demat Bridge, TradingView Webhooks & Copy Trading | SkandX',
    description: 'Automate NSE/BSE/MCX trading with TradingView JSON Webhooks, Dedicated Static IPs, Pre-Built Options Strategy Templates, and Multi-Broker Demat API execution.',
    keywords: 'algo trading india, tradingview webhook bridge india, multi broker copy trading, nifty straddle algo, skandx algo',
    category: 'FinanceApplication'
  },
  '/algo-trading': {
    title: 'Algo Trading India — TradingView Webhook Bridge & Multi-Broker Execution | SkandX',
    description: 'Connect Zerodha, Fyers, AngelOne, Dhan & Upstox with TradingView alerts, static IP compliance, and 1-click algorithmic strategy templates.',
    keywords: 'algo trading india, tradingview to broker bridge, automated option trading india, static ip algo trading',
    category: 'FinanceApplication'
  },
  '/primary-markets': {
    title: 'NSE Bhavcopy Delivery Screener (>60%), Bulk Deals & Live IPO GMP Hub | SkandX',
    description: 'Screen daily NSE/BSE high-delivery institutional accumulation stocks, 2x+ volume surges, Bulk/Block deals, and track Mainboard & SME IPO GMP & allotment.',
    keywords: 'nse bhavcopy delivery screener, high delivery percentage stocks nse, bulk block deals india, live ipo gmp today',
    category: 'FinanceApplication'
  },
  '/trade-diary': {
    title: '8-Pillar Institutional Trade Diary, Discipline Checklist & AI Trading Journal | SkandX',
    description: 'Track trading win rate, profit factor, strategy performance, emotional mistakes, pre-trade checklists, and AI-powered journal analytics.',
    keywords: 'trading journal india, trade diary app, option trading journal, trading checklist and discipline tracker',
    category: 'FinanceApplication'
  }
};

export function applyDynamicSEO(pathname = '/') {
  if (typeof document === 'undefined') return;

  const cleanPath = (pathname || '/').toLowerCase().replace(/\/+$/, '') || '/';
  const seo = SEO_ROUTES[cleanPath] || SEO_ROUTES['/'];
  const canonicalUrl = `https://skandx.in${cleanPath === '/' ? '' : cleanPath}`;

  // 1. Update Document Title
  document.title = seo.title;

  // 2. Helper to upsert meta tags
  const setMeta = (selector, attrName, attrVal, contentVal) => {
    let el = document.querySelector(selector);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrName, attrVal);
      document.head.appendChild(el);
    }
    el.setAttribute('content', contentVal);
  };

  setMeta('meta[name="description"]', 'name', 'description', seo.description);
  setMeta('meta[name="keywords"]', 'name', 'keywords', seo.keywords);
  setMeta('meta[property="og:title"]', 'property', 'og:title', seo.title);
  setMeta('meta[property="og:description"]', 'property', 'og:description', seo.description);
  setMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
  setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', seo.title);
  setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', seo.description);

  // 3. Canonical Link
  let canonicalEl = document.querySelector('link[rel="canonical"]');
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.setAttribute('href', canonicalUrl);

  // 4. Inject Dynamic JSON-LD Structured Data for Google Search Rich Snippets
  let scriptEl = document.getElementById('skandx-dynamic-jsonld');
  if (!scriptEl) {
    scriptEl = document.createElement('script');
    scriptEl.id = 'skandx-dynamic-jsonld';
    scriptEl.type = 'application/ld+json';
    document.head.appendChild(scriptEl);
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: seo.title.split('|')[0].trim(),
        operatingSystem: 'Web, Android, iOS, Windows, macOS',
        applicationCategory: seo.category || 'FinanceApplication',
        url: canonicalUrl,
        description: seo.description,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'INR'
        },
        publisher: {
          '@type': 'Organization',
          name: 'SkandX',
          url: 'https://skandx.in'
        }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'SkandX Home',
            item: 'https://skandx.in'
          },
          ...(cleanPath !== '/' ? [{
            '@type': 'ListItem',
            position: 2,
            name: seo.title.split('—')[0].split('|')[0].trim(),
            item: canonicalUrl
          }] : [])
        ]
      }
    ]
  };

  scriptEl.textContent = JSON.stringify(jsonLd);
}
