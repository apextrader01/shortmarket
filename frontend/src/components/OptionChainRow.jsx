import React from 'react';
import { useStore } from '../store';
import { calculateIV, calculateGreeks } from '../utils/blackScholes';
import { BarChart2, List, AlignLeft, Bell } from 'lucide-react';

const OptionChainRow = React.memo(({
  strike,
  call,
  put,
  basePrice,
  atmStrike,
  atmRowRef,
  T,
  r,
  oneClickMode,
  oneClickMultiplier,
  handleTrade,
  setAlertModalSymbol,
  setChartModalSymbol,
  openMarketDepthModal,
  openDomLadderModal
}) => {
  const callKey = call ? (call.symbol.includes('-') ? call.symbol : `${call.symbol}-${call.exch_seg}`) : null;
  const putKey = put ? (put.symbol.includes('-') ? put.symbol : `${put.symbol}-${put.exch_seg}`) : null;

  const callPriceData = useStore(state => callKey ? state.prices[callKey] : null);
  const putPriceData = useStore(state => putKey ? state.prices[putKey] : null);

  const cLtp = callPriceData?.ltp || 0;
  const pLtp = putPriceData?.ltp || 0;

  // Calculate IV
  let cIV = (cLtp > 0 && basePrice > 0) ? calculateIV('CE', cLtp, basePrice, strike, T, r) : 0;
  let pIV = (pLtp > 0 && basePrice > 0) ? calculateIV('PE', pLtp, basePrice, strike, T, r) : 0;

  // Put-Call Parity Fallback: Deep ITM options often violate strict Spot intrinsic bounds due to Futures pricing.
  if (cIV === 0 && pIV > 0) cIV = pIV;
  if (pIV === 0 && cIV > 0) pIV = cIV;

  // Calculate Greeks
  const cGreeks = (cIV > 0) ? calculateGreeks('CE', basePrice, strike, T, r, cIV) : { delta: 0, theta: 0, vega: 0 };
  const pGreeks = (pIV > 0) ? calculateGreeks('PE', basePrice, strike, T, r, pIV) : { delta: 0, theta: 0, vega: 0 };

  const isCallITM = basePrice > 0 && strike < basePrice;
  const isPutITM = basePrice > 0 && strike > basePrice;

  const cBreakeven = cLtp > 0 ? strike + cLtp : 0;
  const pBreakeven = pLtp > 0 ? strike - pLtp : 0;
  
  const cBreakPct = (cBreakeven > 0 && basePrice > 0) ? ((cBreakeven / basePrice) - 1) * 100 : 0;
  const pBreakPct = (pBreakeven > 0 && basePrice > 0) ? ((pBreakeven / basePrice) - 1) * 100 : 0;
  const atmClass = strike === atmStrike ? 'bg-blue-900/40 border-y border-blue-500/50 relative' : 'border-b border-gray-800/50 hover:bg-gray-800/50';

  return (
    <tr ref={strike === atmStrike ? atmRowRef : null} className={`transition-colors ${atmClass}`}>
      {/* Calls */}
      <td className={`center ${isCallITM ? 'bg-itm-call' : ''}`} style={{ color: 'var(--text-secondary)' }}>{cIV > 0 ? cGreeks.delta.toFixed(2) : '-'}</td>
      <td className={`center ${isCallITM ? 'bg-itm-call' : ''}`} style={{ color: 'var(--text-secondary)' }}>{cIV > 0 ? cGreeks.theta.toFixed(2) : '-'}</td>
      <td className={`center ${isCallITM ? 'bg-itm-call' : ''}`} style={{ color: 'var(--text-secondary)' }}>{cIV > 0 ? cGreeks.vega.toFixed(2) : '-'}</td>
      <td className={`center ${isCallITM ? 'bg-itm-call' : ''}`} style={{ color: 'var(--color-yellow)' }}>{cIV > 0 ? (cIV * 100).toFixed(1) + '%' : '-'}</td>
      <td className={`center ${isCallITM ? 'bg-itm-call' : ''}`}>{callPriceData?.volume || '-'}</td>
      <td className={`center ${isCallITM ? 'bg-itm-call' : ''}`} style={{ color: callPriceData?.change >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
        {callPriceData?.change ? (
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.3' }}>
            <span style={{ fontSize: '11px' }}>{callPriceData.change > 0 ? '+' : ''}{callPriceData.change.toFixed(2)}</span>
            <span style={{ fontSize: '10px', opacity: 0.8 }}>
              ({callPriceData.pct > 0 ? '+' : ''}{callPriceData.pct?.toFixed(1) || '0.0'}%)
            </span>
          </div>
        ) : '-'}
      </td>
      <td className={`center ${isCallITM ? 'bg-itm-call' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <div className="ltp-container" style={{ width: 'auto', flex: 1, display: 'flex', justifyContent: 'center' }}>
            <span className={`ltp-value ${callPriceData?.change >= 0 ? 'neon-text-green' : 'neon-text-red'}`} style={{ fontWeight: '600', color: callPriceData?.change >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
              {cLtp > 0 ? cLtp.toFixed(2) : '-'}
            </span>
            <div className="action-buttons">
              <button 
                onClick={() => handleTrade(call, 'BUY', 'CE', cIV)} 
                className={`btn-mini buy ${oneClickMode ? 'one-click-active' : ''}`}
                title={oneClickMode ? `INSTANT BUY ${oneClickMultiplier}x LOTS` : 'Buy'}
              >B</button>
              <button 
                onClick={() => handleTrade(call, 'SELL', 'CE', cIV)} 
                className={`btn-mini sell ${oneClickMode ? 'one-click-active' : ''}`}
                title={oneClickMode ? `INSTANT SELL ${oneClickMultiplier}x LOTS` : 'Sell'}
              >S</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '2px' }}>
            {call && (
              <>
                <button onClick={() => setAlertModalSymbol(callKey)} style={{ background: 'none', border: 'none', color: 'var(--color-yellow)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }} title="Set Price Alert"><Bell size={14} /></button>
                <button onClick={() => setChartModalSymbol(callKey)} style={{ background: 'none', border: 'none', color: 'var(--color-blue)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }} title="View Chart"><BarChart2 size={14} /></button>
                <button onClick={() => openMarketDepthModal(callKey)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }} title="Market Depth"><AlignLeft size={14} /></button>
                <button onClick={() => openDomLadderModal(callKey, parseInt(call.lotsize) || 1)} style={{ background: 'none', border: 'none', color: 'var(--color-purple)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }} title="DOM Ladder"><List size={14} /></button>
              </>
            )}
          </div>
        </div>
      </td>
      <td className={`center border-right ${isCallITM ? 'bg-itm-call' : ''}`}>
        {cBreakeven > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.3' }}>
            <span style={{ fontSize: '11px', color: '#E2E8F0' }}>{cBreakeven.toFixed(1)}</span>
            <span style={{ fontSize: '10px', color: cBreakPct >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
              {cBreakPct > 0 ? '+' : ''}{cBreakPct.toFixed(1)}%
            </span>
          </div>
        ) : '-'}
      </td>

      {/* Strike */}
      <td className="strike-cell">{strike}</td>

      {/* Puts */}
      <td className={`center border-left ${isPutITM ? 'bg-itm-put' : ''}`}>
        {pBreakeven > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.3' }}>
            <span style={{ fontSize: '11px', color: '#E2E8F0' }}>{pBreakeven.toFixed(1)}</span>
            <span style={{ fontSize: '10px', color: pBreakPct >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
              {pBreakPct > 0 ? '+' : ''}{pBreakPct.toFixed(1)}%
            </span>
          </div>
        ) : '-'}
      </td>
      <td className={`center ${isPutITM ? 'bg-itm-put' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <div style={{ display: 'flex', gap: '2px' }}>
            {put && (
              <>
                <button onClick={() => setAlertModalSymbol(putKey)} style={{ background: 'none', border: 'none', color: 'var(--color-yellow)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }} title="Set Price Alert"><Bell size={14} /></button>
                <button onClick={() => setChartModalSymbol(putKey)} style={{ background: 'none', border: 'none', color: 'var(--color-blue)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }} title="View Chart"><BarChart2 size={14} /></button>
                <button onClick={() => openMarketDepthModal(putKey)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }} title="Market Depth"><AlignLeft size={14} /></button>
                <button onClick={() => openDomLadderModal(putKey, parseInt(put.lotsize) || 1)} style={{ background: 'none', border: 'none', color: 'var(--color-purple)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }} title="DOM Ladder"><List size={14} /></button>
              </>
            )}
          </div>
          <div className="ltp-container" style={{ width: 'auto', flex: 1, display: 'flex', justifyContent: 'center' }}>
            <span className={`ltp-value ${putPriceData?.change >= 0 ? 'neon-text-green' : 'neon-text-red'}`} style={{ fontWeight: '600', color: putPriceData?.change >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
              {pLtp > 0 ? pLtp.toFixed(2) : '-'}
            </span>
            <div className="action-buttons">
              <button 
                onClick={() => handleTrade(put, 'BUY', 'PE', pIV)} 
                className={`btn-mini buy ${oneClickMode ? 'one-click-active' : ''}`}
                title={oneClickMode ? `INSTANT BUY ${oneClickMultiplier}x LOTS` : 'Buy'}
              >B</button>
              <button 
                onClick={() => handleTrade(put, 'SELL', 'PE', pIV)} 
                className={`btn-mini sell ${oneClickMode ? 'one-click-active' : ''}`}
                title={oneClickMode ? `INSTANT SELL ${oneClickMultiplier}x LOTS` : 'Sell'}
              >S</button>
            </div>
          </div>
        </div>
      </td>
      <td className={`center ${isPutITM ? 'bg-itm-put' : ''}`} style={{ color: putPriceData?.change >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
        {putPriceData?.change ? (
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.3' }}>
            <span style={{ fontSize: '11px' }}>{putPriceData.change > 0 ? '+' : ''}{putPriceData.change.toFixed(2)}</span>
            <span style={{ fontSize: '10px', opacity: 0.8 }}>
              ({putPriceData.pct > 0 ? '+' : ''}{putPriceData.pct?.toFixed(1) || '0.0'}%)
            </span>
          </div>
        ) : '-'}
      </td>
      <td className={`center ${isPutITM ? 'bg-itm-put' : ''}`}>{putPriceData?.volume || '-'}</td>
      <td className={`center ${isPutITM ? 'bg-itm-put' : ''}`} style={{ color: 'var(--color-yellow)' }}>{pIV > 0 ? (pIV * 100).toFixed(1) + '%' : '-'}</td>
      <td className={`center ${isPutITM ? 'bg-itm-put' : ''}`} style={{ color: 'var(--text-secondary)' }}>{pIV > 0 ? pGreeks.vega.toFixed(2) : '-'}</td>
      <td className={`center ${isPutITM ? 'bg-itm-put' : ''}`} style={{ color: 'var(--text-secondary)' }}>{pIV > 0 ? pGreeks.theta.toFixed(2) : '-'}</td>
      <td className={`center ${isPutITM ? 'bg-itm-put' : ''}`} style={{ color: 'var(--text-secondary)' }}>{pIV > 0 ? pGreeks.delta.toFixed(2) : '-'}</td>
    </tr>
  );
}, (prev, next) => {
  return prev.strike === next.strike &&
         prev.call?.symbol === next.call?.symbol &&
         prev.put?.symbol === next.put?.symbol &&
         prev.basePrice === next.basePrice &&
         prev.atmStrike === next.atmStrike &&
         prev.T === next.T &&
         prev.r === next.r &&
         prev.oneClickMode === next.oneClickMode &&
         prev.oneClickMultiplier === next.oneClickMultiplier;
});

export default OptionChainRow;
