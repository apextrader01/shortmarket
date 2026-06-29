import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { X, Maximize2, Info } from 'lucide-react';

export default function EditOrderModal() {
  const { editOrderModal, closeEditOrderModal, user, updateOrder, prices } = useStore();
  const order = editOrderModal.order;
  
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState('');
  const [productType, setProductType] = useState('INT');

  const symbol = order ? order.symbol : null;
  const isUp = symbol ? prices[symbol]?.pct >= 0 : true;
  const livePrice = symbol ? prices[symbol]?.ltp || 0 : 0;

  useEffect(() => {
    if (editOrderModal.isOpen && order) {
      setQuantity(order.quantity);
      setPrice(order.price ? parseFloat(order.price).toFixed(2) : '');
      if (order.productType) setProductType(order.productType);
    }
  }, [editOrderModal.isOpen, order]);

  if (!editOrderModal.isOpen || !order) return null;

  const balanceNum = Number(user?.balance) || 0;
  
  // Calculate margin difference
  const oldMargin = order.quantity * parseFloat(order.price || 0);
  const newMargin = quantity * (parseFloat(price) || 0);
  const marginDifference = newMargin - oldMargin;
  
  const isInsufficient = marginDifference > 0 && balanceNum < marginDifference;
  const isBuy = order.side === 'BUY';

  const handleUpdateOrder = async () => {
    const success = await updateOrder(order.id, quantity, parseFloat(price));
    if (success) {
      closeEditOrderModal();
    } else {
      alert("Failed to update order. Please check your balance.");
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

            <button onClick={closeEditOrderModal} style={{ background: 'var(--bg-panel)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={16} /></button>
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
              <input type="text" value={price} onChange={e => setPrice(e.target.value)} style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '4px', color: '#fff', fontSize: '14px', outline: 'none' }} />
            </div>

          </div>



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
              <button style={{ background: 'var(--color-blue)', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>ADD FUNDS</button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '24px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-blue)', marginBottom: '4px' }}>Margin Change</div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: marginDifference > 0 ? 'var(--color-red-light)' : 'var(--color-green-light)' }}>
                {marginDifference > 0 ? '-' : '+'}₹{Math.abs(marginDifference).toFixed(2)}
              </div>
            </div>
          </div>
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
