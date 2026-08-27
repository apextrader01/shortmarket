import React from 'react';
import { useStore } from '../store';
import { X } from 'lucide-react';
import ChartWidget from './ChartWidget';

export default function ChartModal() {
  const chartModalSymbol = useStore(state => state.chartModalSymbol);
  const setChartModalSymbol = useStore(state => state.setChartModalSymbol);

  if (!chartModalSymbol) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(4px)',
      zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: '#1E293B', borderRadius: '12px', width: '90%', maxWidth: '1200px',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid #334155',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
          padding: '16px 20px', borderBottom: '1px solid #334155' 
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#F8FAFC' }}>
            Technical Chart
          </h2>
          <button 
            onClick={() => setChartModalSymbol(null)}
            style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
          >
            <X size={24} />
          </button>
        </div>
        
        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', minHeight: '550px' }}>
          <ChartWidgetWrapper symbol={chartModalSymbol} />
        </div>
      </div>
    </div>
  );
}

function ChartWidgetWrapper({ symbol }) {
  const setSelectedSymbol = useStore(state => state.setSelectedSymbol);
  const selectedSymbol = useStore(state => state.selectedSymbol);
  const [originalSymbol] = React.useState(selectedSymbol);

  React.useEffect(() => {
    setSelectedSymbol(symbol);
    return () => setSelectedSymbol(originalSymbol);
  }, [symbol, originalSymbol, setSelectedSymbol]);

  if (selectedSymbol !== symbol) {
    return <div style={{ color: 'var(--text-secondary)' }}>Loading Chart for {symbol}...</div>;
  }

  return <ChartWidget />;
}


