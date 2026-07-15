import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { X, Maximize2, Info, RefreshCw, FileText, Plus } from 'lucide-react';

export default function OrderModal() {
  const { orderModal, closeOrderModal, prices, user, restrictedStocks, openMarketDepthModal, marketDepthModal } = useStore();
  const [orderType, setOrderType] = useState('LIMIT'); // LIMIT, MARKET
  const [productType, setProductType] = useState('INT'); // INT, DEL
  const [tab, setTab] = useState('Regular'); // Regular, Stop Loss, GTT, SIP
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState('');
  const [slTrigger, setSlTrigger] = useState('');
  const [trailingJump, setTrailingJump] = useState('');
  const [isCO, setIsCO] = useState(false);
  const [isBO, setIsBO] = useState(false);
  const [slPrice, setSlPrice] = useState('');
  const [tgtPrice, setTgtPrice] = useState('');
  const [showCautionPopup, setShowCautionPopup] = useState(false);
  const [showIntradayBlockedPopup, setShowIntradayBlockedPopup] = useState(false);
  
  // Tax estimates
  const [estimatedTaxes, setEstimatedTaxes] = useState(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [showBreakup, setShowBreakup] = useState(false);

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
  
  // Fetch Estimated Charges
  useEffect(() => {
    if (!symbol || !totalQuantity) return;
    const fetchEst = async () => {
       setIsEstimating(true);
       try {
         const p = orderType === 'MARKET' ? livePrice : parseFloat(price);
         if (!p) {
             setEstimatedTaxes(0);
             return;
         }
         const token = useStore.getState().token;
         const res = await fetch(`/api/estimate-charges?symbol=${symbol}&product_type=${productType}&side=${side}&quantity=${totalQuantity}&price=${p}`, {
            headers: { 'Authorization': `Bearer ${token}` }
         });
         const data = await res.json();
         if (data.totalTaxes !== undefined) {
             setEstimatedTaxes(data);
         }
       } catch (err) {
         console.error('Failed to estimate taxes', err);
       } finally {
         setIsEstimating(false);
       }
    };
    
    const timer = setTimeout(fetchEst, 400); // Debounce
    return () => clearTimeout(timer);
  }, [symbol, productType, side, totalQuantity, price, orderType, livePrice]);

  const leverageMultiplier = (productType === 'INT' && !isOption) ? 0.25 : 1.0; // 4x Leverage ONLY for Intraday Stocks
  
  let baseMargin = totalQuantity * (orderType === 'MARKET' ? livePrice : (parseFloat(price) || 0));
  
  if (isOption && !isBuy) {
    // Extract strike price robustly. Broker symbols often look like NIFTY30JUN2623900PE
    // This regex looks for a 3-letter month and 2-digit year before the strike digits.
    const cleanSymbol = symbol.split('-')[0];
    let optionStrike = 0;
    const robustMatch = cleanSymbol.match(/[A-Z]{3}\d{2}(\d+)(CE|PE)$/i);
    if (robustMatch) {
      optionStrike = parseFloat(robustMatch[1]);
    } else {
      const strikeMatch = cleanSymbol.match(/(\d+)(CE|PE)$/i);
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
  } else if (symbol.includes('FUT')) {
    // Futures Margin Calculation (Symmetric for Buy and Sell)
    const isIndex = ['NIFTY', 'BANKNIFTY', 'SENSEX', 'FINNIFTY', 'MIDCPNIFTY'].some(idx => symbol.includes(idx));
    const marginRate = isIndex ? 0.10 : 0.15; // 10% for Index Futures, 15% for Stock/Commodity Futures
    baseMargin = baseMargin * marginRate;
  }

  const requiredMargin = baseMargin * leverageMultiplier;
  const isInsufficient = balanceNum < requiredMargin;

  const isRestricted = restrictedStocks.includes(symbol);
  
  const isCommodity = ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON'].some(c => symbol.startsWith(c));
  
  const isPastIntradayCutoff = () => {
    if (isCommodity) return false;
    const istTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    return (hours > 15 || (hours === 15 && minutes >= 15));
  };

  const isTimeBlocked = isPastIntradayCutoff();
  const isIntradayBlocked = (isRestricted || isTimeBlocked) && productType === 'INT';

  const handlePlaceOrder = async () => {
    if (isIntradayBlocked) {
       setShowIntradayBlockedPopup(true);
       return;
    }
    if (isRestricted && !showCautionPopup) {
       setShowCautionPopup(true);
       return;
    }

    let finalType = orderType;
    if (tab === 'Stop Loss') finalType = orderType === 'MARKET' ? 'SL-M' : 'SL-L';
    if (tab === 'Trailing SL') finalType = 'TRAILING_STOP';
    if (tab === 'GTT') finalType = 'GTT';

    const payload = {
      symbol,
      type: finalType,
      side,
      quantity: totalQuantity,
      price: orderType === 'MARKET' ? livePrice : parseFloat(price),
      trigger_price: (tab === 'Stop Loss' || tab === 'Trailing SL' || tab === 'GTT') && slTrigger ? parseFloat(slTrigger) : null,
      trail_amount: tab === 'Trailing SL' && trailingJump ? parseFloat(trailingJump) : null,
      sl_price: (isCO || isBO) && slPrice ? parseFloat(slPrice) : null,
      tgt_price: isBO && tgtPrice ? parseFloat(tgtPrice) : null,
      margin: requiredMargin, // Backend will deduct this
      product_type: isBO ? 'BO' : isCO ? 'CO' : productType
    };

    if (tab === 'Stop Loss' || tab === 'GTT') {
      const triggerPayload = {
        symbol,
        type: tab === 'GTT' ? 'GTT' : 'SL',
        side,
        quantity: totalQuantity,
        limitPrice: orderType === 'MARKET' ? null : parseFloat(price),
        triggerPrice: parseFloat(slTrigger),
        productType,
        status: 'PENDING_TRIGGER'
      };
      useStore.getState().addPendingTrigger(triggerPayload);
      closeOrderModal();
      return;
    }

    const success = await useStore.getState().placeOrder(payload);
    if (success) {
      closeOrderModal();
    } else {
      const errorMsg = useStore.getState().authError || "Failed to place order. Please try again.";
      alert(errorMsg);
    }
  };

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        width: '520px', background: 'var(--bg-dark)', borderRadius: '8px', 
        border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        transform: marketDepthModal?.isOpen ? 'translateX(-260px)' : 'none',
        transition: 'transform 0.3s ease-in-out'
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

        {/* Intraday / Overnight Tabs */}
        <div style={{ padding: '20px 20px 10px 20px' }}>
          <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden', width: 'fit-content' }}>
            <div 
              onClick={() => setProductType('INT')} 
              style={{ 
                padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                background: productType === 'INT' ? 'var(--color-blue)' : 'transparent',
                color: productType === 'INT' ? '#fff' : 'var(--text-primary)',
                fontSize: '13px', fontWeight: '500'
              }}
            >
              Intraday <Info size={12} style={{ opacity: 0.7 }} />
            </div>
            <div 
              onClick={() => {
                setProductType('DEL');
                setIsCO(false);
                setIsBO(false);
              }} 
              style={{ 
                padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                background: productType === 'DEL' ? 'var(--color-blue)' : 'transparent',
                color: productType === 'DEL' ? '#fff' : 'var(--text-primary)',
                fontSize: '13px', fontWeight: '500'
              }}
            >
              Delivery <Info size={12} style={{ opacity: 0.7 }} />
            </div>
          </div>
        </div>

        {/* Form Body */}
        <div style={{ padding: '10px 20px 20px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: '500' }}>
              {productType === 'INT' ? 'Intraday' : 'Delivery'} - {orderType === 'MARKET' ? 'Market' : 'Limit'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            {/* Qty */}
            <div>
              <fieldset style={{ margin: 0, padding: 0, border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                <legend style={{ marginLeft: '12px', padding: '0 4px', fontSize: '12px', color: 'var(--text-secondary)' }}>Qty(Lot: {orderModal.lotsize || 1})</legend>
                <input 
                  type="number" 
                  value={quantity} 
                  onChange={e => setQuantity(Math.max(1, Number(e.target.value)))} 
                  style={{ width: '100%', background: 'transparent', border: 'none', padding: '8px 12px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} 
                />
              </fieldset>
              {orderModal.lotsize > 1 && (
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Total Qty: {quantity * orderModal.lotsize}
                </div>
              )}
            </div>

            {/* Price */}
            <div>
              <fieldset style={{ margin: 0, padding: 0, border: '1px solid var(--border-color)', borderRadius: '4px', opacity: orderType === 'MARKET' ? 0.5 : 1 }}>
                <legend style={{ marginLeft: '12px', padding: '0 4px', fontSize: '12px', color: 'var(--text-secondary)' }}>Price(Tick: 0.05)</legend>
                <input 
                  type="text" 
                  value={price} 
                  onChange={e => setPrice(e.target.value)} 
                  disabled={orderType === 'MARKET'}
                  style={{ width: '100%', background: 'transparent', border: 'none', padding: '8px 12px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} 
                />
              </fieldset>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={orderType === 'MARKET'} onChange={e => setOrderType(e.target.checked ? 'MARKET' : 'LIMIT')} style={{ accentColor: 'var(--color-blue)' }} /> 
                Market price <Info size={12} />
              </label>
            </div>

            {/* Trigger Price */}
            <div>
              <fieldset style={{ margin: 0, padding: 0, border: '1px solid var(--border-color)', borderRadius: '4px', opacity: tab !== 'Stop Loss' ? 0.5 : 1, background: tab !== 'Stop Loss' ? 'repeating-linear-gradient(-45deg, rgba(128,128,128,0.05), rgba(128,128,128,0.05) 10px, transparent 10px, transparent 20px)' : 'transparent' }}>
                <legend style={{ marginLeft: '12px', padding: '0 4px', fontSize: '12px', color: 'var(--text-secondary)' }}>Trigger Price</legend>
                <input 
                  type="text" 
                  value={slTrigger} 
                  onChange={e => setSlTrigger(e.target.value)}
                  disabled={tab !== 'Stop Loss'}
                  style={{ width: '100%', background: 'transparent', border: 'none', padding: '8px 12px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} 
                />
              </fieldset>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={tab === 'Stop Loss'} onChange={e => setTab(e.target.checked ? 'Stop Loss' : 'Regular')} style={{ accentColor: 'var(--color-blue)' }} /> 
                Trigger buy <Info size={12} />
              </label>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            {productType === 'INT' && (
              <>
                <div style={{ gridColumn: '2' }}>
                  <fieldset style={{ margin: 0, padding: 0, border: '1px solid var(--border-color)', borderRadius: '4px', opacity: !(isCO || isBO) ? 0.5 : 1, background: !(isCO || isBO) ? 'repeating-linear-gradient(-45deg, rgba(128,128,128,0.05), rgba(128,128,128,0.05) 10px, transparent 10px, transparent 20px)' : 'transparent' }}>
                    <legend style={{ marginLeft: '12px', padding: '0 4px', fontSize: '12px', color: 'var(--text-secondary)' }}>Stoploss</legend>
                    <input 
                      type="text" 
                      value={slPrice}
                      onChange={e => setSlPrice(e.target.value)}
                      disabled={!(isCO || isBO)}
                      style={{ width: '100%', background: 'transparent', border: 'none', padding: '8px 12px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} 
                    />
                  </fieldset>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={isCO} onChange={e => { setIsCO(e.target.checked); if (e.target.checked) setIsBO(false); }} style={{ accentColor: 'var(--color-blue)' }} /> 
                    CO <Info size={12} />
                  </label>
                </div>

                <div style={{ gridColumn: '3' }}>
                  <fieldset style={{ margin: 0, padding: 0, border: '1px solid var(--border-color)', borderRadius: '4px', opacity: !isBO ? 0.5 : 1, background: !isBO ? 'repeating-linear-gradient(-45deg, rgba(128,128,128,0.05), rgba(128,128,128,0.05) 10px, transparent 10px, transparent 20px)' : 'transparent' }}>
                    <legend style={{ marginLeft: '12px', padding: '0 4px', fontSize: '12px', color: 'var(--text-secondary)' }}>Take Profit</legend>
                    <input 
                      type="text" 
                      value={tgtPrice}
                      onChange={e => setTgtPrice(e.target.value)}
                      disabled={!isBO}
                      style={{ width: '100%', background: 'transparent', border: 'none', padding: '8px 12px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} 
                    />
                  </fieldset>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={isBO} onChange={e => { setIsBO(e.target.checked); if (e.target.checked) setIsCO(false); }} style={{ accentColor: 'var(--color-blue)' }} /> 
                    BO <Info size={12} />
                  </label>
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '16px' }}>
            <div 
              onClick={() => {
                openMarketDepthModal(symbol, orderModal.lotsize || 1);
              }}
              style={{ color: 'var(--color-blue)', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              Market Depth <Maximize2 size={12} />
            </div>
          </div>
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
        {/* Footer */}
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                <RefreshCw size={14} style={{ color: 'var(--text-secondary)' }} />
                <span style={{ fontSize: '15px', fontWeight: '700' }}>Margin</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '13px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)', width: '60px' }}>Required:</span>
                  <span style={{ color: 'var(--text-primary)' }}>₹{requiredMargin.toFixed(2)} ({productType === 'INT' && !isOption ? '4x' : '1x'})</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)', width: '60px' }}>Available:</span>
                  <span style={{ color: 'var(--text-primary)' }}>₹{balanceNum.toFixed(2)}</span>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginLeft: '22px', marginTop: '4px' }}>
              <button style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', color: '#3b82f6', fontSize: '13px', padding: 0, cursor: 'pointer' }}>
                <Plus size={14} /> Add Funds
              </button>
              <button 
                onClick={() => estimatedTaxes && setShowBreakup(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', color: '#3b82f6', fontSize: '13px', padding: 0, cursor: 'pointer' }}>
                <FileText size={14} /> Price breakup
              </button>
            </div>
          </div>
          
          <button 
            onClick={handlePlaceOrder}
            disabled={isInsufficient}
            style={{ 
              background: (isInsufficient) ? 'var(--bg-panel)' : (isBuy ? 'var(--color-green)' : 'var(--color-red)'), 
              color: (isInsufficient) ? 'var(--text-secondary)' : '#fff', 
              padding: '12px 24px', borderRadius: '4px', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px',
              border: 'none', cursor: (isInsufficient) ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease',
              alignSelf: 'stretch',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            PLACE {isBuy ? 'BUY' : 'SELL'} ORDER
          </button>
        </div>

      </div>

      {/* Block Intraday Overlay inside Modal */}
      {showIntradayBlockedPopup && (
         <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
            <div style={{ background: 'var(--bg-panel)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border-color)', width: '380px', textAlign: 'center', position: 'relative' }}>
               <X size={20} onClick={() => setShowIntradayBlockedPopup(false)} style={{ position: 'absolute', top: '16px', right: '16px', color: 'var(--text-secondary)', cursor: 'pointer' }} />
               <X size={48} style={{ color: 'var(--color-red)', marginBottom: '16px' }} />
               <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>Intraday Unavailable</h3>
               <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>Intraday trading is not available in {symbol.split('-')[0]}</p>
               <button onClick={() => { setProductType('DEL'); setShowIntradayBlockedPopup(false); }} style={{ background: 'var(--color-blue)', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '4px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Switch to Delivery</button>
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

      {/* Charges Breakup Modal */}
      {showBreakup && estimatedTaxes && (
         <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30 }}>
            <div style={{ background: 'var(--bg-panel)', borderRadius: '8px', width: '380px', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', border: '1px solid var(--border-color)' }}>
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                    <FileText size={18} />
                    <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>Charges</h3>
                  </div>
                  <X size={20} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setShowBreakup(false)} />
               </div>
               
               <div style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '16px', color: 'var(--text-primary)' }}>
                     <span>Brokerage</span>
                     <span>₹{estimatedTaxes.brokerage.toFixed(2)}</span>
                  </div>
                  
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>Others</div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                     <span>Transaction (Exch. + Clearing)</span>
                     <span>₹{estimatedTaxes.exchangeCharge.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                     <span>CTT/STT</span>
                     <span>₹{estimatedTaxes.stt.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                     <span>GST</span>
                     <span>₹{estimatedTaxes.gst.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                     <span>SEBI</span>
                     <span>₹{estimatedTaxes.sebiCharge.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                     <span>Stamp duty</span>
                     <span>₹{estimatedTaxes.stampDuty.toFixed(2)}</span>
                  </div>
                  {estimatedTaxes.dpCharge > 0 && (
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                        <span>DP Charge</span>
                        <span>₹{estimatedTaxes.dpCharge.toFixed(2)}</span>
                     </div>
                  )}
               </div>
               
               <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>
                     <span>Total</span>
                     <span>₹{estimatedTaxes.totalTaxes.toFixed(2)}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                     *Actual charges may vary based on order execution. <span style={{ color: 'var(--color-blue)', cursor: 'pointer' }}>Learn more</span>
                  </div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
