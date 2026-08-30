const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/MutualFundDetailsModal.jsx', 'utf8');

const newLogic = `
        if (investType === 'MONTHLY_SIP' || investType === 'WEEKLY_SIP' || investType === 'DAILY_SIP') {
            let periodsPerYear = 12;
            if (investType === 'WEEKLY_SIP') periodsPerYear = 52;
            if (investType === 'DAILY_SIP') periodsPerYear = 250; // standard approx trading days

            const n = investmentYears * periodsPerYear;
            const i = rate / periodsPerYear;

            invested = amt * n;
            wealth = amt * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
        } else {
`;

code = code.replace(
    /if \(investType === 'MONTHLY_SIP' \|\| investType === 'WEEKLY_SIP' \|\| investType === 'DAILY_SIP'\) \{\s*invested = amt \* months;\s*const monthlyRate = rate \/ 12;\s*wealth = amt \* \(\(Math\.pow\(1 \+ monthlyRate, months\) - 1\) \/ monthlyRate\) \* \(1 \+ monthlyRate\);\s*\} else \{/,
    newLogic
);

fs.writeFileSync('frontend/src/components/MutualFundDetailsModal.jsx', code, 'utf8');
console.log('Patched calculation logic');
