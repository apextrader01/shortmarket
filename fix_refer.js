const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/ClientDataView.jsx', 'utf8');

// The card currently looks something like: <Card icon={Users} title="Refer & Earn" desc="Refer a friend to join Short Edge & get rewarded '500" color="#34D399" />
// Or it has handleReferralCopy. Let's just find "Refer & Earn" and replace the whole tag.
const oldCardRegex = /<Card\s+icon=\{Users\}\s+title="Refer & Earn"[^>]+>/;
code = code.replace(oldCardRegex, '<Card icon={Users} title="Refer & Earn" desc="Refer a friend to join Short Edge & get rewarded ?500" color="#34D399" onClick={() => setShowReferralModal(true)} />');

// Fix ? marks
code = code.replace(/Refer & Earn \?500/g, 'Refer & Earn ?500');
code = code.replace(/get \?500 directly/g, 'get ?500 directly');

fs.writeFileSync('frontend/src/components/ClientDataView.jsx', code);
