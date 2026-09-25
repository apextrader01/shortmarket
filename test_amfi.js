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
                  if (parts[4] && parts[5]) {
                      schemeName += ' - ' + parts[4].trim() + ' - ' + parts[5].trim();
                  }
                  
                  // Filter for growth
                  if (schemeName.toLowerCase().includes('growth')) {
                      funds.push({
                          schemeCode: parseInt(parts[0].trim()),
                          schemeName: schemeName
                      });
                  }
              }
          }
      }
      console.log('Total funds parsed:', funds.length);
      console.log(funds.slice(0, 5));
  })
  .catch(console.error);
