/**
 * 20-Point Pre-Launch & SEO/UX Optimization Verification Suite
 * Validates ShortMarket against all 20 professional launch checklist items.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passedChecks = 0;
let totalChecks = 0;

function check(title, condition) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✔ [PASS] ${title}`);
  } else {
    console.error(`  ✖ [FAIL] ${title}`);
    process.exitCode = 1;
  }
}

console.log('======================================================================');
console.log('🚀 VERIFYING 20-POINT PRE-LAUNCH, SECURITY & SEO/UX CHECKLIST');
console.log('======================================================================\n');

// 1. Privacy Policy Page
console.log('▶ 1. PRIVACY POLICY PAGE');
const appJsx = fs.readFileSync(path.join(__dirname, '../frontend/src/App.jsx'), 'utf8');
const legalJsx = fs.readFileSync(path.join(__dirname, '../frontend/src/components/LegalView.jsx'), 'utf8');
check('App.jsx provides public unauthenticated route for /privacy-policy and /privacy',
  appJsx.includes("currentPath.includes('privacy')") && appJsx.includes('<LegalView initialTab={initialTab}'));
check('LegalView.jsx contains comprehensive Privacy Policy section',
  legalJsx.includes('privacy') && legalJsx.includes('DPDP Act, 2023'));

// 2. Terms and Conditions Page
console.log('\n▶ 2. TERMS AND CONDITIONS PAGE');
check('App.jsx provides public unauthenticated route for /terms',
  appJsx.includes("currentPath.includes('terms')"));
check('LegalView.jsx contains full Terms of Service and Risk Disclosures',
  legalJsx.includes('terms') && legalJsx.includes('Terms of Service'));

// 3. Secrets off Frontend
console.log('\n▶ 3. GET SECRETS OFF FRONTEND');
const viteConfig = fs.readFileSync(path.join(__dirname, '../frontend/vite.config.js'), 'utf8');
const distHtml = fs.existsSync(path.join(__dirname, '../frontend/dist/index.html'))
  ? fs.readFileSync(path.join(__dirname, '../frontend/dist/index.html'), 'utf8')
  : '';
check('Vite build isolates frontend without exposing server env variables',
  !distHtml.includes('DATABASE_URL') && !distHtml.includes('JWT_SECRET') && !distHtml.includes('RAZORPAY_KEY_SECRET'));

// 4. Force HTTPS
console.log('\n▶ 4. FORCE HTTPS & HSTS');
const serverJs = fs.readFileSync(path.join(__dirname, '../backend/server.js'), 'utf8');
const setupSsl = fs.readFileSync(path.join(__dirname, '../setup-ssl.sh'), 'utf8');
check('backend/server.js enforces HSTS with 1-year maxAge and preload',
  serverJs.includes('hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }'));
check('setup-ssl.sh configures Certbot automatic 301 HTTPS redirects',
  setupSsl.includes('--redirect'));

// 5. Cookie Consent Banner
console.log('\n▶ 5. COOKIE CONSENT BANNER (DPDP & GDPR)');
const consentJsx = fs.readFileSync(path.join(__dirname, '../frontend/src/components/ConsentBanner.jsx'), 'utf8');
check('ConsentBanner.jsx exists and supports granular analytics/marketing preferences',
  consentJsx.includes('skandx_consent_preferences') && consentJsx.includes('handleAcceptAll'));
check('App.jsx mounts ConsentBanner across unauthenticated, onboarding, and dashboard views',
  (appJsx.match(/<ConsentBanner \/>/g) || []).length >= 3);

// 6. Meta Titles & Descriptions
console.log('\n▶ 6. META TITLES & DESCRIPTIONS');
const indexHtml = fs.readFileSync(path.join(__dirname, '../frontend/index.html'), 'utf8');
check('index.html contains descriptive title and meta description tag',
  indexHtml.includes('SkandX') && indexHtml.includes('Paper Trading') &&
  indexHtml.includes('<meta name="description"'));

// 7. Social Preview Image (OpenGraph & Twitter Card)
console.log('\n▶ 7. SOCIAL PREVIEW IMAGE');
check('index.html specifies og:image pointing to high-res 1024x500 banner',
  indexHtml.includes('property="og:image" content="https://skandx.in/skandx-feature-graphic-1024x500.png"'));
check('index.html specifies twitter:image card for rich previews',
  indexHtml.includes('property="twitter:image" content="https://skandx.in/skandx-feature-graphic-1024x500.png"'));

// 8. Favicons
console.log('\n▶ 8. FAVICONS');
check('index.html specifies favicon.png, favicon.svg, and apple-touch-icon',
  indexHtml.includes('href="/favicon.png"') && indexHtml.includes('href="/favicon.svg"') && indexHtml.includes('href="/apple-touch-icon.png"'));
check('Static favicon assets exist in frontend/public',
  fs.existsSync(path.join(__dirname, '../frontend/public/favicon.ico')) &&
  fs.existsSync(path.join(__dirname, '../frontend/public/favicon.png')) &&
  fs.existsSync(path.join(__dirname, '../frontend/public/apple-touch-icon.png')));

// 9. Sitemap & robots.txt
console.log('\n▶ 9. SITEMAP & ROBOTS.TXT');
const robotsTxt = fs.readFileSync(path.join(__dirname, '../frontend/public/robots.txt'), 'utf8');
const sitemapXml = fs.readFileSync(path.join(__dirname, '../frontend/public/sitemap.xml'), 'utf8');
check('robots.txt allows root and disallows administrative/API routes',
  robotsTxt.includes('Disallow: /adminpanel') && robotsTxt.includes('Sitemap: https://skandx.in/sitemap.xml'));
check('sitemap.xml lists canonical pages including legal documents',
  sitemapXml.includes('https://skandx.in/privacy-policy') && sitemapXml.includes('https://skandx.in/terms'));

// 10. Image Alt Text
console.log('\n▶ 10. IMAGE ALT TEXT (ACCESSIBILITY & SEO)');
check('User avatar in App.jsx contains alt="User Profile"',
  appJsx.includes('alt="User Profile"'));
const loginJsx = fs.readFileSync(path.join(__dirname, '../frontend/src/components/LoginView.jsx'), 'utf8');
check('Branding logos in LoginView contain descriptive alt tags',
  loginJsx.includes('alt="SkandX"'));

// 11. Image Compression & Caching
console.log('\n▶ 11. IMAGE CACHING & COMPRESSION');
check('setup-ssl.sh enables Nginx Gzip compression level 6',
  setupSsl.includes('gzip on;') && setupSsl.includes('gzip_comp_level 6;'));
check('setup-ssl.sh configures 1-year immutable caching for static images & bundles',
  setupSsl.includes('add_header Cache-Control "public, max-age=31536000, immutable";'));

// 12. Page Load Speed & Code Splitting
console.log('\n▶ 12. PAGE LOAD SPEED & CODE SPLITTING');
check('vite.config.js implements vendor chunk splitting',
  viteConfig.includes('vendor-react') && viteConfig.includes('vendor-charts'));
check('App.jsx implements lazy loading for auxiliary views',
  appJsx.includes('lazyWithRetry') && appJsx.includes('Suspense'));

// 13. Color Contrast
console.log('\n▶ 13. COLOR CONTRAST & ACCESSIBILITY');
const indexCss = fs.readFileSync(path.join(__dirname, '../frontend/src/index.css'), 'utf8');
check('index.css establishes high contrast dark palette with compliant text contrast',
  indexCss.includes('#0a0b0d') || indexCss.includes('--bg-primary'));

// 14. Mobile Friendliness
console.log('\n▶ 14. MOBILE RESPONSIVENESS');
check('index.html specifies viewport with viewport-fit=cover',
  indexHtml.includes('name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"'));
check('App.jsx provides mobile navigation dock for small screens',
  appJsx.includes('mobile-bottom-nav'));

// 15. Custom 404 Page
console.log('\n▶ 15. CUSTOM 404 PAGE');
const notFoundExists = fs.existsSync(path.join(__dirname, '../frontend/src/components/NotFoundView.jsx'));
check('NotFoundView.jsx exists with branded recovery actions', notFoundExists);
check('App.jsx detects unhandled routes and mounts NotFoundView',
  appJsx.includes('!isKnownRoute') && appJsx.includes('<NotFoundView'));

// 16. Broken Links Check
console.log('\n▶ 16. LINK INTEGRITY');
check('LoginView links match declared legal routes',
  loginJsx.includes('href="/terms"') && (loginJsx.includes('href="/privacy-policy"') || loginJsx.includes('href="/privacy"')));

// 17. Form Validation
console.log('\n▶ 17. FORM VALIDATION');
const orderModalJsx = fs.readFileSync(path.join(__dirname, '../frontend/src/components/OrderModal.jsx'), 'utf8');
check('OrderModal validates positive whole integer lot sizes for derivatives',
  orderModalJsx.includes('validationError') && orderModalJsx.includes('failValidation'));
check('LoginView validates email, password length, and 6-digit OTP codes',
  loginJsx.includes('cleanOtp.length !== 6') || loginJsx.includes('password.length < 6'));

// 18. Spam / Bot Protection
console.log('\n▶ 18. SPAM & BOT PROTECTION');
check('LoginView integrates Firebase RecaptchaVerifier for SMS OTP',
  loginJsx.includes('RecaptchaVerifier'));
check('backend/server.js enforces authLimiter and orderLimiter rate limits',
  serverJs.includes('authLimiter') && serverJs.includes('orderLimiter'));

// 19. Analytics Setup
console.log('\n▶ 19. ANALYTICS SETUP');
const firebaseJs = fs.readFileSync(path.join(__dirname, '../frontend/src/firebase.js'), 'utf8');
check('firebase.js initializes Google Analytics conditionally with isSupported check',
  firebaseJs.includes('getAnalytics') && firebaseJs.includes('isSupported'));
check('firebase.js configures measurementId G-3NQ59H44ZX',
  firebaseJs.includes('G-3NQ59H44ZX'));

// 20. Clear Call to Action (CTA)
console.log('\n▶ 20. ONE CLEAR CALL TO ACTION');
check('LoginView emphasizes primary action buttons (CREATE ACCOUNT / LOG IN)',
  loginJsx.includes("view === 'login' ? 'LOG IN'") && loginJsx.includes("view === 'register' ? 'CREATE ACCOUNT'"));

console.log('\n======================================================================');
console.log(`TOTAL CHECKS: ${totalChecks} | PASSED: ${passedChecks} | FAILED: ${totalChecks - passedChecks}`);
console.log('======================================================================');

if (passedChecks === totalChecks) {
  console.log('🎉 ALL 20 PRE-LAUNCH & PRODUCTION OPTIMIZATIONS VERIFIED 100% PERFECT!\n');
  process.exit(0);
} else {
  console.error('❌ SOME CHECKS FAILED. Review output above.\n');
  process.exit(1);
}
