fetch('https://www.amfiindia.com/spages/NAVAll.txt')
  .then(r => r.text())
  .then(text => {
      const funds = [];
      const lines = text.split('\n');
      for (const line of lines) {
          if (line.includes(';')) {
              const parts = line.split(';');
              if (parts.length >= 4 && parts[0] && !isNaN(parts[0])) {
                  let schemeName = parts[3].trim();
                  if (parts.length >= 6 && parts[4] && parts[5]) {
                      schemeName += ' - ' + parts[4].trim() + ' - ' + parts[5].trim();
                  } else if (parts.length >= 5 && parts[4]) {
                      schemeName += ' - ' + parts[4].trim();
                  }
                  
                  const n = schemeName.toLowerCase();
                  // Current filter: only Growth
                  if (n.includes('growth')) {
                      funds.push(schemeName);
                  }
              }
          }
      }
      console.log('Original Growth Funds:', funds.length);
      
      const filtered = funds.filter(name => {
          const n = name.toLowerCase();
          // Keep only Direct, drop Regular
          if (n.includes('regular')) return false;
          // Keep only Direct explicitly (some might not have 'direct' in name but usually they do)
          if (!n.includes('direct')) return false;
          // Drop ETFs
          if (n.includes('etf')) return false;
          // Drop FMPs (Fixed Maturity Plans)
          if (n.includes('fmp') || n.includes('fixed maturity')) return false;
          // Drop IDCW / Dividend explicitly
          if (n.includes('idcw') || n.includes('dividend')) return false;
          
          return true;
      });
      
      console.log('Filtered (Direct Growth only, no ETFs/FMPs):', filtered.length);
      console.log(filtered.slice(0, 10));
  });
