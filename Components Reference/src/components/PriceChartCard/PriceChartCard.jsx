import React, { useState, useEffect } from 'react';
import BaseChart from '../BaseChart/BaseChart';
import { X } from 'lucide-react';
import StyledCard from '../StyledCard/StyledCard';
import Button from '../Button/Button';
import SearchBar from '../SearchBar';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
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
    data = [],
    title = 'Price History',
    currency = '$',
    className = '',
    scrollAnimated = false,
    variant = 'default',
    view = 'expanded',
    change = '+0.00', // Used for summary sparkline color
    ...props
}) => {
    const isPositive = change?.startsWith('+');

    // Summary View (Direct match to StockSummary sparkline)
    if (view === 'summary') {
        return (
            <div className="summary-chart price-chart-summary">
                <div className="summary-chart-content">
                    <h3 className="summary-chart-title">{title}</h3>
                    <div className="summary-chart-inner">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data} style={{ outline: 'none' }}>
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
    const [chartData, setChartData] = useState([]);
    const [series, setSeries] = useState([]); // Array of { id, name, dataKey, color }
    const [searchTerm, setSearchTerm] = useState('');
    const [timeRange, setTimeRange] = useState('YTD');

    // Initialize with primary data
    useEffect(() => {
        if (data && data.length > 0) {
            // Transform initial data to a flexible format
            // e.g., { date: 'Jan', price_main: 100 }
            const formattedData = data.map(d => ({
                date: d.date,
                price_main: d.price
            }));

            setChartData(formattedData);
            setSeries([{
                id: 'main',
                name: 'Primary',
                dataKey: 'price_main',
                color: SERIES_COLORS[0]
            }]);
        }
    }, [data]);



    // --- Actions ---

    const handleAddComparison = (value) => {
        const term = value || searchTerm;
        if (!term.trim()) return;
        if (series.length >= 5) {
            alert("Max 5 comparisons allowed");
            return;
        }

        const newTicker = term.toUpperCase();
        const existing = series.find(s => s.name === newTicker);
        if (existing) {
            return; // Already added
        }

        const newId = `price_${newTicker}_${Date.now()}`;
        const newColor = SERIES_COLORS[series.length % SERIES_COLORS.length];

        // 1. Generate Mock Data relative to the main data
        // We'll walk through the existing chartData and add a new key for this stock
        // simulating some random movement.
        let lastPrice = Math.random() * 200 + 50;

        const newData = chartData.map((point, index) => {
            // Random walk: -5% to +5%
            const change = 1 + (Math.random() * 0.1 - 0.05);

            // For the first point, we just use the random start.
            // For subsequent points, we modify the running total.
            if (index > 0) {
                lastPrice = lastPrice * change;
            }

            return {
                ...point,
                [newId]: lastPrice
            };
        });

        // 2. Update Series
        setSeries([...series, {
            id: newId,
            name: newTicker,
            dataKey: newId,
            color: newColor
        }]);

        // 3. Update Chart Data
        setChartData(newData);
    };

    const handleRemoveComparison = (dataKey) => {
        // Prevent removing the main one (optional, but good for UX)
        if (dataKey === 'price_main') return;

        setSeries(series.filter(s => s.dataKey !== dataKey));
        // We don't necessarily need to strip the data from chartData objects;
        // Recharts will just ignore keys that aren't mapped to lines.
    };

    const headerTitle = (
        <div className="chart-title-group">
            <h3 className="chart-title">{title}</h3>
        </div>
    );

    const headerControls = (
        <>
            <SearchBar
                placeholder="Compare ticker..."
                onSearch={setSearchTerm}
                onEnter={handleAddComparison}
                expandedWidth="180px"
            />
        </>
    );

    return (
        <StyledCard
            expanded={true}
            className={`price-chart-card-container ${className}`}
            title={headerTitle}
            controls={headerControls}
            headerAlign="start"
            variant={variant}
            {...props}
        >
            <BaseChart
                data={chartData}
                series={series}
                currency={currency}
                activeTimeRange={timeRange}
                onTimeRangeChange={setTimeRange}
            />

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
                                    onClick={() => handleRemoveComparison(s.dataKey)}
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </StyledCard>
    );
};

export default PriceChartCard;
