const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/ReferralsView.jsx', 'utf8');
code = code.replace('IndianRupee,', '');
code = code.replace('<IndianRupee size={20} color="#34D399" />', '<span style={{color: "#34D399", fontSize: "20px", fontWeight: "bold"}}>?</span>');
fs.writeFileSync('frontend/src/components/ReferralsView.jsx', code);
