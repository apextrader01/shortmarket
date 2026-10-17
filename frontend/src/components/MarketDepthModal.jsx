import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { X } from 'lucide-react';
import { socket } from '../store'; // Import socket to emit subscribe events
import { getInstantLotsize, isDerivativeContract, isCommodityContract, isIndexContract } from '../utils/lotsizeHelper';
import { getFreezeLimit, calculateOrderSlices } from '../utils/freezeLimits';
import { getMarketSession } from '../utils/marketTiming';

export default function MarketDepthModal() {
  const marketDepthModal = useStore(state => state.marketDepthModal);
  const symbol = marketDepthModal.symbol;
  const basicData = useStore(state => symbol ? state.prices[symbol] : null) || {};
  const marketDepthData = useStore(state => state.marketDepthData);
  const oneClickMode = useStore(state => state.oneClickMode);
  const oneClickMultiplier = useStore(state => state.oneClickMultiplier);
  const orderModal = useStore(state => state.orderModal);
  const { closeMarketDepthModal, placeOrder, openOrderModal } = useStore.getState();
  const [isPlacing, setIsPlacing] = useState(false);

  const lotSize = (marketDepthModal.lotsize && Number(marketDepthModal.lotsize) > 1) ? Number(marketDepthModal.lotsize) : (basicData.lotsize && Number(basicData.lotsize) > 1) ? Number(basicData.lotsize) : getInstantLotsize(symbol);

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

  // Use real data from the price_snapshot (basicData) which includes market depth
  let bids = basicData.bids || [];
  let asks = basicData.asks || [];

  // Do not divide by lotSize, Fyers provides exact share quantity for bids/asks
  const displayBids = bids.map(b => ({ ...b, qty: Math.round(b.qty) }));
  const displayAsks = asks.map(a => ({ ...a, qty: Math.round(a.qty) }));

  const totalBidQty = basicData.totBuyQuan ? Math.round(basicData.totBuyQuan) : displayBids.reduce((sum, b) => sum + (b.qty || 0), 0);
  const totalAskQty = basicData.totSellQuan ? Math.round(basicData.totSellQuan) : displayAsks.reduce((sum, a) => sum + (a.qty || 0), 0);
  
  // Calculate width ratio for progress bars
  const totalVol = totalBidQty + totalAskQty;
  const bidRatio = totalVol ? (totalBidQty / totalVol) * 100 : 50;
  const askRatio = totalVol ? (totalAskQty / totalVol) * 100 : 50;

  const handleOneClickOrder = async (side) => {
    if (isPlacing) return;

    const token = localStorage.getItem('token') || useStore.getState().token;
    if (!token) {
      useStore.getState().showToast('Please login to place paper trades.', 'error', 'Authentication Required');
      return;
    }

    const cleanSym = symbol ? symbol.replace(/^(NSE:|BSE:|MCX:)/i, '') : '';
    const baseSym = cleanSym.replace(/-(EQ|A|B|T|X|XT|Z|P|M|SM|BE|BZ|INDEX)$/i, '');
    const isCommodity = isCommodityContract(symbol);
    const isIndex = isIndexContract(symbol);
    const isDerivative = isDerivativeContract(symbol);

    const effectiveLotSize = (marketDepthModal.lotsize && Number(marketDepthModal.lotsize) > 0)
      ? Number(marketDepthModal.lotsize)
      : (basicData.lotsize && Number(basicData.lotsize) > 0)
        ? Number(basicData.lotsize)
        : getInstantLotsize(symbol);

    const multiplier = Math.max(1, parseInt(oneClickMultiplier, 10) || 1);
    const totalQty = Math.max(1, Math.round(effectiveLotSize * multiplier));

    // Strict Exchange Freeze Limit Validation
    const freezeLimit = getFreezeLimit(symbol, effectiveLotSize);
    if (freezeLimit > 0 && totalQty > freezeLimit) {
      const maxLots = effectiveLotSize > 1 ? Math.floor(freezeLimit / effectiveLotSize) : freezeLimit;
      const err = effectiveLotSize > 1
        ? `Order quantity (${totalQty.toLocaleString('en-IN')} qty / ${multiplier} lots) exceeds exchange freeze limit of ${freezeLimit.toLocaleString('en-IN')} (${maxLots} lots max) for ${symbol}.`
        : `Order quantity (${totalQty.toLocaleString('en-IN')} shares) exceeds exchange freeze limit of ${freezeLimit.toLocaleString('en-IN')} shares for ${symbol}.`;
      useStore.getState().showToast(err, 'error', 'Freeze Limit Exceeded');
      return;
    }

    // Comprehensive Live Price Resolution
    const allPrices = useStore.getState().prices || {};
    const resolvedLtp = Number(
      (marketDepthData?.symbol === symbol && Number(marketDepthData.ltp) > 0) ? marketDepthData.ltp :
      (Number(basicData.ltp) > 0) ? basicData.ltp :
      allPrices[symbol]?.ltp ||
      allPrices[cleanSym]?.ltp ||
      allPrices[baseSym]?.ltp ||
      allPrices[`NSE:${cleanSym}`]?.ltp ||
      allPrices[`BSE:${cleanSym}`]?.ltp ||
      allPrices[`MCX:${cleanSym}`]?.ltp ||
      basicData.close ||
      basicData.prev_close ||
      basicData.open ||
      0
    );

    // Evaluate Real-Time Market Session & Timing
    const marketStatus = useStore.getState().marketStatus;
    const marketCalendar = useStore.getState().marketCalendar;
    const session = getMarketSession({
      symbol,
      productType: 'INT',
      isCommodity,
      marketStatus,
      marketCalendar
    });

    // 1. Index trading validation (No AMO, No Delivery, Pro Tier required)
    if (isIndex) {
      if (!session.open) {
        useStore.getState().showToast('Index contracts (NIFTY, BANKNIFTY, SENSEX) can only be traded live between 09:15 AM and 03:15 PM IST on trading days.', 'error', 'Index Trading Closed');
        return;
      }
      const currentUser = useStore.getState().user;
      const isAdmin = Boolean(currentUser?.is_admin);
      const tier = (currentUser?.subscription_tier || 'BASIC').toUpperCase();
      const isExpired = currentUser?.subscription_expires && new Date(currentUser.subscription_expires).getTime() <= Date.now();
      const activeTier = isExpired ? 'BASIC' : tier;
      const isPaidTier = isAdmin || ['PRO', 'MONTHLY', 'YEARLY', 'HIGHEST', 'FEATURE', 'VIP', 'LIFETIME'].includes(activeTier);
      if (!isPaidTier && side === 'BUY') {
        useStore.getState().showToast('Index trading is an exclusive Pro feature. Please upgrade your subscription to trade index options and futures.', 'error', 'Subscription Required');
        return;
      }
    }

    // 2. Regular vs AMO Window
    let isAmo = false;
    let effectiveProductType = 'INT';

    if (!session.open) {
      if (session.isAmoWindow) {
        if (isIndex) {
          useStore.getState().showToast('AMO (After Market Orders) is not permitted for Index contracts. Indices can only be traded live between 09:15 AM and 03:15 PM IST.', 'error', 'AMO Prohibited for Indices');
          return;
        }
        isAmo = true;
        // For cash equities outside market hours, Intraday (MIS) is blocked after cutoff by SEBI regulations, so default to Delivery (CNC / DEL)
        effectiveProductType = (!isDerivative && !isCommodity && !isIndex) ? 'DEL' : 'INT';
      } else {
        useStore.getState().showToast(session.reason || session.closedMessage || 'Market is closed. Orders cannot be placed at this time.', 'error', 'Market Closed');
        return;
      }
    } else {
      // Session is open
      isAmo = false;
      effectiveProductType = 'INT';
    }

    const payload = {
      symbol,
      type: 'MARKET',
      side,
      quantity: totalQty,
      price: resolvedLtp > 0 ? resolvedLtp : 0,
      quoted_price: resolvedLtp > 0 ? resolvedLtp : null,
      trigger_price: null,
      sl_price: null,
      tgt_price: null,
      margin: 0,
      product_type: effectiveProductType,
      lotsize: effectiveLotSize,
      order_variety: isAmo ? 'AMO' : 'REGULAR',
      variety: isAmo ? 'AMO' : 'REGULAR',
      is_amo: isAmo
    };

    setIsPlacing(true);
    try {
      const result = await placeOrder(payload);
      setIsPlacing(false);
      if (result && result.success) {
        closeMarketDepthModal();
        if (result.status === 'EXECUTED' || result.status === 'COMPLETE' || result.status === 'COMPLETED') {
          useStore.getState().showToast(`Instant ${side} order executed for ${totalQty} ${effectiveLotSize > 1 ? 'qty' : 'shares'} of ${cleanSym}!`, 'success', 'Order Filled');
        } else if (result.status === 'AMO_PENDING') {
          useStore.getState().showToast(result.message || `After Market Order (AMO) placed for ${cleanSym}! Queued for market open.`, 'info', 'AMO Queued');
        } else if (result.status === 'REJECTED') {
          useStore.getState().showToast(`Order rejected: ${result.message || result.error || 'Risk check failed'}`, 'error', 'Order Rejected');
        } else {
          useStore.getState().showToast(`Instant ${side} order placed (${result.status || 'Pending'})`, 'info', 'Order Placed');
        }
      } else {
        const errorMsg = result?.error || 'Failed to place instant order. Please try again.';
        useStore.getState().showToast(errorMsg, 'error', 'Order Failed');
      }
    } catch (err) {
      setIsPlacing(false);
      useStore.getState().showToast(err.message || 'Network error occurred while placing order.', 'error', 'Order Failed');
    }
  };

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: orderModal?.isOpen ? 'none' : 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
      pointerEvents: orderModal?.isOpen ? 'none' : 'auto'
    }}>
      <div className={orderModal?.isOpen ? 'order-modal-companion' : ''} style={{
        width: 'min(500px, 96vw)',
        maxWidth: '96vw',
        background: 'var(--bg-dark)', borderRadius: '8px',
        border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        transform: orderModal?.isOpen ? 'translateX(260px)' : 'none',
        transition: 'transform 0.3s ease-in-out',
        pointerEvents: 'auto'
      }}>
        
        {/* Header */}
        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, overflow: 'hidden' }}>
             <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0, whiteSpace: 'nowrap', flexShrink: 0 }}>Market Depth</h2>
             <span style={{ fontSize: '12px', background: 'var(--bg-panel)', padding: '4px 8px', borderRadius: '4px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }} title={symbol}>
               {symbol.split('-')[0]}
             </span>
          </div>
          <button onClick={closeMarketDepthModal} style={{ background: 'var(--bg-panel)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', flexShrink: 0 }}><X size={16} /></button>
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
                  const currentLtp = Number(marketDepthData?.symbol === symbol && marketDepthData.ltp ? marketDepthData.ltp : basicData.ltp);
                  const currentClose = Number(marketDepthData?.symbol === symbol && marketDepthData.close ? marketDepthData.close : basicData.close);
                  if (currentLtp > 0 && currentClose > 0) {
                    const diff = currentLtp - currentClose;
                    const pct = (diff / currentClose) * 100;
                    return `${diff.toFixed(2)} (${pct.toFixed(2)}%)`;
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
                type="button"
                disabled={isPlacing}
                onClick={() => {
                  if (oneClickMode) {
                    handleOneClickOrder('BUY');
                  } else {
                    closeMarketDepthModal();
                    openOrderModal(symbol, 'BUY', lotSize);
                  }
                }}
                className={`btn btn-primary ${oneClickMode ? 'one-click-active' : ''}`}
                style={{ 
                  flex: 1, 
                  background: 'var(--color-blue)', 
                  border: 'none',
                  opacity: isPlacing ? 0.65 : 1,
                  cursor: isPlacing ? 'not-allowed' : 'pointer'
                }}
                title={oneClickMode ? `INSTANT BUY ${oneClickMultiplier}x LOTS` : 'Buy'}
             >
                {isPlacing ? 'PLACING...' : (oneClickMode ? `INSTANT BUY (${oneClickMultiplier}x)` : 'BUY')}
             </button>
             <button 
                type="button"
                disabled={isPlacing}
                onClick={() => {
                  if (oneClickMode) {
                    handleOneClickOrder('SELL');
                  } else {
                    closeMarketDepthModal();
                    openOrderModal(symbol, 'SELL', lotSize);
                  }
                }}
                className={`btn btn-secondary ${oneClickMode ? 'one-click-active' : ''}`}
                style={{ 
                  flex: 1, 
                  background: 'var(--color-red)', 
                  border: 'none', 
                  color: '#fff',
                  opacity: isPlacing ? 0.65 : 1,
                  cursor: isPlacing ? 'not-allowed' : 'pointer'
                }}
                title={oneClickMode ? `INSTANT SELL ${oneClickMultiplier}x LOTS` : 'Sell'}
             >
                {isPlacing ? 'PLACING...' : (oneClickMode ? `INSTANT SELL (${oneClickMultiplier}x)` : 'SELL')}
             </button>
          </div>

        </div>
      </div>
    </div>
  );
}


