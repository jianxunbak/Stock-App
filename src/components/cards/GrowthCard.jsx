import React, { useMemo } from 'react';
import { useStockData } from '../../hooks/useStockData';
import {
    ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart
} from 'recharts';
import styles from './GrowthCard.module.css';
import { useTheme } from '../../context/ThemeContext';

const GrowthCard = ({ currency = 'USD', currencySymbol = '$', currentRate = 1 }) => {
    const { stockData, loading } = useStockData();
    const [barSize, setBarSize] = React.useState(20);
    const [chartHeight, setChartHeight] = React.useState(300);

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
    const { theme } = useTheme();
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
    }, [loading, stockData]);

    if (loading) return <div className={styles.loading}></div>;
    if (!stockData) return null;

    const { growth } = stockData;
    if (!growth) return null;

    // Prepare data for charts
    const prepareChartData = () => {
        if (!growth || !growth.tables) return [];

        const revenue = growth.tables.total_revenue || [];
        const netIncome = growth.tables.net_income || [];
        const opIncome = growth.tables.operating_income || [];
        const ocf = growth.tables.operating_cash_flow || [];

        // Merge by date
        const merged = revenue.map(r => {
            const ni = netIncome.find(n => n.date === r.date);
            const oi = opIncome.find(o => o.date === r.date);
            const o = ocf.find(c => c.date === r.date);
            return {
                date: r.date,
                revenue: r.value * currentRate,
                netIncome: ni ? ni.value * currentRate : 0,
                opIncome: oi ? oi.value * currentRate : 0,
                ocf: o ? o.value * currentRate : 0
            };
        }).reverse(); // Oldest to newest

        return merged;
    };

    const prepareMarginData = () => {
        if (!growth || !growth.tables) return [];

        const gross = growth.tables.gross_margin || [];
        const net = growth.tables.net_margin || [];

        const merged = gross.map(g => {
            const n = net.find(nm => nm.date === g.date);
            return {
                date: g.date,
                grossMargin: g.value,
                netMargin: n ? n.value : 0
            };
        }).reverse();

        return merged;
    };

    let financialData = prepareChartData();
    let marginData = prepareMarginData();

    // MOCK DATA FALLBACK (DEBUGGING)
    if (financialData.length === 0) {
        console.warn("Using Mock Data for Financial Chart");
        financialData = [
            { date: '2021', revenue: 168000000000 * currentRate, netIncome: 61000000000 * currentRate, ocf: 76000000000 * currentRate },
            { date: '2022', revenue: 198000000000 * currentRate, netIncome: 72000000000 * currentRate, ocf: 89000000000 * currentRate },
            { date: '2023', revenue: 211000000000 * currentRate, netIncome: 72000000000 * currentRate, ocf: 87000000000 * currentRate },
            { date: '2024', revenue: 245000000000 * currentRate, netIncome: 88000000000 * currentRate, ocf: 110000000000 * currentRate },
        ];
    }
    if (marginData.length === 0) {
        marginData = [
            { date: '2021', grossMargin: 68, netMargin: 36 },
            { date: '2022', grossMargin: 68, netMargin: 36 },
            { date: '2023', grossMargin: 69, netMargin: 34 },
            { date: '2024', grossMargin: 70, netMargin: 35 },
        ];
    }

    // Lazy load charts (Moved to top)


    return (
        <div ref={cardRef} className={styles.card}>
            {/* <LiquidGlassBackground /> */}
            <h3 className={styles.title}>Growth Analysis</h3>

            {(stockData.overview.quoteType !== 'ETF' && stockData.overview.industry !== 'ETF') ? (
                <>
                    <div className={styles.metricsGrid}>
                        <div className={styles.metricCard}>
                            <h4 className={styles.metricLabel}>Median Annual Revenue Growth</h4>
                            <p className={`${styles.metricValue} ${growth.revenueGrowth > 0 ? styles.positive : styles.negative}`}>
                                {(growth.revenueGrowth * 100).toFixed(2)}%
                            </p>
                        </div>

                    </div>
                    <div className={styles.allChartsContainer}>
                        {/* Chart 1: Revenue, Net Income, OCF */}
                        <div className={styles.chartContainer}>
                            <h4 className={styles.chartTitle}>Financial Performance</h4>
                            {financialData.length > 0 ? (
                                <div className={styles.chartWrapper}>
                                    {isInView ? (
                                        <ResponsiveContainer width="100%" height={chartHeight}>
                                            <ComposedChart data={financialData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                                                <Bar dataKey="revenue" name="Revenue" fill="#3B82F6" barSize={barSize} />
                                                <Bar dataKey="opIncome" name="Operating Income" fill="#8B5CF6" barSize={barSize} />
                                                <Bar dataKey="netIncome" name="Net Income" fill="#F59E0B" barSize={barSize} />
                                                <Bar dataKey="ocf" name="Operating Cash Flow" fill="#10B981" barSize={barSize} />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    ) : <div style={{ height: chartHeight }} />}
                                </div>
                            ) : (
                                <div className={styles.noData}>
                                    No financial data available for chart
                                </div>
                            )}
                        </div>


                        {/* Chart 2: Margins */}
                        <div className={styles.chartContainer}>
                            <h4 className={styles.chartTitle}>Margin Trends</h4>
                            {marginData.length > 0 ? (
                                <div className={styles.chartWrapper}>
                                    {isInView ? (
                                        <ResponsiveContainer width="100%" height={chartHeight}>
                                            <ComposedChart data={marginData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                                                <XAxis dataKey="date" stroke={chartColors.text} tick={{ fontSize: 10, fill: chartColors.text }} />
                                                <YAxis stroke={chartColors.text} tick={{ fontSize: 10, fill: chartColors.text }} tickFormatter={(val) => `${val}%`} />
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
                                                    formatter={(value, name) => [`${Number(value).toFixed(2)}%`, name]}
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
                                                <Bar dataKey="grossMargin" name="Gross Margin" fill="#8B5CF6" barSize={barSize} />
                                                <Bar dataKey="netMargin" name="Net Margin" fill="#EC4899" barSize={barSize} />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    ) : <div style={{ height: chartHeight }} />}
                                </div>
                            ) : (
                                <div className={styles.noData}>
                                    No margin data available for chart
                                </div>
                            )}
                        </div>

                        {/* Growth Estimates Table */}
                        {/* {growth.estimates && growth.estimates.length > 0 && (
                            <div>
                                <h4 className={styles.tableTitle}>5-Year Growth Estimates</h4>
                                <div className={styles.tableContainer}>
                                    <table className={styles.table}>
                                        <thead className={styles.tableHead}>
                                            <tr>
                                                <th className={styles.tableCell}>Period</th>
                                                <th className={styles.tableCell}>Growth Estimates</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {growth.estimates.map((row, idx) => (
                                                <tr key={idx} className={styles.tableRow}>
                                                    <td className={styles.periodCell}>
                                                        {row['Period'] || row['period'] || row['Growth Estimates'] || row['index'] || 'N/A'}
                                                    </td>
                                                    <td className={styles.valueCell}>
                                                        {(row['stockTrend'] || row['stock'] || row[Object.keys(row).find(k => k !== 'period' && k !== 'Period' && k !== 'index')] || 'N/A')}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )} */}
                    </div>
                </>
            ) : (
                <div className={styles.etfMessage}>
                    This is an ETF and Growth Analysis is not applicable.
                </div>
            )}
        </div>
    );
};

export default GrowthCard;
