const fs = require('fs');
const b64 = fs.readFileSync('frontend/public/skandx-logo.png').toString('base64');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <image href="data:image/png;base64,${b64}" width="512" height="512" />
</svg>
`;
fs.writeFileSync('frontend/public/favicon.svg', svg);
if (fs.existsSync('frontend/android/app/src/main/assets/public/favicon.svg')) {
  fs.writeFileSync('frontend/android/app/src/main/assets/public/favicon.svg', svg);
}
console.log('favicon.svg updated with official logo');
