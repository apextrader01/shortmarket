const fs = require('fs');

let code = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// Find the useEffect block
const useEffectRegex = /\s*useEffect\(\(\) => \{\s*document\.documentElement\.setAttribute\('data-theme', theme\);\s*\}, \[theme\]\);/g;

// Remove it from its current location
code = code.replace(useEffectRegex, '');

// Find the if (!user) block
const ifUserIndex = code.indexOf('if (!user) {');

if (ifUserIndex !== -1) {
    // Insert the useEffect right before it
    const newUseEffect = `
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  `;
    code = code.slice(0, ifUserIndex) + newUseEffect + code.slice(ifUserIndex);
} else {
    console.log("Could not find if (!user) block!");
}

fs.writeFileSync('frontend/src/App.jsx', code, 'utf8');
console.log("Done");
