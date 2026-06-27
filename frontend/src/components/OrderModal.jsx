import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { X, Maximize2, Info } from 'lucide-react';

export default function OrderModal() {
  const { orderModal, closeOrderModal, prices, user } = useStore();
  const [orderType, setOrderType] = useState('LIMIT'); // LIMIT, MARKET
  const [productType, setProductType] = useState('INT'); // INT, DEL
  const [tab, setTab] = useState('Regular'); // Regular, Stop Loss, GTT, SIP
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState('');
  const [slTrigger, setSlTrigger] = useState('');
  const [showSlTgt, setShowSlTgt] = useState(false);
  const [slPrice, setSlPrice] = useState('');
  const [tgtPrice, setTgtPrice] = useState('');

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
  const requiredMargin = quantity * (orderType === 'MARKET' ? livePrice : (parseFloat(price) || 0));
  const isInsufficient = balanceNum < requiredMargin;

  const isBuy = side === 'BUY';

  const handlePlaceOrder = async () => {
    const payload = {
      symbol,
      type: orderType,
      side,
      quantity,
      price: orderType === 'MARKET' ? null : parseFloat(price),
      sl_price: showSlTgt && slPrice ? parseFloat(slPrice) : null,
      tgt_price: showSlTgt && tgtPrice ? parseFloat(tgtPrice) : null,
      margin: requiredMargin // Backend will deduct this
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

            {/* Quantity */}
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Quantity</div>
              <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '4px', color: '#fff', fontSize: '14px', outline: 'none' }} />
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
            disabled={isInsufficient}
            style={{ 
              background: isInsufficient ? 'var(--bg-panel)' : (isBuy ? 'var(--color-green)' : 'var(--color-red)'), 
              color: isInsufficient ? 'var(--text-secondary)' : '#fff', 
              padding: '12px 24px', borderRadius: '4px', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px',
              border: 'none', cursor: isInsufficient ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease'
            }}
          >
            PLACE {isBuy ? 'BUY' : 'SELL'} ORDER
          </button>
        </div>

      </div>
    </div>
  );
}
