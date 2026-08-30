const fs = require('fs');

// === FIX ChartWidget.jsx ===
let cw = fs.readFileSync('src/components/ChartWidget.jsx', 'utf8');

const cwOld = `  const { selectedSymbol, candleData, isLoadingCandles, candleError, chartInterval, setChartInterval, loadCandleData, openOrderModal } = useStore(useShallow(state => ({ selectedSymbol: state.selectedSymbol, candleData: state.candleData, isLoadingCandles: state.isLoadingCandles, candleError: state.candleError, chartInterval: state.chartInterval, setChartInterval: state.setChartInterval, loadCandleData: state.loadCandleData, openOrderModal: state.openOrderModal })));`;

const cwNew = `  // [HOTFIX] Only subscribe to STATE in useShallow — not actions (Error #185 fix)
  const { selectedSymbol, candleData, isLoadingCandles, candleError, chartInterval } = useStore(useShallow(state => ({
    selectedSymbol: state.selectedSymbol,
    candleData: state.candleData,
    isLoadingCandles: state.isLoadingCandles,
    candleError: state.candleError,
    chartInterval: state.chartInterval,
  })));
  // Actions are stable — pull separately so they never cause re-renders
  const setChartInterval = useStore(state => state.setChartInterval);
  const loadCandleData = useStore(state => state.loadCandleData);
  const openOrderModal = useStore(state => state.openOrderModal);`;

if (!cw.includes(cwOld)) {
  console.error('ChartWidget FIX TARGET NOT FOUND');
  process.exit(1);
}
cw = cw.replace(cwOld, cwNew);
fs.writeFileSync('src/components/ChartWidget.jsx', cw);
console.log('ChartWidget: FIXED');
