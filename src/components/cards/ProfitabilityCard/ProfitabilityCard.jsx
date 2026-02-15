import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, TrendingDown, TrendingUp, Minus, Activity } from 'lucide-react';
import CardToggleButton from '../CardToggleButton/CardToggleButton';
import MetricCard from '../../ui/MetricCard/MetricCard';
import { useStockData } from '../../../hooks/useStockData';
import styles from './ProfitabilityCard.module.css';
import VerticalBarChart from '../../ui/Charts/VerticalBarChart';
import { useTheme } from '../../../context/ThemeContext';
import ExpandableCard from '../../ui/ExpandableCard/ExpandableCard';

const ProfitabilityCard = ({
    currency = 'USD',
    currencySymbol = '$',
    currentRate = 1,
    isOpen = true,
    onToggle = null,
    onHide = null,
    className = "",
    variant = 'default'
}) => {
    const { stockData, loading, loadStockData } = useStockData();
    const { theme } = useTheme();

    // Lazy load charts
    const [isInView, setIsInView] = useState(false);
    const cardRef = useRef(null);

    useEffect(() => {
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

    if (loading && !stockData) return <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
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

    // Summary Helpers
    const renderTrendOnly = (label, trend) => {
        const Icon = trend.icon;
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px',
                    background: 'rgba(255,255,255,0.05)',
                    color: trend.color,
                    padding: '2px'
                }}>
                    <Icon size={14} />
                </div>
                <span style={{ fontWeight: '500' }}>{label}</span>
            </div>
        );
    };

    // Calculate Summary Data
    const roe = profitability.roe * 100;
    const roic = profitability.roic * 100;

    // Calculate Trends - REVENUE
    let revTrend = { icon: Minus, label: 'Stable', color: 'var(--text-secondary)', text: 'Stable' };
    if (chartData && chartData.length >= 3) {
        const revenues = chartData.map(d => d.revenue);
        const last = revenues[revenues.length - 1];
        const first = revenues[0];
        let increases = 0;
        let decreases = 0;

        for (let i = 1; i < revenues.length; i++) {
            if (revenues[i] > revenues[i - 1]) increases++;
            else if (revenues[i] < revenues[i - 1]) decreases++;
        }

        if (increases >= revenues.length - 2 && last > first)
            revTrend = { icon: TrendingUp, label: 'Growing', color: 'var(--neu-success)', text: 'Growing' };
        else if (decreases >= revenues.length - 2 && last < first)
            revTrend = { icon: TrendingDown, label: 'Declining', color: 'var(--neu-error)', text: 'Declining' };
        else if (increases > 0 && decreases > 0)
            revTrend = { icon: Activity, label: 'Volatile', color: 'var(--neu-warning)', text: 'Volatile' };
    }

    // Calculate Trends - RECEIVABLES
    let recTrend = { icon: Minus, label: 'Stable', color: 'var(--text-secondary)', text: 'Stable' };
    if (chartData && chartData.length >= 3) {
        const receivables = chartData.map(d => d.receivables);
        const last = receivables[receivables.length - 1];
        const first = receivables[0];
        let increases = 0;
        let decreases = 0;

        for (let i = 1; i < receivables.length; i++) {
            if (receivables[i] > receivables[i - 1]) increases++;
            else if (receivables[i] < receivables[i - 1]) decreases++;
        }

        if (increases >= receivables.length - 2 && last > first)
            recTrend = { icon: TrendingUp, label: 'Growing', color: 'var(--neu-warning)', text: 'Growing' };
        else if (decreases >= receivables.length - 2 && last < first)
            recTrend = { icon: TrendingDown, label: 'Declining', color: 'var(--neu-success)', text: 'Declining' };
        else if (increases > 0 && decreases > 0)
            recTrend = { icon: Activity, label: 'Volatile', color: 'var(--text-secondary)', text: 'Volatile' };
    }

    // Calculate Trends - CCC
    let cccTrend = { icon: Minus, label: 'Stable', color: 'var(--text-secondary)' };
    if (profitability.ccc_history && profitability.ccc_history.length >= 2) {
        const last = profitability.ccc_history[profitability.ccc_history.length - 1].value;
        const prev = profitability.ccc_history[profitability.ccc_history.length - 2].value;
        if (last < prev) cccTrend = { icon: TrendingDown, label: 'Improving', color: 'var(--neu-success)' };
        else if (last > prev) cccTrend = { icon: TrendingUp, label: 'Worsening', color: 'var(--neu-error)' };
        else cccTrend = { icon: Minus, label: 'Stable', color: 'var(--text-secondary)' };
    }

    const header = (
        <div className="summary-info stock-health-summary">
            <div className="summary-name">Profitability</div>
            <div className="summary-price-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', width: '100%', alignItems: 'start', columnGap: '0.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--neu-text-tertiary)', fontWeight: 600 }}>ROE</span>
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: roe > 12 ? 'var(--neu-success)' : 'var(--neu-warning)' }}>
                            {roe.toFixed(1)}%
                        </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--neu-text-tertiary)', fontWeight: 600 }}>ROIC</span>
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: roic > 12 ? 'var(--neu-success)' : 'var(--neu-warning)' }}>
                            {roic.toFixed(1)}%
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                    {renderTrendOnly('Rev', revTrend)}
                    {renderTrendOnly('Rec', recTrend)}
                    {renderTrendOnly('CCC', cccTrend)}
                </div>
            </div>
        </div>
    );

    const menuItems = [];

    return (
        <ExpandableCard
            title="Profitability"
            expanded={isOpen}
            defaultExpanded={isOpen}
            onToggle={onToggle}
            onHide={onHide}
            collapsedWidth={220}
            collapsedHeight={220}
            headerContent={header}
            className={className}
            menuItems={menuItems}
            onRefresh={() => stockData?.overview?.symbol && loadStockData(stockData.overview.symbol, true)}
        >
            <div ref={cardRef}>
                {/* Internal title removed as it's now handled by ExpandableCard */}


                {(stockData.overview.quoteType !== 'ETF' && stockData.overview.industry !== 'ETF') ? (
                    <div className={styles.allChartsContainer}>
                        <MetricCard
                            title="Return on Equity"
                            value={profitability.roe}
                            target="> 12% - 15%"
                            variant="transparent"
                            isOpen={true}
                        />

                        <MetricCard
                            title="Return on Invested Capital"
                            value={profitability.roic}
                            target="> 12% - 15%"
                            variant="transparent"
                            isOpen={true}
                        />

                        <div className={styles.chartContainer}>
                            <h4 className={styles.subTitle}>Receivables vs Revenue</h4>
                            {chartData.length > 0 ? (
                                <div className={styles.chartWrapper} style={{ height: 'auto', minHeight: 'auto' }}>
                                    {isInView && (
                                        <VerticalBarChart
                                            data={chartData}
                                            series={[
                                                { dataKey: 'revenue', name: 'Total Revenue', color: '#3B82F6' },
                                                { dataKey: 'receivables', name: 'Accounts Receivable', color: '#EF4444' }
                                            ]}
                                            currencySymbol={currencySymbol}
                                            valueFormatter={(val) => `${currencySymbol}${(val / 1e9).toFixed(0)}B`}
                                            height={240}
                                        />
                                    )}
                                </div>
                            ) : (
                                <div className={styles.noData}>No efficiency data available</div>
                            )}
                        </div>

                        <div className={profitability.ccc_history && profitability.ccc_history.length > 0 ? styles.chartContainer : styles.chartContainerSmall}>
                            <h4 className={styles.subTitle}>Cash Conversion Cycle</h4>
                            {profitability.ccc_history && profitability.ccc_history.length > 0 ? (
                                <div className={styles.chartWrapper} style={{ height: 'auto', minHeight: 'auto' }}>
                                    {isInView && (
                                        <VerticalBarChart
                                            data={[...profitability.ccc_history].reverse()}
                                            series={[
                                                { dataKey: 'value', name: 'Cash Conversion Cycle', color: '#10B981' }
                                            ]}
                                            currencySymbol=""
                                            valueFormatter={(val) => `${Number(val).toFixed(0)} Days`}
                                            height={240}
                                        />
                                    )}
                                </div>
                            ) : (
                                <div className={styles.noDataSmall}>
                                    {profitability.ccc_not_applicable_reason ? (
                                        <span>Not applicable: {profitability.ccc_not_applicable_reason}</span>
                                    ) : (
                                        "No CCC data available"
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className={styles.etfMessage}>
                        This is an ETF and Profitability & Efficiency is not applicable.
                    </div>
                )}
            </div>
        </ExpandableCard>
    );
};

export default ProfitabilityCard;
