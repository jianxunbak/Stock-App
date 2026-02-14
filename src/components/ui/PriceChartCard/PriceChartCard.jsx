import React, { useState, useEffect } from 'react';
import BaseChart from '../BaseChart/BaseChart';
import { X, Percent, DollarSign, ChevronDown, Activity } from 'lucide-react';
import StyledCard from '../StyledCard/StyledCard';
import Button from '../Button/Button';
import DropdownButton from '../DropdownButton/DropdownButton';
import SearchBar from '../SearchBar';
import { fetchChartData } from '../../../services/api';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import Window from '../Window/Window';
import './PriceChartCard.css';

/**
* PriceChartCard Component
* Displays a stylish line chart for stock or portfolio price history.
* Supports adding comparison stocks.
*
* @param {Array} data - Initial data points { date: string, price: number } (for the main stock)
* @param {string} title - Title of the chart
* @param {string} currency - Currency symbol
* @param {string} className - Optional additional classes
*/
const PriceChartCard = ({
    ticker = 'AAPL', // Main ticker
    data = [],
    title = 'Price Performance',
    currencySymbol = '$',
    currentRate = 1,
    className = '',
    scrollAnimated = false,
    variant = 'default',
    view = 'expanded',
    change = '+0.00',
    isOpen, // Ignore passed isOpen to prevent leak to DOM
    isManual = false,
    manualChartData = null,
    manualSeries = null,
    chartHeight = 300,
    allowComparison = true,
    isPercentageData = false, // If true, data is already in % form
    allowSMA = true,
    comparisonTickers: propsComparisonTickers,
    onAddSeries,
    onRemoveSeries,
    ...props
}) => {
    const isPositive = typeof change === 'string' ? change.startsWith('+') : parseFloat(change) >= 0;

    // Summary View (Direct match to StockSummary sparkline)
    if (view === 'summary') {
        return (
            <div className="summary-chart price-chart-summary">
                <div className="summary-chart-content">
                    <h3 className="summary-chart-title">{title}</h3>
                    <div className="summary-chart-inner">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.map(d => ({ ...d, price: d.price * currentRate }))} style={{ outline: 'none' }}>
                                <defs>
                                    <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={isPositive ? 'var(--neu-success)' : 'var(--neu-error)'} stopOpacity={0.2} />
                                        <stop offset="95%" stopColor={isPositive ? 'var(--neu-success)' : 'var(--neu-error)'} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area
                                    type="monotone"
                                    dataKey="price"
                                    stroke={isPositive ? 'var(--neu-success)' : 'var(--neu-error)'}
                                    strokeWidth={2}
                                    fill="url(#sparklineGradient)"
                                    dot={false}
                                    isAnimationActive={false}
                                    connectNulls={true}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        );
    }

    // Colors for different series
    const SERIES_COLORS = [
        'var(--neu-success)', // Main stock (Green)
        'var(--neu-color-favorite)', // Comparison 1 (Yellow/Gold)
        '#60a5fa', // Comparison 2 (Blue)
        '#f87171', // Comparison 3 (Red)
        '#a78bfa', // Comparison 4 (Purple)
    ];

    // State
    const [chartData, setChartData] = useState(() => {
        if (isManual && manualChartData) return manualChartData;
        if (data && data.length > 0) {
            return data.map(d => ({ date: d.date, price_main: d.price * currentRate }));
        }
        return [];
    });
    const [series, setSeries] = useState(() => {
        if (isManual && manualSeries) return manualSeries;
        if (data && data.length > 0) {
            return [{
                id: 'main',
                name: ticker,
                dataKey: 'price_main',
                color: isPositive ? 'var(--neu-success)' : 'var(--neu-error)'
            }];
        }
        return [];
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [timeRange, setTimeRange] = useState('1Y');
    const [comparisonTickers, setComparisonTickers] = useState(() => {
        if (propsComparisonTickers) return propsComparisonTickers;
        if (manualSeries) {
            return manualSeries.filter(s => s.id !== 'main').map(s => s.id);
        }
        return [];
    });

    // Keep state in sync with prop if provided (for persistence/hydration)
    useEffect(() => {
        if (propsComparisonTickers) {
            setComparisonTickers(propsComparisonTickers);
        }
    }, [propsComparisonTickers]);
    const [loading, setLoading] = useState(false);
    const [visibleSMAs, setVisibleSMAs] = useState({
        50: false,
        100: false,
        150: false,
        200: false
    });

    // Error State
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [failedTicker, setFailedTicker] = useState('');

    // Determine X-Axis format
    const xAxisFormatter = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (['1D', '5D'].includes(timeRange)) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        if (['1M', '3M', '6M', 'YTD'].includes(timeRange)) {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
        return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
    };

    const compKeyPrefix = isPercentageData ? 'val_' : 'price_';

    // Initial load and timeframe switch
    useEffect(() => {
        // Skip background fetching if we are in summary view
        if (view === 'summary') return;

        // If manual and no comparisons, skip fetching
        if (isManual && comparisonTickers.length === 0) {
            setChartData(manualChartData || []);
            setSeries(manualSeries || []);
            return;
        }

        const loadData = async () => {
            if (!ticker && !isManual) return;

            setLoading(true);
            try {
                let baseData = [];
                if (isManual && manualChartData) {
                    baseData = manualChartData.map(d => ({ ...d }));
                } else if (ticker) {
                    const mainResponse = await fetchChartData(ticker, timeRange);
                    const mainHistory = mainResponse?.data || [];
                    baseData = mainHistory.map(point => ({
                        date: point.date,
                        price_main: point.close * currentRate,
                        SMA_50: point.SMA_50 * currentRate,
                        SMA_100: point.SMA_100 * currentRate,
                        SMA_150: point.SMA_150 * currentRate,
                        SMA_200: point.SMA_200 * currentRate
                    }));
                }

                // Fetch comparisons if any (ONLY for non-manual charts or manual charts missing that data)
                // For manual charts like Portfolio, we check if the key exists in baseData[0]
                const neededComparisons = isManual
                    ? comparisonTickers.filter(t => (baseData.length > 0 && baseData[0][`${compKeyPrefix}${t}`] === undefined))
                    : comparisonTickers;

                if (neededComparisons.length > 0) {
                    const compResponses = await Promise.all(
                        neededComparisons.map(t => fetchChartData(t, timeRange).catch(() => ({ data: [] })))
                    );
                    const compResults = compResponses.map(r => r?.data || []);

                    baseData = baseData.map(point => {
                        const newPoint = { ...point };
                        neededComparisons.forEach((t, idx) => {
                            const compPoint = compResults[idx].find(p => p.date === point.date);
                            if (compPoint) {
                                newPoint[`${compKeyPrefix}${t}`] = compPoint.close * currentRate;
                            }
                        });
                        return newPoint;
                    });
                }

                setChartData(baseData);
            } catch (err) {
                console.error("Error loading chart data:", err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [ticker, timeRange, comparisonTickers, view, isManual, manualChartData, manualSeries]);

    // Update series when visibility or basic series changes
    useEffect(() => {
        const baseSeries = [];

        if (isManual && manualSeries) {
            baseSeries.push(...manualSeries);
        } else {
            baseSeries.push({
                id: 'main',
                name: ticker,
                dataKey: 'price_main',
                color: isPositive ? 'var(--neu-success)' : 'var(--neu-error)'
            });
        }
        comparisonTickers.forEach((t, idx) => {
            // Only add if not already in manualSeries to avoid duplicates
            if (isManual && manualSeries && manualSeries.some(s => s.id === t)) {
                return;
            }

            baseSeries.push({
                id: t,
                name: t,
                dataKey: `${compKeyPrefix}${t}`,
                color: SERIES_COLORS[(idx + 1) % SERIES_COLORS.length],
                strokeDasharray: null
            });
        });

        // Add SMAs if visible
        const smaColors = {
            50: '#f59e0b', // Amber
            100: '#8b5cf6', // Violet
            150: '#ec4899', // Pink
            200: '#10b981'  // Emerald (distinct from main green)
        };

        Object.entries(visibleSMAs).forEach(([period, isVisible]) => {
            if (isVisible) {
                baseSeries.push({
                    id: `SMA_${period}`,
                    name: `SMA ${period}`,
                    dataKey: `SMA_${period}`,
                    color: smaColors[period],
                    strokeDasharray: null
                });
            }
        });

        setSeries(baseSeries);
    }, [ticker, comparisonTickers, visibleSMAs, isPositive, isManual, manualSeries]);



    // --- Actions ---

    const [mode, setMode] = useState(isPercentageData ? 'percent' : 'price'); // 'price' or 'percent'

    // Calculate SMAs locally if they are missing from chartData
    const chartDataWithSMAs = React.useMemo(() => {
        if (!chartData || chartData.length === 0) return [];

        // Check if any visible SMA is missing from the data
        // We calculate if the key is missing OR if the first point is null (backend couldn't calculate it)
        const missingSMAs = Object.entries(visibleSMAs)
            .filter(([period, isVisible]) => isVisible && (chartData[0][`SMA_${period}`] === undefined || chartData[0][`SMA_${period}`] === null));

        if (missingSMAs.length === 0) return chartData;

        // Find the data key to use for calculation (usually price_main or close)
        const sample = chartData[0];
        const calcKey = series[0]?.dataKey || (sample.price_main !== undefined ? 'price_main' : 'close');

        return chartData.map((d, i) => {
            const newPoint = { ...d };
            missingSMAs.forEach(([period]) => {
                const p = parseInt(period);
                if (i >= p - 1) {
                    const slice = chartData.slice(i - p + 1, i + 1);
                    const sum = slice.reduce((acc, curr) => {
                        const val = curr[calcKey] !== undefined ? curr[calcKey] : (curr.price || 0);
                        return acc + val;
                    }, 0);
                    newPoint[`SMA_${period}`] = sum / p;
                } else {
                    newPoint[`SMA_${period}`] = null; // Too few points
                }
            });
            return newPoint;
        });
    }, [chartData, visibleSMAs]);

    // Compute derived data for display (Price vs Percentage)
    const displayData = React.useMemo(() => {
        if (!chartDataWithSMAs || chartDataWithSMAs.length === 0) return [];

        const firstPoint = chartDataWithSMAs[0];

        // Filter data based on Time Range if in Manual mode
        let filteredData = chartDataWithSMAs;
        if (isManual) {
            const now = new Date();
            let startDate = new Date();

            if (timeRange === '1D') startDate.setDate(now.getDate() - 1);
            else if (timeRange === '5D') startDate.setDate(now.getDate() - 5);
            else if (timeRange === '1M') startDate.setMonth(now.getMonth() - 1);
            else if (timeRange === '3M') startDate.setMonth(now.getMonth() - 3);
            else if (timeRange === '6M') startDate.setMonth(now.getMonth() - 6);
            else if (timeRange === 'YTD') startDate = new Date(now.getFullYear(), 0, 1);
            else if (timeRange === '1Y') startDate.setFullYear(now.getFullYear() - 1);
            else if (timeRange === '5Y') startDate.setFullYear(now.getFullYear() - 5);
            else startDate = new Date(0); // All

            filteredData = chartDataWithSMAs.filter(d => new Date(d.date) >= startDate);

            // Re-index to first point if showing percentage
            if (filteredData.length > 0) {
                const rangeFirstPoint = filteredData[0];
                return filteredData.map(d => {
                    const newPoint = { date: d.date };
                    series.forEach(s => {
                        const key = s.dataKey;
                        const val = d[key];
                        if (val === undefined) return;

                        if (isPercentageData || mode === 'percent') {
                            const rangeBase = rangeFirstPoint[key];

                            if (val === null || val === undefined || rangeBase === null || rangeBase === undefined) {
                                newPoint[key] = null;
                            } else if (isPercentageData) {
                                // For TWR data (which is usually index based 100 or return based 0)
                                // return_new = (1 + r_current) / (1 + r_start) - 1
                                newPoint[key] = ((1 + val / 100) / (1 + rangeBase / 100) - 1) * 100;
                            } else {
                                newPoint[key] = rangeBase !== 0 ? ((val - rangeBase) / rangeBase) * 100 : 0;
                            }
                        } else {
                            newPoint[key] = val;
                        }
                    });
                    return newPoint;
                });
            }
        }

        return chartDataWithSMAs.map(d => {
            const newPoint = { date: d.date };
            series.forEach(s => {
                const key = s.dataKey;
                const val = d[key];

                if (val === undefined || val === null) {
                    newPoint[key] = null;
                    return;
                }

                if (isPercentageData) {
                    // Pre-normalized data from backend (TWR)
                    // SMAs calculated from this data are also in the same scale
                    if (key === 'price_main' || key.startsWith('val_') || key.startsWith('SMA_')) {
                        newPoint[key] = val;
                    } else {
                        // Manually added stock in a performance chart - needs normalization
                        const base = firstPoint[key];
                        if (base === null || base === undefined || base === 0) {
                            newPoint[key] = 0;
                        } else {
                            newPoint[key] = ((val - base) / base) * 100;
                        }
                    }
                } else {
                    if (mode === 'percent') {
                        const base = firstPoint[key];
                        if (base === null || base === undefined || base === 0) {
                            newPoint[key] = 0;
                        } else {
                            newPoint[key] = ((val - base) / base) * 100;
                        }
                    } else {
                        newPoint[key] = val;
                    }
                }
            });
            return newPoint;
        });
    }, [chartDataWithSMAs, mode, series, isPercentageData, isManual, timeRange]);

    // Formatters
    const yAxisFormatter = (val) => {
        if (mode === 'percent' || isPercentageData) return `${Number(val).toFixed(0)}%`;
        if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
        return `${val}`;
    };

    const tooltipValueFormatter = (val) => {
        if (mode === 'percent' || isPercentageData) return `${Number(val).toFixed(2)}%`;
        return `${currencySymbol}${Number(val).toFixed(2)}`;
    };

    // --- Actions ---

    const handleAddComparison = async (value) => {
        const term = (value || searchTerm).trim().toUpperCase();
        if (!term) return;
        if (term === ticker.toUpperCase()) return;
        if (comparisonTickers.includes(term)) return;
        if (comparisonTickers.length >= 5) { // Updated to 5 based on error message 'Max 5'
            // Keeping alert for this max limit or could check usage, but user asked for "Not Found" modal
            // Let's use the modal for consistency if preferred, but the prompt specifically asked for "Stock Not Found"
            // I'll stick to replacing the NOT FOUND alerts.
            alert("Max 5 tickers allowed in total");
            return;
        }

        setLoading(true);
        try {
            // Validate ticker by attempting to fetch its chart data
            const response = await fetchChartData(term, '1D');
            if (!response || !response.data || response.data.length === 0) {
                setFailedTicker(term);
                setShowErrorModal(true);
                setLoading(false);
                return;
            }

            setComparisonTickers(prev => [...prev, term]);
            if (onAddSeries) onAddSeries(term);
            setSearchTerm('');
        } catch (err) {
            setFailedTicker(term);
            setShowErrorModal(true);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveComparison = (id) => {
        if (id === 'main') return;
        setComparisonTickers(prev => prev.filter(t => t !== id));
        if (onRemoveSeries) onRemoveSeries(id);
    };

    const headerTitle = (
        <div className="chart-title-group">
            <h3 className="chart-title">{title}</h3>
        </div>
    );



    return (
        <StyledCard
            expanded={true}
            className={`price-chart-card-container ${className} ${loading ? 'is-loading' : ''}`}
            title={headerTitle}
            headerAlign="start"
            variant={variant}
            {...props}
        >
            {loading && chartData.length === 0 ? (
                <div className="chart-loading-overlay">
                    <div className="spinner"></div>
                    <span>Loading chart data...</span>
                </div>
            ) : (
                <>
                    <BaseChart
                        data={displayData}
                        series={series}
                        currency={currencySymbol}
                        activeTimeRange={timeRange}
                        onTimeRangeChange={setTimeRange}
                        xAxisFormatter={xAxisFormatter}
                        yAxisFormatter={yAxisFormatter}
                        tooltipValueFormatter={tooltipValueFormatter}
                        height={chartHeight}
                        extraControls={
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                {allowSMA && (
                                    <DropdownButton
                                        icon={<Activity size={16} />}
                                        buttonStyle={{ width: '36px', height: '36px', padding: 0 }}
                                        items={['50', '100', '150', '200'].map(period => ({
                                            label: `SMA ${period}`,
                                            isActive: visibleSMAs[period],
                                            onClick: () => setVisibleSMAs(prev => ({ ...prev, [period]: !prev[period] }))
                                        }))}
                                        closeOnSelect={false}
                                        align="left"
                                    />
                                )}

                                {!isPercentageData && (
                                    <Button
                                        variant="outline"
                                        onClick={() => setMode(prev => prev === 'price' ? 'percent' : 'price')}
                                        style={{ width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        {mode === 'price' ? <DollarSign size={16} /> : <Percent size={16} />}
                                    </Button>
                                )}

                                {allowComparison && (
                                    <SearchBar
                                        placeholder="Compare ticker..."
                                        onSearch={setSearchTerm}
                                        onEnter={handleAddComparison}
                                    />
                                )}
                            </div>
                        }
                    />
                </>
            )}

            {/* Legend / Tags (Below Chart) */}
            {series.length > 1 && (
                <div className="chart-legend">
                    {series.map((s) => (
                        <div key={s.id} className="legend-tag" style={{ '--tag-color': s.color }}>
                            <span className="tag-dot"></span>
                            <span className="tag-name">{s.name}</span>
                            {s.id !== 'main' && (
                                <button
                                    className="tag-remove-btn"
                                    onClick={() => handleRemoveComparison(s.id)}
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
            {/* Error Window */}
            <Window
                isOpen={showErrorModal}
                onClose={() => setShowErrorModal(false)}
                title="Stock Not Found"
                headerAlign="start"
                width="400px"
                height="auto"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '0.5rem' }}>
                    <div style={{ color: 'var(--neu-text-primary)' }}>
                        <p style={{ lineHeight: '1.5' }}>Could not find {failedTicker}. Please check the ticker and try again.</p>
                    </div>
                </div>
            </Window>
        </StyledCard >
    );
};

export default PriceChartCard;
