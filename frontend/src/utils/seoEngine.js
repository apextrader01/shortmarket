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
  },
  '/trading-journal': {
    title: 'Trading Journal & Execution Analytics — Track Win Rate & Profit Factor | SkandX',
    description: 'Analyze every paper and live trade with institutional performance metrics, behavioral tags, and strategy breakdowns on SkandX.',
    keywords: 'trading journal india, stock trading log, f&o trading journal, skandx journal',
    category: 'FinanceApplication'
  },
  '/bhavcopy': {
    title: 'NSE/BSE Daily Bhavcopy Delivery Screener (>60% Delivery & Volume Surge) | SkandX',
    description: 'Analyze daily NSE and BSE Bhavcopy delivery percentages, institutional volume breakouts, and bulk/block deal accumulation.',
    keywords: 'nse bhavcopy screener, high delivery stocks nse today, bulk deals nse, skandx bhavcopy',
    category: 'FinanceApplication'
  },
  '/ipo': {
    title: 'Live IPO GMP Today, Mainboard & SME IPO Subscription & Allotment Hub | SkandX',
    description: 'Track upcoming and open Mainboard & SME IPOs, Grey Market Premium (GMP), retail/QIB subscription numbers, and listing gains.',
    keywords: 'live ipo gmp today, upcoming ipo india, sme ipo gmp, ipo subscription status',
    category: 'FinanceApplication'
  },
  '/tax-hub': {
    title: 'Trader Tax Hub — FY25 STCG 20% / LTCG 12.5% & F&O Tax Harvesting | SkandX',
    description: 'Calculate Indian capital gains taxes (STCG 20%, LTCG 12.5%), F&O business income tax, and actionable tax-loss harvesting opportunities.',
    keywords: 'stcg ltcg tax calculator india, tax loss harvesting india, f&o tax calculator, skandx tax hub',
    category: 'FinanceApplication'
  },
  '/wealth': {
    title: 'Wealth OS & Tax Hub — Net Worth, 50/30/20 Budget, HLV Insurance & FY25 Tax Harvesting | SkandX',
    description: '360° Personal Finance & Tax Command Center: Multi-asset Net Worth tracker, 50/30/20 Budget Leak Detector, Actuarial Term/Health HLV Gap, and FY25 STCG 20% / LTCG 12.5% Tax-Loss Harvesting.',
    keywords: 'wealth management calculator india, tax loss harvesting calculator india, stcg ltcg tax calculator fy25, human life value insurance calculator',
    category: 'FinanceApplication'
  },
  '/community': {
    title: 'Trader Community Hub, Trading Clubs & Market Ideas | SkandX',
    description: 'Join trading clubs, share live chart setups, Bullish/Bearish trade ideas, and discuss NSE/BSE/MCX market action with Indian traders on SkandX Community.',
    keywords: 'indian stock market community, trading clubs india, nifty option trading ideas, trader social network india, skandx community',
    category: 'FinanceApplication'
  },
  '/clubs': {
    title: 'Trading Clubs & Strategy Rooms — Join Indian Market Communities | SkandX',
    description: 'Discover and join specialized Indian trading clubs for Nifty Options, Intraday Equity, Swing Trading, Algo Strategies, and Price Action on SkandX.',
    keywords: 'trading clubs india, stock market groups india, option trading community, skandx clubs',
    category: 'FinanceApplication'
  },
  '/feed': {
    title: 'Live Trader Feed — Chart Setups, Market Ideas & PnL Snapshots | SkandX',
    description: 'Real-time feed of chart setups, trade ideas, and market discussions from verified paper and algo traders on SkandX.',
    keywords: 'trader feed india, live chart setups nse, stock market ideas today, skandx feed',
    category: 'FinanceApplication'
  },
  '/pricing': {
    title: 'Subscription Plans & Pricing — Free Paper Trading & Pro Algo Terminal | SkandX',
    description: 'Transparent pricing for SkandX Paper Trading, Financial Calculators, Wealth OS, and Multi-Broker Algo Trading Bridge.',
    keywords: 'skandx pricing, paper trading subscription india, algo trading plans india',
    category: 'FinanceApplication'
  },
  '/aboutus': {
    title: 'About SkandX — Mission, Architecture & Regulatory Disclosures | SkandX',
    description: 'Learn about SkandX Technologies, our institutional paper trading and algorithmic execution platform, policies, and regulatory disclosures.',
    keywords: 'about skandx, skandx technologies, paper trading platform india',
    category: 'FinanceApplication'
  },
  '/about': {
    title: 'About SkandX — Mission, Architecture & Regulatory Disclosures | SkandX',
    description: 'Learn about SkandX Technologies, our institutional paper trading and algorithmic execution platform, policies, and regulatory disclosures.',
    keywords: 'about skandx, skandx technologies, paper trading platform india',
    category: 'FinanceApplication'
  },
  '/login': {
    title: 'Login to SkandX Terminal — Paper Trading, Wealth OS & Algo Bridge | SkandX',
    description: 'Sign in to your SkandX account to access real-time NSE/BSE/MCX paper trading, ₹10,00,000 virtual capital, and algorithmic trading tools.',
    keywords: 'skandx login, paper trading login, skandx terminal sign in',
    category: 'FinanceApplication'
  },
  '/register': {
    title: 'Create Free Account — Get ₹10,00,000 Virtual Capital on SkandX | SkandX',
    description: 'Register for a free SkandX account and start practicing NSE, BSE & MCX Options, Futures & Equity trading with ₹10L virtual funds.',
    keywords: 'skandx register, free paper trading account india, virtual trading sign up',
    category: 'FinanceApplication'
  },
  '/privacy-policy': {
    title: 'Privacy Policy & DPDP Act 2023 Data Protection Notice | SkandX',
    description: 'Official Privacy Notice and Data Protection Policy of SkandX Technologies under the Digital Personal Data Protection Act, 2023 (DPDP Act).',
    keywords: 'skandx privacy policy, dpdp act 2023 compliance, data protection officer skandx',
    category: 'FinanceApplication'
  },
  '/privacy': {
    title: 'Privacy Policy & DPDP Act 2023 Data Protection Notice | SkandX',
    description: 'Official Privacy Notice and Data Protection Policy of SkandX Technologies under the Digital Personal Data Protection Act, 2023 (DPDP Act).',
    keywords: 'skandx privacy policy, dpdp act 2023 compliance, data protection officer skandx',
    category: 'FinanceApplication'
  },
  '/terms': {
    title: 'Terms of Service & Platform Usage Agreement | SkandX',
    description: 'Terms and Conditions governing the use of the SkandX web trading terminal, mobile applications, financial calculators, and APIs.',
    keywords: 'skandx terms of service, terms and conditions skandx',
    category: 'FinanceApplication'
  },
  '/risk-policy': {
    title: 'Risk Disclosure Document — SEBI & Derivative Risk Warning | SkandX',
    description: 'Mandatory Risk Disclosure Document for Equity, Futures & Options derivative simulation and algorithmic trading tools on SkandX.',
    keywords: 'skandx risk disclosure, sebi f&o risk warning, derivative risk policy',
    category: 'FinanceApplication'
  },
  '/risk': {
    title: 'Risk Disclosure Document — SEBI & Derivative Risk Warning | SkandX',
    description: 'Mandatory Risk Disclosure Document for Equity, Futures & Options derivative simulation and algorithmic trading tools on SkandX.',
    keywords: 'skandx risk disclosure, sebi f&o risk warning, derivative risk policy',
    category: 'FinanceApplication'
  },
  '/delete-account': {
    title: 'Request Account Deletion & Data Purge | SkandX',
    description: 'Submit an official account deletion and personal data erasure request for your SkandX account in compliance with Google Play and DPDP Act 2023 policies.',
    keywords: 'delete skandx account, account deletion request skandx, data erasure request',
    category: 'FinanceApplication'
  },
  '/delete': {
    title: 'Request Account Deletion & Data Purge | SkandX',
    description: 'Submit an official account deletion and personal data erasure request for your SkandX account in compliance with Google Play and DPDP Act 2023 policies.',
    keywords: 'delete skandx account, account deletion request skandx, data erasure request',
    category: 'FinanceApplication'
  },
  '/data-rights': {
    title: 'Data Principal Rights Portal (DPDP Act, 2023) | SkandX',
    description: 'Exercise your statutory rights to access, export, correct, or erase personal data under the Digital Personal Data Protection Act, 2023.',
    keywords: 'data principal rights dpdp, export personal data skandx, right to erasure india',
    category: 'FinanceApplication'
  },
  '/accessibility': {
    title: 'Accessibility Statement & Digital Inclusion Policy (WCAG 2.1 AA) | SkandX',
    description: 'SkandX Accessibility Statement detailing WCAG 2.1 Level AA compliance, keyboard execution hotkeys, high-contrast OLED themes, and screen reader support.',
    keywords: 'skandx accessibility statement, wcag 2.1 trading terminal, keyboard shortcuts skandx',
    category: 'FinanceApplication'
  }
};

export function applyDynamicSEO(pathname = '/') {
  if (typeof document === 'undefined') return;

  const cleanPath = (pathname || '/').toLowerCase().replace(/\/+$/, '') || '/';
  const matchedSeo = SEO_ROUTES[cleanPath];
  const seo = matchedSeo || SEO_ROUTES['/'];
  const canonicalUrl = cleanPath === '/' ? 'https://skandx.in/' : `https://skandx.in${cleanPath}`;

  // 1. Update Document Title only if this route has an explicit SEO entry
  if (matchedSeo) {
    document.title = matchedSeo.title;
  }

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
          url: 'https://skandx.in',
          email: 'skandx.in@gmail.com',
          telephone: '+919497861379',
          address: {
            '@type': 'PostalAddress',
            streetAddress: 'SkandX',
            addressLocality: 'Trivandrum',
            addressRegion: 'Kerala',
            addressCountry: 'IN'
          }
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
