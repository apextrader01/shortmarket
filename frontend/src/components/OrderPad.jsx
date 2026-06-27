import React, { useState } from 'react';
import { useStore } from '../store';
import { CheckCircle, XCircle } from 'lucide-react';

export default function OrderPad() {
  const { selectedSymbol, prices, placeOrder, orders, cancelOrder } = useStore();
  const [type, setType] = useState('MARKET');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [status, setStatus] = useState(null); // null | 'success' | 'error'

  const ltp = prices[selectedSymbol]?.ltp || 0;
  const marginRequired = ((type === 'LIMIT' ? (parseFloat(price) || 0) : ltp) * parseInt(quantity || 0));

  const handleOrder = async (side) => {
    if (!quantity || parseInt(quantity) < 1) return;
    if (type === 'LIMIT' && (!price || parseFloat(price) <= 0)) return;

    const success = await placeOrder({
      userId: 1,
      symbol: selectedSymbol,
      type,
      side,
      quantity: parseInt(quantity),
      price: type === 'LIMIT' ? parseFloat(price) : null
    });

    setStatus(success ? 'success' : 'error');
    setTimeout(() => setStatus(null), 2500);
  };

  const pendingOrders = orders.filter(o => o.status === 'PENDING' && o.symbol === selectedSymbol);

  return (
    <div className="glass-panel" style={{ padding: '20px' }}>
      <h3 style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '16px', fontWeight: '700' }}>Order Entry</span>
        <span style={{
          fontSize: '12px', fontWeight: '700', letterSpacing: '1px',
          background: 'rgba(225,42,31,0.15)', color: 'var(--color-red)',
          padding: '4px 10px', borderRadius: '6px'
        }}>{selectedSymbol}</span>
      </h3>

      {/* Order Type Toggle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '4px' }}>
        {['MARKET', 'LIMIT'].map(t => (
          <button
            key={t}
            onClick={() => setType(t)}
            style={{
              flex: 1, padding: '8px', border: 'none', cursor: 'pointer',
              borderRadius: '6px', fontSize: '13px', fontWeight: '600',
              background: type === t ? 'var(--color-navy-light)' : 'transparent',
              color: type === t ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >{t}</button>
        ))}
      </div>

      {/* LTP Display */}
      <div style={{ marginBottom: '16px', padding: '10px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Last Price</span>
        <span style={{ fontWeight: '700', color: 'var(--color-green-light)', fontSize: '14px' }}>
          {ltp ? `₹${ltp.toFixed(2)}` : '—'}
        </span>
      </div>

      {/* Quantity */}
      <div className="input-group">
        <label>Quantity</label>
        <input
          type="number"
          className="input-field"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          min="1"
          placeholder="Enter quantity"
        />
      </div>

      {/* Limit Price */}
      {type === 'LIMIT' && (
        <div className="input-group">
          <label>Limit Price (₹)</label>
          <input
            type="number"
            className="input-field"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            step="0.05"
            placeholder={ltp ? ltp.toFixed(2) : '0.00'}
          />
        </div>
      )}

      {/* Margin Display */}
      <div style={{ margin: '12px 0', padding: '10px 14px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Margin Required:</span>
        <span style={{ fontWeight: '700' }}>₹{marginRequired.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
      </div>

      {/* Status Feedback */}
      {status && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
          background: status === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(225,42,31,0.15)',
          color: status === 'success' ? 'var(--color-green-light)' : 'var(--color-red-light)',
          borderRadius: '8px', marginBottom: '12px', fontSize: '13px', fontWeight: '600'
        }}>
          {status === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {status === 'success' ? 'Order placed successfully!' : 'Order failed. Please try again.'}
        </div>
      )}

      {/* BUY / SELL */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button className="btn btn-buy" style={{ flex: 1, padding: '13px', fontSize: '14px', fontWeight: '700' }} onClick={() => handleOrder('BUY')}>
          ▲ BUY
        </button>
        <button className="btn btn-sell" style={{ flex: 1, padding: '13px', fontSize: '14px', fontWeight: '700' }} onClick={() => handleOrder('SELL')}>
          ▼ SELL
        </button>
      </div>

      {/* Pending orders for this symbol */}
      {pendingOrders.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-secondary)' }}>PENDING ORDERS</div>
          {pendingOrders.map(o => (
            <div key={o.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', marginBottom: '6px',
              fontSize: '12px'
            }}>
              <span style={{ color: o.side === 'BUY' ? 'var(--color-green-light)' : 'var(--color-red-light)', fontWeight: '700' }}>
                {o.side} {o.quantity}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>{o.type}{o.price ? ` @ ₹${o.price}` : ''}</span>
              <button
                onClick={() => cancelOrder(o.id)}
                style={{
                  background: 'rgba(225,42,31,0.2)', color: 'var(--color-red-light)',
                  border: 'none', cursor: 'pointer', padding: '3px 8px', borderRadius: '4px',
                  fontSize: '11px', fontWeight: '600'
                }}
              >Cancel</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
