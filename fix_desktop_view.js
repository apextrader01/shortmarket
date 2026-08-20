const fs = require('fs');
const { execSync } = require('child_process');

// The commit before the card layout was added is 'bc4d7d7' (latest), '916f881' (cards added). So we want the one before 916f881.
// Let's get the file contents from 916f881^
const oldFileContent = execSync('git show 916f881^:frontend/src/components/PositionsView.jsx', { encoding: 'utf8' });

let curFile = fs.readFileSync('frontend/src/components/PositionsView.jsx', 'utf8');

const tableStartIdx = oldFileContent.indexOf('<div className="glass-panel"');
let tableEndIdx = oldFileContent.indexOf('</table>', tableStartIdx);
tableEndIdx = oldFileContent.indexOf('</div>', tableEndIdx) + 6;
tableEndIdx = oldFileContent.indexOf('</div>', tableEndIdx) + 6;
const tableHtml = oldFileContent.substring(tableStartIdx, tableEndIdx);

if (!tableHtml || tableHtml.indexOf('table') === -1) {
    console.error("Failed to extract table HTML properly!");
    process.exit(1);
}

// Now replace the corrupt desktop-view block in curFile
const desktopViewStart = curFile.indexOf('<div className="desktop-view">');
const desktopViewEnd = curFile.indexOf('</div>', desktopViewStart) + 6;

const before = curFile.substring(0, desktopViewStart);
const after = curFile.substring(desktopViewEnd);

const newContent = before + `<div className="desktop-view">
            ${tableHtml.replace(/\r\n/g, '\n').replace(/\n/g, '\n            ')}
          </div>` + after;

fs.writeFileSync('frontend/src/components/PositionsView.jsx', newContent);
console.log("Desktop table restored successfully!");
