import React, { useMemo } from 'react';
import { useStockData } from '../../hooks/useStockData';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar
} from 'recharts';
import styles from './ProfitabilityCard.module.css';
import { useTheme } from '../../context/ThemeContext';

const ProfitabilityCard = ({ currency = 'USD', currencySymbol = '$', currentRate = 1 }) => {
    const { stockData, loading } = useStockData();
    const { theme } = useTheme();
    const [barSize, setBarSize] = React.useState(20);
    const [chartHeight, setChartHeight] = React.useState(300);

    // Lazy load charts
    const [isInView, setIsInView] = React.useState(false);
    const cardRef = React.useRef(null);

    React.useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.1 }
        );

        if (cardRef.current) {
            observer.observe(cardRef.current);
        }

        return () => observer.disconnect();
    }, [loading]);


    React.useEffect(() => {
        const handleResize = () => {
            // Use 400px for desktop (>= 768px), 300px for mobile (< 768px)
            setChartHeight(window.innerWidth < 768 ? 300 : 400);

            // Keep the bar size logic here too
            setBarSize(window.innerWidth < 768 ? 2 : 30);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);


    // Define chart colors based on theme
    const chartColors = useMemo(() => {
        const isDark = theme === 'dark';
        return {
            grid: isDark ? "#374151" : "#e5e7eb",
            text: isDark ? "#9CA3AF" : "#6b7280",
            tooltipBg: isDark ? "#1F2937" : "#ffffff",
            tooltipColor: isDark ? "#fff" : "#111827",
            tooltipBorder: isDark ? "none" : "1px solid #e5e7eb"
        };
    }, [theme]);

    if (loading) return <div className={styles.loading}></div>;
    if (!stockData) return null;

    const { profitability, growth } = stockData;
    if (!profitability || !growth) return null;

    // Prepare data
    const prepareChartData = () => {
        if (!profitability || !growth || !profitability.tables || !growth.tables) return [];

        const receivables = profitability.tables.accounts_receivable || [];
        const revenue = growth.tables.total_revenue || [];

        // Merge by date
        const merged = revenue.map(r => {
            const rec = receivables.find(a => a.date === r.date);
            return {
                date: r.date,
                revenue: r.value * currentRate,
                receivables: rec ? rec.value * currentRate : 0
            };
        }).reverse();

        return merged;
    };

    const chartData = prepareChartData();

    // Lazy load charts (Moved to top)

    return (
        <div ref={cardRef} className={styles.card}>
            {/* <LiquidGlassBackground /> */}
            <h3 className={styles.title}>Profitability & Efficiency</h3>

            {(stockData.overview.quoteType !== 'ETF' && stockData.overview.industry !== 'ETF') ? (
                <>
                    <div className={styles.metricsGrid}>
                        <div className={styles.metricCard}>
                            <h4 className={styles.metricLabel}>Return on Equity</h4>
                            <p className={`${styles.metricValue} ${profitability.roe > 0.12 ? styles.positive : styles.warning}`}>
                                {(profitability.roe * 100).toFixed(2)}%
                            </p>
                            <p className={styles.metricTarget}>Target: exceed 12% - 15%</p>
                        </div>

                        <div className={styles.metricCard}>
                            <h4 className={styles.metricLabel}>Return on Invested Capital</h4>
                            <p className={`${styles.metricValue} ${profitability.roic > 0.12 ? styles.positive : styles.warning}`}>
                                {(profitability.roic * 100).toFixed(2)}%
                            </p>
                            <p className={styles.metricTarget}>Target: exceed 12% - 15%</p>
                        </div>
                    </div>
                    <div className={styles.allChartsContainer}>
                        {/* Chart: Receivables vs Revenue */}
                        <div className={styles.chartContainer}>
                            <h4 className={styles.chartTitle}>Receivables vs Revenue</h4>
                            {chartData.length > 0 ? (
                                <div className={styles.chartWrapper}>
                                    {isInView ? (
                                        <ResponsiveContainer width="100%" height={chartHeight}>
                                            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                                                <XAxis dataKey="date" stroke={chartColors.text} tick={{ fontSize: 10, fill: chartColors.text }} />
                                                <YAxis stroke={chartColors.text} tick={{ fontSize: 10, fill: chartColors.text }} tickFormatter={(val) => `${currencySymbol}${(val / 1e9).toFixed(0)}B`} />
                                                <Tooltip
                                                    wrapperStyle={{ outline: 'none', backgroundColor: 'transparent' }}
                                                    contentStyle={{
                                                        // 1. BACKGROUND
                                                        backgroundColor: theme === 'dark' ? 'rgba(20, 20, 20, 0.7)' : 'rgba(255, 255, 255, 0.7)',

                                                        // 2. BORDER RADIUS
                                                        borderRadius: '15px',

                                                        // 3. BACKDROP FILTER
                                                        backdropFilter: 'blur(15px) saturate(150%) brightness(1.2)',
                                                        WebkitBackdropFilter: 'blur(15px) saturate(150%) brightness(1.2)',

                                                        // 4. BORDERS
                                                        borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid rgb(255, 255, 255)',
                                                        borderLeft: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid rgb(255, 255, 255)',
                                                        borderRight: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.2)',
                                                        borderBottom: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.2)',

                                                        // 5. BOX SHADOW
                                                        boxShadow: theme === 'dark'
                                                            ? '0 10px 20px rgba(0, 0, 0, 0.5), inset 2px 2px 3px rgba(255, 255, 255, 0.2), inset -1px -1px 3px rgba(0, 0, 0, 0.5)'
                                                            : '10px 10px 20px rgba(0, 0, 0, 0.2), -3px -3px 10px rgba(0, 0, 0, 0.1), inset 2px 2px 3px rgba(255, 255, 255, 0.2), inset -1px -1px 3px rgba(0, 0, 0, 0.5)',

                                                        // 6. FONT/TEXT STYLES
                                                        color: chartColors.tooltipColor,
                                                        fontSize: '12px',
                                                        padding: '8px 10px'
                                                    }}
                                                    formatter={(value, name) => [`${currencySymbol}${Number(value / 1e9).toFixed(2)}B`, name]}
                                                    itemStyle={{ margin: '0', padding: '0' }}
                                                    labelStyle={{
                                                        margin: '0 0 3px 0',
                                                        padding: '0',
                                                        fontWeight: 'bold'
                                                    }}
                                                />
                                                <Legend wrapperStyle={{
                                                    width: '100%', display: 'flex', justifyContent: 'center', paddingTop: 10, paddingLeft: 35, fontSize: '12px', alignItems: 'center'
                                                }} />
                                                <Bar dataKey="revenue" name="Total Revenue" fill="#3B82F6" barSize={barSize} />
                                                <Bar dataKey="receivables" name="Accounts Receivable" fill="#EF4444" barSize={barSize} />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    ) : <div style={{ height: chartHeight }} />}
                                </div>
                            ) : (
                                <div className={styles.noData}>
                                    No efficiency data available for chart
                                </div>
                            )}
                        </div>

                        {/* Chart: Cash Conversion Cycle */}
                        <div className={profitability.ccc_history && profitability.ccc_history.length > 0 ? styles.chartContainer : styles.chartContainerSmall}>
                            <h4 className={styles.chartTitle}>Cash Conversion Cycle</h4>
                            {profitability.ccc_history && profitability.ccc_history.length > 0 ? (
                                <div className={styles.chartWrapper}>
                                    {isInView ? (
                                        <ResponsiveContainer width="100%" height={chartHeight}>
                                            <ComposedChart data={[...profitability.ccc_history].reverse()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                                                <XAxis dataKey="date" stroke={chartColors.text} tick={{ fontSize: 10, fill: chartColors.text }} />
                                                <YAxis stroke={chartColors.text} tick={{ fontSize: 10, fill: chartColors.text }} label={{ value: 'Days', angle: -90, position: 'insideLeft', fill: chartColors.text }} />
                                                <Tooltip
                                                    wrapperStyle={{ outline: 'none', backgroundColor: 'transparent' }}
                                                    contentStyle={{
                                                        // 1. BACKGROUND
                                                        backgroundColor: theme === 'dark' ? 'rgba(20, 20, 20, 0.7)' : 'rgba(255, 255, 255, 0.7)',

                                                        // 2. BORDER RADIUS
                                                        borderRadius: '15px',

                                                        // 3. BACKDROP FILTER
                                                        backdropFilter: 'blur(15px) saturate(150%) brightness(1.2)',
                                                        WebkitBackdropFilter: 'blur(15px) saturate(150%) brightness(1.2)',

                                                        // 4. BORDERS
                                                        borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid rgb(255, 255, 255)',
                                                        borderLeft: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid rgb(255, 255, 255)',
                                                        borderRight: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.2)',
                                                        borderBottom: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.2)',

                                                        // 5. BOX SHADOW
                                                        boxShadow: theme === 'dark'
                                                            ? '0 10px 20px rgba(0, 0, 0, 0.5), inset 2px 2px 3px rgba(255, 255, 255, 0.2), inset -1px -1px 3px rgba(0, 0, 0, 0.5)'
                                                            : '10px 10px 20px rgba(0, 0, 0, 0.2), -3px -3px 10px rgba(0, 0, 0, 0.1), inset 2px 2px 3px rgba(255, 255, 255, 0.2), inset -1px -1px 3px rgba(0, 0, 0, 0.5)',

                                                        // 6. FONT/TEXT STYLES
                                                        color: chartColors.tooltipColor,
                                                        fontSize: '12px',
                                                        padding: '8px 10px'
                                                    }}
                                                    formatter={(value, name) => [`${Number(value).toFixed(0)} Days`, name]}
                                                    itemStyle={{ margin: '0', padding: '0' }}
                                                    labelStyle={{
                                                        margin: '0 0 3px 0',
                                                        padding: '0',
                                                        fontWeight: 'bold'
                                                    }}
                                                />
                                                <Legend wrapperStyle={{
                                                    width: '100%', display: 'flex', justifyContent: 'center', paddingTop: 10, paddingLeft: 35, fontSize: '12px', alignItems: 'center'
                                                }} />
                                                <Bar dataKey="value" name="Cash Conversion Cycle" fill="#10B981" barSize={barSize} />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    ) : <div style={{ height: chartHeight }} />}
                                </div>
                            ) : (
                                <div className={styles.noDataSmall}>
                                    {profitability.ccc_not_applicable_reason ? (
                                        <span>
                                            Not applicable: {profitability.ccc_not_applicable_reason}
                                        </span>
                                    ) : (
                                        "No CCC data available for chart"
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <div className={styles.etfMessage}>
                    This is an ETF and Profitability & Efficiency is not applicable.
                </div>
            )}
        </div>
    );
};

export default ProfitabilityCard;
