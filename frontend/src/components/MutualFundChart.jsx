import React, { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import { useStore } from '../store';
import { Loader2 } from 'lucide-react';

export default function MutualFundChart({ schemeCode, color = '#22c55e' }) {
    const chartContainerRef = useRef();
    const { fetchFundHistory, fundHistoryCache } = useStore();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let chart;
        let lineSeries;

        const initChart = async () => {
            setLoading(true);
            try {
                const data = await fetchFundHistory(schemeCode);
                if (!data || data.length === 0) {
                    setError('No historical data available');
                    setLoading(false);
                    return;
                }

                // Create chart
                chart = createChart(chartContainerRef.current, {
                    layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#9ca3af' },
                    grid: { vertLines: { color: 'rgba(255,255,255,0.05)' }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
                    timeScale: { 
                        borderColor: 'rgba(255,255,255,0.1)', 
                        timeVisible: true,
                        rightOffset: 12
                    },
                    rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
                    crosshair: {
                        mode: 1,
                        vertLine: { color: 'rgba(255,255,255,0.4)', width: 1, style: 1 },
                        horzLine: { color: 'rgba(255,255,255,0.4)', width: 1, style: 1 }
                    }
                });

                lineSeries = chart.addAreaSeries({
                    lineColor: color,
                    topColor: `${color}40`, // 25% opacity
                    bottomColor: `${color}00`,
                    lineWidth: 2,
                    priceFormat: { type: 'price', precision: 2, minMove: 0.01 }
                });

                // Filter to last 5 years
                const fiveYearsAgo = new Date();
                fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
                const fiveYearsAgoStr = fiveYearsAgo.toISOString().split('T')[0];
                
                const filteredData = data.filter(d => d.time >= fiveYearsAgoStr);
                
                lineSeries.setData(filteredData);
                chart.timeScale().fitContent();

                setLoading(false);
            } catch (err) {
                setError(err.message);
                setLoading(false);
            }
        };

        initChart();

        const handleResize = () => {
            if (chart && chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (chart) chart.remove();
        };
    }, [schemeCode, fetchFundHistory, color]);

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* Always render the container so the ref exists immediately */}
            <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
            
            {loading && (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', background: 'var(--bg-panel)' }}>
                    <Loader2 size={24} className="spin" style={{ marginRight: '8px' }} /> Loading NAV History...
                </div>
            )}

            {error && !loading && (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-red)', background: 'var(--bg-panel)' }}>
                    {error}
                </div>
            )}
        </div>
    );
}
