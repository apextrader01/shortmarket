import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useStore, socket } from '../store';
import { X } from 'lucide-react';

export default function DOMLadderModal() {
  const { 
    domLadderModal, closeDomLadderModal, marketDepthData, prices, 
    oneClickMode, oneClickMultiplier, placeOrder, openOrderModal
  } = useStore();

  const symbol = domLadderModal.symbol;
  const basicData = prices[symbol] || {};
  const lotsize = domLadderModal.lotsize || basicData.lotsize || 1;
  
  const [centerPrice, setCenterPrice] = useState(0);
  const scrollRef = useRef(null);
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    if (!domLadderModal.isOpen || !symbol) return;
    socket.emit('subscribe_depth', symbol);
    return () => socket.emit('unsubscribe_depth', symbol);
  }, [domLadderModal.isOpen, symbol]);

  let refPrice = parseFloat(marketDepthData?.symbol === symbol && marketDepthData.ltp ? marketDepthData.ltp : basicData.ltp);
  if (!refPrice || isNaN(refPrice) || refPrice === 0) {
    refPrice = parseFloat(marketDepthData?.symbol === symbol && marketDepthData.close ? marketDepthData.close : basicData.close);
  }
  if (!refPrice || isNaN(refPrice) || refPrice === 0) {
    if (marketDepthData?.symbol === symbol && marketDepthData.bids?.length > 0) refPrice = parseFloat(marketDepthData.bids[0].price);
    else if (marketDepthData?.symbol === symbol && marketDepthData.asks?.length > 0) refPrice = parseFloat(marketDepthData.asks[0].price);
  }

  const ltp = marketDepthData?.symbol === symbol && marketDepthData.ltp ? parseFloat(marketDepthData.ltp) : parseFloat(basicData.ltp);

  // Set the initial center price when we first get a reference price
  useEffect(() => {
    if (domLadderModal.isOpen && refPrice > 0 && centerPrice === 0) {
      setCenterPrice(refPrice);
    }
  }, [domLadderModal.isOpen, refPrice, centerPrice]);

  if (!domLadderModal.isOpen || !symbol) return null;

  // Use real data from store, fallback to empty array
  const rawBids = marketDepthData?.symbol === symbol ? marketDepthData.bids : [];
  const rawAsks = marketDepthData?.symbol === symbol ? marketDepthData.asks : [];

  const bids = rawBids.map(b => ({ ...b, qty: Math.round(b.qty / lotsize) }));
  const asks = rawAsks.map(a => ({ ...a, qty: Math.round(a.qty / lotsize) }));

  // Generate a price ladder (e.g., 20 ticks above and 20 ticks below centerPrice)
  // Standard Indian market tick size is 0.05
  const tickSize = 0.05;
  const ladderRows = [];
  
  if (centerPrice > 0) {
    const startPrice = centerPrice + (30 * tickSize); // Highest price at top
    const endPrice = centerPrice - (30 * tickSize);   // Lowest price at bottom
    
    for (let p = startPrice; p >= endPrice; p -= tickSize) {
      // Fix floating point precision
      const cleanPrice = parseFloat(p.toFixed(2));
      ladderRows.push(cleanPrice);
    }
  }

  const handleOrder = (price, side) => {
    if (oneClickMode) {
      const payload = {
        symbol,
        type: 'LIMIT',
        side,
        quantity: lotsize * (oneClickMultiplier || 1),
        price: parseFloat(price),
        trigger_price: null,
        sl_price: null,
        tgt_price: null,
        margin: 0,
        product_type: 'INT'
      };
      placeOrder(payload);
    } else {
      closeDomLadderModal();
      // Need to pre-fill the order modal with this limit price.
      openOrderModal(symbol, side, lotsize);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
    }}>
      <div style={{
        width: '400px', background: 'var(--bg-dark)', borderRadius: '8px', 
        border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '80vh'
      }}>
        
        {/* Header */}
        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>DOM Ladder</h2>
             <span style={{ fontSize: '12px', background: 'var(--bg-panel)', padding: '4px 8px', borderRadius: '4px', fontWeight: '600' }}>{symbol.split('-')[0]}</span>
          </div>
          <button onClick={closeDomLadderModal} style={{ background: 'var(--bg-panel)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={16} /></button>
        </div>

        {/* Content Headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '12px 20px', borderBottom: '1px solid var(--border-color)', fontSize: '12px', fontWeight: 'bold' }}>
           <div style={{ color: 'var(--color-blue)', textAlign: 'center' }}>BID QTY</div>
           <div style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>PRICE</div>
           <div style={{ color: 'var(--color-red-light)', textAlign: 'center' }}>ASK QTY</div>
        </div>

        {/* Scrollable Ladder */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
           {ladderRows.length === 0 ? (
             <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Waiting for tick data...</div>
           ) : (
             ladderRows.map((price, i) => {
               const isLTP = price.toFixed(2) === (ltp || 0).toFixed(2);
               const bid = bids.find(b => parseFloat(b.price).toFixed(2) === price.toFixed(2));
               const ask = asks.find(a => parseFloat(a.price).toFixed(2) === price.toFixed(2));
               
               return (
                 <div key={i} style={{ 
                   display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', 
                   background: isLTP ? 'rgba(255,255,255,0.1)' : (i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'),
                   fontSize: '13px', fontWeight: isLTP ? 'bold' : '500', height: '32px'
                 }}>
                   
                   {/* Bid Column */}
                   <div 
                     onClick={() => handleOrder(price, 'BUY')}
                     className={`ladder-cell bid-cell ${oneClickMode ? 'one-click' : ''}`}
                     style={{ 
                       textAlign: 'center', color: 'var(--color-blue)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                       background: bid ? 'rgba(34, 197, 94, 0.15)' : 'transparent', borderRight: '1px solid var(--border-color)', position: 'relative'
                     }}
                     title={oneClickMode ? `INSTANT BUY LIMIT @ ${price.toFixed(2)}` : `Buy Limit @ ${price.toFixed(2)}`}
                   >
                     {bid ? bid.qty : ''}
                   </div>

                   {/* Price Column */}
                   <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid var(--border-color)', color: isLTP ? '#fff' : 'var(--text-primary)' }}>
                     {price.toFixed(2)}
                   </div>

                   {/* Ask Column */}
                   <div 
                     onClick={() => handleOrder(price, 'SELL')}
                     className={`ladder-cell ask-cell ${oneClickMode ? 'one-click' : ''}`}
                     style={{ 
                       textAlign: 'center', color: 'var(--color-red-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                       background: ask ? 'rgba(239, 68, 68, 0.15)' : 'transparent', position: 'relative'
                     }}
                     title={oneClickMode ? `INSTANT SELL LIMIT @ ${price.toFixed(2)}` : `Sell Limit @ ${price.toFixed(2)}`}
                   >
                     {ask ? ask.qty : ''}
                   </div>

                 </div>
               );
             })
           )}
        </div>
        
        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-panel)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
           <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
             Default Qty: <strong>{lotsize * (oneClickMultiplier || 1)}</strong>
           </div>
           <button 
             onClick={() => setCenterPrice(ltp)}
             style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
           >
             Center to LTP
           </button>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .ladder-cell:hover {
          background: rgba(255,255,255,0.1) !important;
        }
        .ladder-cell.bid-cell.one-click:hover {
          background: var(--color-blue) !important;
          color: white !important;
        }
        .ladder-cell.ask-cell.one-click:hover {
          background: var(--color-red) !important;
          color: white !important;
        }
      `}} />
    </div>
  );
}
