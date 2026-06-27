import React, { useState, useEffect } from 'react';
import useStore from '../store';
import { API } from '../store';

const OptionChainView = () => {
  const [symbol, setSymbol] = useState('NIFTY');
  const [expiry, setExpiry] = useState('');
  const [expiries, setExpiries] = useState([]);
  const [optionsData, setOptionsData] = useState({});
  const [loading, setLoading] = useState(false);

  const prices = useStore((state) => state.prices);
  const openOrderModal = useStore((state) => state.openOrderModal);
  const subscribeToOption = useStore((state) => state.subscribeToOption);
  const unsubscribeFromOption = useStore((state) => state.unsubscribeFromOption);

  useEffect(() => {
    const fetchChain = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/api/options/chain/${symbol}`);
        if (!res.ok) throw new Error('Failed to fetch option chain');
        const data = await res.json();
        
        setOptionsData(data);
        const expList = Object.keys(data).sort((a, b) => new Date(a) - new Date(b));
        setExpiries(expList);
        if (expList.length > 0) {
          setExpiry(expList[0]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchChain();
  }, [symbol]);

  useEffect(() => {
    if (!expiry || !optionsData[expiry]) return;

    const strikes = Object.keys(optionsData[expiry]);
    const tokensToSub = [];

    strikes.forEach((strike) => {
      const data = optionsData[expiry][strike];
      if (data.CE) tokensToSub.push({ ...data.CE, name: symbol });
      if (data.PE) tokensToSub.push({ ...data.PE, name: symbol });
    });

    tokensToSub.forEach(opt => subscribeToOption(opt));

    return () => {
      tokensToSub.forEach(opt => unsubscribeFromOption(opt));
    };
  }, [expiry, optionsData, symbol, subscribeToOption, unsubscribeFromOption]);

  const handleTrade = (opt, type) => {
    if (!opt) return;
    const orderSymbol = opt.symbol; // The unique symbol is just the contract symbol since we inject it dynamically
    // The OrderModal uses selectedSymbol from store, but we can just pass the string to openOrderModal
    openOrderModal(orderSymbol, type);
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Loading Option Chain...</div>;
  }

  const chain = optionsData[expiry] || {};
  const strikes = Object.keys(chain).map(Number).sort((a, b) => a - b);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-gray-200">
      {/* Header Controls */}
      <div className="p-4 border-b border-[#222] flex gap-4 items-center bg-[#111]">
        <select 
          className="bg-[#222] border border-[#333] rounded px-4 py-2 text-white outline-none"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
        >
          <option value="NIFTY">NIFTY 50</option>
          <option value="BANKNIFTY">BANKNIFTY</option>
          <option value="SENSEX">SENSEX</option>
        </select>
        
        <select 
          className="bg-[#222] border border-[#333] rounded px-4 py-2 text-white outline-none"
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
        >
          {expiries.map(exp => (
            <option key={exp} value={exp}>{exp}</option>
          ))}
        </select>
      </div>

      {/* Option Chain Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm text-left">
          <thead className="sticky top-0 bg-[#161616] text-[#888] uppercase font-semibold text-xs border-b border-[#333] shadow-md z-10">
            <tr>
              <th className="px-4 py-3 text-center border-r border-[#333] bg-[#1a2016] text-green-500" colSpan="3">CALLS</th>
              <th className="px-4 py-3 text-center border-r border-[#333] w-32">STRIKE</th>
              <th className="px-4 py-3 text-center bg-[#201616] text-red-500" colSpan="3">PUTS</th>
            </tr>
            <tr className="border-t border-[#333]">
              <th className="px-2 py-2 w-16 text-center border-r border-[#333] bg-[#1a2016]">Vol</th>
              <th className="px-2 py-2 w-24 text-right border-r border-[#333] bg-[#1a2016]">LTP</th>
              <th className="px-2 py-2 w-20 text-center border-r border-[#333] bg-[#1a2016]">Trade</th>
              <th className="px-2 py-2 text-center border-r border-[#333] bg-[#111] font-bold text-white">Strike</th>
              <th className="px-2 py-2 w-20 text-center border-r border-[#333] bg-[#201616]">Trade</th>
              <th className="px-2 py-2 w-24 text-right border-r border-[#333] bg-[#201616]">LTP</th>
              <th className="px-2 py-2 w-16 text-center bg-[#201616]">Vol</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222]">
            {strikes.map((strike, i) => {
              const call = chain[strike].CE;
              const put = chain[strike].PE;

              const callPrice = call ? prices[call.symbol] : null;
              const putPrice = put ? prices[put.symbol] : null;

              return (
                <tr key={strike} className="hover:bg-[#1a1a1a] transition-colors group">
                  {/* Calls */}
                  <td className="px-2 py-2 text-center border-r border-[#333] text-gray-500">{callPrice?.volume || '-'}</td>
                  <td className={`px-2 py-2 text-right border-r border-[#333] font-mono ${callPrice?.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {callPrice?.ltp ? callPrice.ltp.toFixed(2) : '-'}
                  </td>
                  <td className="px-2 py-1 text-center border-r border-[#333]">
                    <div className="opacity-0 group-hover:opacity-100 flex justify-center gap-1">
                      <button onClick={() => handleTrade(call, 'BUY')} className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] px-2 py-1 rounded">B</button>
                      <button onClick={() => handleTrade(call, 'SELL')} className="bg-red-600 hover:bg-red-500 text-white text-[10px] px-2 py-1 rounded">S</button>
                    </div>
                  </td>

                  {/* Strike */}
                  <td className="px-4 py-2 text-center font-bold text-gray-200 border-r border-[#333] bg-[#111]">{strike}</td>

                  {/* Puts */}
                  <td className="px-2 py-1 text-center border-r border-[#333]">
                    <div className="opacity-0 group-hover:opacity-100 flex justify-center gap-1">
                      <button onClick={() => handleTrade(put, 'BUY')} className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] px-2 py-1 rounded">B</button>
                      <button onClick={() => handleTrade(put, 'SELL')} className="bg-red-600 hover:bg-red-500 text-white text-[10px] px-2 py-1 rounded">S</button>
                    </div>
                  </td>
                  <td className={`px-2 py-2 text-right border-r border-[#333] font-mono ${putPrice?.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {putPrice?.ltp ? putPrice.ltp.toFixed(2) : '-'}
                  </td>
                  <td className="px-2 py-2 text-center text-gray-500">{putPrice?.volume || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OptionChainView;
