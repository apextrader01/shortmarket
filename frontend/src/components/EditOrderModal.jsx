import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { X, Maximize2, Info } from 'lucide-react';

export default function EditOrderModal() {
  const editOrderModal = useStore(state => state.editOrderModal);
  const user = useStore(state => state.user);
  const { closeEditOrderModal, updateOrder } = useStore.getState();
  const order = editOrderModal.order;
  
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState('');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [productType, setProductType] = useState('INT');
  const [slPrice, setSlPrice] = useState('');
  const [tgtPrice, setTgtPrice] = useState('');
  const [isMarket, setIsMarket] = useState(false);

  const symbol = order ? order.symbol : null;
  const exchange = symbol ? (symbol.startsWith('MCX:') ? 'MCX' : symbol.startsWith('BSE:') ? 'BSE' : 'NSE') : 'NSE';
  const cleanSym = symbol ? (symbol.includes(':') ? symbol.split(':')[1] : symbol) : '';
  const priceData = useStore(state => {
    if (!symbol) return null;
    return state.prices[symbol] || state.prices[cleanSym] || state.prices[`NSE:${cleanSym}`] || state.prices[`BSE:${cleanSym}`] || state.prices[`MCX:${cleanSym}`] || null;
  });
  const isUp = priceData ? (priceData.pct !== undefined ? priceData.pct >= 0 : (priceData.change !== undefined ? priceData.change >= 0 : true)) : true;
  const livePrice = (priceData && priceData.ltp) ? Number(priceData.ltp) : (parseFloat(order?.price) || parseFloat(order?.trigger_price) || 0);

  // Determine if BO or CO (handles both Parent Open Orders and Child Pending Legs)
  const isBOParent = order ? !!(order.sl_price && order.tgt_price) : false;
  const isCOParent = order ? !!(order.sl_price && !order.tgt_price && !order.parent_order_id) : false;
  const isBOLeg = order ? (order.productType === 'BO' || order.product_type === 'BO' || order.trigger_type === 'BO') : false;
  const isCOLeg = order ? (order.productType === 'CO' || order.product_type === 'CO' || order.trigger_type === 'CO') : false;
  
  const isBO = isBOParent || isBOLeg;
  const isCO = isCOParent || isCOLeg;
  const isPendingTrigger = order?.status === 'PENDING_TRIGGER';

  useEffect(() => {
    if (editOrderModal.isOpen && order) {
      const rawQty = Number(order.quantity);
      setQuantity(isNaN(rawQty) ? 1 : Math.round(rawQty));

      const trg = order.trigger_price ?? order.triggerPrice;
      const prc = order.price ?? order.limitPrice;
      setTriggerPrice(trg ? parseFloat(trg).toFixed(2) : '');

      const isInitiallyMarket = order.type === 'MARKET';
      setIsMarket(isInitiallyMarket);

      if (isPendingTrigger) {
        setPrice(order.type === 'SL-M' ? (trg ? parseFloat(trg).toFixed(2) : '') : (prc ? parseFloat(prc).toFixed(2) : (trg ? parseFloat(trg).toFixed(2) : '')));
      } else {
        setPrice(prc ? parseFloat(prc).toFixed(2) : (livePrice > 0 ? livePrice.toFixed(2) : ''));
      }
      const prod = order.productType || order.product_type || 'INT';
      setProductType(prod);
      setSlPrice(order.sl_price ? parseFloat(order.sl_price).toFixed(2) : '');
      setTgtPrice(order.tgt_price ? parseFloat(order.tgt_price).toFixed(2) : '');
    }
  }, [editOrderModal.isOpen, order]);

  if (!editOrderModal.isOpen || !order) return null;

  const balanceNum = Number(user?.balance) || 0;
  
  // Calculate margin difference
  // Child legs (SL/Target of BO/CO) and pending trigger orders do not require additional margin
  let marginDifference = 0;
  if (!isPendingTrigger && !order.parent_order_id) {
    const oldMargin = parseFloat(order.margin || 0);
    const effectiveProductType = order.product_type || order.productType || 'INT';
    const isDelSell = order.side === 'SELL' && (effectiveProductType === 'DEL' || effectiveProductType === 'CNC');
    if (isDelSell || (oldMargin === 0 && Number(quantity) === Number(order.quantity))) {
      marginDifference = 0;
    } else {
      const rawPrice = parseFloat(price) || livePrice || 0;
      const contractValue = (Number(quantity) || 0) * rawPrice;
      const cleanSymUpper = String(order.symbol || '').replace(/^(NSE:|BSE:|MCX:)/i, '').toUpperCase();
      const isOption = /(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(cleanSymUpper);
      const isLeveraged = ['INT', 'INTRADAY', 'MIS', 'CO', 'BO'].includes(effectiveProductType);
      let newMargin = contractValue;
      if (isOption && order.side === 'BUY') {
        newMargin = contractValue; // 100% upfront premium required for options buying
      } else if (isLeveraged && !isOption) {
        newMargin = contractValue * 0.20; // 5x leverage for cash intraday
      }
      marginDifference = newMargin - oldMargin;
    }
  }
  
  const isInsufficient = marginDifference > 0 && balanceNum < marginDifference;
  const isBuy = order.side === 'BUY';

  const handleUpdateOrder = async () => {
    const numQty = Number(quantity);
    if (!numQty || numQty <= 0 || isNaN(numQty)) {
      alert('Please enter a valid quantity greater than 0.');
      return;
    }

    const marketFlag = isMarket;
    const finalPrice = marketFlag ? (livePrice > 0 ? livePrice : (parseFloat(price) || 0)) : parseFloat(price);
    const sl = slPrice ? parseFloat(slPrice) : null;
    const tgt = tgtPrice ? parseFloat(tgtPrice) : null;
    const finalTriggerPrice = triggerPrice ? parseFloat(triggerPrice) : (isPendingTrigger ? (order.type === 'SL-M' ? finalPrice : parseFloat(price)) : null);

    const requiresLimitPrice = !marketFlag && (order.type === 'LIMIT' || order.type === 'SL' || order.type === 'SL-L' || !isPendingTrigger);
    if (requiresLimitPrice && (isNaN(finalPrice) || finalPrice <= 0)) {
      alert('Please enter a valid limit price greater than 0.');
      return;
    }

    if (!marketFlag && isPendingTrigger && (isNaN(finalTriggerPrice) || !finalTriggerPrice || finalTriggerPrice <= 0)) {
      alert('Please enter a valid trigger price greater than 0.');
      return;
    }

    const res = await updateOrder(order.id, numQty, finalPrice, sl, tgt, marketFlag, finalTriggerPrice);

    if (res && res.success) {
      closeEditOrderModal();
    } else {
      const err = (res && res.error) || useStore.getState().authError || "Failed to update order. Please check your balance or parameters.";
      alert(err);
    }
  };

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      background: 'rgba(0,0,0,0.85)',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', padding: '2px 7px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
                {exchange}
              </span>
              <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                {symbol ? (symbol.includes(':') ? symbol.split(':')[1].split('-')[0] : symbol.split('-')[0]) : ''}
              </h2>
              <span style={{ 
                fontSize: '11px', 
                fontWeight: '700', 
                padding: '2px 7px', 
                borderRadius: '4px', 
                background: isBuy ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)', 
                color: isBuy ? '#00E676' : '#FF3B30' 
              }}>
                {isBuy ? 'BUY' : 'SELL'}
              </span>
              {isBO && <span style={{ fontSize: '10px', background: '#f59e0b', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>BO</span>}
              {isCO && <span style={{ fontSize: '10px', background: '#8b5cf6', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>CO</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isUp ? '#00E676' : '#FF3B30', display: 'inline-block' }} />
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Market Price (LTP):</span>
              <span style={{ color: isUp ? 'var(--color-green-light)' : 'var(--color-red-light)', fontWeight: '700', fontSize: '13.5px' }}>
                ₹{livePrice.toFixed(2)}
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: '600', color: isUp ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                {isUp ? '▲' : '▼'} {priceData?.pct !== undefined ? `${priceData.pct >= 0 ? '+' : ''}${Number(priceData.pct).toFixed(2)}%` : ''}
              </span>
            </div>
          </div>

          <button onClick={closeEditOrderModal} style={{ background: 'var(--bg-panel)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={16} /></button>
        </div>

        {/* Form Body */}
        <div style={{ padding: '20px' }}>
          
          {isPendingTrigger ? (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <input 
                  type="checkbox" 
                  id="marketCheck"
                  checked={isMarket} 
                  onChange={e => setIsMarket(e.target.checked)} 
                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--color-blue)' }} 
                />
                <label htmlFor="marketCheck" style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Execute immediately at Market Price (₹{livePrice.toFixed(2)})
                </label>
              </div>

              {!isMarket && (
                <div style={{ display: 'grid', gridTemplateColumns: order.type === 'SL' ? '1fr 1fr' : '1fr', gap: '12px' }}>
                  {order.type === 'SL' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Limit Price</span>
                        {livePrice > 0 && (
                          <button
                            type="button"
                            onClick={() => setPrice(livePrice.toFixed(2))}
                            style={{ background: 'rgba(37, 99, 235, 0.15)', border: '1px solid rgba(37, 99, 235, 0.35)', color: '#38bdf8', fontSize: '10px', fontWeight: '700', padding: '1px 6px', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Use LTP
                          </button>
                        )}
                      </div>
                      <input 
                        type="text" 
                        value={price} 
                        onChange={e => setPrice(e.target.value)} 
                        style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '10px 12px', borderRadius: '4px', color: '#fff', fontSize: '15px', outline: 'none', fontWeight: '600' }} 
                      />
                    </div>
                  )}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--color-yellow)', fontWeight: '600' }}>Trigger Price</span>
                      {livePrice > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setTriggerPrice(livePrice.toFixed(2));
                            if (order.type !== 'SL') setPrice(livePrice.toFixed(2));
                          }}
                          style={{ background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.35)', color: '#EAB308', fontSize: '10px', fontWeight: '700', padding: '1px 6px', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Use LTP
                        </button>
                      )}
                    </div>
                    <input 
                      type="text" 
                      value={order.type === 'SL' ? triggerPrice : (triggerPrice || price)} 
                      onChange={e => { 
                        setTriggerPrice(e.target.value); 
                        if (order.type !== 'SL') setPrice(e.target.value); 
                      }} 
                      style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '10px 12px', borderRadius: '4px', color: '#fff', fontSize: '15px', outline: 'none', fontWeight: '600' }} 
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Order Type Toggle: LIMIT vs MARKET */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: '600' }}>Order Type</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setIsMarket(false)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: `1px solid ${!isMarket ? '#2563eb' : 'var(--border-color)'}`,
                      background: !isMarket ? 'rgba(37, 99, 235, 0.15)' : 'var(--bg-panel)',
                      color: !isMarket ? '#38bdf8' : 'var(--text-secondary)',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    LIMIT
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMarket(true);
                      if (livePrice > 0) setPrice(livePrice.toFixed(2));
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: `1px solid ${isMarket ? '#2563eb' : 'var(--border-color)'}`,
                      background: isMarket ? 'rgba(37, 99, 235, 0.15)' : 'var(--bg-panel)',
                      color: isMarket ? '#38bdf8' : 'var(--text-secondary)',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    MARKET
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                
                {/* Product Type (Read-Only) */}
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Product Type</div>
                  <div style={{ padding: '8px 12px', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '4px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: 'var(--color-blue-light)' }}>
                    {order.product_type || order.productType || 'INT'}
                  </div>
                </div>

                {/* Quantity */}
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Quantity</div>
                  <input 
                    type="number" 
                    min={1} 
                    max={10000000} 
                    value={quantity} 
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '') { setQuantity(''); return; }
                      const n = parseInt(val, 10);
                      if (!isNaN(n)) setQuantity(Math.min(10000000, Math.max(1, n)));
                    }} 
                    onBlur={e => {
                      const n = parseInt(e.target.value, 10);
                      setQuantity(Math.min(10000000, Math.max(1, isNaN(n) ? 1 : n)));
                    }} 
                    style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '4px', color: '#fff', fontSize: '14px', outline: 'none' }} 
                  />
                </div>

                {/* Price */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Price</span>
                    {!isMarket && livePrice > 0 && (
                      <button
                        type="button"
                        onClick={() => setPrice(livePrice.toFixed(2))}
                        title="Set price to live market price"
                        style={{
                          background: 'rgba(37, 99, 235, 0.15)',
                          border: '1px solid rgba(37, 99, 235, 0.35)',
                          color: '#38bdf8',
                          fontSize: '10px',
                          fontWeight: '700',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Use LTP
                      </button>
                    )}
                  </div>
                  {isMarket ? (
                    <div style={{ 
                      padding: '8px 10px', 
                      background: 'rgba(37, 99, 235, 0.1)', 
                      border: '1px solid rgba(37, 99, 235, 0.35)', 
                      borderRadius: '4px', 
                      textAlign: 'center', 
                      fontSize: '12.5px', 
                      fontWeight: '700', 
                      color: '#38bdf8',
                      whiteSpace: 'nowrap'
                    }}>
                      Market (₹{livePrice.toFixed(2)})
                    </div>
                  ) : (
                    <input 
                      type="text" 
                      value={price} 
                      onChange={e => setPrice(e.target.value)} 
                      placeholder={livePrice > 0 ? livePrice.toFixed(2) : '0.00'}
                      style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '4px', color: '#fff', fontSize: '14px', outline: 'none' }} 
                    />
                  )}
                </div>

              </div>

              {/* Stop-Loss Trigger Price (if SL order) */}
              {(order.type === 'SL' || order.type === 'SL-M' || order.trigger_price) && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-yellow)', fontWeight: '600' }}>Trigger Price</span>
                    {livePrice > 0 && (
                      <button
                        type="button"
                        onClick={() => setTriggerPrice(livePrice.toFixed(2))}
                        style={{
                          background: 'rgba(234, 179, 8, 0.15)',
                          border: '1px solid rgba(234, 179, 8, 0.35)',
                          color: '#EAB308',
                          fontSize: '10px',
                          fontWeight: '700',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Use LTP
                      </button>
                    )}
                  </div>
                  <input 
                    type="text" 
                    value={triggerPrice} 
                    onChange={e => setTriggerPrice(e.target.value)} 
                    style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid rgba(234, 179, 8, 0.4)', padding: '8px 12px', borderRadius: '4px', color: '#fff', fontSize: '14px', outline: 'none' }} 
                  />
                </div>
              )}

              {/* BO/CO Fields */}
              {(isBO || isCO) && (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: isBO ? '1fr 1fr' : '1fr', 
                  gap: '16px', 
                  marginBottom: '16px',
                  padding: '16px',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '8px',
                  border: `1px solid ${isBO ? 'rgba(245, 158, 11, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`
                }}>
                  {/* SL Price */}
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--color-red-light)', marginBottom: '8px', fontWeight: '600' }}>
                      Stop Loss Price
                    </div>
                    <input 
                      type="text" 
                      value={slPrice} 
                      onChange={e => setSlPrice(e.target.value)} 
                      style={{ 
                        width: '100%', background: 'var(--bg-panel)', 
                        border: '1px solid rgba(239, 68, 68, 0.3)', 
                        padding: '8px 12px', borderRadius: '4px', 
                        color: '#fff', fontSize: '14px', outline: 'none' 
                      }} 
                    />
                  </div>

                  {/* Target Price (BO only) */}
                  {isBO && (
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--color-green-light)', marginBottom: '8px', fontWeight: '600' }}>
                        Target Price
                      </div>
                      <input 
                        type="text" 
                        value={tgtPrice} 
                        onChange={e => setTgtPrice(e.target.value)} 
                        style={{ 
                          width: '100%', background: 'var(--bg-panel)', 
                          border: '1px solid rgba(34, 197, 94, 0.3)', 
                          padding: '8px 12px', borderRadius: '4px', 
                          color: '#fff', fontSize: '14px', outline: 'none' 
                        }} 
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Margin Alert (if insufficient) */}
          {isInsufficient && (
            <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '12px', borderRadius: '8px', marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'var(--color-yellow)', color: '#000', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>!</div>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '14px', color: '#fef08a' }}>Insufficient margin!</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>To update, please add ₹{(marginDifference - balanceNum).toFixed(2)}</div>
                </div>
              </div>
              <button 
                onClick={() => {
                  closeEditOrderModal();
                  window.dispatchEvent(new CustomEvent('open-deposit-modal'));
                }}
                style={{ background: 'var(--color-blue)', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
              >
                ADD FUNDS
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {!isPendingTrigger && (
            <div style={{ display: 'flex', gap: '24px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-blue)', marginBottom: '4px' }}>Margin Change</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: marginDifference > 0 ? 'var(--color-red-light)' : 'var(--color-green-light)' }}>
                  {marginDifference > 0 ? '-' : '+'}₹{Math.abs(marginDifference).toFixed(2)}
                </div>
              </div>
            </div>
          )}
          <button 
            onClick={handleUpdateOrder}
            disabled={isInsufficient}
            style={{ 
              background: isInsufficient ? 'var(--bg-panel)' : 'var(--color-blue)', 
              color: isInsufficient ? 'var(--text-secondary)' : '#fff', 
              padding: '12px 24px', borderRadius: '4px', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px',
              border: 'none', cursor: isInsufficient ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease'
            }}
          >
            UPDATE ORDER
          </button>
        </div>

      </div>
    </div>
  );
}


