const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/PositionsView.jsx', 'utf8');

// 1. Remove `prices: state.prices` from useStore
code = code.replace(/prices: state\.prices\s*/g, '');
code = code.replace(/, prices \} = useStore/, ' } = useStore');
code = code.replace(/prices: state\.prices,?\s*/g, '');

// 2. Remove prices from useMemo dependencies
code = code.replace(/, prices\]\);/g, ']);');

// 3. Remove PNL calculation from useMemo
// Inside useMemo, it maps over symbolAgg. We need to strip out the ltp fetching and pnl math.
code = code.replace(/const ltp = prices\[pos\.symbol\]\?\.ltp \|\| 0;/g, 'const ltp = 0;');
code = code.replace(/const pnl = .*?;/s, 'const pnl = 0;');
code = code.replace(/globalMTM \+= .*?;/s, '');

// 4. Create the TotalMtmBadge component at the top
const badgeCode = `
const TotalMtmBadge = React.memo(({ sourceData, viewMode }) => {
  const prices = useStore(state => state.prices);
  
  let globalMTM = 0;
  const symbolAgg = {};
  
  sourceData.forEach(pos => {
    const posQty = Number(pos.quantity) || 0;
    const isOpen = posQty !== 0;
    if (viewMode === 'OPEN' && !isOpen) return;
    if (viewMode === 'CLOSED' && isOpen) return;
    
    const key = \`\${pos.symbol}-\${pos.product_type}\`;
    if (!symbolAgg[key]) { symbolAgg[key] = { ...pos, encumberedQty: 0, unencumberedQty: 0 }; }
    const agg = symbolAgg[key];
    
    if (agg.id !== pos.id) {
       agg.realized_pnl = (parseFloat(agg.realized_pnl) || 0) + (parseFloat(pos.realized_pnl) || 0);
       if (isOpen) {
         const currentTotal = Math.abs(Number(agg.quantity)) * parseFloat(agg.average_price || 0);
         const newTotal = Math.abs(posQty) * parseFloat(pos.average_price || 0);
         agg.quantity = Number(agg.quantity) + posQty;
         agg.average_price = Math.abs(agg.quantity) > 0 ? (currentTotal + newTotal) / Math.abs(agg.quantity) : agg.average_price;
       }
    }
  });

  Object.values(symbolAgg).forEach(pos => {
    const qty = Number(pos.quantity);
    const avg = parseFloat(pos.average_price);
    const ltp = prices[pos.symbol]?.ltp || 0;
    const invested = avg * Math.abs(qty);
    const currentValue = ltp * Math.abs(qty);
    const pnl = (qty !== 0) 
        ? (qty > 0 ? (currentValue - invested) : (invested - currentValue))
        : parseFloat(pos.realized_pnl || 0);
    
    if (viewMode === 'OPEN') globalMTM += pnl;
    if (viewMode === 'CLOSED') globalMTM += parseFloat(pos.realized_pnl || 0);
    if (viewMode === 'HOLDINGS') globalMTM += pnl;
  });

  const isGlobalProfit = globalMTM >= 0;
  return (
    <div style={{ padding: '2px 8px', borderRadius: '4px', background: isGlobalProfit ? 'rgba(38,166,154,0.1)' : 'rgba(239,83,80,0.1)', color: isGlobalProfit ? 'var(--color-green)' : 'var(--color-red)' }}>
      {globalMTM.toFixed(2)}
    </div>
  );
});
`;
code = code.replace("export default function PositionsView() {", badgeCode + "\nexport default function PositionsView() {");

// 5. Replace where globalMTM is rendered
code = code.replace(/<span style=\{\{ color: globalMTM >= 0 \? 'var\(--color-green\)' : 'var\(--color-red\)', fontWeight: 'bold' \}\}>.*?<\/span>/s, '<TotalMtmBadge sourceData={sourceData} viewMode={viewMode} />');

fs.writeFileSync('frontend/src/components/PositionsView.new.jsx', code);
console.log('Script ran successfully');
