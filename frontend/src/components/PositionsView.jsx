import React, { useMemo, useState, useEffect } from 'react';
import { useStore, API } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { Activity, X } from 'lucide-react';

export default function PositionsView() {
  const [viewMode, setViewMode] = useState('OPEN'); // 'OPEN' | 'CLOSED' | 'HOLDINGS'
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { positions, holdings, prices, orders } = useStore(useShallow(state => ({ positions: state.positions, holdings: state.holdings, prices: state.prices, orders: state.orders })));
  
  const mergedHoldingsMap = {};
  if (viewMode === 'HOLDINGS') {
    (holdings || []).forEach(h => { mergedHoldingsMap[h.symbol] = { ...h }; });
  }
  
  let sourceData = [];
  if (viewMode === 'HOLDINGS') {
    sourceData = Object.values(mergedHoldingsMap).filter(h => h.quantity > 0);
  } else if (viewMode === 'OPEN') {
    sourceData = (positions || []).filter(p => Number(p.quantity) !== 0);
  } else if (viewMode === 'CLOSED') {
    // 1. Include explicit closed positions from database
    const dbClosed = (positions || []).filter(p => Number(p.quantity) === 0);
    
    // 2. Synthesize closed positions from executed orders that recorded realized P&L
    const closedOrdersMap = {};
    (orders || []).forEach(o => {
      const isExecuted = o.status === 'COMPLETED' || o.status === 'COMPLETE' || o.status === 'EXECUTED';
      const hasRealizedPnl = o.realized_pnl !== null && o.realized_pnl !== undefined && Number(o.realized_pnl) !== 0;
      if (isExecuted && hasRealizedPnl) {
        const key = `${o.symbol}-${o.product_type || 'INT'}`;
        if (!closedOrdersMap[key]) {
          closedOrdersMap[key] = {
            id: `closed-ord-${o.id}`,
            symbol: o.symbol,
            product_type: o.product_type || 'INT',
            quantity: 0,
            closed_quantity: 0,
            average_price: Number(o.average_price || o.price || 0),
            exit_price: Number(o.average_price || o.price || 0),
            realized_pnl: 0,
            created_at: o.created_at,
            updated_at: o.updated_at || o.created_at
          };
        }
        closedOrdersMap[key].closed_quantity += Number(o.quantity || 0);
        closedOrdersMap[key].realized_pnl += Number(o.realized_pnl);
        closedOrdersMap[key].exit_price = Number(o.average_price || o.price || closedOrdersMap[key].exit_price);
      }
    });

    const orderClosedList = Object.values(closedOrdersMap);
    
    // Combine and deduplicate
    const combinedMap = {};
    [...dbClosed, ...orderClosedList].forEach(p => {
      const key = `${p.symbol}-${p.product_type}`;
      if (!combinedMap[key]) {
        combinedMap[key] = { ...p };
      } else {
        combinedMap[key].realized_pnl = Number(combinedMap[key].realized_pnl || 0) + Number(p.realized_pnl || 0);
        combinedMap[key].closed_quantity = Number(combinedMap[key].closed_quantity || 0) + Number(p.closed_quantity || 0);
      }
    });

    sourceData = Object.values(combinedMap);
  }
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
         agg.closed_quantity = (parseFloat(agg.closed_quantity) || 0) + (parseFloat(pos.closed_quantity) || 0);
         
         if (isOpen) {
           const currentTotal = Math.abs(Number(agg.quantity)) * parseFloat(agg.average_price || 0);
           const newTotal = Math.abs(posQty) * parseFloat(pos.average_price || 0);
           agg.quantity = Number(agg.quantity) + posQty;
           agg.average_price = Math.abs(agg.quantity) > 0 ? (currentTotal + newTotal) / Math.abs(agg.quantity) : agg.average_price;
         } else {
           if (parseFloat(pos.average_price) > 0 && parseFloat(agg.average_price) === 0) {
             agg.average_price = pos.average_price;
           }
           const prevClosed = parseFloat(agg.closed_quantity) - (parseFloat(pos.closed_quantity) || 0);
           const prevExitTotal = prevClosed * parseFloat(agg.exit_price || 0);
           const newExitTotal = (parseFloat(pos.closed_quantity) || 0) * parseFloat(pos.exit_price || 0);
           const totalClosed = parseFloat(agg.closed_quantity) || 1;
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
    flatList.sort((a, b) => {
        const isAmf = String(a.symbol || '').endsWith('-MF');
        const isBmf = String(b.symbol || '').endsWith('-MF');
        if (isAmf && !isBmf) return 1;
        if (!isAmf && isBmf) return -1;
        return String(a.symbol || '').localeCompare(String(b.symbol || ''));
    });

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
    <div style={{ padding: isMobile ? '12px 12px 80px 12px' : '24px', paddingBottom: '100px', width: '100%', boxSizing: 'border-box', background: 'var(--bg-dark)', overflowY: 'auto', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '12px' : '24px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '16px', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '800', margin: 0 }}>Positions</h2>
          <div style={{ display: 'flex', background: 'var(--bg-hover)', borderRadius: '6px', padding: '3px' }}>
            <button
              onClick={() => setViewMode('OPEN')}
              style={{ background: viewMode === 'OPEN' ? 'var(--color-blue)' : 'transparent', color: viewMode === 'OPEN' ? '#fff' : 'var(--text-primary)', border: 'none', padding: isMobile ? '4px 8px' : '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: isMobile ? '11px' : '13px', fontWeight: '600' }}
            >
              OPEN
            </button>
            <button
              onClick={() => setViewMode('HOLDINGS')}
              style={{ background: viewMode === 'HOLDINGS' ? 'var(--color-blue)' : 'transparent', color: viewMode === 'HOLDINGS' ? '#fff' : 'var(--text-primary)', border: 'none', padding: isMobile ? '4px 8px' : '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: isMobile ? '11px' : '13px', fontWeight: '600' }}
            >
              HOLDINGS
            </button>
            <button
              onClick={() => setViewMode('CLOSED')}
              style={{ background: viewMode === 'CLOSED' ? 'var(--color-blue)' : 'transparent', color: viewMode === 'CLOSED' ? '#fff' : 'var(--text-primary)', border: 'none', padding: isMobile ? '4px 8px' : '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: isMobile ? '11px' : '13px', fontWeight: '600' }}
            >
              CLOSED
            </button>
          </div>
        </div>
        {viewMode === 'OPEN' && flatPositions.length > 0 && (
          <button
            onClick={exitAllPositions}
            style={{
              background: 'var(--color-red-light)', color: '#fff', border: 'none',
              padding: isMobile ? '6px 12px' : '8px 16px', borderRadius: '4px', fontSize: isMobile ? '11px' : '12px', fontWeight: 'bold', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
              width: isMobile ? '100%' : 'auto'
            }}
          >
            EXIT ALL POSITIONS
          </button>
        )}
        {viewMode === 'HOLDINGS' && flatPositions.length > 0 && (
          <button
            onClick={async () => {
              if (!window.confirm(`Are you sure you want to EXIT ALL ${flatPositions.length} active holdings at current market price?`)) return;
              try {
                const res = await fetch(`${API}/api/holdings/exit-all`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' }
                });
                const data = await res.json();
                if (res.ok) {
                  alert(data.message || 'Successfully exited all holdings!');
                  useStore.getState().fetchUserData();
                } else {
                  alert(data.error || 'Failed to exit holdings');
                }
              } catch (e) {
                alert('Error exiting holdings: ' + e.message);
              }
            }}
            style={{
              background: 'var(--color-red-light)', color: '#fff', border: 'none',
              padding: isMobile ? '6px 12px' : '8px 16px', borderRadius: '4px', fontSize: isMobile ? '11px' : '12px', fontWeight: 'bold', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
              width: isMobile ? '100%' : 'auto'
            }}
          >
            EXIT ALL HOLDINGS ⚡
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
        <>
          {!isMobile && (
            <div className="desktop-view">
              <div className="glass-panel" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="responsive-mobile-table positions-layout positions-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)' }}>Symbol</th>
                  <th style={{ textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)' }}>Buy/Sell</th>
                  <th style={{ textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)' }}>Net Quantity</th>
                  <th style={{ textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)' }}>Avg. Price</th>
                  <th style={{ textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)' }}>Last Price (LTP)</th>
                  <th style={{ textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)' }}>Unrealized P&L</th>
                  <th style={{ textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)' }}>Realized P&L</th>
                  <th style={{ textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)' }}>Segment</th>
                  <th style={{ textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)' }}>Exchange</th>
                  <th style={{ textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)' }}>Product</th>
                  <th style={{ textAlign: 'center', paddingRight: '20px', fontWeight: '600', color: 'var(--text-secondary)' }}></th>
                </tr>
              </thead>
              <tbody>
                {flatPositions.map((pos, idx) => {
                  const isProfit = pos.pnl >= 0;
                  const sideText = pos.qty > 0 ? 'Buy' : (pos.qty < 0 ? 'Sell' : '-');
                  const realizedPnl = parseFloat(pos.realized_pnl) || 0;
                  
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s', ':hover': { background: 'rgba(255,255,255,0.02)' } }}>
                      <td data-label="Symbol" style={{ padding: '16px 20px' }}>
                        {pos.symbol.split(':')[1] ? pos.symbol.split(':')[1].split('-')[0] : pos.symbol.split('-')[0]} <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginLeft: '6px', background: 'var(--bg-hover)', padding: '2px 4px', borderRadius: '4px' }}>{pos.symbol.split(':')[0] || 'NSE'}</span>
                      </td>
                      <td data-label="Side" style={{ fontWeight: '600', color: pos.qty > 0 ? 'var(--color-blue-light)' : (pos.qty < 0 ? 'var(--color-red-light)' : 'var(--text-secondary)') }}>
                        {sideText}
                      </td>
                      <td data-label="Net Qty" style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                        {viewMode === 'CLOSED' ? Math.abs(pos.closed_quantity || 0) : Math.abs(pos.qty)}
                      </td>
                      <td style={{ fontWeight: '500' }}>₹{pos.avg.toFixed(2)}</td>
                      <td data-label="LTP" style={{ fontWeight: '500' }}>{viewMode === 'CLOSED' ? (pos.exit_price ? `₹${parseFloat(pos.exit_price).toFixed(2)}` : '—') : (pos.ltp > 0 ? `₹${pos.ltp.toFixed(2)}` : '—')}
                      </td>
                      <td data-label="Unrealized P&L" style={{ fontWeight: '700', color: viewMode === 'CLOSED' ? 'var(--text-muted)' : (isProfit ? 'var(--color-green-light)' : 'var(--color-red-light)') }}>
                        {viewMode === 'CLOSED' ? '-' : `${pos.pnl > 0 ? '+ ' : ''}₹${Math.abs(pos.pnl).toFixed(2)}`}
                      </td>
                      <td data-label="Realized P&L" style={{ fontWeight: '700', color: realizedPnl > 0 ? 'var(--color-green-light)' : (realizedPnl < 0 ? 'var(--color-red-light)' : 'var(--text-muted)') }}>
                        {realizedPnl !== 0 ? `${realizedPnl > 0 ? '+ ' : ''}₹${Math.abs(realizedPnl).toFixed(2)}` : '0'}
                      </td>
                      <td data-label="Segment" style={{ fontWeight: '500' }}>{pos.segment}</td>
                      <td data-label="Exchange" style={{ fontWeight: '500' }}>{pos.exchange}</td>
                      <td data-label="Product" style={{ fontWeight: '500' }}>{pos.productLabel}</td>
                      <td data-label="Actions" style={{ textAlign: 'center', paddingRight: '20px' }}>
                        {viewMode === 'OPEN' && (
                          <X 
                            size={18} 
                            style={{ cursor: 'pointer', color: 'var(--text-secondary)', transition: 'color 0.2s' }}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-red-light)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
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
                          />
                        )}
                        {viewMode === 'HOLDINGS' && (
                          <X 
                            size={18} 
                            style={{ cursor: 'pointer', color: 'var(--text-secondary)', transition: 'color 0.2s' }}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-red-light)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                            onClick={() => useStore.getState().openOrderModal(pos.symbol, 'SELL', pos.lotsize || 1, 'DEL', true, pos.quantity)}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
                </tbody>
            </table>
          </div>
        </div>
          </div>
            )}
          <div className="mobile-view">
            {isMobile && (
              <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                {/* 📊 Compact Kite-Style Positions Summary Bar */}
                <div style={{ 
                  background: 'rgba(255,255,255,0.03)', 
                  border: '1px solid rgba(255,255,255,0.07)', 
                  borderRadius: '8px', 
                  padding: '10px 14px', 
                  marginBottom: '10px',
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}>
                  <div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>Total MTM (Live)</div>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: globalMTM >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                      {globalMTM >= 0 ? '+' : ''}₹{globalMTM.toFixed(2)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>{flatPositions.length} Position(s)</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: '600' }}>
                      {viewMode === 'CLOSED' ? 'Closed Trades' : viewMode === 'HOLDINGS' ? 'T+1 Holdings' : 'Open Positions'}
                    </div>
                  </div>
                </div>

                {/* 📱 High-Density Kite/Fyers Position Rows (6-8 fit on screen) */}
                {flatPositions.map((pos, idx) => {
                  const isProfit = pos.pnl >= 0;
                  const realizedPnl = parseFloat(pos.realized_pnl) || 0;
                  const pnlPercent = pos.invested > 0 ? (pos.pnl / pos.invested) * 100 : 0;
                  const displayPnl = viewMode === 'CLOSED' ? realizedPnl : pos.pnl;
                  const isDisplayProfit = displayPnl >= 0;
                  const sideText = pos.qty > 0 ? 'BUY' : (pos.qty < 0 ? 'SELL' : '-');
                  const isBuy = pos.qty > 0 || (viewMode === 'CLOSED' && pos.closed_quantity > 0);

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
                          useStore.getState().openOrderModal(pos.symbol, 'SELL', pos.lotsize || 1, 'DEL', true, pos.quantity);
                        }
                      }}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        background: 'transparent',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                        cursor: viewMode === 'CLOSED' ? 'default' : 'pointer'
                      }}
                    >
                      {/* Line 1: Product/Segment & Side (Left) | PnL Value (Right) */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: '3px', fontWeight: '600' }}>
                            {pos.productLabel || (viewMode === 'HOLDINGS' ? 'CNC' : 'NRML')}
                          </span>
                          <span style={{ fontSize: '10.5px', fontWeight: '700', color: isBuy ? 'var(--color-green-light)' : 'var(--color-red-light)', background: isBuy ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', padding: '1px 5px', borderRadius: '3px' }}>
                            {viewMode === 'CLOSED' ? 'CLOSED' : sideText}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: isDisplayProfit ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                          {viewMode === 'CLOSED' ? 'Realized: ' : 'MTM: '}{isDisplayProfit ? '+' : ''}₹{displayPnl.toFixed(2)}
                        </div>
                      </div>

                      {/* Line 2: Symbol Name (Left) | PnL % (Right) */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '68%' }}>
                          {pos.symbol.split(':')[1] ? pos.symbol.split(':')[1].split('-')[0] : pos.symbol.split('-')[0]}
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: isDisplayProfit ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                          ({isDisplayProfit ? '+' : ''}{pnlPercent.toFixed(2)}%)
                        </div>
                      </div>

                      {/* Line 3: Qty & Avg Price (Left) | LTP (Right) */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                        <div>
                          Qty: {viewMode === 'CLOSED' ? Math.abs(pos.closed_quantity || 0) : Math.abs(pos.qty)} • Avg: ₹{pos.avg.toFixed(2)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>LTP: ₹{viewMode === 'CLOSED' ? (pos.exit_price ? parseFloat(pos.exit_price).toFixed(2) : '—') : (pos.ltp > 0 ? pos.ltp.toFixed(2) : '—')}</span>
                          {viewMode === 'OPEN' && (
                            <span style={{ fontSize: '10px', color: 'var(--color-red-light)', border: '1px solid rgba(239,68,68,0.3)', padding: '1px 4px', borderRadius: '3px', fontWeight: '600' }}>
                              Exit ✕
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Global MTM Banner (Only on desktop to avoid covering mobile bottom nav) */}
        {!isMobile && (
          <div style={{
            position: 'fixed', bottom: '24px', right: '24px', 
            background: 'var(--bg-panel)',
            backdropFilter: 'blur(16px)', 
            border: `1px solid ${globalMTM >= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
            boxShadow: `0 12px 40px ${globalMTM >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`,
            borderRadius: '16px',
            padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '32px',
            zIndex: 50, transition: 'all 0.3s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Activity size={24} color={globalMTM >= 0 ? '#10B981' : '#EF4444'} />
              <div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Portfolio MTM</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Live market ticks</div>
              </div>
            </div>
            <div style={{ 
              fontSize: '28px', fontWeight: '900', letterSpacing: '-0.5px',
              color: globalMTM >= 0 ? '#10B981' : '#EF4444' 
            }}>
              {globalMTM >= 0 ? '+' : ''}₹{globalMTM.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        )}

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
                    step="any"
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '4px', outline: 'none' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Order Type</label>
                  <select
                    value={partialExitType}
                    onChange={(e) => setPartialExitType(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '4px', outline: 'none' }}
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
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '4px', outline: 'none' }}
                  />
                </div>
              )}

              <button
                onClick={async () => {
                  const inputVal = parseFloat(partialExitQty);
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
                  color: 'var(--text-primary)', border: 'none', padding: '12px', borderRadius: '6px', fontSize: '14px',
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











