const fs = require('fs');

const oldFile = fs.readFileSync('old_positions.jsx', 'utf8');
let curFile = fs.readFileSync('frontend/src/components/PositionsView.jsx', 'utf8');

const tableStartIdx = oldFile.indexOf('<div className="glass-panel"');
let tableEndIdx = oldFile.indexOf('</table>', tableStartIdx);
tableEndIdx = oldFile.indexOf('</div>', tableEndIdx) + 6;
tableEndIdx = oldFile.indexOf('</div>', tableEndIdx) + 6;
const tableHtml = oldFile.substring(tableStartIdx, tableEndIdx);

const desktopViewStart = curFile.indexOf('<div className="desktop-view">');
let desktopViewEnd = curFile.indexOf('</div>', desktopViewStart);
if (curFile.substring(desktopViewStart, desktopViewEnd).includes('i m')) {
    desktopViewEnd += 6;
}

const before = curFile.substring(0, desktopViewStart);
const after = curFile.substring(desktopViewEnd);

const newContent = before + `<div className="desktop-view">
            ${tableHtml.replace(/\r\n/g, '\n').replace(/\n/g, '\n            ')}
          </div>` + after;

fs.writeFileSync('frontend/src/components/PositionsView.jsx', newContent);
console.log("Replaced perfectly.");
