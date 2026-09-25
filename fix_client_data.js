const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/ClientDataView.jsx', 'utf8');

// 1. Change onClick to setActiveTab('Referrals')
code = code.replace(/<Card icon=\{Users\} title="Refer & Earn" desc="Refer a friend to join Short Edge & get rewarded ?500" color="#34D399" onClick=\{[^}]+\} \/>/, '<Card icon={Users} title="Refer & Earn" desc="Refer a friend & get 10% of their subscription" color="#34D399" onClick={() => setActiveTab(\'Referrals\')} />');

// 2. Remove the modal
const modalStart = code.indexOf('{/* Referral Modal */}');
const modalEnd = code.indexOf(')}', modalStart) + 2; // Rough approximation. Wait, let's just strip everything from {/* Referral Modal */} to the final `</div>`
if (modalStart !== -1) {
    // Better strategy using regex:
    code = code.replace(/\{\/\* Referral Modal \*\/\}.*?Done<\/button>\s*<\/div>\s*<\/div>\s*\)\}/s, "");
}

// 3. Remove showReferralModal state
code = code.replace(/const \[showReferralModal, setShowReferralModal\] = useState\(false\);\s*const refLink =[^;]+;/, "");

fs.writeFileSync('frontend/src/components/ClientDataView.jsx', code);
