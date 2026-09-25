const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.jsx', 'utf8');

const oldHotkey = `  // Global Hotkey Engine (Shift+B, Shift+S)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input or textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.shiftKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        if (!selectedSymbol) return;
        const stockInfo = stocks.find(s => s.uniqueSymbol === selectedSymbol) || {};
        const lotsize = stockInfo.lotsize || 1;
        
        placeOrder({
          symbol: selectedSymbol,
          type: 'MARKET',
          side: 'BUY',
          quantity: lotsize * (oneClickMultiplier || 1),
          price: 0,
          product_type: 'INT'
        });
        
        setHotkeyToast('?? BUY MARKET: ' + selectedSymbol);
        setTimeout(() => setHotkeyToast(null), 1500);
      }
      
      if (e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (!selectedSymbol) return;
        const stockInfo = stocks.find(s => s.uniqueSymbol === selectedSymbol) || {};
        const lotsize = stockInfo.lotsize || 1;
        
        placeOrder({
          symbol: selectedSymbol,
          type: 'MARKET',
          side: 'SELL',
          quantity: lotsize * (oneClickMultiplier || 1),
          price: 0,
          product_type: 'INT'
        });
        
        setHotkeyToast('?? SELL MARKET: ' + selectedSymbol);
        setTimeout(() => setHotkeyToast(null), 1500);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSymbol, stocks, oneClickMultiplier, placeOrder]);`;

const newHotkey = `  // Global Hotkey Engine (Shift+B, Shift+S)
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
          setHotkeyToast('? ' + (useStore.getState().authError || 'Order Failed'));
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
          setHotkeyToast('? ' + (useStore.getState().authError || 'Order Failed'));
        }
        setTimeout(() => setHotkeyToast(null), 3500);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSymbol, stocks, oneClickMultiplier, placeOrder]);`;

// Just replace ignoring standard line endings by removing them in both strings for the match
const normalize = (str) => str.replace(/\r\n/g, '\n');
code = normalize(code);
const searchFor = normalize(oldHotkey);

if(code.includes(searchFor)) {
    code = code.replace(searchFor, newHotkey);
    fs.writeFileSync('frontend/src/App.jsx', code);
    console.log("Replaced successfully!");
} else {
    console.log("String not found!");
}
