import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { X } from 'lucide-react';

export default function MarketDepthModal() {
  const { marketDepthModal, closeMarketDepthModal, prices } = useStore();
  const [bids, setBids] = useState([]);
  const [asks, setAsks] = useState([]);

  const symbol = marketDepthModal.symbol;
  const priceData = prices[symbol];
  const ltp = priceData?.ltp || 0;

  useEffect(() => {
    if (!marketDepthModal.isOpen || !ltp) return;

    // Level 2 Data Simulator
    const generateDepth = () => {
      let currentBids = [];
      let currentAsks = [];
      let currentBid = ltp - 0.05;
      let currentAsk = ltp + 0.05;

      for (let i = 0; i < 5; i++) {
        // Randomize price decrement/increment slightly
        const bidDec = (Math.random() * 0.5 + 0.1);
        const askInc = (Math.random() * 0.5 + 0.1);
        currentBid -= bidDec;
        currentAsk += askInc;

        // Randomize quantity between 100 and 15000 (often multiples of 15 or 50)
        const bidQty = Math.floor(Math.random() * 300) * 50;
        const askQty = Math.floor(Math.random() * 300) * 50;

        // Randomize orders count between 1 and 25
        const bidOrders = Math.floor(Math.random() * 25) + 1;
        const askOrders = Math.floor(Math.random() * 25) + 1;

        currentBids.push({
          orders: bidOrders,
          qty: bidQty,
          price: Math.max(0.05, currentBid).toFixed(2),
          changed: Math.random() > 0.5 // random flash
        });

        currentAsks.push({
          orders: askOrders,
          qty: askQty,
          price: currentAsk.toFixed(2),
          changed: Math.random() > 0.5
        });
      }
      
      setBids(currentBids);
      setAsks(currentAsks);
    };

    // Initial generate
    generateDepth();

    // Pulse every 800ms
    const interval = setInterval(generateDepth, 800);
    return () => clearInterval(interval);
  }, [marketDepthModal.isOpen, ltp]);

  if (!marketDepthModal.isOpen || !symbol) return null;

  const totalBidQty = bids.reduce((sum, b) => sum + b.qty, 0);
  const totalAskQty = asks.reduce((sum, a) => sum + a.qty, 0);
  
  // Calculate width ratio for progress bars
  const totalVol = totalBidQty + totalAskQty;
  const bidRatio = totalVol ? (totalBidQty / totalVol) * 100 : 50;
  const askRatio = totalVol ? (totalAskQty / totalVol) * 100 : 50;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
    }}>
      <div style={{
        width: '500px', background: 'var(--bg-dark)', borderRadius: '8px', 
        border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column'
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
             <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr', textAlign: 'left' }}>
                <span style={{ textAlign: 'right' }}>Price</span>
                <span>Qty</span>
                <span style={{ textAlign: 'right' }}>Orders</span>
             </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
             {/* Bids Column */}
             <div>
                {bids.map((bid, i) => (
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
                {asks.map((ask, i) => (
                  <div key={i} style={{ 
                    display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr', textAlign: 'left', padding: '6px 0', fontSize: '12px', fontWeight: '500',
                    background: ask.changed ? 'rgba(239, 68, 68, 0.1)' : 'transparent', transition: 'background 0.3s'
                  }}>
                    <span style={{ color: 'var(--color-red-light)', textAlign: 'right' }}>{ask.price}</span>
                    <span style={{ color: 'var(--color-red-light)', paddingLeft: '8px' }}>{ask.qty}</span>
                    <span style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{ask.orders}</span>
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

        </div>
      </div>
    </div>
  );
}
