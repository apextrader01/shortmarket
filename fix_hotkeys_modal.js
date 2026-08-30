const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.jsx', 'utf8');

const regex = /\/\/ Global Hotkey Engine \(Shift\+B, Shift\+S\)[\s\S]*?\}, \[selectedSymbol, stocks, oneClickMultiplier, placeOrder\]\);/m;

const newHotkey = `// Global Hotkey Engine (Shift+B, Shift+S)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input or textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.shiftKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        if (!selectedSymbol) return;
        const stockInfo = stocks.find(s => s.uniqueSymbol === selectedSymbol) || {};
        const lotsize = stockInfo.lotsize || 1;
        
        const { useStore } = require('./store');
        useStore.getState().openOrderModal(selectedSymbol, 'BUY', lotsize);
      }
      
      if (e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (!selectedSymbol) return;
        const stockInfo = stocks.find(s => s.uniqueSymbol === selectedSymbol) || {};
        const lotsize = stockInfo.lotsize || 1;
        
        const { useStore } = require('./store');
        useStore.getState().openOrderModal(selectedSymbol, 'SELL', lotsize);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSymbol, stocks]);`;

if(regex.test(code)) {
    code = code.replace(regex, newHotkey);
    fs.writeFileSync('frontend/src/App.jsx', code);
    console.log("Replaced successfully!");
} else {
    console.log("String not found via regex!");
}
