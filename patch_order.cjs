const fs = require('fs');
let file = 'frontend/src/components/OrderModal.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove prices from useShallow
content = content.replace('prices: state.prices, ', '');
content = content.replace('prices, ', '');

// 2. Add specific price selector right after useShallow
const shallowRegex = /useStore\(useShallow.*?\)\)\);/;
const shallowMatch = content.match(shallowRegex);

if (shallowMatch) {
  const insertPos = shallowMatch.index + shallowMatch[0].length;
  const before = content.substring(0, insertPos);
  const after = content.substring(insertPos);
  
  const inject = `\n  const livePriceData = useStore(state => state.prices[orderModal?.symbol]);`;
  content = before + inject + after;
  
  // 3. Replace prices[symbol] with livePriceData
  content = content.replace(/prices\[symbol\]/g, 'livePriceData');
  
  fs.writeFileSync(file, content);
  console.log('OrderModal decoupled successfully!');
} else {
  console.log('Could not find useShallow in OrderModal');
}
