// frontend/src/utils/adminExport.js
// Client-side zero-cost Excel & PDF export utilities

/**
 * Escapes a cell value for standard CSV/Excel format.
 */
function escapeCSVValue(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Exports data to an Excel-compatible CSV with UTF-8 BOM.
 */
export function exportToExcel(data, columns, filename = 'export', title = 'Report') {
  if (!data || !data.length) {
    alert('No data available to export.');
    return;
  }

  const generatedDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const rows = [];

  // Metadata headers
  rows.push([escapeCSVValue('SHORT MARKET - ADMIN REPORT')].join(','));
  rows.push([escapeCSVValue(`Title: ${title}`)].join(','));
  rows.push([escapeCSVValue(`Generated At: ${generatedDate} IST`)].join(','));
  rows.push([escapeCSVValue(`Total Records: ${data.length}`)].join(','));
  rows.push(''); // Blank line

  // Column Headers
  const headers = columns.map(col => escapeCSVValue(col.header));
  rows.push(headers.join(','));

  // Data Rows
  data.forEach((item, idx) => {
    const row = columns.map(col => {
      let val = '';
      if (col.format) {
        val = col.format(item[col.key], item, idx);
      } else if (col.key) {
        val = item[col.key];
      }
      return escapeCSVValue(val);
    });
    rows.push(row.join(','));
  });

  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports data to a clean, professionally styled printable PDF document.
 */
export function exportToPDF(data, columns, filename = 'report', title = 'Admin Report', subtitle = '') {
  if (!data || !data.length) {
    alert('No data available to export.');
    return;
  }

  const generatedDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  // Build Table HTML
  const headerHtml = columns
    .map(c => `<th style="text-align: ${c.align || 'left'};">${c.header}</th>`)
    .join('');

  const rowsHtml = data
    .map((item, idx) => {
      const cells = columns
        .map(c => {
          let val = '';
          if (c.format) {
            val = c.format(item[c.key], item, idx);
          } else if (c.key) {
            val = item[c.key] !== null && item[c.key] !== undefined ? item[c.key] : '';
          }
          return `<td style="text-align: ${c.align || 'left'};">${val}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title} - ${filename}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 16px;
      color: #1e293b;
      background: #ffffff;
      font-size: 11px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .brand-title {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #0f172a;
      text-transform: uppercase;
    }
    .report-title {
      font-size: 14px;
      font-weight: 600;
      color: #3b82f6;
      margin-top: 3px;
    }
    .subtitle {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }
    .meta {
      text-align: right;
      font-size: 10px;
      color: #64748b;
      line-height: 1.4;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-weight: 600;
      color: #334155;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 10px;
    }
    th {
      background-color: #0f172a;
      color: #ffffff;
      font-weight: 600;
      padding: 6px 8px;
      border: 1px solid #0f172a;
      white-space: nowrap;
    }
    td {
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
      word-break: break-word;
    }
    tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .footer {
      margin-top: 16px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #94a3b8;
    }
    .no-print-bar {
      margin-bottom: 14px;
      padding: 8px 12px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .print-btn {
      background: #2563eb;
      color: white;
      border: none;
      padding: 5px 12px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 11px;
      cursor: pointer;
    }
    @media print {
      .no-print-bar {
        display: none !important;
      }
      body {
        padding: 0;
      }
      th {
        background-color: #0f172a !important;
        color: #ffffff !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      tr:nth-child(even) {
        background-color: #f8fafc !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div>
      <strong>Print Preview / Save as PDF:</strong> Choose <em>Save as PDF</em> in print destination.
    </div>
    <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
  </div>

  <div class="header">
    <div>
      <div class="brand-title">SHORT MARKET</div>
      <div class="report-title">${title}</div>
      ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
    </div>
    <div class="meta">
      <div>Generated: <strong>${generatedDate} IST</strong></div>
      <div style="margin-top: 3px;"><span class="badge">Total Records: ${data.length}</span></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>${headerHtml}</tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="footer">
    <div>Short Market Trading Platform &copy; ${new Date().getFullYear()} - Confidential Admin Report</div>
  </div>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 350);
    });
  </script>
</body>
</html>
`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  } else {
    alert('Pop-up was blocked. Please allow pop-ups for this site to export PDF.');
  }
}

