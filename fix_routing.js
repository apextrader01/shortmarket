const fs = require('fs');
let content = fs.readFileSync('frontend/src/App.jsx', 'utf8');

const regex = /useEffect\(\(\) => \{\s*if \(activeTab\) \{\s*const newPath = \\/\$\{activeTab\.toLowerCase\(\)\}\;\s*if \(window\.location\.pathname !== newPath\) \{\s*window\.history\.pushState\(null, '', newPath\);\s*\}\s*\}\s*\}, \[activeTab\]\);/;

const replacement = useEffect(() => {
    if (activeTab) {
      let newPath = \/\\;
      if (activeTab === 'Portfolio' && typeof portfolioSubTab !== 'undefined') {
        newPath = \/portfolio/\\;
      }
      if (window.location.pathname !== newPath) {
        window.history.pushState(null, '', newPath);
      }
    }
  }, [activeTab, typeof portfolioSubTab !== 'undefined' ? portfolioSubTab : null]);;

content = content.replace(regex, replacement);
fs.writeFileSync('frontend/src/App.jsx', content, 'utf8');
console.log('Successfully updated App.jsx routing!');
