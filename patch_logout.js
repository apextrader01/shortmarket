const fs = require('fs');
let code = fs.readFileSync('frontend/src/store.js', 'utf8');

code = code.replace(
    'localStorage.removeItem(\'token\');',
    'localStorage.removeItem(\'token\');\n    localStorage.removeItem(\'hasSkippedOnboarding\');\n    set({ hasSkippedOnboarding: false });'
);

fs.writeFileSync('frontend/src/store.js', code, 'utf8');
console.log('Patched logout in store.js');
