import React, { useRef, useEffect, useState } from 'react';
import { X, Download, Copy, Share2, Check, Image as ImageIcon } from 'lucide-react';
import { useStore } from '../store';

const CARD_THEMES = [
  {
    id: 'cyberpunk',
    name: 'Cyber Neon',
    bgStart: '#050814',
    bgEnd: '#0f172a',
    accent: '#38bdf8',
    glow: '#0284c7',
    profitColor: '#22c55e',
    lossColor: '#ef4444',
    textColor: '#ffffff',
    subTextColor: '#94a3b8',
    cardBorder: 'rgba(56, 189, 248, 0.35)',
    panelBg: 'rgba(15, 23, 42, 0.75)'
  },
  {
    id: 'oled',
    name: 'OLED Stealth',
    bgStart: '#000000',
    bgEnd: '#0a0a0a',
    accent: '#3b82f6',
    glow: '#1d4ed8',
    profitColor: '#10b981',
    lossColor: '#f43f5e',
    textColor: '#ffffff',
    subTextColor: '#71717a',
    cardBorder: 'rgba(255, 255, 255, 0.12)',
    panelBg: 'rgba(20, 20, 22, 0.8)'
  },
  {
    id: 'royal_gold',
    name: 'Royal Gold',
    bgStart: '#0f0c08',
    bgEnd: '#1c160e',
    accent: '#fbbf24',
    glow: '#d97706',
    profitColor: '#34d399',
    lossColor: '#f87171',
    textColor: '#fef3c7',
    subTextColor: '#a3907c',
    cardBorder: 'rgba(251, 191, 36, 0.3)',
    panelBg: 'rgba(28, 22, 14, 0.8)'
  },
  {
    id: 'matrix',
    name: 'Matrix Green',
    bgStart: '#02140d',
    bgEnd: '#052e16',
    accent: '#4ade80',
    glow: '#16a34a',
    profitColor: '#4ade80',
    lossColor: '#f87171',
    textColor: '#f0fdf4',
    subTextColor: '#86efac',
    cardBorder: 'rgba(74, 222, 128, 0.3)',
    panelBg: 'rgba(6, 46, 26, 0.75)'
  }
];

