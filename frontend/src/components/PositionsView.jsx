import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { Briefcase, TrendingUp, TrendingDown, Target, Activity, X } from 'lucide-react';

const extractUnderlying = (symbol) => {
  const match = symbol.match(/^[A-Z]+/);
  return match ? match[0] : symbol;
};

export default function PositionsView() {
  const [viewMode, setViewMode] = useState('OPEN'); // 'OPEN' | 'CLOSED' | 'HOLDINGS'
  const { positions, holdings, prices } = useStore(useShallow(state => ({ positions: state.positions, holdings: state.holdings, prices: state.prices })));
  const mergedHoldingsMap = {};
  if (viewMode === 'HOLDINGS') {
    (holdings || []).forEach(h => { mergedHoldingsMap[h.symbol] = { ...h }; });
    (positions || []).filter(p => p.product_type === 'DEL' && p.quantity !== 0).forEach(p => {
      if (mergedHoldingsMap[p.symbol]) {
         const existing = mergedHoldingsMap[p.symbol];
         const newQty = existing.quantity + p.quantity;
         const totalCost = (existing.quantity * parseFloat(existing.average_price)) + (p.quantity * parseFloat(p.average_price));
         existing.quantity = newQty;
         existing.average_price = Math.abs(newQty) > 0 ? totalCost / Math.abs(newQty) : 0;
      } else {
         mergedHoldingsMap[p.symbol] = { ...p };
      }
    });
  }
  
  const sourceData = viewMode === 'HOLDINGS' ? Object.values(mergedHoldingsMap).filter(h => h.quantity > 0) : (positions || []);
  const [partialExitPos, setPartialExitPos] = useState(null);
  const [partialExitQty, setPartialExitQty] = useState('');
  const [partialExitType, setPartialExitType] = useState('MARKET');
  const [partialExitPrice, setPartialExitPrice] = useState('');

  // Group positions by underlying asset
  const { groupedStrategies, globalMTM } = useMemo(() => {
    let globalMTM = 0;
    const groups = {};
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
           // For open positions: aggregate quantity and recalculate avg price
           const currentTotal = Math.abs(Number(agg.quantity)) * parseFloat(agg.average_price || 0);
           const newTotal = Math.abs(posQty) * parseFloat(pos.average_price || 0);
           agg.quantity = Number(agg.quantity) + posQty;
           agg.average_price = Math.abs(agg.quantity) > 0 ? (currentTotal + newTotal) / Math.abs(agg.quantity) : agg.average_price;
         } else {
           // For closed positions: keep the first non-zero avg price, and use weighted avg for exit_price
           if (parseFloat(pos.average_price) > 0 && parseFloat(agg.average_price) === 0) {
             agg.average_price = pos.average_price;
           }
           // Weighted average exit price
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

    Object.values(symbolAgg).forEach(pos => {
      const posQty = Number(pos.quantity) || 0;
      if (posQty === 0 && viewMode === 'OPEN') return;

      const underlying = extractUnderlying(pos.symbol);
      if (!groups[underlying]) {
        groups[underlying] = { underlying, positions: [], netPnl: 0, totalInvested: 0 };
      }
      
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
      
      groups[underlying].positions.push({ ...pos, ltp, avg, qty, pnl, invested, lotSize, isOpen: qty !== 0 });
      groups[underlying].netPnl += pnl;
      groups[underlying].totalInvested += invested;
      globalMTM += pnl;
    });

    return { groupedStrategies: Object.values(groups), globalMTM };
  }, [sourceData, prices, viewMode]);

  // Removed early return to keep the header visible when empty

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

  const exitStrategyGroup = async (groupPositions) => {
    const openLegs = groupPositions.filter(p => p.quantity !== 0 && p.product_type !== 'BO' && p.product_type !== 'CO');
    if (openLegs.length === 0) {
      alert('No valid unencumbered positions to exit in this strategy.');
      return;
    }
    if (!window.confirm(`Exit ${openLegs.length} unencumbered leg(s) in this strategy at market price?`)) return;
    const store = useStore.getState();
    let failed = 0;
    for (const pos of openLegs) {
      const exitSide = pos.quantity > 0 ? 'SELL' : 'BUY';
      const ok = await store.placeOrder({
        symbol: pos.symbol,
        type: 'MARKET',
        side: exitSide,
        quantity: Math.abs(pos.quantity),
        price: 0,
        sl_price: null,
        tgt_price: null,
        margin: 0,
        product_type: pos.product_type || 'DEL'
      });
      if (!ok) failed++;
    }
    if (failed > 0) alert(`${failed} leg(s) failed to exit. Check browser console for details.`);
  };

  return (
    <div style={{ padding: '24px', paddingBottom: '100px', width: '100%', background: 'var(--bg-dark)', overflowY: 'auto', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '800' }}>Strategies</h2>
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
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {sourceData.length === 0 || groupedStrategies.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
            <div style={{ 
              width: '120px', height: '100px', background: 'var(--bg-panel)', 
              borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)', marginBottom: '24px', position: 'relative'
            }}>
              <Briefcase size={40} color="var(--color-green-light)" />
              <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '24px' }}>✨</div>
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>
              {viewMode === 'CLOSED' ? 'No closed positions yet' : viewMode === 'HOLDINGS' ? 'You have no active holdings' : 'You do not have any positions'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>
              {viewMode === 'CLOSED' ? 'Positions you close today will appear here.' : viewMode === 'HOLDINGS' ? 'Long-term delivery positions will appear here on T+1.' : 'List of all your positions for today will appear here.'}
            </p>
          </div>
        ) : groupedStrategies.map((group, idx) => {
          const isGroupProfit = group.netPnl >= 0;
          // Simple visual width for the P&L bar (capped at 100%)
          const barWidth = Math.min(Math.abs(group.netPnl) / (group.totalInvested || 1) * 100, 100);

          return (
            <div key={group.underlying + idx} className="glass-panel" style={{ overflow: 'hidden', padding: 0 }}>
              {/* Group Header */}
              <div style={{ 
                padding: '16px 20px', 
                background: 'rgba(255, 255, 255, 0.03)', 
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ 
                    background: 'rgba(96, 165, 250, 0.15)', color: '#60A5FA', 
                    padding: '8px', borderRadius: '8px' 
                  }}>
                    <Target size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, letterSpacing: '0.5px' }}>{group.underlying} Strategy</h3>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{group.positions.length} active legs</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                  {/* Visual Strategy P&L Bar */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{ 
                      fontSize: '18px', fontWeight: '800', 
                      color: isGroupProfit ? 'var(--color-green-light)' : 'var(--color-red-light)' 
                    }}>
                      {isGroupProfit ? '+' : ''}₹{group.netPnl.toFixed(2)}
                    </span>
                    <div style={{ width: '120px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', display: 'flex', justifyContent: isGroupProfit ? 'flex-start' : 'flex-end' }}>
                      <div style={{ 
                        height: '100%', width: `${barWidth}%`, 
                        background: isGroupProfit ? 'var(--color-green-light)' : 'var(--color-red-light)',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>

                  {viewMode === 'OPEN' && (
                    <button 
                      onClick={() => exitStrategyGroup(group.positions)}
                      style={{ 
                        background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-red-light)', 
                        border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 12px', 
                        borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' 
                      }}
                    >
                      EXIT STRATEGY
                    </button>
                  )}
                </div>
              </div>

              {/* Legs Table */}
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <th style={{ padding: '12px 20px', textAlign: 'left' }}>Instrument</th>
                    <th style={{ textAlign: 'left' }}>Type</th>
                    <th style={{ textAlign: 'right' }}>Qty.</th>
                    <th style={{ textAlign: 'right' }}>Avg. Price</th>
                    <th style={{ textAlign: 'right' }}>{viewMode === 'CLOSED' ? 'Exit Price' : 'LTP'}</th>
                    <th style={{ textAlign: 'right', paddingRight: '20px' }}>P&L</th>
                    <th style={{ textAlign: 'right', paddingRight: '20px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {group.positions.map(pos => {
                    const isProfit = pos.pnl >= 0;
                    return (
                      <tr key={pos.id || pos.symbol} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '12px 20px', fontWeight: '600' }}>{pos.symbol}</td>
                        <td>
                          <span style={{ 
                            background: pos.product_type === 'INT' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                            color: pos.product_type === 'INT' ? '#fef08a' : 'var(--color-green-light)',
                            padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold'
                          }}>{pos.product_type || 'DEL'}</span>
                        </td>
                        <td style={{ textAlign: 'right', color: viewMode === 'CLOSED' ? 'var(--text-secondary)' : (pos.qty > 0 ? '#60A5FA' : '#F87171'), fontWeight: 'bold' }}>
                          {viewMode === 'CLOSED' ? Math.abs(pos.closed_quantity || 0) : (pos.qty > 0 ? '+' : '') + Number(pos.qty)}
                        </td>
                        <td style={{ textAlign: 'right' }}>₹{pos.avg.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: '600' }}>
                          {viewMode === 'CLOSED' ? (pos.exit_price ? `₹${parseFloat(pos.exit_price).toFixed(2)}` : '—') : (pos.ltp > 0 ? `₹${pos.ltp.toFixed(2)}` : '—')}
                        </td>
                        <td style={{ 
                          textAlign: 'right', paddingRight: '20px',
                          fontWeight: '700',
                          color: isProfit ? 'var(--color-green-light)' : 'var(--color-red-light)'
                        }}>
                          {pos.pnl > 0 ? '+' : ''}{pos.pnl.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right', paddingRight: '20px' }}>
                          {viewMode === 'OPEN' && (
                            <button
                              onClick={() => {
                                if (pos.unencumberedQty === 0) {
                                  alert('This position is fully tied to BO/CO pending triggers. To exit, please cancel or modify the pending orders in the Orders tab.');
                                  return;
                                }
                                setPartialExitPos(pos);
                                const ls = pos.lotSize || 1;
                                setPartialExitQty((Math.abs(pos.unencumberedQty) / ls).toString());
                                setPartialExitType('MARKET');
                                setPartialExitPrice(pos.ltp > 0 ? pos.ltp.toFixed(2) : '');
                              }}
                              style={{
                                background: 'transparent',
                                color: 'var(--color-red-light)',
                                border: '1px solid var(--color-red-light)',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                              }}
                            >
                              EXIT
                            </button>
                          )}
                          {viewMode === 'HOLDINGS' && (
                            <button
                              onClick={() => useStore.getState().openOrderModal(pos.symbol, 'SELL', 1, 'DEL')}
                              style={{
                                background: 'transparent',
                                color: 'var(--color-red-light)',
                                border: '1px solid var(--color-red-light)',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                              }}
                            >
                              SELL
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          );
        })}
      </div>

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
