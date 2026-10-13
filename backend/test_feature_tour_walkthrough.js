// backend/test_feature_tour_walkthrough.js
// Verification script for Interactive Feature Introduction Tour & Onboarding

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('======================================================================');
console.log('🔬 VERIFICATION: INTERACTIVE FEATURE INTRODUCTION TOUR & REGISTRATION');
console.log('======================================================================\n');

// 1. Verify FeatureTourModal.jsx
const tourModalPath = path.join(__dirname, '../frontend/src/components/FeatureTourModal.jsx');
assert(fs.existsSync(tourModalPath), 'FeatureTourModal.jsx must exist');
const tourModalCode = fs.readFileSync(tourModalPath, 'utf8');

assert(tourModalCode.includes('TOUR_STEPS'), 'FeatureTourModal must define TOUR_STEPS array');
assert(tourModalCode.includes('Multi-Market Live Trading Terminal'), 'Must introduce Hub 01 Trading Terminal');
assert(tourModalCode.includes('Automated Trade Diary & Gemini AI Coach'), 'Must introduce Hub 02 Trade Diary');
assert(tourModalCode.includes('SkandX Algo & Multi-Broker Bridge'), 'Must introduce Hub 03 Algo Bridge');
assert(tourModalCode.includes('15+ Institutional Financial Engines'), 'Must introduce Hub 04 Financial Calculators');
assert(tourModalCode.includes('Wealth OS & Union Budget 2025 Tax Hub'), 'Must introduce Hub 05 Wealth OS');
assert(tourModalCode.includes('Primary Markets, IPOs & Trader Clubs'), 'Must introduce Hub 06 Primary Markets & Community');

assert(tourModalCode.includes('handleNext'), 'Must have handleNext button handler');
assert(tourModalCode.includes('handlePrev'), 'Must have handlePrev back handler');
assert(tourModalCode.includes('handleDismiss'), 'Must have handleDismiss skip/finish handler');
assert(tourModalCode.includes('Skip Tour'), 'Must render Skip Tour button');
assert(tourModalCode.includes('skandx_feature_tour_completed'), 'Must persist tour completion in localStorage');
assert(tourModalCode.includes('ArrowRight') && tourModalCode.includes('Escape'), 'Must support keyboard navigation');
console.log('✔ [PASS] Module 1: FeatureTourModal component with 6 hubs, Next, Back, Skip, & Keyboard nav');

// 2. Verify LandingHomeView.jsx integration
const landingPath = path.join(__dirname, '../frontend/src/components/LandingHomeView.jsx');
const landingCode = fs.readFileSync(landingPath, 'utf8');
assert(landingCode.includes('import FeatureTourModal from \'./FeatureTourModal\''), 'LandingHomeView must import FeatureTourModal');
assert(landingCode.includes('showTour') && landingCode.includes('setShowTour'), 'LandingHomeView must have showTour state');
assert(landingCode.includes('skandx_new_registration'), 'LandingHomeView must check for new registration flag');
assert(landingCode.includes('Feature Tour'), 'LandingHomeView must render Feature Tour button in navbar');
assert(landingCode.includes('<FeatureTourModal'), 'LandingHomeView must render FeatureTourModal component');
console.log('✔ [PASS] Module 2: LandingHomeView mounts tour, auto-triggers on registration & provides header button');

// 3. Verify App.jsx unblocked Home routing
const appPath = path.join(__dirname, '../frontend/src/App.jsx');
const appCode = fs.readFileSync(appPath, 'utf8');
assert(appCode.includes("activeTab !== 'Home'"), 'App.jsx must not block Home tab with OnboardingWizard');
console.log('✔ [PASS] Module 3: App.jsx allows newly registered users to land on Home / Landing page unblocked');

// 4. Verify OnboardingWizard.jsx Skip option
const wizardPath = path.join(__dirname, '../frontend/src/components/OnboardingWizard.jsx');
const wizardCode = fs.readFileSync(wizardPath, 'utf8');
assert(wizardCode.includes('Skip for now'), 'OnboardingWizard must provide Skip for now button in header');
assert(wizardCode.includes('Skip setup'), 'OnboardingWizard must provide Skip setup button in step 1 footer');
console.log('✔ [PASS] Module 4: OnboardingWizard provides clear skip options so users are never trapped');

// 5. Verify LoginView.jsx and store.js flags
const loginPath = path.join(__dirname, '../frontend/src/components/LoginView.jsx');
const loginCode = fs.readFileSync(loginPath, 'utf8');
assert(loginCode.includes("localStorage.setItem('skandx_show_feature_tour', 'true')"), 'LoginView must flag show feature tour on registration');
assert(loginCode.includes("localStorage.setItem('skandx_new_registration', 'true')"), 'LoginView must flag new registration on signup');

const storePath = path.join(__dirname, '../frontend/src/store.js');
const storeCode = fs.readFileSync(storePath, 'utf8');
assert(storeCode.includes("localStorage.setItem('skandx_show_feature_tour', 'true')"), 'store.js must flag tour on register success');
console.log('✔ [PASS] Module 5: Registration handlers set feature tour flags on new account creation');

// 6. Verify server.js is_new_user flag
const serverPath = path.join(__dirname, '../backend/server.js');
const serverCode = fs.readFileSync(serverPath, 'utf8');
assert(serverCode.includes('is_new_user: isNewUser'), 'server.js must return is_new_user in google-login');
console.log('✔ [PASS] Module 6: Backend google-login returns is_new_user indicator');

console.log('\n======================================================================');
console.log('🏁 ALL FEATURE TOUR VERIFICATION CHECKS PASSED (6/6)');
console.log('======================================================================\n');
