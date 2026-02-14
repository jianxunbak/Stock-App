import React, { useMemo } from 'react';

import { useStockData } from '../../../hooks/useStockData';
import styles from './FinancialPerformanceCard.module.css';
import CardToggleButton from '../../cards/CardToggleButton/CardToggleButton';
import VerticalBarChart from '../Charts/VerticalBarChart';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

const FinancialPerformanceCard = ({ currencySymbol = '$', currentRate = 1, isOpen = true, onToggle = null, view = 'expanded', variant = 'default' }) => {
    const { stockData, loading } = useStockData();

    const combinedData = useMemo(() => {
        if (!stockData || !stockData.growth || !stockData.growth.tables) return [];

        const { tables } = stockData.growth;
        const revenue = tables.total_revenue || [];
        const netIncome = tables.net_income || [];
        const opIncome = tables.operating_income || [];
        const ocf = tables.operating_cash_flow || [];
        const grossMargin = tables.gross_margin || [];
        const netMargin = tables.net_margin || [];

        return revenue.map(r => {
            const ni = netIncome.find(n => n.date === r.date);
            const oi = opIncome.find(o => o.date === r.date);
            const o = ocf.find(c => c.date === r.date);
            const gm = grossMargin.find(g => g.date === r.date);
            const nm = netMargin.find(n => n.date === r.date);
            return {
                date: r.date,
                revenue: r.value * currentRate,
                netIncome: ni ? ni.value * currentRate : 0,
                opIncome: oi ? oi.value * currentRate : 0,
                ocf: o ? o.value * currentRate : 0,
                grossMargin: gm ? gm.value : 0,
                netMargin: nm ? nm.value : 0
            };
        }).reverse();
    }, [stockData, currentRate]);

    if (loading) return view === 'summary' ? <div className={styles.summaryLoading}></div> : <div className={styles.loading}></div>;
    if (!stockData) return null;

    const isETF = stockData.overview.quoteType === 'ETF' || stockData.overview.industry === 'ETF';

    const series = [
        { dataKey: 'revenue', name: 'Revenue', color: '#3B82F6' },
        { dataKey: 'opIncome', name: 'Operating Income', color: '#8B5CF6' },
        { dataKey: 'netIncome', name: 'Net Income', color: '#F59E0B' },
        { dataKey: 'ocf', name: 'Operating Cash Flow', color: '#10B981' }
    ];

    const valueFormatter = (val) => `${currencySymbol}${(val / 1e9).toFixed(0)} B`;

    const getTrendInfo = (data, key) => {
        if (!data || data.length < 2) return { icon: Minus, label: 'Stable', color: 'var(--text-secondary)' };

        const values = data.map(d => d[key]);
        const last = values[values.length - 1];
        const first = values[0];

        // Count positive/negative changes
        let increases = 0;
        let decreases = 0;
        const isMargin = key.toLowerCase().includes('margin');

        for (let i = 1; i < values.length; i++) {
            if (isMargin) {
                if (values[i] > values[i - 1] + 0.1) increases++;
                else if (values[i] < values[i - 1] - 0.1) decreases++;
            } else {
                if (values[i] > values[i - 1] * 1.02) increases++;
                else if (values[i] < values[i - 1] * 0.98) decreases++;
            }
        }

        if (increases >= values.length - 2 && last > first)
            return { icon: TrendingUp, label: isMargin ? 'Improving' : 'Increasing', color: 'var(--neu-success)' };
        if (decreases >= values.length - 2 && last < first)
            return { icon: TrendingDown, label: isMargin ? 'Declining' : 'Decreasing', color: 'var(--neu-error)' };
        if (increases > 0 && decreases > 0)
            return { icon: Activity, label: 'Volatile', color: 'var(--neu-color-favorite)' };
        return { icon: Minus, label: 'Stable', color: 'var(--text-secondary)' };
    };

    // Summary View (Trend Icons)
    if (view === 'summary') {
        const metrics = [
            { key: 'revenue', label: 'Revenue' },
            { key: 'opIncome', label: 'Op Income' },
            { key: 'netIncome', label: 'Net Income' },
            { key: 'ocf', label: 'OCF' },
            { key: 'grossMargin', label: 'Gross Margin' },
            { key: 'netMargin', label: 'Net Margin' }
        ];

        return (
            <div className="summary-trends stock-health-summary">
                <div className="summary-health-content" style={{ width: '100%', textAlign: 'left', paddingTop: '0' }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr',
                        gap: '0.15rem',
                        padding: '0',
                        width: '100%'
                    }}>
                        {metrics.map(m => {
                            const trend = getTrendInfo(combinedData, m.key);
                            const Icon = trend.icon;
                            return (
                                <div key={m.key} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.15rem',
                                    fontSize: '0.8rem',
                                    minWidth: 0
                                }}>
                                    <div style={{
                                        padding: '1px',
                                        borderRadius: '2px',
                                        background: 'rgba(255,255,255,0.05)',
                                        display: 'flex',
                                        color: trend.color,
                                        flexShrink: 0
                                    }}>
                                        <Icon size={12} />
                                    </div>
                                    <span style={{
                                        color: 'var(--neu-text-tertiary)',
                                        fontWeight: '500',
                                        whiteSpace: 'nowrap',
                                        overflow: 'visible'
                                    }}>{m.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    const content = (
        <>
            {variant !== 'transparent' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className={styles.title}>Financial Trend</h3>
                    {onToggle && (
                        <CardToggleButton isOpen={isOpen} onClick={onToggle} />
                    )}
                </div>
            )}

            {isOpen && (
                !isETF ? (
                    <div className={styles.chartContainer} style={variant === 'transparent' ? { padding: '0.5rem 0' } : {}}>
                        {variant === 'transparent' && (
                            <h3 className={styles.title} style={{ margin: 0 }}>Financial Trend</h3>
                        )}
                        <VerticalBarChart
                            data={combinedData}
                            series={series}
                            currencySymbol={currencySymbol}
                            valueFormatter={valueFormatter}
                            height={240}
                        />
                    </div>
                ) : (
                    <div className={styles.etfMessage}>
                        Not applicable for ETFs.
                    </div>
                )
            )}
        </>
    );

    if (variant === 'transparent') {
        return content;
    }

    return (
        <div className={styles.card}>
            {content}
        </div>
    );
};

export default FinancialPerformanceCard;
