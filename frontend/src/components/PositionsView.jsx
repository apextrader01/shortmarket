import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Briefcase, TrendingUp, TrendingDown, Target, Activity, X } from 'lucide-react';

const extractUnderlying = (symbol) => {
  const match = symbol.match(/^[A-Z]+/);
  return match ? match[0] : symbol;
};

export default function PositionsView() {
  const { positions, prices } = useStore();
  const [partialExitPos, setPartialExitPos] = useState(null);
  const [partialExitQty, setPartialExitQty] = useState('');
  const [partialExitType, setPartialExitType] = useState('MARKET');
  const [partialExitPrice, setPartialExitPrice] = useState('');

  // Group positions by underlying asset
  const { groupedStrategies, globalMTM } = useMemo(() => {
    let globalMTM = 0;
    const groups = {};

    positions.forEach(pos => {
      if (pos.quantity === 0) return;
      const underlying = extractUnderlying(pos.symbol);
      if (!groups[underlying]) {
        groups[underlying] = { underlying, positions: [], netPnl: 0, totalInvested: 0 };
      }
      
      const priceData = prices[pos.symbol] || {};
      const ltp = priceData.ltp || 0;
      const avg = parseFloat(pos.average_price) || 0;
      const qty = pos.quantity || 0;
      
      const invested = avg * Math.abs(qty);
      const currentValue = ltp * Math.abs(qty);
      const pnl = qty > 0 ? (currentValue - invested) : (invested - currentValue);
      const lotSize = priceData.lotsize || 1;
      
      groups[underlying].positions.push({ ...pos, ltp, avg, qty, pnl, invested, lotSize });
      groups[underlying].netPnl += pnl;
      groups[underlying].totalInvested += invested;
      globalMTM += pnl;
    });

    return { groupedStrategies: Object.values(groups), globalMTM };
  }, [positions, prices]);

  if (positions.length === 0 || groupedStrategies.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)' }}>
        <div style={{ 
          width: '120px', height: '100px', background: 'var(--bg-panel)', 
          borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)', marginBottom: '24px', position: 'relative'
        }}>
          <Briefcase size={40} color="var(--color-green-light)" />
          <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '24px' }}>✨</div>
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>You do not have any positions</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>List of all your positions for today will appear here.</p>
      </div>
    );
  }

  const exitAllPositions = async () => {
    if (window.confirm('Are you sure you want to EXIT ALL open positions at market price?')) {
      const store = useStore.getState();
      for (const pos of positions) {
        if (pos.quantity === 0) continue;
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
        }
      }
    }
  };

  const exitStrategyGroup = async (groupPositions) => {
    if (window.confirm('Are you sure you want to exit all positions in this strategy?')) {
      const store = useStore.getState();
      for (const pos of groupPositions) {
        if (pos.quantity === 0) continue;
        const exitSide = pos.quantity > 0 ? 'SELL' : 'BUY';
        await store.placeOrder({
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
      }
    }
  };

  return (
    <div style={{ padding: '24px', paddingBottom: '100px', width: '100%', background: 'var(--bg-dark)', overflowY: 'auto', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '800' }}>Live Strategies</h2>
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
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {groupedStrategies.map((group, idx) => {
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
                    <th style={{ textAlign: 'right' }}>LTP</th>
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
                        <td style={{ textAlign: 'right', color: pos.qty > 0 ? '#60A5FA' : '#F87171', fontWeight: 'bold' }}>
                          {pos.qty > 0 ? '+' : ''}{pos.qty}
                        </td>
                        <td style={{ textAlign: 'right' }}>₹{pos.avg.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: '600' }}>{pos.ltp > 0 ? `₹${pos.ltp.toFixed(2)}` : '—'}</td>
                        <td style={{ 
                          textAlign: 'right', paddingRight: '20px',
                          fontWeight: '700',
                          color: isProfit ? 'var(--color-green-light)' : 'var(--color-red-light)'
                        }}>
                          {pos.pnl > 0 ? '+' : ''}{pos.pnl.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right', paddingRight: '20px' }}>
                          <button
                            onClick={() => {
                              setPartialExitPos(pos);
                              const ls = pos.lotSize || 1;
                              setPartialExitQty((Math.abs(pos.qty) / ls).toString());
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
                  if (qtyToExit > 0 && qtyToExit <= Math.abs(partialExitPos.qty)) {
                    const exitSide = partialExitPos.qty > 0 ? 'SELL' : 'BUY';
                    await useStore.getState().placeOrder({
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
                    setPartialExitPos(null);
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