export default function PnLShareCardModal({ trade, onClose }) {
  const user = useStore(state => state.user);
  const canvasRef = useRef(null);
  const [selectedThemeId, setSelectedThemeId] = useState('cyberpunk');
  const [copySuccess, setCopySuccess] = useState(false);

  const currentTheme = CARD_THEMES.find(t => t.id === selectedThemeId) || CARD_THEMES[0];

  const symbol = trade?.symbol || 'NIFTY';
  const displaySymbol = symbol.includes(':') ? symbol.split(':')[1] : symbol;
  const pnl = Number(trade?.realized_pnl !== undefined ? trade?.realized_pnl : (trade?.pnl || trade?.displayPnl || 0));
  const isProfit = pnl >= 0;
  const pnlPercent = trade?.pnlPercent !== undefined
    ? Number(trade.pnlPercent)
    : (trade?.avg && trade?.exit_price
      ? ((trade.exit_price - trade.avg) / trade.avg) * 100 * (trade.side === 'SELL' ? -1 : 1)
      : 0);

  const entryPrice = Number(trade?.avg || trade?.average_price || trade?.buyPrice || 0);
  const exitPrice = Number(trade?.exit_price || trade?.ltp || trade?.sellPrice || entryPrice);
  const quantity = Math.abs(Number(trade?.qty || trade?.quantity || trade?.closed_quantity || 1));
  const productType = trade?.product_type || trade?.productLabel || 'INTRADAY';
  const side = trade?.side || (isProfit ? 'BUY' : 'SELL');
  const tag = trade?.tag || (isProfit ? 'Breakout Setup' : 'Risk Managed');
  const dateStr = trade?.date || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const drawCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = 1080;
    const height = 1080;

    canvas.width = width;
    canvas.height = height;

    const t = currentTheme;

    // Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, t.bgStart);
    bgGrad.addColorStop(1, t.bgEnd);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Radial Ambient Glow
    const radGrad = ctx.createRadialGradient(width / 2, 450, 50, width / 2, 450, 550);
    radGrad.addColorStop(0, isProfit ? 'rgba(34, 197, 94, 0.18)' : 'rgba(239, 68, 68, 0.18)');
    radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, width, height);

    // Grid Pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Outer Frame
    ctx.save();
    ctx.strokeStyle = t.cardBorder;
    ctx.lineWidth = 3;
    ctx.strokeRect(36, 36, width - 72, height - 72);
    ctx.restore();

    // Corner accents
    const cornerSize = 24;
    ctx.strokeStyle = isProfit ? t.profitColor : t.accent;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(36, 36 + cornerSize); ctx.lineTo(36, 36); ctx.lineTo(36 + cornerSize, 36); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(width - 36 - cornerSize, 36); ctx.lineTo(width - 36, 36); ctx.lineTo(width - 36, 36 + cornerSize); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(36, height - 36 - cornerSize); ctx.lineTo(36, height - 36); ctx.lineTo(36 + cornerSize, height - 36); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(width - 36 - cornerSize, height - 36); ctx.lineTo(width - 36, height - 36); ctx.lineTo(width - 36, height - 36 - cornerSize); ctx.stroke();

    // Header Branding
    ctx.fillStyle = t.textColor;
    ctx.font = '900 34px sans-serif';
    ctx.fillText('SHORT EDGE', 80, 110);

    ctx.fillStyle = t.accent;
    ctx.font = '700 16px sans-serif';
    ctx.fillText('VERIFIED TRADING TERMINAL', 80, 138);

    // Verified Pill
    ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
    ctx.beginPath();
    ctx.roundRect(width - 260, 80, 180, 48, [12]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#22c55e';
    ctx.font = '700 18px sans-serif';
    ctx.fillText('✓ VERIFIED P&L', width - 240, 110);

    // Trader Info
    ctx.fillStyle = t.subTextColor;
    ctx.font = '500 20px sans-serif';
    const traderName = user?.username ? ('@' + user.username) : '@ShortEdgeTrader';
    ctx.fillText(traderName + '  •  ' + dateStr + ' ' + timeStr, 80, 185);

    // Divider
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(80, 215);
    ctx.lineTo(width - 80, 215);
    ctx.stroke();

    // Symbol
    ctx.fillStyle = t.textColor;
    ctx.font = '800 48px sans-serif';
    ctx.fillText(displaySymbol, 80, 285);

    // Product & Side Badges
    const badgeX = 80;
    const badgeY = 310;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, 110, 36, [8]);
    ctx.fill();
    ctx.fillStyle = t.subTextColor;
    ctx.font = '700 16px sans-serif';
    ctx.fillText(productType, badgeX + 16, badgeY + 24);

    const isBuySide = side === 'BUY' || side === 'LONG';
    ctx.fillStyle = isBuySide ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)';
    ctx.beginPath();
    ctx.roundRect(badgeX + 125, badgeY, 80, 36, [8]);
    ctx.fill();
    ctx.fillStyle = isBuySide ? '#22c55e' : '#ef4444';
    ctx.font = '700 16px sans-serif';
    ctx.fillText(side, badgeX + 145, badgeY + 24);

    if (tag) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.beginPath();
      ctx.roundRect(badgeX + 220, badgeY, 210, 36, [8]);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.font = '700 15px sans-serif';
      ctx.fillText(tag, badgeX + 235, badgeY + 24);
    }

    // P&L Hero Card
    const heroY = 375;
    ctx.fillStyle = t.panelBg;
    ctx.beginPath();
    ctx.roundRect(80, heroY, width - 160, 220, [20]);
    ctx.fill();
    ctx.strokeStyle = isProfit ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = t.subTextColor;
    ctx.font = '600 20px sans-serif';
    ctx.fillText(isProfit ? 'TOTAL REALIZED NET PROFIT' : 'TOTAL REALIZED LOSS', 115, heroY + 50);

    const pnlFormatted = (isProfit ? '+' : '-') + '₹' + Math.abs(pnl).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    ctx.fillStyle = isProfit ? t.profitColor : t.lossColor;
    ctx.font = '900 76px sans-serif';
    ctx.fillText(pnlFormatted, 115, heroY + 135);

    const returnFormatted = (isProfit ? '+' : '') + pnlPercent.toFixed(2) + '% ROI';
    ctx.fillStyle = isProfit ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)';
    ctx.beginPath();
    ctx.roundRect(115, heroY + 155, 170, 38, [10]);
    ctx.fill();
    ctx.fillStyle = isProfit ? t.profitColor : t.lossColor;
    ctx.font = '800 20px sans-serif';
    ctx.fillText(returnFormatted, 130, heroY + 181);

    // Metrics Grid
    const gridY = 625;
    const colWidth = (width - 160 - 36) / 3;
    const metrics = [
      { label: 'ENTRY PRICE', val: '₹' + entryPrice.toFixed(2) },
      { label: 'EXIT / LTP', val: '₹' + exitPrice.toFixed(2) },
      { label: 'QUANTITY', val: quantity + ' Qty' }
    ];

    metrics.forEach((m, idx) => {
      const colX = 80 + idx * (colWidth + 18);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.beginPath();
      ctx.roundRect(colX, gridY, colWidth, 120, [14]);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = t.subTextColor;
      ctx.font = '600 16px sans-serif';
      ctx.fillText(m.label, colX + 24, gridY + 42);

      ctx.fillStyle = t.textColor;
      ctx.font = '800 28px sans-serif';
      ctx.fillText(m.val, colX + 24, gridY + 86);
    });

    // Discipline Banner
    const bannerY = 775;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.beginPath();
    ctx.roundRect(80, bannerY, width - 160, 110, [14]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = t.accent;
    ctx.font = '700 18px sans-serif';
    ctx.fillText('TRADING DISCIPLINE & RULES', 115, bannerY + 42);

    ctx.fillStyle = t.subTextColor;
    ctx.font = '500 16px sans-serif';
    const quote = isProfit
      ? '“Plan the trade and trade the plan. Consistency comes from disciplined risk management.”'
      : '“Every loss is tuition paid for market mastery. Protect capital first.”';
    ctx.fillText(quote, 115, bannerY + 76);

    // Footer
    const footerY = 945;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(80, footerY);
    ctx.lineTo(width - 80, footerY);
    ctx.stroke();

    ctx.fillStyle = t.textColor;
    ctx.font = '700 22px sans-serif';
    ctx.fillText('Trade with Speed & Precision on Short Edge', 80, footerY + 45);

    ctx.fillStyle = t.subTextColor;
    ctx.font = '500 15px sans-serif';
    ctx.fillText('www.shortedge.in  •  Zero Latency Algo & Paper Trading', 80, footerY + 72);

    ctx.fillStyle = t.accent;
    ctx.font = '900 26px sans-serif';
    ctx.fillText('⚡ SHORT EDGE', width - 280, footerY + 55);
  };

  useEffect(() => {
    drawCard();
  }, [selectedThemeId, trade, user]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const image = canvas.toDataURL('image/png', 1.0);
    const link = document.createElement('a');
    link.download = 'ShortEdge_PnL_' + displaySymbol + '_' + Date.now() + '.png';
    link.href = image;
    link.click();
  };

  const handleCopyImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        if (navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2500);
        } else {
          const text = 'Short Edge Trade:\n' + displaySymbol + ' ' + side + ' | P&L: ' + (isProfit ? '+' : '') + '₹' + pnl.toFixed(2) + ' (' + pnlPercent.toFixed(2) + '%)\nExecuted on Short Edge Terminal';
          await navigator.clipboard.writeText(text);
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2500);
        }
      }, 'image/png');
    } catch (err) {
      console.warn('Clipboard copy error:', err);
      handleDownload();
    }
  };

  const handleShareWhatsApp = () => {
    const shareText = encodeURIComponent(
      'Short Edge Trade Result:\n' +
      'Symbol: ' + displaySymbol + '\n' +
      'Side: ' + side + ' (' + productType + ')\n' +
      'Realized P&L: ' + (isProfit ? '+' : '') + '₹' + Math.abs(pnl).toLocaleString('en-IN') + '\n' +
      'ROI: ' + (isProfit ? '+' : '') + pnlPercent.toFixed(2) + '%\n' +
      'Trader: @' + (user?.username || 'Trader') + '\n\n' +
      'Trade seamlessly on Short Edge: https://shortedge.in'
    );
    window.open('https://api.whatsapp.com/send?text=' + shareText, '_blank');
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      overflowY: 'auto'
    }}>
      <div style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        borderRadius: '20px',
        maxWidth: '560px',
        width: '100%',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: isProfit ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              color: isProfit ? 'var(--color-green-light)' : 'var(--color-red-light)',
              padding: '8px',
              borderRadius: '10px'
            }}>
              <ImageIcon size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>Share Trade P&L Card</h3>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                1080x1080 HD Social Share Card
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Select Card Theme
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {CARD_THEMES.map(t => {
                const isSelected = t.id === selectedThemeId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedThemeId(t.id)}
                    style={{
                      padding: '8px 4px',
                      borderRadius: '8px',
                      background: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.04)',
                      border: isSelected ? '1.5px solid var(--color-blue)' : '1px solid var(--border-color)',
                      color: isSelected ? '#60a5fa' : 'var(--text-secondary)',
                      fontSize: '11px',
                      fontWeight: isSelected ? '700' : '500',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{
            width: '100%',
            aspectRatio: '1 / 1',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
            background: '#000',
            position: 'relative'
          }}>
            <canvas
              ref={canvasRef}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={handleDownload}
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'var(--color-blue)',
                border: 'none',
                color: '#fff',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)'
              }}
            >
              <Download size={15} /> Download
            </button>

            <button
              type="button"
              onClick={handleCopyImage}
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: copySuccess ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.06)',
                border: copySuccess ? '1px solid #22c55e' : '1px solid var(--border-color)',
                color: copySuccess ? 'var(--color-green-light)' : 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              {copySuccess ? <Check size={15} /> : <Copy size={15} />}
              {copySuccess ? 'Copied!' : 'Copy Image'}
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.35)',
                color: 'var(--color-green-light)',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Share2 size={15} /> WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
