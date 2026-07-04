import React, { useMemo, useState } from 'react';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { calculateGreeks } from '../utils/blackScholes';

// Normal CDF approximation for POP
function N(x) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2.0);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

export default function OptionsStrategyBuilder({ legs, spotPrice, expiryDate, onRemoveLeg, onClear, onUpdateLeg, onExecute }) {
  const [targetDteOffset, setTargetDteOffset] = useState(0); // 0 = Today, DTE = Expiry

  const {
    data, maxProfit, maxLoss, breakevens, netPremium, pop, 
    totalDelta, totalTheta, totalGamma, totalVega, dte
  } = useMemo(() => {
    if (!legs || legs.length === 0) {
      return { 
        data: [], maxProfit: 0, maxLoss: 0, breakevens: [], netPremium: 0, 
        pop: 0, totalDelta: 0, totalTheta: 0, totalGamma: 0, totalVega: 0, dte: 0 
      };
    }

    // Calculate DTE
    const today = new Date();
    today.setHours(0,0,0,0);
    
    let exp = new Date();
    if (expiryDate) {
      const match = expiryDate.match(/^(\d{2})([A-Z]{3})(\d{2,4})$/i);
      if (match) {
        const day = parseInt(match[1]);
        const months = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
        const month = months[match[2].toUpperCase()];
        const year = match[3].length === 2 ? 2000 + parseInt(match[3]) : parseInt(match[3]);
        if (month !== undefined) {
          exp = new Date(year, month, day);
        }
      } else {
        const parsed = new Date(expiryDate);
        if (!isNaN(parsed)) exp = parsed;
      }
    }
    exp.setHours(0,0,0,0);
    
    let diffDays = Math.max(0, Math.floor((exp - today) / (1000 * 60 * 60 * 24)));
    if (diffDays === 0 || isNaN(diffDays)) diffDays = 0.01; // Avoid 0 DTE math errors
    
    const targetDaysLeft = Math.max(0.001, diffDays - targetDteOffset);
    const T = targetDaysLeft / 365.0; // Time in years for Black-Scholes

    // Determine range
    const strikes = legs.map(l => l.strike || 0);
    const minStrike = Math.min(...strikes);
    const maxStrike = Math.max(...strikes);
    const effectiveSpot = spotPrice || strikes[0] || 10000;
    
    const rangeBuffer = effectiveSpot * 0.08; // 8% buffer
    const minPrice = Math.floor(Math.min(minStrike, effectiveSpot) - rangeBuffer);
    const maxPrice = Math.ceil(Math.max(maxStrike, effectiveSpot) + rangeBuffer);
    const step = (maxPrice - minPrice) / 100;
    
    let netPrem = 0;
    let tDelta = 0, tTheta = 0, tGamma = 0, tVega = 0;

    legs.forEach(leg => {
      const price = leg.price || 0;
      const qty = leg.quantity || 1;
      const val = price * qty;
      const sign = leg.side === 'BUY' ? 1 : -1;
      netPrem += leg.side === 'BUY' ? -val : val;

      // Calculate Greeks for Today
      const iv = leg.iv > 0 ? leg.iv : 0.2;
      const greeks = calculateGreeks(leg.optionType, effectiveSpot, leg.strike, diffDays / 365, 0.1, iv);
      tDelta += greeks.delta * qty * sign;
      tTheta += greeks.theta * qty * sign;
      tGamma += greeks.gamma * qty * sign;
      tVega += greeks.vega * qty * sign;
    });

    const calculateExpiryPayoff = (priceAtExpiry) => {
      let totalPnl = 0;
      legs.forEach(leg => {
        const strike = leg.strike || 0;
        const price = leg.price || 0;
        const qty = leg.quantity || 1;
        let intrinsic = leg.optionType === 'CE' ? Math.max(0, priceAtExpiry - strike) : Math.max(0, strike - priceAtExpiry);
        totalPnl += (leg.side === 'BUY') ? (intrinsic - price) * qty : (price - intrinsic) * qty;
      });
      return totalPnl;
    };

    const calculateTargetPayoff = (targetSpotPrice) => {
      let totalPnl = 0;
      legs.forEach(leg => {
        const strike = leg.strike || 0;
        const price = leg.price || 0;
        const qty = leg.quantity || 1;
        const iv = leg.iv > 0 ? leg.iv : 0.2;
        
        let targetVal = 0;
        if (targetDaysLeft <= 0.01) {
          targetVal = leg.optionType === 'CE' ? Math.max(0, targetSpotPrice - strike) : Math.max(0, strike - targetSpotPrice);
        } else {
          const g = calculateGreeks(leg.optionType, targetSpotPrice, strike, T, 0.1, iv);
          targetVal = g.price;
        }

        totalPnl += (leg.side === 'BUY') ? (targetVal - price) * qty : (price - targetVal) * qty;
      });
      return totalPnl;
    };

    const dataPoints = [];
    let pMax = -Infinity, pMin = Infinity;
    
    for (let p = minPrice; p <= maxPrice; p += step) {
      const pnlExpiry = calculateExpiryPayoff(p);
      const pnlTarget = calculateTargetPayoff(p);
      dataPoints.push({ price: Math.round(p), pnlExpiry, pnlTarget });
      if (pnlExpiry > pMax) pMax = pnlExpiry;
      if (pnlExpiry < pMin) pMin = pnlExpiry;
    }

    // Find Expiry breakevens
    const be = [];
    for (let i = 1; i < dataPoints.length; i++) {
      const prev = dataPoints[i - 1];
      const curr = dataPoints[i];
      if ((prev.pnlExpiry < 0 && curr.pnlExpiry >= 0) || (prev.pnlExpiry > 0 && curr.pnlExpiry <= 0)) {
        const ratio = Math.abs(prev.pnlExpiry) / (Math.abs(prev.pnlExpiry) + Math.abs(curr.pnlExpiry));
        be.push(prev.price + (curr.price - prev.price) * ratio);
      }
    }
    const finalBE = [...new Set(be.map(b => Math.round(b)))];

    // POP calculation (Probability of Profit) using a very simplified assumption:
    // P(Spot > BE) for bullish, P(Spot < BE) for bearish. 
    let popSum = 0;
    const avgIv = legs.reduce((acc, l) => acc + (l.iv || 0.2), 0) / legs.length;
    const sigmaT = avgIv * Math.sqrt(diffDays / 365);
    
    if (sigmaT > 0 && effectiveSpot > 0) {
      if (finalBE.length === 0) {
        popSum = pMax > 0 ? 100 : 0;
      } else if (finalBE.length === 1) {
        const b = finalBE[0];
        const d2 = (Math.log(effectiveSpot / b) + (0.1 - (avgIv * avgIv)/2) * (diffDays/365)) / sigmaT;
        // If profit is on the right side of BE
        if (calculateExpiryPayoff(b + 10) > 0) {
          popSum = N(d2) * 100;
        } else {
          popSum = N(-d2) * 100;
        }
      } else if (finalBE.length === 2) {
        // e.g. Iron Condor or Straddle
        const b1 = Math.min(...finalBE);
        const b2 = Math.max(...finalBE);
        const d2_1 = (Math.log(effectiveSpot / b1) + (0.1 - (avgIv * avgIv)/2) * (diffDays/365)) / sigmaT;
        const d2_2 = (Math.log(effectiveSpot / b2) + (0.1 - (avgIv * avgIv)/2) * (diffDays/365)) / sigmaT;
        
        const probBelowB1 = N(-d2_1);
        const probAboveB2 = N(d2_2);
        const probBetween = Math.max(0, 1 - probBelowB1 - probAboveB2);

        // Check where the profit lies
        const pMid = calculateExpiryPayoff((b1 + b2) / 2);
        if (pMid > 0) {
          popSum = probBetween * 100;
        } else {
          popSum = (probBelowB1 + probAboveB2) * 100;
        }
      } else {
        popSum = 50; // Fallback for complex payoffs
      }
    }

    return {
      data: dataPoints,
      maxProfit: pMax > 999999 ? Infinity : pMax,
      maxLoss: pMin < -999999 ? -Infinity : pMin,
      breakevens: finalBE,
      netPremium: netPrem,
      pop: popSum,
      totalDelta: tDelta, totalTheta: tTheta, totalGamma: tGamma, totalVega: tVega,
      dte: diffDays
    };
  }, [legs, spotPrice, expiryDate, targetDteOffset]);

  const gradientOffset = useMemo(() => {
    if (!data || data.length === 0) return 0;
    const dataMax = Math.max(...data.map(i => i.pnlExpiry));
    const dataMin = Math.min(...data.map(i => i.pnlExpiry));

    if (dataMax <= 0) return 0;
    if (dataMin >= 0) return 1;

    return dataMax / (dataMax - dataMin);
  }, [data]);

  if (!legs || legs.length === 0) {
    return (
      <div style={{ padding: '24px', background: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No legs added to strategy. Add legs from the Option Chain to build a strategy.
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const pTgt = payload.find(p => p.dataKey === 'pnlTarget')?.value || 0;
      const pExp = payload.find(p => p.dataKey === 'pnlExpiry')?.value || 0;
      return (
        <div style={{ background: '#1e293b', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '8px', color: '#fff', fontSize: '13px' }}>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>Price: ₹{label}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '4px' }}>
            <span style={{ color: 'var(--color-blue)' }}>Target Date P&L:</span>
            <span style={{ fontWeight: 'bold', color: pTgt >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
              {pTgt >= 0 ? '+' : '-'}₹{Math.abs(pTgt).toFixed(2)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Expiry P&L:</span>
            <span style={{ fontWeight: 'bold', color: pExp >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
              {pExp >= 0 ? '+' : '-'}₹{Math.abs(pExp).toFixed(2)}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', background: 'var(--bg-panel)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', marginTop: '24px' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Strategy Builder</h3>
          <span style={{ padding: '4px 8px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-blue)', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
            {dte.toFixed(0)} DTE
          </span>
        </div>
        <button onClick={onClear} className="btn-mini sell" style={{ padding: '6px 12px', borderRadius: '4px' }}>
          <i className="fi fi-rr-trash" style={{ marginRight: '6px' }}></i>Clear Strategy
        </button>
      </div>

      {/* METRICS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
        <MetricCard title="Max Profit" value={maxProfit === Infinity ? 'Unlimited' : `₹${maxProfit.toFixed(2)}`} color={maxProfit === Infinity ? 'var(--color-green)' : 'var(--text-primary)'} />
        <MetricCard title="Max Loss" value={maxLoss === -Infinity ? 'Unlimited' : `-₹${Math.abs(maxLoss).toFixed(2)}`} color={maxLoss === -Infinity ? 'var(--color-red)' : 'var(--text-primary)'} />
        <MetricCard title="Risk / Reward" value={maxLoss === -Infinity || maxLoss === 0 || maxProfit === Infinity ? 'N/A' : `1 : ${(Math.abs(maxProfit) / Math.abs(maxLoss)).toFixed(1)}`} />
        <MetricCard title="POP" value={`${pop.toFixed(1)}%`} color={pop > 50 ? 'var(--color-green)' : 'var(--color-yellow)'} />
        <MetricCard title="Net Premium" value={netPremium > 0 ? `+ ₹${netPremium.toFixed(0)}` : `- ₹${Math.abs(netPremium).toFixed(0)}`} color={netPremium > 0 ? 'var(--color-green)' : 'var(--color-red)'} />
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        
        {/* LEFT PANE: GREEKS & TABLE */}
        <div style={{ flex: '1', minWidth: '350px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* GREEKS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12px', textAlign: 'center' }}>
            <div><div style={{ color: 'var(--text-secondary)' }}>Total Delta</div><div style={{ fontWeight: 'bold' }}>{totalDelta.toFixed(2)}</div></div>
            <div><div style={{ color: 'var(--text-secondary)' }}>Total Theta</div><div style={{ fontWeight: 'bold' }}>{totalTheta.toFixed(2)}</div></div>
            <div><div style={{ color: 'var(--text-secondary)' }}>Total Gamma</div><div style={{ fontWeight: 'bold' }}>{totalGamma.toFixed(4)}</div></div>
            <div><div style={{ color: 'var(--text-secondary)' }}>Total Vega</div><div style={{ fontWeight: 'bold' }}>{totalVega.toFixed(2)}</div></div>
          </div>

          {/* TARGET DATE SLIDER */}
          {dte > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Target Date Curve (T+{targetDteOffset})</span>
                <span style={{ fontWeight: 'bold' }}>{Math.max(0, dte - targetDteOffset).toFixed(0)} Days Left</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max={Math.floor(dte)} 
                step="1"
                value={targetDteOffset} 
                onChange={(e) => setTargetDteOffset(parseInt(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                <span>Today</span>
                <span>Expiry</span>
              </div>
            </div>
          )}

          {/* LEGS TABLE */}
          <div style={{ flex: 1, border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '500' }}>Side</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '500' }}>Strike</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '500' }}>Qty</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '500' }}>Price</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '500' }}></th>
                </tr>
              </thead>
              <tbody>
                {legs.map((leg, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <select 
                        value={leg.side} 
                        onChange={(e) => onUpdateLeg(i, { ...leg, side: e.target.value })}
                        style={{ background: leg.side === 'BUY' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: leg.side === 'BUY' ? 'var(--color-green)' : 'var(--color-red)', border: 'none', padding: '4px 8px', borderRadius: '4px', outline: 'none', fontWeight: 'bold' }}
                      >
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                      </select>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontWeight: '500' }}>{leg.strike} {leg.optionType}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <input 
                        type="number" 
                        value={leg.quantity}
                        onChange={(e) => onUpdateLeg(i, { ...leg, quantity: parseInt(e.target.value) || 1 })}
                        style={{ width: '60px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', padding: '4px 8px', borderRadius: '4px', textAlign: 'center' }}
                      />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>₹{leg.price.toFixed(1)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <button onClick={() => onRemoveLeg(i)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <i className="fi fi-rr-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* EXECUTE STRATEGY */}
          <button 
            onClick={onExecute}
            className="btn-primary"
            style={{ width: '100%', padding: '12px', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', background: 'var(--color-blue)' }}
          >
            <i className="fi fi-rr-rocket"></i> Execute Strategy
          </button>

        </div>

        {/* RIGHT PANE: CHART */}
        <div style={{ flex: '2', minWidth: '400px', height: '450px', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
              <defs>
                <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={gradientOffset} stopColor="#10B981" stopOpacity={0.6} />
                  <stop offset={gradientOffset} stopColor="#EF4444" stopOpacity={0.6} />
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
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.5)" strokeWidth={2} />
              {spotPrice && (
                <ReferenceLine x={spotPrice} stroke="var(--color-blue)" strokeDasharray="3 3" label={{ position: 'top', value: 'Spot', fill: 'var(--color-blue)', fontSize: 12 }} />
              )}
              {breakevens.map((b, i) => (
                <ReferenceLine key={i} x={b} stroke="var(--text-secondary)" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'BE', fill: 'var(--text-secondary)', fontSize: 10 }} />
              ))}
              
              {/* Expiry Payoff (Shaded Area) */}
              <Area 
                type="linear" 
                dataKey="pnlExpiry" 
                stroke="url(#splitColor)" 
                strokeWidth={2} 
                fill="url(#splitColor)"
                activeDot={false}
                name="Expiry P&L"
              />
              
              {/* Target Payoff (Smooth Curve) */}
              <Line 
                type="monotone" 
                dataKey="pnlTarget" 
                stroke="var(--color-blue)" 
                strokeWidth={3} 
                strokeDasharray="5 5"
                dot={false}
                activeDot={{ r: 6, fill: 'var(--color-blue)' }}
                name="Target Date P&L"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{title}</div>
      <div style={{ fontSize: '16px', fontWeight: 'bold', color: color || 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}
