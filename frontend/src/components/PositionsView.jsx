import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { Activity, X } from 'lucide-react';

export default function PositionsView() {
  const [viewMode, setViewMode] = useState('OPEN'); // 'OPEN' | 'CLOSED' | 'HOLDINGS'
  const { positions, holdings, prices } = useStore(useShallow(state => ({ positions: state.positions, holdings: state.holdings, prices: state.prices })));
  
  const mergedHoldingsMap = {};
  if (viewMode === 'HOLDINGS') {
    (holdings || []).forEach(h => { mergedHoldingsMap[h.symbol] = { ...h }; });
  }
  
  const sourceData = viewMode === 'HOLDINGS' ? Object.values(mergedHoldingsMap).filter(h => h.quantity > 0) : (positions || []);
  const [partialExitPos, setPartialExitPos] = useState(null);
  const [partialExitQty, setPartialExitQty] = useState('');
  const [partialExitType, setPartialExitType] = useState('MARKET');
  const [partialExitPrice, setPartialExitPrice] = useState('');

  // Group positions by Symbol + Product Type (Flat List)
  const { flatPositions, globalMTM } = useMemo(() => {
    let globalMTM = 0;
    const symbolAgg = {};

    sourceData.forEach(pos => {
      const posQty = Number(pos.quantity) || 0;
      const isOpen = posQty !== 0;
      if (viewMode === 'OPEN' && !isOpen) return;
      if (viewMode === 'CLOSED' && isOpen) return;

      const key = `${pos.symbol}-${pos.product_type}`;
      if (!symbolAgg[key]) {
         symbolAgg[key] = { ...pos, encumberedQty: 0, unencumberedQty: 0 };
      }
      
      const agg = symbolAgg[key];
      if (agg.id !== pos.id) { // Merge
         const prevQty = agg.quantity;
         agg.realized_pnl = (parseFloat(agg.realized_pnl) || 0) + (parseFloat(pos.realized_pnl) || 0);
         agg.closed_quantity = (parseInt(agg.closed_quantity) || 0) + (parseInt(pos.closed_quantity) || 0);
         
         if (isOpen) {
           const currentTotal = Math.abs(Number(agg.quantity)) * parseFloat(agg.average_price || 0);
           const newTotal = Math.abs(posQty) * parseFloat(pos.average_price || 0);
           agg.quantity = Number(agg.quantity) + posQty;
           agg.average_price = Math.abs(agg.quantity) > 0 ? (currentTotal + newTotal) / Math.abs(agg.quantity) : agg.average_price;
         } else {
           if (parseFloat(pos.average_price) > 0 && parseFloat(agg.average_price) === 0) {
             agg.average_price = pos.average_price;
           }
           const prevClosed = parseInt(agg.closed_quantity) - (parseInt(pos.closed_quantity) || 0);
           const prevExitTotal = prevClosed * parseFloat(agg.exit_price || 0);
           const newExitTotal = (parseInt(pos.closed_quantity) || 0) * parseFloat(pos.exit_price || 0);
           const totalClosed = parseInt(agg.closed_quantity) || 1;
           agg.exit_price = (prevExitTotal + newExitTotal) / totalClosed;
         }
         
         if ((agg.product_type === 'BO' || agg.product_type === 'CO') && (pos.product_type !== 'BO' && pos.product_type !== 'CO')) {
             agg.product_type = pos.product_type;
         }
      }
      
      if (pos.product_type === 'BO' || pos.product_type === 'CO') {
         agg.encumberedQty += Math.abs(posQty);
      } else {
         agg.unencumberedQty += Math.abs(posQty);
      }
    });

    const flatList = [];
    Object.values(symbolAgg).forEach(pos => {
      const posQty = Number(pos.quantity) || 0;
      if (posQty === 0 && viewMode === 'OPEN') return;

      const priceData = prices[pos.symbol] || {};
      const ltp = priceData.ltp || 0;
      const avg = parseFloat(pos.average_price) || 0;
      const qty = posQty;
      
      const invested = avg * Math.abs(qty);
      const currentValue = ltp * Math.abs(qty);
      
      const pnl = (qty !== 0) 
          ? (qty > 0 ? (currentValue - invested) : (invested - currentValue))
          : parseFloat(pos.realized_pnl || 0);
          
      const lotSize = priceData.lotsize || 1;
      
      let segment = 'Stock';
      if (pos.symbol.includes('CE') || pos.symbol.includes('PE')) segment = 'Option';
      else if (pos.symbol.includes('FUT')) segment = 'Future';
      
      let exchange = 'NSE';
      if (pos.symbol.includes('SENSEX') || pos.symbol.includes('BSE')) exchange = 'BSE';
      if (pos.symbol.includes('NATURALGAS') || pos.symbol.includes('CRUDE') || pos.symbol.includes('MCX')) exchange = 'MCX';

      let productLabel = 'Delivery';
      if (pos.product_type === 'INT') productLabel = 'Intraday';
      if (pos.product_type === 'BO') productLabel = 'Bracket Order';
      if (pos.product_type === 'CO') productLabel = 'Cover Order';
      if (viewMode === 'HOLDINGS') productLabel = 'Delivery';
      
      flatList.push({ 
        ...pos, ltp, avg, qty, pnl, invested, lotSize, isOpen: qty !== 0,
        segment, exchange, productLabel
      });
      globalMTM += pnl;
    });

    // Sort alphabetically by symbol
    flatList.sort((a, b) => a.symbol.localeCompare(b.symbol));

    return { flatPositions: flatList, globalMTM };
  }, [sourceData, prices, viewMode]);

  const exitAllPositions = async () => {
    const openPositions = positions.filter(p => p.quantity !== 0 && p.product_type !== 'BO' && p.product_type !== 'CO');
    if (openPositions.length === 0) {
      alert('No valid unencumbered positions to exit.');
      return;
    }
    if (!window.confirm(`Exit ALL ${openPositions.length} unencumbered position(s) at market price?`)) return;
    const store = useStore.getState();
    let failed = 0;
    for (const pos of openPositions) {
      const exitSide = pos.quantity > 0 ? 'SELL' : 'BUY';
      const payload = {
        symbol: pos.symbol,
        type: 'MARKET',
        side: exitSide,
        quantity: Math.abs(pos.quantity),
        price: 0,
        sl_price: null,
        tgt_price: null,
        margin: 0,
        product_type: pos.product_type || 'DEL'
      };
      const success = await store.placeOrder(payload);
      if (success) {
        store.clearPendingTriggersForSymbol(pos.symbol);
      } else {
        failed++;
      }
    }
    if (failed > 0) alert(`${failed} order(s) failed. Check browser console for details.`);
  };

  return (
    <div style={{ padding: '24px', paddingBottom: '100px', width: '100%', background: 'var(--bg-dark)', overflowY: 'auto', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '800' }}>Positions</h2>
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', padding: '4px' }}>
            <button
              onClick={() => setViewMode('OPEN')}
              style={{ background: viewMode === 'OPEN' ? 'var(--color-blue)' : 'transparent', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
            >
              OPEN
            </button>
            <button
              onClick={() => setViewMode('HOLDINGS')}
              style={{ background: viewMode === 'HOLDINGS' ? 'var(--color-blue)' : 'transparent', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
            >
              HOLDINGS
            </button>
            <button
              onClick={() => setViewMode('CLOSED')}
              style={{ background: viewMode === 'CLOSED' ? 'var(--color-blue)' : 'transparent', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
            >
              CLOSED
            </button>
          </div>
        </div>
        {viewMode === 'OPEN' && (
          <button
            onClick={exitAllPositions}
            style={{
              background: 'var(--color-red-light)', color: '#fff', border: 'none',
              padding: '8px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
            }}
          >
            EXIT ALL POSITIONS
          </button>
        )}
      </div>
      
      {flatPositions.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ 
            width: '120px', height: '100px', background: 'var(--bg-panel)', 
            borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)', marginBottom: '24px'
          }}>
            <Activity size={40} color="var(--color-green-light)" />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>
            {viewMode === 'CLOSED' ? 'No closed positions yet' : viewMode === 'HOLDINGS' ? 'You have no active holdings' : 'You do not have any positions'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>
            {viewMode === 'CLOSED' ? 'Positions you close today will appear here.' : viewMode === 'HOLDINGS' ? 'Long-term delivery positions will appear here on T+1.' : 'List of all your positions for today will appear here.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {flatPositions.map((pos, idx) => {
            const isProfit = pos.pnl >= 0;
            const realizedPnl = parseFloat(pos.realized_pnl) || 0;
            const currentValue = pos.ltp * Math.abs(pos.qty);
            const pnlPercent = pos.invested > 0 ? (pos.pnl / pos.invested) * 100 : 0;
            
            // For closed positions, use realized P&L as the main display
            const displayPnl = viewMode === 'CLOSED' ? realizedPnl : pos.pnl;
            const isDisplayProfit = displayPnl >= 0;

            return (
              <div 
                key={idx} 
                onClick={() => {
                  if (viewMode === 'CLOSED') return;
                  if (viewMode === 'OPEN') {
                    if (pos.unencumberedQty === 0) {
                      alert('This position is fully tied to BO/CO pending triggers. To exit, please cancel or modify the pending orders in the Orders tab.');
                      return;
                    }
                    setPartialExitPos(pos);
                    const ls = pos.lotSize || 1;
                    setPartialExitQty((Math.abs(pos.unencumberedQty) / ls).toString());
                    setPartialExitType('MARKET');
                    setPartialExitPrice(pos.ltp > 0 ? pos.ltp.toFixed(2) : '');
                  } else if (viewMode === 'HOLDINGS') {
                    useStore.getState().openOrderModal(pos.symbol, 'SELL', 1, 'DEL');
                  }
                }}
                style={{ 
                  background: 'var(--bg-panel)', 
                  border: '1px solid rgba(255,255,255,0.05)', 
                  borderRadius: '8px', 
                  padding: '16px',
                  cursor: viewMode === 'CLOSED' ? 'default' : 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'background 0.2s, border-color 0.2s',
                  ':hover': {
                    background: 'rgba(255,255,255,0.03)',
                    borderColor: 'var(--color-blue-dark)'
                  }
                }}
              >
                {/* Left Accent Bar */}
                <div style={{ position: 'absolute', left: 0, top: '16px', bottom: '16px', width: '3px', background: pos.qty > 0 ? 'var(--color-green-light)' : (pos.qty < 0 ? 'var(--color-red-light)' : 'var(--text-muted)'), borderRadius: '0 4px 4px 0' }} />

                {/* Row 1: Symbol & Avg */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingLeft: '12px' }}>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff', letterSpacing: '0.3px' }}>
                    {pos.symbol.replace(/-(EQ|FUT|CE|PE)$/, '')}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                    Avg. ₹{pos.avg.toFixed(2)}
                  </div>
                </div>

                {/* Row 2: LTP & Qty/Side */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingLeft: '12px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                    <span>₹{viewMode === 'CLOSED' ? (pos.exit_price ? parseFloat(pos.exit_price).toFixed(2) : '—') : (pos.ltp > 0 ? pos.ltp.toFixed(2) : '—')}</span>
                    {/* Optional: Add day change % here if available in prices store */}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                    <span>Qty {viewMode === 'CLOSED' ? Math.abs(pos.closed_quantity || 0) : (pos.qty > 0 ? '+' : (pos.qty < 0 ? '-' : ''))}{Math.abs(viewMode === 'CLOSED' ? pos.closed_quantity || 0 : pos.qty)}</span>
                    {(pos.qty !== 0 || viewMode === 'CLOSED') && (
                      <span style={{ 
                        background: pos.qty > 0 || (viewMode === 'CLOSED' && pos.closed_quantity > 0) ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', 
                        color: pos.qty > 0 || (viewMode === 'CLOSED' && pos.closed_quantity > 0) ? 'var(--color-green-light)' : 'var(--color-red-light)', 
                        padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '800' 
                      }}>
                        {pos.qty > 0 || (viewMode === 'CLOSED' && pos.closed_quantity > 0) ? 'B' : 'S'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 3: Invested, Current, P&L */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', paddingLeft: '12px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '500' }}>Invested Value</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>₹{pos.invested.toFixed(2)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '500' }}>Current Value</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
                      {viewMode === 'CLOSED' ? '-' : `₹${currentValue.toFixed(2)}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '500' }}>
                      {viewMode === 'CLOSED' ? 'Realized P&L' : `P&L (${isDisplayProfit ? '▲' : '▼'} ${Math.abs(pnlPercent).toFixed(2)}%)`}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: isDisplayProfit ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                      {isDisplayProfit ? '+' : ''}₹{displayPnl.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Global MTM Banner */}
      <div style={{
        position: 'fixed', bottom: '0', left: '0', right: '0', 
        background: globalMTM >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
        backdropFilter: 'blur(10px)', borderTop: `1px solid ${globalMTM >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
        padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        zIndex: 50, transition: 'all 0.3s ease'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Activity size={24} color={globalMTM >= 0 ? '#10B981' : '#EF4444'} />
          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Portfolio MTM</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Live updates based on market ticks</div>
          </div>
        </div>
        <div style={{ 
          fontSize: '32px', fontWeight: '900', letterSpacing: '-0.5px',
          color: globalMTM >= 0 ? '#10B981' : '#EF4444' 
        }}>
          {globalMTM >= 0 ? '+' : ''}₹{globalMTM.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>

      {/* Partial Exit Modal */}
      {partialExitPos && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-dark)', width: '380px', borderRadius: '12px',
            border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Partial Exit</h3>
              <X size={18} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setPartialExitPos(null)} />
            </div>
            <div style={{ padding: '24px 20px' }}>
              <div style={{ marginBottom: '16px', fontSize: '14px', fontWeight: '600', color: 'var(--color-blue-light)' }}>
                {partialExitPos.symbol}
              </div>
              
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    {partialExitPos.lotSize > 1 ? 'Lots' : 'Qty'} (Max: {Math.abs(partialExitPos.qty) / (partialExitPos.lotSize || 1)})
                  </label>
                  <input
                    type="number"
                    value={partialExitQty}
                    onChange={(e) => setPartialExitQty(e.target.value)}
                    max={Math.abs(partialExitPos.qty) / (partialExitPos.lotSize || 1)}
                    min="1"
                    step="1"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', padding: '8px 12px', borderRadius: '4px', outline: 'none' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Order Type</label>
                  <select
                    value={partialExitType}
                    onChange={(e) => setPartialExitType(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', padding: '8px 12px', borderRadius: '4px', outline: 'none' }}
                  >
                    <option value="MARKET" style={{color:'#000'}}>Market</option>
                    <option value="LIMIT" style={{color:'#000'}}>Limit</option>
                  </select>
                </div>
              </div>

              {partialExitType === 'LIMIT' && (
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Limit Price</label>
                  <input
                    type="number"
                    value={partialExitPrice}
                    onChange={(e) => setPartialExitPrice(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', padding: '8px 12px', borderRadius: '4px', outline: 'none' }}
                  />
                </div>
              )}

              <button
                onClick={async () => {
                  const inputVal = parseInt(partialExitQty);
                  const ls = partialExitPos.lotSize || 1;
                  const qtyToExit = inputVal * ls;
                  const maxQty = Math.abs(partialExitPos.unencumberedQty);
                  if (!qtyToExit || qtyToExit <= 0 || qtyToExit > maxQty) {
                    alert(`Invalid quantity. Max allowed (unencumbered): ${maxQty / ls} lots`);
                    return;
                  }
                  const exitSide = partialExitPos.qty > 0 ? 'SELL' : 'BUY';
                  const ok = await useStore.getState().placeOrder({
                    symbol: partialExitPos.symbol,
                    type: partialExitType,
                    side: exitSide,
                    quantity: qtyToExit,
                    price: partialExitType === 'MARKET' ? 0 : parseFloat(partialExitPrice),
                    sl_price: null,
                    tgt_price: null,
                    margin: 0,
                    product_type: partialExitPos.product_type || 'DEL'
                  });
                  if (ok) {
                    setPartialExitPos(null);
                  } else {
                    alert('Exit failed. Check the browser console (F12) for error details.');
                  }
                }}
                style={{
                  width: '100%', background: partialExitPos.qty > 0 ? 'var(--color-red)' : 'var(--color-blue)',
                  color: '#fff', border: 'none', padding: '12px', borderRadius: '6px', fontSize: '14px',
                  fontWeight: 'bold', cursor: 'pointer', marginTop: partialExitType === 'MARKET' ? '12px' : '0'
                }}
              >
                {partialExitPos.qty > 0 ? 'SELL' : 'BUY'} {partialExitQty} {partialExitPos.lotSize > 1 ? 'LOTS' : 'QTY'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
