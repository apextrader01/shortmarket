const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.jsx', 'utf8');

const regex = /\/\/ Global Hotkey Engine \(Shift\+B, Shift\+S\)[\s\S]*?\}, \[selectedSymbol, stocks, oneClickMultiplier, placeOrder\]\);/m;

const newHotkey = `// Global Hotkey Engine (Shift+B, Shift+S)
  useEffect(() => {
    const handleKeyDown = async (e) => {
      // Don't trigger if user is typing in an input or textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.shiftKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        if (!selectedSymbol) return;
        const stockInfo = stocks.find(s => s.uniqueSymbol === selectedSymbol) || {};
        const lotsize = stockInfo.lotsize || 1;
        
        setHotkeyToast('? Placing BUY order...');
        const res = await placeOrder({
          symbol: selectedSymbol,
          type: 'MARKET',
          side: 'BUY',
          quantity: lotsize * (oneClickMultiplier || 1),
          price: 0,
          product_type: 'INT'
        });
        
        if (res && res.success) {
          setHotkeyToast('? BUY MARKET PLACED: ' + selectedSymbol);
        } else {
          const { useStore } = require('./store');
          const errorMsg = useStore.getState().authError || 'Order Failed';
          setHotkeyToast('? ' + errorMsg);
        }
        setTimeout(() => setHotkeyToast(null), 3500);
      }
      
      if (e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (!selectedSymbol) return;
        const stockInfo = stocks.find(s => s.uniqueSymbol === selectedSymbol) || {};
        const lotsize = stockInfo.lotsize || 1;
        
        setHotkeyToast('? Placing SELL order...');
        const res = await placeOrder({
          symbol: selectedSymbol,
          type: 'MARKET',
          side: 'SELL',
          quantity: lotsize * (oneClickMultiplier || 1),
          price: 0,
          product_type: 'INT'
        });
        
        if (res && res.success) {
          setHotkeyToast('? SELL MARKET PLACED: ' + selectedSymbol);
        } else {
          const { useStore } = require('./store');
          const errorMsg = useStore.getState().authError || 'Order Failed';
          setHotkeyToast('? ' + errorMsg);
        }
        setTimeout(() => setHotkeyToast(null), 3500);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSymbol, stocks, oneClickMultiplier, placeOrder]);`;

if(regex.test(code)) {
    code = code.replace(regex, newHotkey);
    fs.writeFileSync('frontend/src/App.jsx', code);
    console.log("Replaced successfully!");
} else {
    console.log("String not found via regex!");
}
