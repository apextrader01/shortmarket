// frontend/src/utils/clientReportGenerator.js
// High-Precision Financial Reports & Statements Generator (Excel + PDF + HTML)

/**
 * Escape CSV string values properly
 */
function esc(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Returns YYYY-MM-DD in IST timezone (Asia/Kolkata)
 */
export function getISTDateString(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
  const parts = new Intl.DateTimeFormat('en-IN', options).formatToParts(d);
  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  return `${y}-${m}-${day}`;
}

/**
 * Robust filter for any list of records based on period preset or custom date range
 */
export function filterRecordsByPeriod(records = [], period = 'All Time', customStart = '', customEnd = '', dateField = 'created_at') {
  if (!Array.isArray(records) || records.length === 0) return [];
  if (period === 'All' || period === 'All Time' || period === 'All Records') return records;

  const now = new Date();
  const todayIST = getISTDateString(now);

  return records.filter(item => {
    const rawDate = item[dateField] || item.createdAt || item.date || item.timestamp;
    if (!rawDate) return true;
    const itemDate = new Date(rawDate);
    if (isNaN(itemDate.getTime())) return true;
    const itemIST = getISTDateString(itemDate);

    if (period === 'Today' || period.includes('Today')) {
      return itemIST === todayIST;
    }
    if (period === 'This Week' || period === 'Week' || period.includes('Week')) {
      const diffMs = now.getTime() - itemDate.getTime();
      return diffMs >= 0 && diffMs <= (7 * 24 * 60 * 60 * 1000);
    }
    if (period === '15 Days' || period.includes('15 Days')) {
      const diffMs = now.getTime() - itemDate.getTime();
      return diffMs >= 0 && diffMs <= (15 * 24 * 60 * 60 * 1000);
    }
    if (period === 'This Month' || period === 'Month' || period === 'Current Month' || period.includes('Month')) {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return itemDate >= startOfMonth && itemDate <= now;
    }
    if (period === '3 Months' || period.includes('3 Months')) {
      const diffMs = now.getTime() - itemDate.getTime();
      return diffMs >= 0 && diffMs <= (90 * 24 * 60 * 60 * 1000);
    }
    if (period.includes('2025-26')) {
      const fyStart = '2025-04-01';
      const fyEnd = '2026-03-31';
      return itemIST >= fyStart && itemIST <= fyEnd;
    }
    if (period.includes('2024-25')) {
      const fyStart = '2024-04-01';
      const fyEnd = '2025-03-31';
      return itemIST >= fyStart && itemIST <= fyEnd;
    }
    if (period === 'Custom' || period.includes('Custom')) {
      if (customStart && itemIST < customStart) return false;
      if (customEnd && itemIST > customEnd) return false;
      return true;
    }
    return true;
  });
}

/**
 * Standard Indian Regulatory Charges Calculator
 */
export function calculateIndianCharges(order) {
  const qty = Math.abs(Number(order.quantity) || 0);
  const price = Number(order.average_price || order.price || order.execution_price || 0);
  const tradeValue = qty * price;
  const isDelivery = order.product_type === 'DELIVERY';
  const isOption = /(CE|PE|OPT)/i.test(order.symbol || '');
  const isFuture = /FUT/i.test(order.symbol || '');
  const isMCX = /(MCX|GOLD|SILVER|CRUDE|NATURALGAS|COPPER)/i.test(order.symbol || '');
  const isSell = (order.side === 'SELL' || order.type === 'SELL');

  // Brokerage: ₹20 flat or ₹0 for delivery
  let brokerage = isDelivery ? 0 : 20;
  if (order.brokerage !== undefined && order.brokerage !== null) {
    brokerage = Number(order.brokerage);
  }

  // STT / CTT
  let stt = 0;
  if (isDelivery) {
    stt = tradeValue * 0.001;
  } else if (isOption) {
    stt = isSell ? tradeValue * 0.000625 : 0;
  } else if (isFuture) {
    stt = isSell ? tradeValue * 0.000125 : 0;
  } else if (isMCX) {
    stt = isSell ? tradeValue * 0.0001 : 0;
  } else {
    stt = isSell ? tradeValue * 0.00025 : 0;
  }

  // Exchange Txn Charges
  let exchangeFee = 0;
  if (isOption) {
    exchangeFee = tradeValue * 0.0005;
  } else if (isFuture) {
    exchangeFee = tradeValue * 0.000019;
  } else if (isMCX) {
    exchangeFee = tradeValue * 0.000021;
  } else {
    exchangeFee = tradeValue * 0.0000345;
  }

  // SEBI Charges: ₹10 per crore (0.000001)
  const sebiFee = tradeValue * 0.000001;

  // Stamp Duty (on buy only)
  let stampDuty = 0;
  if (!isSell) {
    if (isDelivery) stampDuty = tradeValue * 0.00015;
    else if (isOption) stampDuty = tradeValue * 0.00003;
    else if (isFuture) stampDuty = tradeValue * 0.00002;
    else if (isMCX) stampDuty = tradeValue * 0.00002;
    else stampDuty = tradeValue * 0.00003;
  }

  // GST: 18% on (Brokerage + Exchange + SEBI)
  const gst = (brokerage + exchangeFee + sebiFee) * 0.18;
  const totalCharges = brokerage + stt + exchangeFee + sebiFee + stampDuty + gst;

  return {
    tradeValue: Math.round(tradeValue * 100) / 100,
    brokerage: Math.round(brokerage * 100) / 100,
    stt: Math.round(stt * 100) / 100,
    exchangeFee: Math.round(exchangeFee * 100) / 100,
    sebiFee: Math.round(sebiFee * 100) / 100,
    stampDuty: Math.round(stampDuty * 100) / 100,
    gst: Math.round(gst * 100) / 100,
    totalCharges: Math.round(totalCharges * 100) / 100
  };
}

/**
 * Downloads a CSV file — bulletproof direct anchor approach
 */
export function triggerCsvDownload(csvRows, filename) {
  try {
    const csvContent = '\uFEFF' + csvRows.map(r => Array.isArray(r) ? r.join(',') : r).join('\r\n');
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeFilename = `${filename}_${dateStr}.csv`;

    // Method 1: Blob URL anchor
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = url;
    link.download = safeFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.error('CSV Download failed:', err);
    alert('CSV download failed. Please try again or use a different browser.');
  }
}

/**
 * Downloads a standalone HTML statement file — bulletproof direct anchor approach
 */
export function triggerHtmlDownload(htmlContent, filename) {
  try {
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeFilename = `${filename}_${dateStr}.html`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = url;
    link.download = safeFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.error('HTML Download failed:', err);
    alert('HTML download failed. Please try again.');
  }
}

/**
 * Builds standard styled HTML document for statements
 */
export function buildReportHtml(title, clientMeta = {}, summaryCards = [], tablesHtml = '') {
  const generatedDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const clientName = clientMeta.username || clientMeta.name || 'Valued Trader';
  const clientId = clientMeta.client_id || (clientMeta.id ? `SE${String(clientMeta.id).padStart(6, '0')}` : 'SE000001');
  const pan = clientMeta.pan_card || clientMeta.pan || 'XXXXX0000X';

  const cardsHtml = (summaryCards || []).map(c => `
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; flex: 1; min-width: 140px;">
      <div style="font-size: 11px; color: #64748b; margin-bottom: 2px;">${c.label}</div>
      <div style="font-size: 15px; font-weight: 700; color: ${c.color || '#0f172a'};">${c.value}</div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title} - ${clientId}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 16px; background: #fff; font-size: 11.5px; }
    .no-print { position: sticky; top: 0; background: #ffffff; padding: 12px 16px; border-bottom: 2px solid #2563eb; margin: -16px -16px 16px -16px; display: flex; justify-content: space-between; align-items: center; z-index: 9999; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 14px; }
    .logo-title { font-size: 20px; font-weight: 800; color: #1e3a8a; letter-spacing: -0.5px; }
    .doc-title { font-size: 14px; font-weight: 700; color: #2563eb; margin-top: 2px; }
    .meta-box { display: flex; gap: 24px; background: #f1f5f9; padding: 10px 14px; border-radius: 6px; margin-bottom: 14px; font-size: 11px; }
    .summary-grid { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10.5px; }
    th { background: #1e293b; color: #fff; padding: 6px 8px; text-align: left; font-weight: 600; }
    td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) td { background: #f8fafc; }
    .text-right { text-align: right; }
    .text-green { color: #16a34a; font-weight: 600; }
    .text-red { color: #dc2626; font-weight: 600; }
    .footer { font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 20px; }
    @media print {
      .no-print { display: none !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <div style="font-size: 13px; font-weight: 700; color: #1e3a8a; display: flex; align-items: center; gap: 8px;">
      <span style="background: #2563eb; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px;">SHORT EDGE</span>
      <span>${title} - Statement Preview</span>
    </div>
    <div style="display: flex; gap: 8px;">
      <button onclick="window.print()" style="background: #2563eb; color: #fff; border: none; padding: 8px 18px; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(37,99,235,0.3);">🖨️ Print / Save as PDF</button>
      <button onclick="window.close()" style="background: #e2e8f0; color: #334155; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px;">✕ Close</button>
    </div>
  </div>

  <div class="header">
    <div>
      <div class="logo-title">SHORT EDGE</div>
      <div class="doc-title">${title}</div>
    </div>
    <div style="text-align: right; font-size: 10px; color: #475569;">
      <div>Short Edge Trading Platform</div>
      <div>Generated: ${generatedDate} IST</div>
      <div>Official Client Statement</div>
    </div>
  </div>

  <div class="meta-box">
    <div><strong>Client Name:</strong> ${clientName}</div>
    <div><strong>Client ID:</strong> <span style="font-family: monospace; font-weight: 700;">${clientId}</span></div>
    <div><strong>PAN:</strong> ${pan}</div>
    <div><strong>Period:</strong> ${clientMeta.period || 'All Records'}</div>
  </div>

  ${summaryCards && summaryCards.length ? `<div class="summary-grid">${cardsHtml}</div>` : ''}

  ${tablesHtml}

  <div class="footer">
    This is a computer-generated official statement from Short Edge. No physical signature is required. For discrepancies, contact support@shortedge.in.
  </div>

  <script>
    if (document.readyState === 'complete') {
      setTimeout(function() { try { window.print(); } catch(e) {} }, 350);
    } else {
      window.addEventListener('load', function() {
        setTimeout(function() { try { window.print(); } catch(e) {} }, 350);
      });
    }
  </script>
</body>
</html>`;
}

/**
 * Opens printable statement — triple fallback: blank window > blob tab > HTML download
 */
export function triggerPdfPrint(title, clientMeta = {}, summaryCards = [], tablesHtml = '') {
  const fullHtml = buildReportHtml(title, clientMeta, summaryCards, tablesHtml);
  const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');

  // Attempt 1: Open a blank window and write HTML directly (synchronous, no popup blocker)
  try {
    const printWindow = window.open('', '_blank');
    if (printWindow && printWindow.document && !printWindow.closed) {
      printWindow.document.open();
      printWindow.document.write(fullHtml);
      printWindow.document.close();
      printWindow.focus();
      return; // Success — exit
    }
  } catch (e1) {
    console.warn('Attempt 1 (blank window) failed:', e1);
  }

  // Attempt 2: Open a Blob URL in new tab
  try {
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const w2 = window.open(blobUrl, '_blank');
    if (w2) {
      w2.focus();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
      return; // Success — exit
    }
    URL.revokeObjectURL(blobUrl);
  } catch (e2) {
    console.warn('Attempt 2 (blob URL) failed:', e2);
  }

  // Attempt 3 (guaranteed fallback): Direct HTML file download — works 100% regardless of popup settings
  console.warn('All popup methods blocked — falling back to direct HTML download');
  triggerHtmlDownload(fullHtml, safeTitle);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. TAX P&L STATEMENT GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
export function generateTaxPnLReport(orders = [], positions = [], user = {}, dateRange = 'FY 2025-26', format = 'excel', customStart = '', customEnd = '') {
  const filtered = filterRecordsByPeriod(orders, dateRange, customStart, customEnd);
  const executed = filtered.filter(o => o.status === 'COMPLETED' || o.status === 'COMPLETE' || o.status === 'EXECUTED');
  
  const scripMap = {};
  executed.forEach(o => {
    const sym = o.symbol || 'UNKNOWN';
    if (!scripMap[sym]) {
      scripMap[sym] = {
        symbol: sym,
        segment: /(CE|PE|OPT)/i.test(sym) ? 'F&O Options' : (/FUT/i.test(sym) ? 'F&O Futures' : (o.product_type === 'DELIVERY' ? 'Equity Delivery' : 'Equity Intraday')),
        buyQty: 0,
        buyVal: 0,
        sellQty: 0,
        sellVal: 0,
        realizedPnl: 0,
        charges: 0
      };
    }
    const qty = Number(o.quantity) || 0;
    const price = Number(o.average_price || o.price || 0);
    const val = qty * price;
    const isBuy = (o.side === 'BUY' || o.type === 'BUY');

    if (isBuy) {
      scripMap[sym].buyQty += qty;
      scripMap[sym].buyVal += val;
    } else {
      scripMap[sym].sellQty += qty;
      scripMap[sym].sellVal += val;
    }

    if (o.realized_pnl !== null && o.realized_pnl !== undefined && parseFloat(o.realized_pnl) !== 0) {
      scripMap[sym].realizedPnl += parseFloat(o.realized_pnl);
    }
    const ch = calculateIndianCharges(o);
    scripMap[sym].charges += ch.totalCharges;
  });

  const scripList = Object.values(scripMap);
  const totalTurnover = scripList.reduce((acc, s) => acc + (s.buyVal + s.sellVal), 0);
  const totalGrossPnl = scripList.reduce((acc, s) => acc + s.realizedPnl, 0);
  const totalCharges = scripList.reduce((acc, s) => acc + s.charges, 0);
  const totalNetTaxable = totalGrossPnl - totalCharges;

  const displayPeriod = dateRange === 'Custom' ? `${customStart || 'Start'} to ${customEnd || 'End'}` : dateRange;

  if (format === 'excel') {
    const rows = [];
    rows.push([esc('SHORT EDGE - SCRIPWISE TAX P&L STATEMENT')]);
    rows.push([esc(`Client ID: ${user.client_id || user.id || 'SE000001'}`), esc(`Client Name: ${user.username || 'Valued Trader'}`), esc(`Period: ${displayPeriod}`)]);
    rows.push([esc(`Total Turnover: ₹${totalTurnover.toFixed(2)}`), esc(`Gross Realized P&L: ₹${totalGrossPnl.toFixed(2)}`), esc(`Net Taxable P&L: ₹${totalNetTaxable.toFixed(2)}`)]);
    rows.push('');
    rows.push([esc('Scrip Symbol'), esc('Segment'), esc('Buy Qty'), esc('Buy Value (₹)'), esc('Sell Qty'), esc('Sell Value (₹)'), esc('Gross Realized P&L (₹)'), esc('Total Taxes & Charges (₹)'), esc('Net Taxable P&L (₹)')]);

    scripList.forEach(s => {
      const net = s.realizedPnl - s.charges;
      rows.push([
        esc(s.symbol),
        esc(s.segment),
        esc(s.buyQty),
        esc(s.buyVal.toFixed(2)),
        esc(s.sellQty),
        esc(s.sellVal.toFixed(2)),
        esc(s.realizedPnl.toFixed(2)),
        esc(s.charges.toFixed(2)),
        esc(net.toFixed(2))
      ]);
    });

    if (scripList.length === 0) {
      rows.push([esc('No trades executed during this selected period.'), '', '', '', '', '', '', '', '']);
    }

    triggerCsvDownload(rows, `Tax_PnL_${displayPeriod.replace(/\s+/g, '_')}`);
  } else if (format === 'html') {
    const summaryCards = [
      { label: 'Total Turnover', value: `₹${totalTurnover.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
      { label: 'Gross Realized P&L', value: `${totalGrossPnl >= 0 ? '+' : ''}₹${totalGrossPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: totalGrossPnl >= 0 ? '#16a34a' : '#dc2626' },
      { label: 'Taxes & Charges', value: `₹${totalCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#dc2626' },
      { label: 'Net Taxable P&L', value: `${totalNetTaxable >= 0 ? '+' : ''}₹${totalNetTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: totalNetTaxable >= 0 ? '#16a34a' : '#dc2626' }
    ];

    const tableRows = scripList.map(s => {
      const net = s.realizedPnl - s.charges;
      return `
        <tr>
          <td><strong>${s.symbol}</strong></td>
          <td>${s.segment}</td>
          <td class="text-right">${s.buyQty}</td>
          <td class="text-right">₹${s.buyVal.toFixed(2)}</td>
          <td class="text-right">${s.sellQty}</td>
          <td class="text-right">₹${s.sellVal.toFixed(2)}</td>
          <td class="text-right ${s.realizedPnl >= 0 ? 'text-green' : 'text-red'}">${s.realizedPnl >= 0 ? '+' : ''}₹${s.realizedPnl.toFixed(2)}</td>
          <td class="text-right">₹${s.charges.toFixed(2)}</td>
          <td class="text-right ${net >= 0 ? 'text-green' : 'text-red'}">${net >= 0 ? '+' : ''}₹${net.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const tablesHtml = `
      <table>
        <thead>
          <tr>
            <th>Scrip Symbol</th>
            <th>Segment</th>
            <th class="text-right">Buy Qty</th>
            <th class="text-right">Buy Value</th>
            <th class="text-right">Sell Qty</th>
            <th class="text-right">Sell Value</th>
            <th class="text-right">Gross Realized P&L</th>
            <th class="text-right">Taxes & Charges</th>
            <th class="text-right">Net Taxable P&L</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows.length ? tableRows : '<tr><td colspan="9" style="text-align:center; padding: 20px;">No trades recorded in this period.</td></tr>'}
        </tbody>
      </table>
    `;

    const html = buildReportHtml('Scripwise Tax P&L Statement', { ...user, period: displayPeriod }, summaryCards, tablesHtml);
    triggerHtmlDownload(html, `Tax_PnL_${displayPeriod.replace(/\s+/g, '_')}`);
  } else {
    const summaryCards = [
      { label: 'Total Turnover', value: `₹${totalTurnover.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
      { label: 'Gross Realized P&L', value: `${totalGrossPnl >= 0 ? '+' : ''}₹${totalGrossPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: totalGrossPnl >= 0 ? '#16a34a' : '#dc2626' },
      { label: 'Taxes & Charges', value: `₹${totalCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#dc2626' },
      { label: 'Net Taxable P&L', value: `${totalNetTaxable >= 0 ? '+' : ''}₹${totalNetTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: totalNetTaxable >= 0 ? '#16a34a' : '#dc2626' }
    ];

    const tableRows = scripList.map(s => {
      const net = s.realizedPnl - s.charges;
      return `
        <tr>
          <td><strong>${s.symbol}</strong></td>
          <td>${s.segment}</td>
          <td class="text-right">${s.buyQty}</td>
          <td class="text-right">₹${s.buyVal.toFixed(2)}</td>
          <td class="text-right">${s.sellQty}</td>
          <td class="text-right">₹${s.sellVal.toFixed(2)}</td>
          <td class="text-right ${s.realizedPnl >= 0 ? 'text-green' : 'text-red'}">${s.realizedPnl >= 0 ? '+' : ''}₹${s.realizedPnl.toFixed(2)}</td>
          <td class="text-right">₹${s.charges.toFixed(2)}</td>
          <td class="text-right ${net >= 0 ? 'text-green' : 'text-red'}">${net >= 0 ? '+' : ''}₹${net.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const tablesHtml = `
      <table>
        <thead>
          <tr>
            <th>Scrip Symbol</th>
            <th>Segment</th>
            <th class="text-right">Buy Qty</th>
            <th class="text-right">Buy Value</th>
            <th class="text-right">Sell Qty</th>
            <th class="text-right">Sell Value</th>
            <th class="text-right">Gross Realized P&L</th>
            <th class="text-right">Taxes & Charges</th>
            <th class="text-right">Net Taxable P&L</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows.length ? tableRows : '<tr><td colspan="9" style="text-align:center; padding: 20px;">No trades recorded in this period.</td></tr>'}
        </tbody>
      </table>
    `;

    triggerPdfPrint('Scripwise Tax P&L Statement', { ...user, period: displayPeriod }, summaryCards, tablesHtml);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. P&L SUMMARY STATEMENT GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
export function generatePnLSummaryReport(orders = [], positions = [], user = {}, dateRange = 'Current Month', format = 'excel', customStart = '', customEnd = '') {
  const filtered = filterRecordsByPeriod(orders, dateRange, customStart, customEnd);
  const executed = filtered.filter(o => o.status === 'COMPLETED' || o.status === 'COMPLETE' || o.status === 'EXECUTED');
  
  const segments = {
    'Equity Intraday': { trades: 0, turnover: 0, grossPnl: 0, charges: 0 },
    'Equity Delivery': { trades: 0, turnover: 0, grossPnl: 0, charges: 0 },
    'F&O Futures': { trades: 0, turnover: 0, grossPnl: 0, charges: 0 },
    'F&O Options': { trades: 0, turnover: 0, grossPnl: 0, charges: 0 },
    'Commodity (MCX)': { trades: 0, turnover: 0, grossPnl: 0, charges: 0 }
  };

  executed.forEach(o => {
    const sym = o.symbol || '';
    let seg = 'Equity Intraday';
    if (/(CE|PE|OPT)/i.test(sym)) seg = 'F&O Options';
    else if (/FUT/i.test(sym)) seg = 'F&O Futures';
    else if (/(MCX|GOLD|SILVER|CRUDE)/i.test(sym)) seg = 'Commodity (MCX)';
    else if (o.product_type === 'DELIVERY') seg = 'Equity Delivery';

    const ch = calculateIndianCharges(o);
    segments[seg].trades += 1;
    segments[seg].turnover += ch.tradeValue;
    segments[seg].charges += ch.totalCharges;
    if (o.realized_pnl !== null && o.realized_pnl !== undefined) {
      segments[seg].grossPnl += parseFloat(o.realized_pnl || 0);
    }
  });

  const totalGross = Object.values(segments).reduce((a, b) => a + b.grossPnl, 0);
  const totalCharges = Object.values(segments).reduce((a, b) => a + b.charges, 0);
  const totalNet = totalGross - totalCharges;

  const displayPeriod = dateRange === 'Custom' ? `${customStart || 'Start'} to ${customEnd || 'End'}` : dateRange;

  if (format === 'excel') {
    const rows = [];
    rows.push([esc('SHORT EDGE - SEGMENTWISE P&L SUMMARY STATEMENT')]);
    rows.push([esc(`Client ID: ${user.client_id || user.id || 'SE000001'}`), esc(`Client Name: ${user.username || 'Valued Trader'}`), esc(`Period: ${displayPeriod}`)]);
    rows.push('');
    rows.push([esc('Trading Segment'), esc('Total Trades'), esc('Total Turnover (₹)'), esc('Gross P&L (₹)'), esc('Total Charges (₹)'), esc('Net Realized P&L (₹)')]);

    Object.entries(segments).forEach(([segName, data]) => {
      rows.push([
        esc(segName),
        esc(data.trades),
        esc(data.turnover.toFixed(2)),
        esc(data.grossPnl.toFixed(2)),
        esc(data.charges.toFixed(2)),
        esc((data.grossPnl - data.charges).toFixed(2))
      ]);
    });

    triggerCsvDownload(rows, `PnL_Summary_${displayPeriod.replace(/\s+/g, '_')}`);
  } else if (format === 'html') {
    const summaryCards = [
      { label: 'Total Realized Gross P&L', value: `${totalGross >= 0 ? '+' : ''}₹${totalGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: totalGross >= 0 ? '#16a34a' : '#dc2626' },
      { label: 'Total Regulatory Charges', value: `₹${totalCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#dc2626' },
      { label: 'Net Realized Profit / Loss', value: `${totalNet >= 0 ? '+' : ''}₹${totalNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: totalNet >= 0 ? '#16a34a' : '#dc2626' }
    ];

    const tableRows = Object.entries(segments).map(([segName, data]) => {
      const net = data.grossPnl - data.charges;
      return `
        <tr>
          <td><strong>${segName}</strong></td>
          <td class="text-right">${data.trades}</td>
          <td class="text-right">₹${data.turnover.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td class="text-right ${data.grossPnl >= 0 ? 'text-green' : 'text-red'}">${data.grossPnl >= 0 ? '+' : ''}₹${data.grossPnl.toFixed(2)}</td>
          <td class="text-right">₹${data.charges.toFixed(2)}</td>
          <td class="text-right ${net >= 0 ? 'text-green' : 'text-red'}">${net >= 0 ? '+' : ''}₹${net.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const tablesHtml = `
      <table>
        <thead>
          <tr>
            <th>Trading Segment</th>
            <th class="text-right">Total Trades</th>
            <th class="text-right">Turnover</th>
            <th class="text-right">Gross P&L</th>
            <th class="text-right">Charges</th>
            <th class="text-right">Net Realized P&L</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;

    const html = buildReportHtml('Segmentwise P&L Summary Statement', { ...user, period: displayPeriod }, summaryCards, tablesHtml);
    triggerHtmlDownload(html, `PnL_Summary_${displayPeriod.replace(/\s+/g, '_')}`);
  } else {
    const summaryCards = [
      { label: 'Total Realized Gross P&L', value: `${totalGross >= 0 ? '+' : ''}₹${totalGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: totalGross >= 0 ? '#16a34a' : '#dc2626' },
      { label: 'Total Regulatory Charges', value: `₹${totalCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#dc2626' },
      { label: 'Net Realized Profit / Loss', value: `${totalNet >= 0 ? '+' : ''}₹${totalNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: totalNet >= 0 ? '#16a34a' : '#dc2626' }
    ];

    const tableRows = Object.entries(segments).map(([segName, data]) => {
      const net = data.grossPnl - data.charges;
      return `
        <tr>
          <td><strong>${segName}</strong></td>
          <td class="text-right">${data.trades}</td>
          <td class="text-right">₹${data.turnover.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td class="text-right ${data.grossPnl >= 0 ? 'text-green' : 'text-red'}">${data.grossPnl >= 0 ? '+' : ''}₹${data.grossPnl.toFixed(2)}</td>
          <td class="text-right">₹${data.charges.toFixed(2)}</td>
          <td class="text-right ${net >= 0 ? 'text-green' : 'text-red'}">${net >= 0 ? '+' : ''}₹${net.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const tablesHtml = `
      <table>
        <thead>
          <tr>
            <th>Trading Segment</th>
            <th class="text-right">Total Trades</th>
            <th class="text-right">Turnover</th>
            <th class="text-right">Gross P&L</th>
            <th class="text-right">Charges</th>
            <th class="text-right">Net Realized P&L</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;

    triggerPdfPrint('Segmentwise P&L Summary Statement', { ...user, period: displayPeriod }, summaryCards, tablesHtml);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. TRADES & CHARGES DETAILED BREAKDOWN
// ─────────────────────────────────────────────────────────────────────────────
export function generateTradesAndChargesReport(orders = [], user = {}, dateRange = 'Current Month', format = 'excel', customStart = '', customEnd = '') {
  const filtered = filterRecordsByPeriod(orders, dateRange, customStart, customEnd);
  const executed = filtered.filter(o => o.status === 'COMPLETED' || o.status === 'COMPLETE' || o.status === 'EXECUTED');

  let grandBrokerage = 0;
  let grandSTT = 0;
  let grandExchange = 0;
  let grandGST = 0;
  let grandSEBI = 0;
  let grandStamp = 0;
  let grandTotalCharges = 0;

  const tradeRows = executed.map(o => {
    const ch = calculateIndianCharges(o);
    grandBrokerage += ch.brokerage;
    grandSTT += ch.stt;
    grandExchange += ch.exchangeFee;
    grandGST += ch.gst;
    grandSEBI += ch.sebiFee;
    grandStamp += ch.stampDuty;
    grandTotalCharges += ch.totalCharges;

    return {
      date: new Date(o.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      orderId: o.id || 'N/A',
      symbol: o.symbol,
      side: o.side || o.type || 'BUY',
      product: o.product_type || 'INTRADAY',
      qty: Number(o.quantity) || 0,
      price: Number(o.average_price || o.price || 0),
      tradeValue: ch.tradeValue,
      ...ch
    };
  });

  const displayPeriod = dateRange === 'Custom' ? `${customStart || 'Start'} to ${customEnd || 'End'}` : dateRange;

  if (format === 'excel') {
    const rows = [];
    rows.push([esc('SHORT EDGE - TRADES & CHARGES BREAKDOWN STATEMENT')]);
    rows.push([esc(`Client ID: ${user.client_id || user.id || 'SE000001'}`), esc(`Client Name: ${user.username || 'Valued Trader'}`), esc(`Period: ${displayPeriod}`)]);
    rows.push([esc(`Total Trades: ${executed.length}`), esc(`Total Brokerage: ₹${grandBrokerage.toFixed(2)}`), esc(`Total Charges & Taxes: ₹${grandTotalCharges.toFixed(2)}`)]);
    rows.push('');
    rows.push([
      esc('Trade Date/Time'), esc('Order ID'), esc('Symbol'), esc('Side'), esc('Product'), esc('Quantity'),
      esc('Price (₹)'), esc('Trade Value (₹)'), esc('Brokerage (₹)'), esc('STT/CTT (₹)'), esc('Exchange Txn (₹)'),
      esc('SEBI (₹)'), esc('Stamp Duty (₹)'), esc('GST (₹)'), esc('Total Charges (₹)')
    ]);

    tradeRows.forEach(t => {
      rows.push([
        esc(t.date), esc(t.orderId), esc(t.symbol), esc(t.side), esc(t.product), esc(t.qty),
        esc(t.price.toFixed(2)), esc(t.tradeValue.toFixed(2)), esc(t.brokerage.toFixed(2)), esc(t.stt.toFixed(2)),
        esc(t.exchangeFee.toFixed(2)), esc(t.sebiFee.toFixed(2)), esc(t.stampDuty.toFixed(2)), esc(t.gst.toFixed(2)),
        esc(t.totalCharges.toFixed(2))
      ]);
    });

    if (tradeRows.length === 0) {
      rows.push([esc('No trades executed during this selected period.'), '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
    }

    triggerCsvDownload(rows, `Trades_and_Charges_${displayPeriod.replace(/\s+/g, '_')}`);
  } else if (format === 'html') {
    const summaryCards = [
      { label: 'Total Executed Trades', value: `${executed.length}` },
      { label: 'Total Brokerage', value: `₹${grandBrokerage.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
      { label: 'Total STT / CTT', value: `₹${grandSTT.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
      { label: 'Total GST (18%)', value: `₹${grandGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
      { label: 'Grand Total Charges', value: `₹${grandTotalCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#dc2626' }
    ];

    const tableRows = tradeRows.map(t => `
      <tr>
        <td>${t.date}</td>
        <td><strong style="color: ${t.side === 'BUY' ? '#2563eb' : '#dc2626'};">${t.side}</strong> ${t.symbol}</td>
        <td class="text-right">${t.qty} @ ₹${t.price.toFixed(2)}</td>
        <td class="text-right">₹${t.tradeValue.toFixed(2)}</td>
        <td class="text-right">₹${t.brokerage.toFixed(2)}</td>
        <td class="text-right">₹${t.stt.toFixed(2)}</td>
        <td class="text-right">₹${t.gst.toFixed(2)}</td>
        <td class="text-right"><strong>₹${t.totalCharges.toFixed(2)}</strong></td>
      </tr>
    `).join('');

    const tablesHtml = `
      <table>
        <thead>
          <tr>
            <th>Date & Time</th>
            <th>Trade Details</th>
            <th class="text-right">Quantity & Price</th>
            <th class="text-right">Trade Value</th>
            <th class="text-right">Brokerage</th>
            <th class="text-right">STT / CTT</th>
            <th class="text-right">GST</th>
            <th class="text-right">Total Charges</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows.length ? tableRows : '<tr><td colspan="8" style="text-align:center; padding: 20px;">No trades recorded in this period.</td></tr>'}
        </tbody>
      </table>
    `;

    const html = buildReportHtml('Trades & Regulatory Charges Statement', { ...user, period: displayPeriod }, summaryCards, tablesHtml);
    triggerHtmlDownload(html, `Trades_and_Charges_${displayPeriod.replace(/\s+/g, '_')}`);
  } else {
    const summaryCards = [
      { label: 'Total Executed Trades', value: `${executed.length}` },
      { label: 'Total Brokerage', value: `₹${grandBrokerage.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
      { label: 'Total STT / CTT', value: `₹${grandSTT.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
      { label: 'Total GST (18%)', value: `₹${grandGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
      { label: 'Grand Total Charges', value: `₹${grandTotalCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#dc2626' }
    ];

    const tableRows = tradeRows.map(t => `
      <tr>
        <td>${t.date}</td>
        <td><strong style="color: ${t.side === 'BUY' ? '#2563eb' : '#dc2626'};">${t.side}</strong> ${t.symbol}</td>
        <td class="text-right">${t.qty} @ ₹${t.price.toFixed(2)}</td>
        <td class="text-right">₹${t.tradeValue.toFixed(2)}</td>
        <td class="text-right">₹${t.brokerage.toFixed(2)}</td>
        <td class="text-right">₹${t.stt.toFixed(2)}</td>
        <td class="text-right">₹${t.gst.toFixed(2)}</td>
        <td class="text-right"><strong>₹${t.totalCharges.toFixed(2)}</strong></td>
      </tr>
    `).join('');

    const tablesHtml = `
      <table>
        <thead>
          <tr>
            <th>Date & Time</th>
            <th>Trade Details</th>
            <th class="text-right">Quantity & Price</th>
            <th class="text-right">Trade Value</th>
            <th class="text-right">Brokerage</th>
            <th class="text-right">STT / CTT</th>
            <th class="text-right">GST</th>
            <th class="text-right">Total Charges</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows.length ? tableRows : '<tr><td colspan="8" style="text-align:center; padding: 20px;">No trades recorded in this period.</td></tr>'}
        </tbody>
      </table>
    `;

    triggerPdfPrint('Trades & Regulatory Charges Statement', { ...user, period: displayPeriod }, summaryCards, tablesHtml);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. STATEMENT - LEDGER GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
export function generateLedgerReport(ledger = [], user = {}, dateRange = 'All Records', format = 'excel', customStart = '', customEnd = '') {
  const filtered = filterRecordsByPeriod(ledger, dateRange, customStart, customEnd);
  
  let currentBalance = parseFloat(user.balance || 0);
  const ledgerWithBalance = (filtered || []).map(entry => {
    const balanceAfter = currentBalance;
    currentBalance -= Number(entry.amount);
    return { ...entry, running_balance: balanceAfter };
  });

  const totalCredits = filtered.filter(l => Number(l.amount) > 0).reduce((acc, l) => acc + Number(l.amount), 0);
  const totalDebits = filtered.filter(l => Number(l.amount) < 0).reduce((acc, l) => acc + Math.abs(Number(l.amount)), 0);
  const closingBalance = parseFloat(user.balance || 0);

  const displayPeriod = dateRange === 'Custom' ? `${customStart || 'Start'} to ${customEnd || 'End'}` : dateRange;

  if (format === 'excel') {
    const rows = [];
    rows.push([esc('SHORT EDGE - FINANCIAL LEDGER ACCOUNT STATEMENT')]);
    rows.push([esc(`Client ID: ${user.client_id || user.id || 'SE000001'}`), esc(`Client Name: ${user.username || 'Valued Trader'}`), esc(`Period: ${displayPeriod}`)]);
    rows.push([esc(`Total Credits: ₹${totalCredits.toFixed(2)}`), esc(`Total Debits: ₹${totalDebits.toFixed(2)}`), esc(`Closing Available Balance: ₹${closingBalance.toFixed(2)}`)]);
    rows.push('');
    rows.push([esc('Date & Time'), esc('Transaction Type'), esc('Description / Narration'), esc('Credit (₹)'), esc('Debit (₹)'), esc('Net Amount (₹)'), esc('Running Balance (₹)')]);

    ledgerWithBalance.forEach(l => {
      const amt = Number(l.amount) || 0;
      rows.push([
        esc(new Date(l.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })),
        esc(l.type),
        esc(l.description || l.type),
        esc(amt > 0 ? amt.toFixed(2) : '0.00'),
        esc(amt < 0 ? Math.abs(amt).toFixed(2) : '0.00'),
        esc(amt.toFixed(2)),
        esc(Number(l.running_balance).toFixed(2))
      ]);
    });

    if (ledgerWithBalance.length === 0) {
      rows.push([esc('No ledger transactions recorded in this period.'), '', '', '', '', '', '']);
    }

    triggerCsvDownload(rows, `Ledger_Statement_${displayPeriod.replace(/\s+/g, '_')}`);
  } else if (format === 'html') {
    const summaryCards = [
      { label: 'Total Deposits & Credits', value: `+₹${totalCredits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#16a34a' },
      { label: 'Total Withdrawals & Debits', value: `-₹${totalDebits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#dc2626' },
      { label: 'Closing Available Balance', value: `₹${closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#2563eb' }
    ];

    const tableRows = ledgerWithBalance.map(l => {
      const amt = Number(l.amount) || 0;
      return `
        <tr>
          <td>${new Date(l.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
          <td><span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 9.5px;">${String(l.type || '').replace('_', ' ')}</span></td>
          <td>${l.description || l.type}</td>
          <td class="text-right text-green">${amt > 0 ? `₹${amt.toFixed(2)}` : '-'}</td>
          <td class="text-right text-red">${amt < 0 ? `₹${Math.abs(amt).toFixed(2)}` : '-'}</td>
          <td class="text-right" style="font-weight: 700; color: #1e3a8a;">₹${Number(l.running_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      `;
    }).join('');

    const tablesHtml = `
      <table>
        <thead>
          <tr>
            <th>Date & Time</th>
            <th>Type</th>
            <th>Narration / Description</th>
            <th class="text-right">Credit (+)</th>
            <th class="text-right">Debit (-)</th>
            <th class="text-right">Available Balance</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows.length ? tableRows : '<tr><td colspan="6" style="text-align:center; padding: 20px;">No transactions recorded in ledger for this period.</td></tr>'}
        </tbody>
      </table>
    `;

    const html = buildReportHtml('Financial Ledger Statement', { ...user, period: displayPeriod }, summaryCards, tablesHtml);
    triggerHtmlDownload(html, `Ledger_Statement_${displayPeriod.replace(/\s+/g, '_')}`);
  } else {
    const summaryCards = [
      { label: 'Total Deposits & Credits', value: `+₹${totalCredits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#16a34a' },
      { label: 'Total Withdrawals & Debits', value: `-₹${totalDebits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#dc2626' },
      { label: 'Closing Available Balance', value: `₹${closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#2563eb' }
    ];

    const tableRows = ledgerWithBalance.map(l => {
      const amt = Number(l.amount) || 0;
      return `
        <tr>
          <td>${new Date(l.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
          <td><span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 9.5px;">${String(l.type || '').replace('_', ' ')}</span></td>
          <td>${l.description || l.type}</td>
          <td class="text-right text-green">${amt > 0 ? `₹${amt.toFixed(2)}` : '-'}</td>
          <td class="text-right text-red">${amt < 0 ? `₹${Math.abs(amt).toFixed(2)}` : '-'}</td>
          <td class="text-right" style="font-weight: 700; color: #1e3a8a;">₹${Number(l.running_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      `;
    }).join('');

    const tablesHtml = `
      <table>
        <thead>
          <tr>
            <th>Date & Time</th>
            <th>Type</th>
            <th>Narration / Description</th>
            <th class="text-right">Credit (+)</th>
            <th class="text-right">Debit (-)</th>
            <th class="text-right">Available Balance</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows.length ? tableRows : '<tr><td colspan="6" style="text-align:center; padding: 20px;">No transactions recorded in ledger for this period.</td></tr>'}
        </tbody>
      </table>
    `;

    triggerPdfPrint('Financial Ledger Statement', { ...user, period: displayPeriod }, summaryCards, tablesHtml);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. OFFICIAL DAILY CONTRACT NOTE GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
export function generateContractNoteReport(orders = [], user = {}, tradeDate = new Date().toISOString().slice(0, 10), format = 'pdf') {
  const executed = (orders || []).filter(o => {
    const isDone = o.status === 'COMPLETED' || o.status === 'COMPLETE' || o.status === 'EXECUTED';
    if (!isDone) return false;
    const oDate = getISTDateString(o.created_at);
    return oDate === tradeDate;
  });

  const cnNumber = `CN-${tradeDate.replace(/-/g, '')}-${(user.client_id || user.id || 'SE000001')}`;
  
  let totalBuyVal = 0;
  let totalSellVal = 0;
  let totalBrokerage = 0;
  let totalSTT = 0;
  let totalExchange = 0;
  let totalGST = 0;
  let totalSEBI = 0;
  let totalStamp = 0;

  const tradeItems = executed.map((o, idx) => {
    const ch = calculateIndianCharges(o);
    const isBuy = (o.side === 'BUY' || o.type === 'BUY');
    if (isBuy) totalBuyVal += ch.tradeValue;
    else totalSellVal += ch.tradeValue;

    totalBrokerage += ch.brokerage;
    totalSTT += ch.stt;
    totalExchange += ch.exchangeFee;
    totalGST += ch.gst;
    totalSEBI += ch.sebiFee;
    totalStamp += ch.stampDuty;

    return {
      orderNo: o.id || `ORD${1000 + idx}`,
      tradeTime: new Date(o.created_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
      symbol: o.symbol,
      side: o.side || o.type || 'BUY',
      qty: Number(o.quantity) || 0,
      price: Number(o.average_price || o.price || 0),
      tradeValue: ch.tradeValue,
      brokerage: ch.brokerage,
      netRate: isBuy ? (Number(o.average_price || o.price || 0) + ch.brokerage / (Number(o.quantity) || 1)) : (Number(o.average_price || o.price || 0) - ch.brokerage / (Number(o.quantity) || 1)),
      netTotal: isBuy ? (ch.tradeValue + ch.totalCharges) : (ch.tradeValue - ch.totalCharges)
    };
  });

  const totalTaxes = totalBrokerage + totalSTT + totalExchange + totalGST + totalSEBI + totalStamp;
  const netSettlement = totalSellVal - totalBuyVal - totalTaxes;

  if (format === 'excel') {
    const rows = [];
    rows.push([esc('SHORT EDGE - ELECTRONIC CONTRACT NOTE (ECN)')]);
    rows.push([esc(`Contract Note No: ${cnNumber}`), esc(`Trade Date: ${tradeDate}`), esc(`Client ID: ${user.client_id || user.id || 'SE000001'}`)]);
    rows.push([esc(`Client Name: ${user.username || 'Valued Trader'}`), esc(`Net Settlement: ₹${netSettlement.toFixed(2)} (${netSettlement >= 0 ? 'Receivable' : 'Payable'})`)]);
    rows.push('');
    rows.push([esc('Order No'), esc('Trade Time'), esc('Symbol'), esc('Buy/Sell'), esc('Quantity'), esc('Gross Price (₹)'), esc('Trade Value (₹)'), esc('Brokerage (₹)'), esc('Net Rate (₹)'), esc('Net Amount (₹)')]);

    tradeItems.forEach(t => {
      rows.push([
        esc(t.orderNo), esc(t.tradeTime), esc(t.symbol), esc(t.side), esc(t.qty),
        esc(t.price.toFixed(2)), esc(t.tradeValue.toFixed(2)), esc(t.brokerage.toFixed(2)), esc(t.netRate.toFixed(2)), esc(t.netTotal.toFixed(2))
      ]);
    });

    if (tradeItems.length === 0) {
      rows.push([esc(`No trades executed on ${tradeDate}.`), '', '', '', '', '', '', '', '', '']);
    }

    triggerCsvDownload(rows, `Contract_Note_${tradeDate}`);
  } else if (format === 'html') {
    const summaryCards = [
      { label: 'Contract Note Number', value: cnNumber },
      { label: 'Total Trade Turnover', value: `₹${(totalBuyVal + totalSellVal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
      { label: 'Total Taxes & Levies', value: `₹${totalTaxes.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#dc2626' },
      { label: 'Net Settlement (Pay-in/Pay-out)', value: `${netSettlement >= 0 ? '+' : ''}₹${netSettlement.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: netSettlement >= 0 ? '#16a34a' : '#dc2626' }
    ];

    const tableRows = tradeItems.map(t => `
      <tr>
        <td>${t.orderNo}</td>
        <td>${t.tradeTime}</td>
        <td><strong>${t.symbol}</strong></td>
        <td><strong style="color: ${t.side === 'BUY' ? '#2563eb' : '#dc2626'};">${t.side}</strong></td>
        <td class="text-right">${t.qty}</td>
        <td class="text-right">₹${t.price.toFixed(2)}</td>
        <td class="text-right">₹${t.tradeValue.toFixed(2)}</td>
        <td class="text-right">₹${t.brokerage.toFixed(2)}</td>
        <td class="text-right"><strong>₹${t.netTotal.toFixed(2)}</strong></td>
      </tr>
    `).join('');

    const chargesBreakdownTable = `
      <div style="margin-top: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px;">
        <div style="font-weight: 700; margin-bottom: 8px; font-size: 11px; color: #1e293b;">Regulatory Tax & Charges Schedule</div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 10.5px;">
          <div>Brokerage: <strong>₹${totalBrokerage.toFixed(2)}</strong></div>
          <div>STT / CTT: <strong>₹${totalSTT.toFixed(2)}</strong></div>
          <div>Exchange Txn Fee: <strong>₹${totalExchange.toFixed(2)}</strong></div>
          <div>GST (18%): <strong>₹${totalGST.toFixed(2)}</strong></div>
          <div>SEBI Turnover Fee: <strong>₹${totalSEBI.toFixed(2)}</strong></div>
          <div>Stamp Duty: <strong>₹${totalStamp.toFixed(2)}</strong></div>
          <div>Total Levies: <strong style="color: #dc2626;">₹${totalTaxes.toFixed(2)}</strong></div>
        </div>
      </div>
    `;

    const tablesHtml = `
      <table>
        <thead>
          <tr>
            <th>Order No</th>
            <th>Trade Time</th>
            <th>Symbol / Contract</th>
            <th>Side</th>
            <th class="text-right">Quantity</th>
            <th class="text-right">Gross Price</th>
            <th class="text-right">Trade Value</th>
            <th class="text-right">Brokerage</th>
            <th class="text-right">Net Amount</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows.length ? tableRows : '<tr><td colspan="9" style="text-align:center; padding: 20px;">No trades executed on ' + tradeDate + '.</td></tr>'}
        </tbody>
      </table>
      ${chargesBreakdownTable}
    `;

    const html = buildReportHtml(`Contract Note - ${tradeDate}`, { ...user, period: `Trade Date: ${tradeDate}` }, summaryCards, tablesHtml);
    triggerHtmlDownload(html, `Contract_Note_${tradeDate}`);
  } else {
    const summaryCards = [
      { label: 'Contract Note Number', value: cnNumber },
      { label: 'Total Trade Turnover', value: `₹${(totalBuyVal + totalSellVal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
      { label: 'Total Taxes & Levies', value: `₹${totalTaxes.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#dc2626' },
      { label: 'Net Settlement (Pay-in/Pay-out)', value: `${netSettlement >= 0 ? '+' : ''}₹${netSettlement.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: netSettlement >= 0 ? '#16a34a' : '#dc2626' }
    ];

    const tableRows = tradeItems.map(t => `
      <tr>
        <td>${t.orderNo}</td>
        <td>${t.tradeTime}</td>
        <td><strong>${t.symbol}</strong></td>
        <td><strong style="color: ${t.side === 'BUY' ? '#2563eb' : '#dc2626'};">${t.side}</strong></td>
        <td class="text-right">${t.qty}</td>
        <td class="text-right">₹${t.price.toFixed(2)}</td>
        <td class="text-right">₹${t.tradeValue.toFixed(2)}</td>
        <td class="text-right">₹${t.brokerage.toFixed(2)}</td>
        <td class="text-right"><strong>₹${t.netTotal.toFixed(2)}</strong></td>
      </tr>
    `).join('');

    const chargesBreakdownTable = `
      <div style="margin-top: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px;">
        <div style="font-weight: 700; margin-bottom: 8px; font-size: 11px; color: #1e293b;">Regulatory Tax & Charges Schedule</div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 10.5px;">
          <div>Brokerage: <strong>₹${totalBrokerage.toFixed(2)}</strong></div>
          <div>STT / CTT: <strong>₹${totalSTT.toFixed(2)}</strong></div>
          <div>Exchange Txn Fee: <strong>₹${totalExchange.toFixed(2)}</strong></div>
          <div>GST (18%): <strong>₹${totalGST.toFixed(2)}</strong></div>
          <div>SEBI Turnover Fee: <strong>₹${totalSEBI.toFixed(2)}</strong></div>
          <div>Stamp Duty: <strong>₹${totalStamp.toFixed(2)}</strong></div>
          <div>Total Levies: <strong style="color: #dc2626;">₹${totalTaxes.toFixed(2)}</strong></div>
        </div>
      </div>
    `;

    const tablesHtml = `
      <table>
        <thead>
          <tr>
            <th>Order No</th>
            <th>Trade Time</th>
            <th>Symbol / Contract</th>
            <th>Side</th>
            <th class="text-right">Quantity</th>
            <th class="text-right">Gross Price</th>
            <th class="text-right">Trade Value</th>
            <th class="text-right">Brokerage</th>
            <th class="text-right">Net Amount</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows.length ? tableRows : '<tr><td colspan="9" style="text-align:center; padding: 20px;">No trades executed on ' + tradeDate + '.</td></tr>'}
        </tbody>
      </table>
      ${chargesBreakdownTable}
    `;

    triggerPdfPrint(`Contract Note - ${tradeDate}`, { ...user, period: `Trade Date: ${tradeDate}` }, summaryCards, tablesHtml);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. DP HOLDINGS & DEMAT VALUATION STATEMENT
// ─────────────────────────────────────────────────────────────────────────────
export function generateDPHoldingReport(holdings = [], prices = {}, user = {}, format = 'excel') {
  let totalInvested = 0;
  let totalCurrentVal = 0;

  const holdingRows = (holdings || []).map((h, idx) => {
    const qty = Number(h.quantity) || 0;
    const avgPrice = Number(h.average_price || 0);
    const invested = qty * avgPrice;
    
    const livePriceObj = prices[h.symbol];
    const cmp = (livePriceObj && typeof livePriceObj === 'object') ? Number(livePriceObj.ltp || avgPrice) : Number(livePriceObj || avgPrice);
    const currentVal = qty * cmp;
    const pnl = currentVal - invested;
    const pnlPct = invested > 0 ? ((pnl / invested) * 100).toFixed(2) : '0.00';

    totalInvested += invested;
    totalCurrentVal += currentVal;

    return {
      isin: h.isin || `INE${String(idx + 1).padStart(9, '0')}`,
      symbol: h.symbol,
      qty,
      avgPrice,
      cmp,
      invested,
      currentVal,
      pnl,
      pnlPct
    };
  });

  const totalUnrealizedPnl = totalCurrentVal - totalInvested;
  const totalReturnPct = totalInvested > 0 ? ((totalUnrealizedPnl / totalInvested) * 100).toFixed(2) : '0.00';
  const asOfDate = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });

  if (format === 'excel') {
    const rows = [];
    rows.push([esc('SHORT EDGE - DP HOLDINGS & DEMAT PORTFOLIO VALUATION')]);
    rows.push([esc(`Client ID: ${user.client_id || user.id || 'SE000001'}`), esc(`Client Name: ${user.username || 'Valued Trader'}`), esc(`Valuation Date: ${asOfDate}`)]);
    rows.push([esc(`Total Invested: ₹${totalInvested.toFixed(2)}`), esc(`Current Portfolio Value: ₹${totalCurrentVal.toFixed(2)}`), esc(`Unrealized P&L: ₹${totalUnrealizedPnl.toFixed(2)} (${totalReturnPct}%)`)]);
    rows.push('');
    rows.push([esc('ISIN'), esc('Scrip Symbol'), esc('Holding Qty'), esc('Buy Avg Price (₹)'), esc('CMP / LTP (₹)'), esc('Invested Value (₹)'), esc('Current Value (₹)'), esc('Unrealized P&L (₹)'), esc('P&L (%)')]);

    holdingRows.forEach(h => {
      rows.push([
        esc(h.isin),
        esc(h.symbol),
        esc(h.qty),
        esc(h.avgPrice.toFixed(2)),
        esc(h.cmp.toFixed(2)),
        esc(h.invested.toFixed(2)),
        esc(h.currentVal.toFixed(2)),
        esc(h.pnl.toFixed(2)),
        esc(`${h.pnlPct}%`)
      ]);
    });

    if (holdingRows.length === 0) {
      rows.push([esc('No Demat holdings available in portfolio.'), '', '', '', '', '', '', '', '']);
    }

    triggerCsvDownload(rows, `DP_Holdings_Valuation_${new Date().toISOString().slice(0, 10)}`);
  } else if (format === 'html') {
    const summaryCards = [
      { label: 'Total Invested Value', value: `₹${totalInvested.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
      { label: 'Current Portfolio Value', value: `₹${totalCurrentVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#2563eb' },
      { label: 'Total Unrealized P&L', value: `${totalUnrealizedPnl >= 0 ? '+' : ''}₹${totalUnrealizedPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${totalReturnPct}%)`, color: totalUnrealizedPnl >= 0 ? '#16a34a' : '#dc2626' }
    ];

    const tableRows = holdingRows.map(h => `
      <tr>
        <td><span style="font-family: monospace; font-size: 10px; color: #64748b;">${h.isin}</span></td>
        <td><strong>${h.symbol}</strong></td>
        <td class="text-right">${h.qty}</td>
        <td class="text-right">₹${h.avgPrice.toFixed(2)}</td>
        <td class="text-right">₹${h.cmp.toFixed(2)}</td>
        <td class="text-right">₹${h.invested.toFixed(2)}</td>
        <td class="text-right">₹${h.currentVal.toFixed(2)}</td>
        <td class="text-right ${h.pnl >= 0 ? 'text-green' : 'text-red'}">${h.pnl >= 0 ? '+' : ''}₹${h.pnl.toFixed(2)}</td>
        <td class="text-right ${h.pnl >= 0 ? 'text-green' : 'text-red'}">${h.pnl >= 0 ? '+' : ''}${h.pnlPct}%</td>
      </tr>
    `).join('');

    const tablesHtml = `
      <table>
        <thead>
          <tr>
            <th>ISIN</th>
            <th>Scrip Symbol</th>
            <th class="text-right">Qty</th>
            <th class="text-right">Buy Avg</th>
            <th class="text-right">LTP / CMP</th>
            <th class="text-right">Invested Value</th>
            <th class="text-right">Current Value</th>
            <th class="text-right">Unrealized P&L</th>
            <th class="text-right">Return %</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows.length ? tableRows : '<tr><td colspan="9" style="text-align:center; padding: 20px;">No Demat holdings found in portfolio.</td></tr>'}
        </tbody>
      </table>
    `;

    const html = buildReportHtml('DP Holdings & Demat Valuation Statement', { ...user, period: `As on ${asOfDate}` }, summaryCards, tablesHtml);
    triggerHtmlDownload(html, `DP_Holdings_Valuation_${new Date().toISOString().slice(0, 10)}`);
  } else {
    const summaryCards = [
      { label: 'Total Invested Value', value: `₹${totalInvested.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
      { label: 'Current Portfolio Value', value: `₹${totalCurrentVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#2563eb' },
      { label: 'Total Unrealized P&L', value: `${totalUnrealizedPnl >= 0 ? '+' : ''}₹${totalUnrealizedPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${totalReturnPct}%)`, color: totalUnrealizedPnl >= 0 ? '#16a34a' : '#dc2626' }
    ];

    const tableRows = holdingRows.map(h => `
      <tr>
        <td><span style="font-family: monospace; font-size: 10px; color: #64748b;">${h.isin}</span></td>
        <td><strong>${h.symbol}</strong></td>
        <td class="text-right">${h.qty}</td>
        <td class="text-right">₹${h.avgPrice.toFixed(2)}</td>
        <td class="text-right">₹${h.cmp.toFixed(2)}</td>
        <td class="text-right">₹${h.invested.toFixed(2)}</td>
        <td class="text-right">₹${h.currentVal.toFixed(2)}</td>
        <td class="text-right ${h.pnl >= 0 ? 'text-green' : 'text-red'}">${h.pnl >= 0 ? '+' : ''}₹${h.pnl.toFixed(2)}</td>
        <td class="text-right ${h.pnl >= 0 ? 'text-green' : 'text-red'}">${h.pnl >= 0 ? '+' : ''}${h.pnlPct}%</td>
      </tr>
    `).join('');

    const tablesHtml = `
      <table>
        <thead>
          <tr>
            <th>ISIN</th>
            <th>Scrip Symbol</th>
            <th class="text-right">Qty</th>
            <th class="text-right">Buy Avg</th>
            <th class="text-right">LTP / CMP</th>
            <th class="text-right">Invested Value</th>
            <th class="text-right">Current Value</th>
            <th class="text-right">Unrealized P&L</th>
            <th class="text-right">Return %</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows.length ? tableRows : '<tr><td colspan="9" style="text-align:center; padding: 20px;">No Demat holdings found in portfolio.</td></tr>'}
        </tbody>
      </table>
    `;

    triggerPdfPrint('DP Holdings & Demat Valuation Statement', { ...user, period: `As on ${asOfDate}` }, summaryCards, tablesHtml);
  }
}
