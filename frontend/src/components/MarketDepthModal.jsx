import React, { useEffect } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { X } from 'lucide-react';
import { socket } from '../store'; // Import socket to emit subscribe events

export default function MarketDepthModal() {
  const { marketDepthModal, closeMarketDepthModal, marketDepthData, prices, oneClickMode, oneClickMultiplier, placeOrder, openOrderModal, orderModal } = useStore(useShallow(state => ({ marketDepthModal: state.marketDepthModal, closeMarketDepthModal: state.closeMarketDepthModal, marketDepthData: state.marketDepthData, prices: state.prices, oneClickMode: state.oneClickMode, oneClickMultiplier: state.oneClickMultiplier, placeOrder: state.placeOrder, openOrderModal: state.openOrderModal, orderModal: state.orderModal })));

  const symbol = marketDepthModal.symbol;
  const basicData = prices[symbol] || {};
  const lotSize = marketDepthModal.lotsize || basicData.lotsize || 1;

  useEffect(() => {
    if (!marketDepthModal.isOpen || !symbol) return;

    // Emit subscribe_depth to backend
    socket.emit('subscribe_depth', symbol);

    return () => {
      // Emit unsubscribe_depth when modal closes
      socket.emit('unsubscribe_depth', symbol);
    };
  }, [marketDepthModal.isOpen, symbol]);

  if (!marketDepthModal.isOpen || !symbol) return null;

  // Use real data from store, fallback to fake data if market is closed (empty arrays)
  let bids = marketDepthData?.symbol === symbol ? marketDepthData.bids : [];
  let asks = marketDepthData?.symbol === symbol ? marketDepthData.asks : [];

  if (bids.length === 0 && asks.length === 0) {
    const ltp = basicData?.ltp || 100;
    bids = [
      { orders: 3, qty: 150, price: (ltp - 0.5).toFixed(2) },
      { orders: 1, qty: 50, price: (ltp - 1.0).toFixed(2) },
      { orders: 5, qty: 300, price: (ltp - 1.5).toFixed(2) },
      { orders: 2, qty: 100, price: (ltp - 2.0).toFixed(2) },
      { orders: 8, qty: 850, price: (ltp - 2.5).toFixed(2) }
    ];
    asks = [
      { orders: 2, qty: 200, price: (ltp + 0.5).toFixed(2) },
      { orders: 4, qty: 120, price: (ltp + 1.0).toFixed(2) },
      { orders: 1, qty: 10, price: (ltp + 1.5).toFixed(2) },
      { orders: 7, qty: 500, price: (ltp + 2.0).toFixed(2) },
      { orders: 3, qty: 150, price: (ltp + 2.5).toFixed(2) }
    ];
  }

  const displayBids = bids.map(b => ({ ...b, qty: Math.round(b.qty / lotSize) }));
  const displayAsks = asks.map(a => ({ ...a, qty: Math.round(a.qty / lotSize) }));

  const totalBidQty = (marketDepthData?.symbol === symbol && marketDepthData.totBuyQuan) ? Math.round(marketDepthData.totBuyQuan / lotSize) : displayBids.reduce((sum, b) => sum + (b.qty || 0), 0);
  const totalAskQty = (marketDepthData?.symbol === symbol && marketDepthData.totSellQuan) ? Math.round(marketDepthData.totSellQuan / lotSize) : displayAsks.reduce((sum, a) => sum + (a.qty || 0), 0);
  
  // Calculate width ratio for progress bars
  const totalVol = totalBidQty + totalAskQty;
  const bidRatio = totalVol ? (totalBidQty / totalVol) * 100 : 50;
  const askRatio = totalVol ? (totalAskQty / totalVol) * 100 : 50;

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: orderModal?.isOpen ? 'none' : 'rgba(0,0,0,0.6)',
      backdropFilter: orderModal?.isOpen ? 'none' : 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
      pointerEvents: orderModal?.isOpen ? 'none' : 'auto'
    }}>
      <div className={orderModal?.isOpen ? 'order-modal-companion' : ''} style={{
        width: '500px', background: 'var(--bg-dark)', borderRadius: '8px',
        border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        transform: orderModal?.isOpen ? 'translateX(260px)' : 'none',
        transition: 'transform 0.3s ease-in-out',
        pointerEvents: 'auto'
      }}>
        
        {/* Header */}
        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>Market Depth</h2>
             <span style={{ fontSize: '12px', background: 'var(--bg-panel)', padding: '4px 8px', borderRadius: '4px', fontWeight: '600' }}>{symbol.split('-')[0]}</span>
          </div>
          <button onClick={closeMarketDepthModal} style={{ background: 'var(--bg-panel)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={16} /></button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
             <div style={{ color: 'var(--color-blue)', fontSize: '12px', fontWeight: 'bold' }}>BID</div>
             <div style={{ color: 'var(--color-red-light)', fontSize: '12px', fontWeight: 'bold', textAlign: 'right' }}>ASK</div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)', padding: '8px 0' }}>
             {/* Bid Header */}
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1.5fr', textAlign: 'right' }}>
                <span style={{ textAlign: 'left' }}>Orders</span>
                <span>Qty</span>
                <span>Price</span>
             </div>
             {/* Ask Header */}
             <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr', textAlign: 'right' }}>
                <span style={{ textAlign: 'left' }}>Price</span>
                <span>Qty</span>
                <span>Orders</span>
             </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
             {/* Bids Column */}
             <div>
                {displayBids.map((bid, i) => (
                  <div key={i} style={{ 
                    display: 'grid', gridTemplateColumns: '1fr 1.5fr 1.5fr', textAlign: 'right', padding: '6px 0', fontSize: '12px', fontWeight: '500',
                    background: bid.changed ? 'rgba(34, 197, 94, 0.1)' : 'transparent', transition: 'background 0.3s'
                  }}>
                    <span style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>{bid.orders}</span>
                    <span style={{ color: 'var(--color-blue)' }}>{bid.qty}</span>
                    <span style={{ color: 'var(--color-blue)' }}>{bid.price}</span>
                  </div>
                ))}
             </div>
             
             {/* Asks Column */}
             <div>
                {displayAsks.map((ask, i) => (
                  <div key={i} style={{ 
                    display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr', textAlign: 'right', padding: '6px 0', fontSize: '12px', fontWeight: '500',
                    background: ask.changed ? 'rgba(239, 68, 68, 0.1)' : 'transparent', transition: 'background 0.3s'
                  }}>
                    <span style={{ color: 'var(--color-red-light)', textAlign: 'left' }}>{ask.price}</span>
                    <span style={{ color: 'var(--color-red-light)' }}>{ask.qty}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{ask.orders}</span>
                  </div>
                ))}
             </div>
          </div>
          
          {/* Total Quantity & Bar */}
          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-blue)' }}>Total Buy Qty: {totalBidQty.toLocaleString()}</span>
                <span style={{ color: 'var(--color-red-light)' }}>Total Sell Qty: {totalAskQty.toLocaleString()}</span>
             </div>
             <div style={{ display: 'flex', height: '6px', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${bidRatio}%`, background: 'var(--color-blue)', transition: 'width 0.3s' }}></div>
                <div style={{ width: `${askRatio}%`, background: 'var(--color-red)', transition: 'width 0.3s' }}></div>
             </div>
          </div>

          {/* Market Stats Grid */}
          <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px', rowGap: '12px' }}>
            
            {/* Left Column */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>P. Close</span>
              <span style={{ textAlign: 'right', fontWeight: '500' }}>{marketDepthData?.symbol === symbol && marketDepthData.close ? marketDepthData.close : (basicData.close || '-')}</span>
              
              <span style={{ color: 'var(--text-secondary)' }}>High</span>
              <span style={{ textAlign: 'right', fontWeight: '500' }}>{marketDepthData?.symbol === symbol && marketDepthData.high ? marketDepthData.high : (basicData.high || '-')}</span>
              
              <span style={{ color: 'var(--text-secondary)' }}>Volume</span>
              <span style={{ textAlign: 'right', fontWeight: '500' }}>{marketDepthData?.symbol === symbol && marketDepthData.volume !== undefined && marketDepthData.volume !== null ? marketDepthData.volume.toLocaleString() : (basicData.volume !== undefined ? basicData.volume.toLocaleString() : '-')}</span>
              
              <span style={{ color: 'var(--text-secondary)' }}>Change</span>
              <span style={{ textAlign: 'right', fontWeight: '500', color: (marketDepthData?.symbol === symbol ? marketDepthData.ltp : basicData.ltp) > (marketDepthData?.symbol === symbol ? marketDepthData.close : basicData.close) ? 'var(--color-blue)' : 'var(--color-red)' }}>
                {(() => {
                  const currentLtp = marketDepthData?.symbol === symbol && marketDepthData.ltp ? marketDepthData.ltp : basicData.ltp;
                  const currentClose = marketDepthData?.symbol === symbol && marketDepthData.close ? marketDepthData.close : basicData.close;
                  if (currentLtp && currentClose) {
                    return `${(currentLtp - currentClose).toFixed(2)} (${(((currentLtp - currentClose)/currentClose)*100).toFixed(2)}%)`;
                  }
                  return '-';
                })()}
              </span>
              
              <span style={{ color: 'var(--text-secondary)' }}>LTQ</span>
              <span style={{ textAlign: 'right', fontWeight: '500' }}>{marketDepthData?.symbol === symbol && marketDepthData.ltq !== undefined && marketDepthData.ltq !== null ? marketDepthData.ltq : (basicData.ltq !== undefined ? basicData.ltq : '-')}</span>
              
              <span style={{ color: 'var(--text-secondary)' }}>LC</span>
              <span style={{ textAlign: 'right', fontWeight: '500' }}>{marketDepthData?.symbol === symbol && marketDepthData.lowerCircuit !== undefined && marketDepthData.lowerCircuit !== null ? marketDepthData.lowerCircuit : (basicData.lowerCircuit !== undefined ? basicData.lowerCircuit : '-')}</span>
            </div>

            {/* Right Column */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Open</span>
              <span style={{ textAlign: 'right', fontWeight: '500' }}>{marketDepthData?.symbol === symbol && marketDepthData.open ? marketDepthData.open : (basicData.open || '-')}</span>
              
              <span style={{ color: 'var(--text-secondary)' }}>Low</span>
              <span style={{ textAlign: 'right', fontWeight: '500' }}>{marketDepthData?.symbol === symbol && marketDepthData.low ? marketDepthData.low : (basicData.low || '-')}</span>
              
              <span style={{ color: 'var(--text-secondary)' }}>Avg. Price</span>
              <span style={{ textAlign: 'right', fontWeight: '500' }}>{marketDepthData?.symbol === symbol && marketDepthData.avgPrice !== undefined && marketDepthData.avgPrice !== null ? marketDepthData.avgPrice : (basicData.avgPrice !== undefined ? basicData.avgPrice : '-')}</span>
              
              <span style={{ color: 'var(--text-secondary)' }}>LTP</span>
              <span style={{ textAlign: 'right', fontWeight: '500' }}>{marketDepthData?.symbol === symbol && marketDepthData.ltp ? marketDepthData.ltp : (basicData.ltp || '-')}</span>
              
              <span style={{ color: 'var(--text-secondary)' }}>LTT</span>
              <span style={{ textAlign: 'right', fontWeight: '500' }}>{marketDepthData?.symbol === symbol && marketDepthData.ltt ? marketDepthData.ltt : (basicData.ltt || '-')}</span>
              
              <span style={{ color: 'var(--text-secondary)' }}>UC</span>
              <span style={{ textAlign: 'right', fontWeight: '500' }}>{marketDepthData?.symbol === symbol && marketDepthData.upperCircuit !== undefined && marketDepthData.upperCircuit !== null ? marketDepthData.upperCircuit : (basicData.upperCircuit !== undefined ? basicData.upperCircuit : '-')}</span>
            </div>

          </div>
          
          {/* Action Buttons */}
          <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
             <button 
                onClick={() => {
                  if (oneClickMode) {
                    const payload = {
                      symbol,
                      type: 'MARKET',
                      side: 'BUY',
                      quantity: marketDepthModal.lotsize ? (marketDepthModal.lotsize * (oneClickMultiplier || 1)) : (oneClickMultiplier || 1),
                      price: (marketDepthData?.symbol === symbol ? marketDepthData.ltp : basicData.ltp) || 0,
                      trigger_price: null,
                      sl_price: null,
                      tgt_price: null,
                      margin: 0,
                      product_type: 'INT'
                    };
                    placeOrder(payload);
                  } else {
                    closeMarketDepthModal();
                    openOrderModal(symbol, 'BUY', marketDepthModal.lotsize || 1);
                  }
                }}
                className={`btn btn-primary ${oneClickMode ? 'one-click-active' : ''}`}
                style={{ flex: 1, background: 'var(--color-blue)', border: 'none' }}
                title={oneClickMode ? `INSTANT BUY ${oneClickMultiplier}x LOTS` : 'Buy'}
             >
                {oneClickMode ? `INSTANT BUY (${oneClickMultiplier}x)` : 'BUY'}
             </button>
             <button 
                onClick={() => {
                  if (oneClickMode) {
                    const payload = {
                      symbol,
                      type: 'MARKET',
                      side: 'SELL',
                      quantity: marketDepthModal.lotsize ? (marketDepthModal.lotsize * (oneClickMultiplier || 1)) : (oneClickMultiplier || 1),
                      price: (marketDepthData?.symbol === symbol ? marketDepthData.ltp : basicData.ltp) || 0,
                      trigger_price: null,
                      sl_price: null,
                      tgt_price: null,
                      margin: 0,
                      product_type: 'INT'
                    };
                    placeOrder(payload);
                  } else {
                    closeMarketDepthModal();
                    openOrderModal(symbol, 'SELL', marketDepthModal.lotsize || 1);
                  }
                }}
                className={`btn btn-secondary ${oneClickMode ? 'one-click-active' : ''}`}
                style={{ flex: 1, background: 'var(--color-red)', border: 'none', color: '#fff' }}
                title={oneClickMode ? `INSTANT SELL ${oneClickMultiplier}x LOTS` : 'Sell'}
             >
                {oneClickMode ? `INSTANT SELL (${oneClickMultiplier}x)` : 'SELL'}
             </button>
          </div>

        </div>
      </div>
    </div>
  );
}
