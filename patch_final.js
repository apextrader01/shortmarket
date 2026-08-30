const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/MutualFundsView.jsx', 'utf8');

const oldSort = `  const sortedFunds = [...filteredFunds].sort((a, b) => {
      if (!sortConfig.key) return 0;
      
      const valA = a[sortConfig.key] || -9999;
      const valB = b[sortConfig.key] || -9999;
      
      if (valA < valB) {
          return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (valA > valB) {
          return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
  });`;

const newSort = `  const sortedFunds = [...filteredFunds].sort((a, b) => {
      if (!sortConfig.key) return 0;
      
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      
      if (sortConfig.key === 'category' || sortConfig.key === 'risk') {
          valA = String(valA || '').toLowerCase();
          valB = String(valB || '').toLowerCase();
          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      } else {
          valA = valA !== undefined && valA !== null ? valA : -999999;
          valB = valB !== undefined && valB !== null ? valB : -999999;
          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      }
  });`;

code = code.replace(oldSort, newSort);

const oldHeaders = `                                <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)' }}>Category</th>
                                <th style={{ padding: '16px', textAlign: 'center', fontWeight: '600', color: 'var(--text-secondary)' }}>Risk</th>
                                <th style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: 'var(--text-secondary)' }}>NAV</th>`;

const newHeaders = `                                <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('category')}>
                                    Category {sortConfig.key === 'category' ? (sortConfig.direction === 'desc' ? '\u2193' : '\u2191') : '\u2195'}
                                </th>
                                <th style={{ padding: '16px', textAlign: 'center', fontWeight: '600', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('risk')}>
                                    Risk {sortConfig.key === 'risk' ? (sortConfig.direction === 'desc' ? '\u2193' : '\u2191') : '\u2195'}
                                </th>
                                <th style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('nav')}>
                                    NAV {sortConfig.key === 'nav' ? (sortConfig.direction === 'desc' ? '\u2193' : '\u2191') : '\u2195'}
                                </th>`;

code = code.replace(oldHeaders, newHeaders);

fs.writeFileSync('frontend/src/components/MutualFundsView.jsx', code);
console.log('Fixed MutualFundsView.jsx properly');
