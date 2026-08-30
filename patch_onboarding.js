const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/OnboardingWizard.jsx', 'utf8');

code = code.replace(
    '// On success, the store will update and App.jsx will automatically unmount this component.',
    'else { skipOnboarding(); } // Force local state to bypass modal permanently on success'
);

fs.writeFileSync('frontend/src/components/OnboardingWizard.jsx', code, 'utf8');
console.log('Patched OnboardingWizard');
