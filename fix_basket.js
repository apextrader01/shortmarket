const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/BasketModal.jsx', 'utf8');

// Strip out prices from the main hook
code = code.replace(/prices: state\.prices,?\s*/g, '');
code = code.replace(/, prices \} = useStore/, ' } = useStore');
code = code.replace(/prices,/g, '');

const liveFooterCode = `
const LiveBasketFooter = React.memo(({ basketItems, productType, placeBasketOrder, setBasketModalOpen, balanceNum }) => {
  const prices = useStore(state => state.prices);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const enhancedItems = basketItems.map(item => {
    const symbol = item.symbol;
    const livePrice = symbol ? prices[symbol]?.ltp || 0 : 0;
    
    let optionStrike = 0;
    const isOption = symbol.includes('CE') || symbol.includes('PE');
    if (isOption) {
      const robustMatch = symbol.match(/[A-Z]{3}\\d{2}(\\d+)(CE|PE)$/i);
      if (robustMatch) {
        optionStrike = parseFloat(robustMatch[1]);
      } else {
        const strikeMatch = symbol.match(/(\\d+)(CE|PE)$/i);
        if (strikeMatch) {
           let rawStrikeStr = strikeMatch[1];
           if (rawStrikeStr.length > 5) rawStrikeStr = rawStrikeStr.substring(rawStrikeStr.length - 5);
           optionStrike = parseFloat(rawStrikeStr);
        }
      }
    }
    const typeStr = symbol.includes('CE') ? 'CE' : (symbol.includes('PE') ? 'PE' : 'OTHER');
    const totalQuantity = item.quantity * (item.lotsize || 1);
    return { ...item, livePrice, optionStrike, isOption, typeStr, totalQuantity };
  });

  let requiredMargin = 0;
  const buys = enhancedItems.filter(item => item.side === 'BUY');
  const sells = enhancedItems.filter(item => item.side === 'SELL');
  let totalPremiumPaid = 0;
  let unhedgedSells = [...sells];
  let hedgedMargin = 0;

  buys.forEach(buy => {
    const premium = buy.totalQuantity * (buy.orderType === 'MARKET' ? buy.livePrice : parseFloat(buy.price || 0));
    totalPremiumPaid += premium;
    if (buy.isOption && buy.optionStrike > 0) {
      const pairIndex = unhedgedSells.findIndex(sell => sell.isOption && sell.typeStr === buy.typeStr && sell.optionStrike > 0);
      if (pairIndex !== -1) {
        const sell = unhedgedSells[pairIndex];
        const strikeDiff = Math.abs(sell.optionStrike - buy.optionStrike);
        const hedgedQty = Math.min(buy.totalQuantity, sell.totalQuantity);
        hedgedMargin += strikeDiff * hedgedQty;
        unhedgedSells.splice(pairIndex, 1);
      }
    }
  });

  unhedgedSells.forEach(sell => {
    const isIndex = ['NIFTY', 'BANKNIFTY', 'SENSEX', 'FINNIFTY', 'MIDCPNIFTY'].some(idx => sell.symbol.includes(idx));
    let baseMargin = 0;
    const premium = sell.totalQuantity * (sell.orderType === 'MARKET' ? sell.livePrice : parseFloat(sell.price || 0));

    if (sell.isOption) {
      const marginRate = isIndex ? 0.10 : 0.20; 
      if (sell.optionStrike > 0) {
        const grossMargin = sell.optionStrike * sell.totalQuantity * marginRate;
        baseMargin = Math.max(grossMargin - premium, 0); 
      } else {
        baseMargin = sell.totalQuantity * (isIndex ? 4000 : 8000);
      }
    } else if (sell.symbol.includes('FUT')) {
      const marginRate = isIndex ? 0.10 : 0.15;
      baseMargin = sell.totalQuantity * (sell.orderType === 'MARKET' ? sell.livePrice : parseFloat(sell.price || 0)) * marginRate;
    } else {
      baseMargin = sell.totalQuantity * (sell.orderType === 'MARKET' ? sell.livePrice : parseFloat(sell.price || 0));
    }
    const leverageMultiplier = (productType === 'INT' && !sell.isOption) ? 0.25 : 1.0;
    requiredMargin += (baseMargin * leverageMultiplier);
  });

  let finalMargin = hedgedMargin + requiredMargin + totalPremiumPaid;
  if (basketItems.length === 0) finalMargin = 0;

  const handleExecute = async () => {
    if (basketItems.length === 0) return;
    if (balanceNum < finalMargin) {
      alert(\`Insufficient balance. You need '\${finalMargin.toFixed(2)} to place these orders.\`);
      return;
    }
    setIsSubmitting(true);
    const payload = {
      total_margin: finalMargin,
      items: enhancedItems.map(item => ({
        symbol: item.symbol,
        type: item.orderType,
        side: item.side,
        quantity: item.totalQuantity,
        price: item.orderType === 'MARKET' ? item.livePrice : parseFloat(item.price),
        product_type: productType,
        margin: 0
      }))
    };
    const success = await placeBasketOrder(payload);
    setIsSubmitting(false);
    if (!success) alert("Failed to place basket orders. Please try again.");
    else setBasketModalOpen(false);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Required Margin (approx)</div>
        <div style={{ fontSize: '18px', fontWeight: '800', color: balanceNum >= finalMargin ? 'var(--text-primary)' : 'var(--color-red-light)' }}>
          '{finalMargin.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </div>
      </div>
      <button 
        disabled={basketItems.length === 0 || isSubmitting}
        onClick={handleExecute}
        style={{
          background: basketItems.length === 0 ? 'var(--bg-hover)' : 'var(--color-blue)',
          color: basketItems.length === 0 ? 'var(--text-muted)' : '#fff',
          border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: '700', cursor: basketItems.length === 0 ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.2s'
        }}
      >
        {isSubmitting ? <span className="spinner" style={{ width: '16px', height: '16px' }}></span> : <ShoppingBag size={18} />}
        {isSubmitting ? 'Executing...' : 'Place Orders'}
      </button>
    </div>
  );
});
`;

code = code.replace("export default function BasketModal() {", liveFooterCode + "\nexport default function BasketModal() {");

const blockStart = `  const enhancedItems = basketItems.map(item => {`;
const blockEnd = `  if (basketItems.length === 0) finalMargin = 0;`;

const bS = code.indexOf(blockStart);
const bE = code.indexOf(blockEnd) + blockEnd.length;
if(bS > -1 && bE > bS) {
  code = code.slice(0, bS) + code.slice(bE);
}

// Remove handleExecute function from main body
const heStart = `  const handleExecute = async () => {`;
const heEnd = `    }
  };`;
const hS = code.indexOf(heStart);
const hE = code.indexOf(heEnd) + heEnd.length;
if(hS > -1 && hE > hS) {
  code = code.slice(0, hS) + code.slice(hE);
}

// Replace footer rendering
const footerRegex = /<div style=\{\{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba\(255,255,255,0\.05\)' \}\}>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*\)\s*;\s*}/;
code = code.replace(footerRegex, '<LiveBasketFooter basketItems={basketItems} productType={productType} placeBasketOrder={placeBasketOrder} setBasketModalOpen={setBasketModalOpen} balanceNum={balanceNum} />\n      </div>\n    </div>\n  );\n}');

fs.writeFileSync('frontend/src/components/BasketModal.jsx', code);
console.log('Fixed BasketModal');
