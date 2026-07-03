import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts';

export default function OptionsStrategyBuilder({ legs, spotPrice, onRemoveLeg }) {
  const { data, maxProfit, maxLoss, breakevens, netPremium } = useMemo(() => {
    if (!legs || legs.length === 0) {
      return { data: [], maxProfit: 0, maxLoss: 0, breakevens: [], netPremium: 0 };
    }

    // Determine the range for X-axis based on strikes
    const strikes = legs.map(l => l.strike || 0);
    const minStrike = Math.min(...strikes);
    const maxStrike = Math.max(...strikes);
    
    // If spotPrice is falsy, fallback to the ATM/first strike
    const effectiveSpot = spotPrice || strikes[0] || 10000;
    
    const rangeBuffer = effectiveSpot * 0.05; // 5% buffer
    const minPrice = Math.floor(Math.min(minStrike, effectiveSpot) - rangeBuffer);
    const maxPrice = Math.ceil(Math.max(maxStrike, effectiveSpot) + rangeBuffer);
    
    // Step size based on typical index/stock intervals
    const step = (maxPrice - minPrice) / 100;
    
    let netPrem = 0;
    legs.forEach(leg => {
      const price = leg.price || 0;
      const qty = leg.quantity || 1;
      const val = price * qty;
      netPrem += leg.side === 'BUY' ? -val : val;
    });

    const calculatePayoff = (priceAtExpiry) => {
      let totalPnl = 0;
      legs.forEach(leg => {
        const strike = leg.strike || 0;
        const price = leg.price || 0;
        const qty = leg.quantity || 1;

        let intrinsic = 0;
        if (leg.optionType === 'CE') {
          intrinsic = Math.max(0, priceAtExpiry - strike);
        } else {
          intrinsic = Math.max(0, strike - priceAtExpiry);
        }
        
        if (leg.side === 'BUY') {
          totalPnl += (intrinsic - price) * qty;
        } else {
          totalPnl += (price - intrinsic) * qty;
        }
      });
      return totalPnl;
    };

    const dataPoints = [];
    let pMax = -Infinity;
    let pMin = Infinity;
    
    for (let p = minPrice; p <= maxPrice; p += step) {
      const pnl = calculatePayoff(p);
      dataPoints.push({ price: Math.round(p), pnl });
      if (pnl > pMax) pMax = pnl;
      if (pnl < pMin) pMin = pnl;
    }

    // Find breakevens (where sign changes)
    const be = [];
    for (let i = 1; i < dataPoints.length; i++) {
      const prev = dataPoints[i - 1];
      const curr = dataPoints[i];
      if ((prev.pnl < 0 && curr.pnl >= 0) || (prev.pnl > 0 && curr.pnl <= 0)) {
        // Interpolate exactly
        const ratio = Math.abs(prev.pnl) / (Math.abs(prev.pnl) + Math.abs(curr.pnl));
        const exactPrice = prev.price + (curr.price - prev.price) * ratio;
        be.push(exactPrice);
      }
    }

    return {
      data: dataPoints,
      maxProfit: pMax > 999999 ? Infinity : pMax,
      maxLoss: pMin < -999999 ? -Infinity : pMin,
      breakevens: [...new Set(be.map(b => Math.round(b)))], // Unique rounded breakevens
      netPremium: netPrem
    };
  }, [legs, spotPrice]);

  if (!legs || legs.length === 0) {
    return (
      <div style={{ padding: '24px', background: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No legs added to strategy. Add legs from the Option Chain to build a strategy.
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const val = payload[0].value;
      return (
        <div style={{ background: '#1e293b', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '8px', color: '#fff' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Expiry Price: ₹{label}</div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: val >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
            Projected P&L: {val >= 0 ? '+' : '-'}₹{Math.abs(val).toFixed(2)}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', background: 'var(--bg-panel)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>Strategy Builder</h3>
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        {/* Left Side: Stats and Legs */}
        <div style={{ flex: '1', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Max Profit</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: maxProfit === Infinity ? 'var(--color-green)' : 'var(--text-primary)' }}>
                {maxProfit === Infinity ? 'Unlimited' : `₹${maxProfit.toFixed(2)}`}
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Max Loss</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: maxLoss === -Infinity ? 'var(--color-red)' : 'var(--text-primary)' }}>
                {maxLoss === -Infinity ? 'Unlimited' : `-₹${Math.abs(maxLoss).toFixed(2)}`}
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Breakevens</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--color-blue)' }}>
                {breakevens.length > 0 ? breakevens.map(b => `₹${b}`).join(', ') : 'None'}
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Net Premium</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: netPremium > 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                {netPremium > 0 ? `Receive ₹${netPremium.toFixed(2)}` : `Pay ₹${Math.abs(netPremium).toFixed(2)}`}
              </div>
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>Strategy Legs</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {legs.map((leg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', background: leg.side === 'BUY' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: leg.side === 'BUY' ? 'var(--color-green)' : 'var(--color-red)' }}>
                      {leg.side}
                    </span>
                    <span style={{ fontWeight: '500' }}>{leg.strike} {leg.optionType}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Qty: {leg.quantity} @ ₹{leg.price}</span>
                  </div>
                  <button onClick={() => onRemoveLeg(i)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
                    <i className="fi fi-rr-cross-small"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Graph */}
        <div style={{ flex: '2', minWidth: '400px', height: '400px', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
              <defs>
                <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-green)" stopOpacity={0.4} />
                  <stop offset="50%" stopColor="var(--color-green)" stopOpacity={0} />
                  <stop offset="50%" stopColor="var(--color-red)" stopOpacity={0} />
                  <stop offset="100%" stopColor="var(--color-red)" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="price" 
                stroke="var(--text-secondary)" 
                fontSize={12} 
                tickMargin={10} 
                domain={['dataMin', 'dataMax']} 
                type="number" 
                tickFormatter={(val) => `₹${val}`}
              />
              <YAxis 
                stroke="var(--text-secondary)" 
                fontSize={12} 
                tickFormatter={(val) => val >= 0 ? `+${val}` : val}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
              {spotPrice && (
                <ReferenceLine x={spotPrice} stroke="var(--color-blue)" strokeDasharray="3 3" label={{ position: 'top', value: 'Spot', fill: 'var(--color-blue)', fontSize: 12 }} />
              )}
              <Line 
                type="monotone" 
                dataKey="pnl" 
                stroke="var(--text-primary)" 
                strokeWidth={2} 
                dot={false}
                activeDot={{ r: 6, fill: 'var(--color-blue)' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
