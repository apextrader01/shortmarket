
const fs = require('fs');
let css = fs.readFileSync('frontend/src/index.css', 'utf8');

const newLightMode = \[data-theme='light'] {
  --color-green-light: #16a34a;
  --color-red-light: #dc2626;
  --bg-primary: #FFFFFF;
  --bg-secondary: #FFFFFF;
  --bg-panel: #FFFFFF;
  --text-primary: #0F172A;
  --text-secondary: #475569;
  --border-color: #E2E8F0;
  --border-highlight: #CBD5E1;
  --bg-dark: #F8FAFC;
  --bg-hover: #F1F5F9;
}\;

const newSystemLightMode = \@media (prefers-color-scheme: light) {
  [data-theme='system'] {
    --bg-primary: #FFFFFF;
    --bg-secondary: #FFFFFF;
    --bg-panel: #FFFFFF;
    --text-primary: #0F172A;
    --text-secondary: #475569;
    --border-color: #E2E8F0;
    --border-highlight: #CBD5E1;
    --bg-dark: #F8FAFC;
    --bg-hover: #F1F5F9;
  }
}\;

css = css.replace(/\[data-theme='light'\] \{[\s\S]*?\}/, newLightMode);
css = css.replace(/@media \(prefers-color-scheme: light\) \{[\s\S]*?\[data-theme='system'\] \{[\s\S]*?\}[\s\S]*?\}/, newSystemLightMode);

fs.writeFileSync('frontend/src/index.css', css);
console.log('Done');

