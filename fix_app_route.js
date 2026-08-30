const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// 1. Add import
if (!code.includes('import ReferralsView')) {
    code = code.replace(/import PricingView from '.\/components\/PricingView';/, "import PricingView from './components/PricingView';\nimport ReferralsView from './components/ReferralsView';");
}

// 2. Add route
if (!code.includes("activeTab === 'Referrals'")) {
    const route = `{activeTab === 'Referrals' && <ReferralsView setActiveTab={setActiveTab} />}`;
    code = code.replace(/\{activeTab === 'Pricing' && \(/, route + "\n            {activeTab === 'Pricing' && (");
}

fs.writeFileSync('frontend/src/App.jsx', code);
