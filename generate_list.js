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
                  if (
                      n.includes('growth') &&
                      n.includes('direct') &&
                      !n.includes('regular') &&
                      !n.includes('etf') &&
                      !n.includes('fmp') &&
                      !n.includes('fixed maturity')
                  ) {
                      funds.push(schemeName);
                  }
              }
          }
      }
      
      const fs = require('fs');
      fs.writeFileSync('C:/Users/h4har/.gemini/antigravity/brain/9eccbd45-b347-4e31-8811-5070c67dbd03/scratch/mf_list.txt', funds.join('\n'));
      console.log('Saved ' + funds.length + ' funds to scratch folder.');
      
      // Let's also count how many are HDFC to prove the point
      const hdfcCount = funds.filter(f => f.toLowerCase().includes('hdfc')).length;
      console.log('HDFC Funds count:', hdfcCount);
  });
