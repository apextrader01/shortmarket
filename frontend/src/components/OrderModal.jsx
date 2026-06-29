import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { X, Maximize2, Info } from 'lucide-react';

export default function OrderModal() {
  const { orderModal, closeOrderModal, prices, user, restrictedStocks } = useStore();
  const [orderType, setOrderType] = useState('LIMIT'); // LIMIT, MARKET
  const [productType, setProductType] = useState('INT'); // INT, DEL
  const [tab, setTab] = useState('Regular'); // Regular, Stop Loss, GTT, SIP
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState('');
  const [slTrigger, setSlTrigger] = useState('');
  const [showSlTgt, setShowSlTgt] = useState(false);
  const [slPrice, setSlPrice] = useState('');
  const [tgtPrice, setTgtPrice] = useState('');
  const [showCautionPopup, setShowCautionPopup] = useState(false);

  // Local side state (B/S)
  const [side, setSide] = useState('BUY');

  const symbol = orderModal.symbol;
  const livePrice = symbol ? prices[symbol]?.ltp || 0 : 0;
  const isUp = symbol ? prices[symbol]?.pct >= 0 : true;

  // Initialize modal state when it opens
  useEffect(() => {
    if (orderModal.isOpen) {
      setSide(orderModal.type);
      setPrice(livePrice ? livePrice.toFixed(2) : '');
    }
  }, [orderModal.isOpen, orderModal.symbol, orderModal.type, livePrice]);

  if (!orderModal.isOpen || !symbol) return null;

  const balanceNum = Number(user?.balance) || 0;
  const totalQuantity = quantity * (orderModal.lotsize || 1);
  const isBuy = side === 'BUY';
  const isOption = symbol.includes('CE') || symbol.includes('PE');
  
  const leverageMultiplier = (productType === 'INT' && !isOption) ? 0.25 : 1.0; // 4x Leverage ONLY for Intraday Stocks
  
  let baseMargin = totalQuantity * (orderType === 'MARKET' ? livePrice : (parseFloat(price) || 0));
  
  if (isOption && !isBuy) {
    // Extract strike price robustly. Broker symbols often look like NIFTY30JUN2623900PE
    // This regex looks for a 3-letter month and 2-digit year before the strike digits.
    let optionStrike = 0;
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
    // Index vs Stock differentiation
    const isIndex = ['NIFTY', 'BANKNIFTY', 'SENSEX', 'FINNIFTY', 'MIDCPNIFTY'].some(idx => symbol.includes(idx));
    
    // 10% (10x leverage) for Index Options, 20% (5x leverage) for highly volatile Stock Options
    const marginRate = isIndex ? 0.10 : 0.20; 
    
    if (optionStrike > 0) {
      const grossMargin = optionStrike * totalQuantity * marginRate;
      // Subtract the premium you collect from the buyer (baseMargin holds the premium value initially)
      baseMargin = Math.max(grossMargin - baseMargin, 0); 
    } else {
      // Fallback
      baseMargin = totalQuantity * (isIndex ? 4000 : 8000);
    }
  }

  const requiredMargin = baseMargin * leverageMultiplier;
  const isInsufficient = balanceNum < requiredMargin;

  const isRestricted = restrictedStocks.includes(symbol);
  const isIntradayBlocked = isRestricted && productType === 'INT';

  const handlePlaceOrder = async () => {
    if (isIntradayBlocked) return;
    if (isRestricted && !showCautionPopup) {
       setShowCautionPopup(true);
       return;
    }

    const payload = {
      symbol,
      type: orderType,
      side,
      quantity: totalQuantity,
      price: orderType === 'MARKET' ? livePrice : parseFloat(price),
      sl_price: showSlTgt && slPrice ? parseFloat(slPrice) : null,
      tgt_price: showSlTgt && tgtPrice ? parseFloat(tgtPrice) : null,
      margin: requiredMargin, // Backend will deduct this
      product_type: productType
    };

    const success = await useStore.getState().placeOrder(payload);
    if (success) {
      closeOrderModal();
    } else {
      alert("Failed to place order. Please try again.");
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        width: '520px', background: 'var(--bg-dark)', borderRadius: '8px', 
        border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column'
      }}>
        
        {/* Header */}
        <div style={{ background: isBuy ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '8px' }}>{symbol.split('-')[0]}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="radio" checked readOnly style={{ accentColor: 'var(--color-blue)' }} />
                <span>NSE <span style={{ color: isUp ? 'var(--color-green-light)' : 'var(--color-red-light)', fontWeight: '600' }}>{livePrice.toFixed(2)} {isUp ? '▲' : '▼'}</span></span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', background: 'var(--bg-panel)', borderRadius: '20px', overflow: 'hidden', padding: '2px' }}>
              <button 
                onClick={() => setSide('BUY')}
                style={{ 
                  background: isBuy ? 'var(--color-blue)' : 'transparent', color: isBuy ? '#fff' : 'var(--text-secondary)',
                  border: 'none', borderRadius: '16px', width: '32px', height: '24px', fontSize: '12px', fontWeight: '700', cursor: 'pointer'
                }}>B</button>
              <button 
                onClick={() => setSide('SELL')}
                style={{ 
                  background: !isBuy ? 'var(--color-red)' : 'transparent', color: !isBuy ? '#fff' : 'var(--text-secondary)',
                  border: 'none', borderRadius: '16px', width: '32px', height: '24px', fontSize: '12px', fontWeight: '700', cursor: 'pointer'
                }}>S</button>
            </div>
            <button style={{ background: 'var(--bg-panel)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}><Maximize2 size={14} /></button>
            <button onClick={closeOrderModal} style={{ background: 'var(--bg-panel)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={16} /></button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', padding: '0 20px', gap: '24px' }}>
          {['Regular', 'Stop Loss'].map(t => (
            <div key={t} onClick={() => setTab(t)} style={{ 
              padding: '12px 0', fontSize: '13px', fontWeight: tab === t ? '600' : '500', 
              color: tab === t ? 'var(--color-blue)' : 'var(--text-secondary)',
              borderBottom: tab === t ? '2px solid var(--color-blue)' : '2px solid transparent',
              cursor: 'pointer' 
            }}>{t}</div>
          ))}
        </div>

        {/* Form Body */}
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            
            {/* Product Type */}
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Product Type</div>
              <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                <div onClick={() => setProductType('INT')} style={{ flex: 1, textAlign: 'center', padding: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', background: productType === 'INT' ? 'rgba(34, 197, 94, 0.1)' : 'transparent', color: productType === 'INT' ? 'var(--color-green-light)' : 'var(--text-primary)' }}>INT</div>
                <div onClick={() => setProductType('DEL')} style={{ flex: 1, textAlign: 'center', padding: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', background: productType === 'DEL' ? 'rgba(34, 197, 94, 0.1)' : 'transparent', color: productType === 'DEL' ? 'var(--color-green-light)' : 'var(--text-primary)' }}>DEL</div>
              </div>
            </div>

            {/* Quantity / Lots */}
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                {orderModal.lotsize > 1 ? 'Lots' : 'Quantity'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="number" 
                  value={quantity} 
                  onChange={e => setQuantity(Math.max(1, Number(e.target.value)))} 
                  style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '4px', color: '#fff', fontSize: '14px', outline: 'none' }} 
                />
              </div>
              {orderModal.lotsize > 1 && (
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  1 Lot = {orderModal.lotsize} Qty (Total: {quantity * orderModal.lotsize})
                </div>
              )}
            </div>

            {/* Price */}
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Price</div>
              <input type="text" value={price} onChange={e => setPrice(e.target.value)} disabled={orderType === 'MARKET'} style={{ width: '100%', background: orderType === 'MARKET' ? 'rgba(255,255,255,0.05)' : 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '4px', color: '#fff', fontSize: '14px', outline: 'none', opacity: orderType === 'MARKET' ? 0.5 : 1 }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px', fontSize: '12px' }}>
                <span onClick={() => setOrderType('LIMIT')} style={{ color: orderType === 'LIMIT' ? 'var(--color-blue)' : 'var(--text-secondary)', cursor: 'pointer' }}>Limit</span>
                <span onClick={() => setOrderType('MARKET')} style={{ color: orderType === 'MARKET' ? 'var(--color-blue)' : 'var(--text-secondary)', cursor: 'pointer' }}>Market</span>
              </div>
            </div>

          </div>

          {/* Stop Loss Tab specific inputs */}
          {tab === 'Stop Loss' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>SL Trigger Price</div>
                <input type="text" value={slTrigger} onChange={e => setSlTrigger(e.target.value)} style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '4px', color: '#fff', fontSize: '14px', outline: 'none' }} />
              </div>
            </div>
          )}

          {/* Set Stop Loss / Target (Robo Order Logic) */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--color-blue)', fontWeight: '600' }}>
              <input type="checkbox" checked={showSlTgt} onChange={e => setShowSlTgt(e.target.checked)} style={{ accentColor: 'var(--color-blue)' }} />
              Set Stop Loss / Target <Info size={14} />
            </label>

            {showSlTgt && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Stop Loss Price</div>
                  <input type="text" value={slPrice} onChange={e => setSlPrice(e.target.value)} style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '4px', color: '#fff', fontSize: '14px', outline: 'none' }} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Target Price</div>
                  <input type="text" value={tgtPrice} onChange={e => setTgtPrice(e.target.value)} style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '4px', color: '#fff', fontSize: '14px', outline: 'none' }} />
                </div>
              </div>
            )}
          </div>

          {/* Margin Alert (if insufficient) */}
          {isInsufficient && (
            <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '12px', borderRadius: '8px', marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'var(--color-yellow)', color: '#000', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>!</div>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '14px', color: '#fef08a' }}>Insufficient margin!</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>To buy {quantity} Share, please add ₹{(requiredMargin - balanceNum).toFixed(2)}</div>
                </div>
              </div>
              <button style={{ background: 'var(--color-blue)', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>ADD FUNDS</button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '24px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-blue)', marginBottom: '4px' }}>Available</div>
              <div style={{ fontSize: '13px', fontWeight: '600' }}>₹{balanceNum.toFixed(2)}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-blue)', marginBottom: '4px' }}>Required</div>
              <div style={{ fontSize: '13px', fontWeight: '600' }}>₹{requiredMargin.toFixed(2)}</div>
            </div>
          </div>
          <button 
            onClick={handlePlaceOrder}
            disabled={isInsufficient || isIntradayBlocked}
            style={{ 
              background: (isInsufficient || isIntradayBlocked) ? 'var(--bg-panel)' : (isBuy ? 'var(--color-green)' : 'var(--color-red)'), 
              color: (isInsufficient || isIntradayBlocked) ? 'var(--text-secondary)' : '#fff', 
              padding: '12px 24px', borderRadius: '4px', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px',
              border: 'none', cursor: (isInsufficient || isIntradayBlocked) ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease'
            }}
          >
            PLACE {isBuy ? 'BUY' : 'SELL'} ORDER
          </button>
        </div>

      </div>

      {/* Block Intraday Overlay inside Modal */}
      {isIntradayBlocked && (
         <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
            <div style={{ background: 'var(--bg-panel)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border-color)', width: '380px', textAlign: 'center' }}>
               <X size={48} style={{ color: 'var(--color-red)', marginBottom: '16px' }} />
               <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>Intraday Unavailable</h3>
               <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>Intraday trading is not available in {symbol.split('-')[0]}</p>
               <button onClick={() => setProductType('DEL')} style={{ background: 'var(--color-blue)', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '4px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Switch to Delivery</button>
            </div>
         </div>
      )}

      {/* Caution Popup for Restricted Stocks in Delivery */}
      {showCautionPopup && (
         <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
            <div style={{ background: 'var(--bg-dark)', padding: '24px', borderRadius: '8px', border: '1px solid var(--color-red)', width: '420px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--color-red)' }}>
                  <div style={{ background: 'var(--color-red)', color: 'white', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>!</div>
                  <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Caution</h3>
               </div>
               <p style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '12px' }}>Security is under the following list of cautions:</p>
               <ul style={{ fontSize: '13px', color: 'var(--text-secondary)', paddingLeft: '20px', marginBottom: '16px' }}>
                  <li style={{ marginBottom: '8px' }}>Security is under Gross settlement (Trade for Trade)</li>
                  <li>The company is in BZ/SZ series due to non compliance with SEBI SOP Circular</li>
               </ul>
               <div style={{ fontSize: '13px', color: 'var(--color-blue)', cursor: 'pointer', marginBottom: '20px' }}>KNOW MORE</div>
               <p style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '20px' }}>Would you like to continue?</p>
               <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowCautionPopup(false)} style={{ background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '8px 24px', borderRadius: '4px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>NO</button>
                  <button onClick={() => { setShowCautionPopup(false); handlePlaceOrder(); }} style={{ background: 'var(--color-red)', color: 'white', border: 'none', padding: '8px 24px', borderRadius: '4px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>YES</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
