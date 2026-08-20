const fs = require('fs');

const oldContent = fs.readFileSync('old_positions.jsx', 'utf8');
const curContent = fs.readFileSync('frontend/src/components/PositionsView.jsx', 'utf8');

const tableStartIdx = oldContent.indexOf('<div className="glass-panel"');
let tableEndIdx = oldContent.indexOf('</table>', tableStartIdx);
tableEndIdx = oldContent.indexOf('</div>', tableEndIdx) + 6;
tableEndIdx = oldContent.indexOf('</div>', tableEndIdx) + 6;
const tableHtml = oldContent.substring(tableStartIdx, tableEndIdx);

const cardsStartIdx = curContent.indexOf('<div style={{ display: \'grid\'');
let endCardsIdx = curContent.indexOf(')}', curContent.indexOf(')', curContent.indexOf('          })}'))); // find end of map
endCardsIdx = curContent.indexOf('</div>', endCardsIdx) + 6;

// The issue before was that `cardsHtml` included `)}\n\n` because I extracted up to the closing `div`.
// Wait, `endCardsIdx` is precisely the end of `</div>` of the grid.
// Let's just extract the exact cards wrapper:
const cardsHtml = curContent.substring(cardsStartIdx, endCardsIdx);

// The `before` and `after` logic:
// `before` should be everything up to `cardsStartIdx`.
const before = curContent.substring(0, cardsStartIdx);

// `after` should be everything starting FROM `)}` that closes the ternary.
// Let's find the closing `)}` right after `cardsHtml`.
let afterIdx = curContent.indexOf(')}', endCardsIdx);
const after = curContent.substring(afterIdx); // This starts with `)}\n\n      {/* Global MTM Banner */}`

const newContent = before + `<>
          <div className="desktop-view">
            ` + tableHtml.replace(/\r\n/g, '\n') + `
          </div>
          <div className="mobile-view">
            ` + cardsHtml.replace(/\r\n/g, '\n') + `
          </div>
        </>
      ` + after;

fs.writeFileSync('frontend/src/components/PositionsView.jsx', newContent);
console.log("Merged correctly.");
