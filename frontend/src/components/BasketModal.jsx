import React, { useState } from 'react';
import { useStore } from '../store';
import { X, Trash2, ShoppingBag } from 'lucide-react';

export default function BasketModal() {
  const { 
    basketModalOpen, setBasketModalOpen, 
    basketItems, removeFromBasket, updateBasketItem, placeBasketOrder, 
    prices, user, restrictedStocks 
  } = useStore();

  const [productType, setProductType] = useState('INT');
  const [showCautionPopup, setShowCautionPopup] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!basketModalOpen) return null;

  const balanceNum = Number(user?.balance) || 0;

  // Enhance basket items with live price and calculated individual margin
  const enhancedItems = basketItems.map(item => {
    const symbol = item.symbol;
    const livePrice = symbol ? prices[symbol]?.ltp || 0 : 0;
    
    // Parse strike
    let optionStrike = 0;
    const isOption = symbol.includes('CE') || symbol.includes('PE');
    if (isOption) {
      const robustMatch = symbol.match(/[A-Z]{3}\d{2}(\d+)(CE|PE)$/i);
      if (robustMatch) {
        optionStrike = parseFloat(robustMatch[1]);
      } else {
        const strikeMatch = symbol.match(/(\d+)(CE|PE)$/i);
        if (strikeMatch) {
           let rawStrikeStr = strikeMatch[1];
           if (rawStrikeStr.length > 5) rawStrikeStr = rawStrikeStr.substring(rawStrikeStr.length - 5);
           optionStrike = parseFloat(rawStrikeStr);
        }
      }
    }

    const typeStr = symbol.includes('CE') ? 'CE' : (symbol.includes('PE') ? 'PE' : 'OTHER');
    const totalQuantity = item.quantity * (item.lotsize || 1);
    
    return {
      ...item,
      livePrice,
      optionStrike,
      isOption,
      typeStr,
      totalQuantity
    };
  });

  // Calculate Margin with Hedging Benefit
  let requiredMargin = 0;

  // Separate legs
  const buys = enhancedItems.filter(item => item.side === 'BUY');
  const sells = enhancedItems.filter(item => item.side === 'SELL');

  let totalPremiumPaid = 0;
  let unhedgedSells = [...sells];
  let hedgedMargin = 0;

  buys.forEach(buy => {
    const premium = buy.totalQuantity * (buy.orderType === 'MARKET' ? buy.livePrice : parseFloat(buy.price || 0));
    totalPremiumPaid += premium;

    // Try to pair with a sell of the SAME TYPE (CE with CE, PE with PE)
    if (buy.isOption && buy.optionStrike > 0) {
      const pairIndex = unhedgedSells.findIndex(sell => sell.isOption && sell.typeStr === buy.typeStr && sell.optionStrike > 0);
      if (pairIndex !== -1) {
        const sell = unhedgedSells[pairIndex];
        // Calculate max loss for the spread
        const strikeDiff = Math.abs(sell.optionStrike - buy.optionStrike);
        // We use min quantity to hedge
        const hedgedQty = Math.min(buy.totalQuantity, sell.totalQuantity);
        
        hedgedMargin += strikeDiff * hedgedQty;
        
        // Remove from unhedged list
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
  
  // Intraday leverage for non-options buys
  buys.forEach(buy => {
    if (!buy.isOption && productType === 'INT') {
      const premium = buy.totalQuantity * (buy.orderType === 'MARKET' ? buy.livePrice : parseFloat(buy.price || 0));
      finalMargin -= premium;
      finalMargin += premium * 0.25;
    }
  });

  const isInsufficient = balanceNum < finalMargin;

  // Check restrictions and cutoff
  const isTimeBlocked = enhancedItems.some(item => {
    if (['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON'].some(c => item.symbol.startsWith(c))) return false;
    const istTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    return (hours > 15 || (hours === 15 && minutes >= 15));
  });

  const isAnyRestricted = enhancedItems.some(item => restrictedStocks.includes(item.symbol));
  const isIntradayBlocked = (isAnyRestricted || isTimeBlocked) && productType === 'INT';

  const handleExecute = async () => {
    if (basketItems.length === 0) return;
    if (isIntradayBlocked) return;
    if (isAnyRestricted && !showCautionPopup) {
       setShowCautionPopup(true);
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
    if (!success) {
      alert("Failed to place basket orders. Please try again.");
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        width: '600px', background: 'var(--bg-dark)', borderRadius: '8px', 
        border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column', maxHeight: '80vh'
      }}>
        
        {/* Header */}
        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingBag size={20} color="var(--color-blue)" />
            <h2 style={{ fontSize: '16px', fontWeight: '800' }}>Basket Order ({basketItems.length})</h2>
          </div>
          <button onClick={() => setBasketModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {/* Product Type Selection */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Product Type:</span>
          <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
            <div onClick={() => setProductType('INT')} style={{ width: '60px', textAlign: 'center', padding: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', background: productType === 'INT' ? 'rgba(34, 197, 94, 0.1)' : 'transparent', color: productType === 'INT' ? 'var(--color-green-light)' : 'var(--text-primary)' }}>INT</div>
            <div onClick={() => setProductType('DEL')} style={{ width: '60px', textAlign: 'center', padding: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', background: productType === 'DEL' ? 'rgba(34, 197, 94, 0.1)' : 'transparent', color: productType === 'DEL' ? 'var(--color-green-light)' : 'var(--text-primary)' }}>DEL</div>
          </div>
        </div>

        {/* Item List */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          {basketItems.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0' }}>Your basket is empty.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {enhancedItems.map((item, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', padding: '12px', background: 'var(--bg-panel)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ width: '8px', height: '40px', background: item.side === 'BUY' ? 'var(--color-blue)' : 'var(--color-red)', borderRadius: '4px', marginRight: '12px' }}></div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>{item.symbol}</div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <span style={{ color: item.side === 'BUY' ? 'var(--color-blue)' : 'var(--color-red)' }}>{item.side}</span>
                      <span>•</span>
                      <span>Qty: {item.quantity} {item.lotsize > 1 ? `x ${item.lotsize}` : ''}</span>
                    </div>
                  </div>

                  <div style={{ width: '120px', display: 'flex', flexDirection: 'column', gap: '4px', marginRight: '16px' }}>
                    <select 
                      value={item.orderType} 
                      onChange={(e) => updateBasketItem(index, { orderType: e.target.value })}
                      style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', padding: '4px', borderRadius: '4px', fontSize: '12px', width: '100%', outline: 'none' }}
                    >
                      <option value="MARKET">Market</option>
                      <option value="LIMIT">Limit</option>
                    </select>
                    {item.orderType === 'LIMIT' && (
                      <input 
                        type="number" 
                        value={item.price} 
                        onChange={(e) => updateBasketItem(index, { price: e.target.value })}
                        style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', padding: '4px', borderRadius: '4px', fontSize: '12px', width: '100%', outline: 'none' }}
                      />
                    )}
                  </div>

                  <div style={{ textAlign: 'right', width: '80px', marginRight: '16px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>LTP</div>
                    <div style={{ fontSize: '13px', fontWeight: '600' }}>₹{item.livePrice.toFixed(2)}</div>
                  </div>

                  <button onClick={() => removeFromBasket(index)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px 20px', borderTop: '1px solid var(--border-color)' }}>
           {isInsufficient && basketItems.length > 0 && (
            <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '8px 12px', borderRadius: '4px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'var(--color-yellow)', color: '#000', width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>!</div>
              <div style={{ fontSize: '12px', color: '#fef08a' }}>Insufficient margin! Shortfall: ₹{(finalMargin - balanceNum).toFixed(2)}</div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '32px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Available Balance</div>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>₹{balanceNum.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-blue)', marginBottom: '4px' }}>Combined Margin</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-blue)' }}>₹{finalMargin.toFixed(2)}</div>
              </div>
            </div>
            <button 
              onClick={handleExecute}
              disabled={isInsufficient || isIntradayBlocked || isSubmitting || basketItems.length === 0}
              style={{ 
                background: (isInsufficient || isIntradayBlocked || basketItems.length === 0) ? 'var(--bg-panel)' : 'var(--color-blue)', 
                color: (isInsufficient || isIntradayBlocked || basketItems.length === 0) ? 'var(--text-secondary)' : '#fff', 
                padding: '12px 24px', borderRadius: '4px', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px',
                border: 'none', cursor: (isInsufficient || isIntradayBlocked || basketItems.length === 0) ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease'
              }}
            >
              {isSubmitting ? 'EXECUTING...' : 'EXECUTE BASKET'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
