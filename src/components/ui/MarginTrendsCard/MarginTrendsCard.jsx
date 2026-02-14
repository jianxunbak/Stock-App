import React, { useMemo } from 'react';
import { useStockData } from '../../../hooks/useStockData';
import styles from './MarginTrendsCard.module.css';
import CardToggleButton from '../../cards/CardToggleButton/CardToggleButton';
import VerticalBarChart from '../Charts/VerticalBarChart';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

const MarginTrendsCard = ({ isOpen = true, onToggle = null, view = 'expanded', variant = 'default' }) => {
    const { stockData, loading } = useStockData();

    const marginData = useMemo(() => {
        if (!stockData || !stockData.growth || !stockData.growth.tables) return [];

        const { tables } = stockData.growth;
        const gross = tables.gross_margin || [];
        const net = tables.net_margin || [];

        return gross.map(g => {
            const n = net.find(nm => nm.date === g.date);
            return {
                date: g.date,
                grossMargin: g.value,
                netMargin: n ? n.value : 0
            };
        }).reverse();
    }, [stockData]);

    if (loading) return view === 'summary' ? <div className={styles.summaryLoading}></div> : <div className={styles.loading}></div>;
    if (!stockData) return null;

    const isETF = stockData.overview.quoteType === 'ETF' || stockData.overview.industry === 'ETF';

    const series = [
        { dataKey: 'grossMargin', name: 'Gross Margin', color: '#8B5CF6' },
        { dataKey: 'netMargin', name: 'Net Margin', color: '#EC4899' }
    ];

    const valueFormatter = (val) => `${Number(val).toFixed(2)}% `;

    const getTrendInfo = (data, key) => {
        if (!data || data.length < 2) return { icon: Minus, label: 'Stable', color: 'var(--text-secondary)' };

        const values = data.map(d => d[key]);
        const last = values[values.length - 1];
        const first = values[0];

        // Count positive/negative changes
        let increases = 0;
        let decreases = 0;
        for (let i = 1; i < values.length; i++) {
            if (values[i] > values[i - 1] + 0.1) increases++; // Use absolute basis points for margins
            else if (values[i] < values[i - 1] - 0.1) decreases++;
        }

        if (increases >= values.length - 2 && last > first)
            return { icon: TrendingUp, label: 'Improving', color: 'var(--neu-success)' };
        if (decreases >= values.length - 2 && last < first)
            return { icon: TrendingDown, label: 'Declining', color: 'var(--neu-error)' };
        if (increases > 0 && decreases > 0)
            return { icon: Activity, label: 'Volatile', color: 'var(--neu-color-favorite)' };
        return { icon: Minus, label: 'Stable', color: 'var(--text-secondary)' };
    };

    // Summary View (Trend Icons)
    if (view === 'summary') {
        const metrics = [
            { key: 'grossMargin', label: 'Gross Margin' },
            { key: 'netMargin', label: 'Net Margin' }
        ];

        return (
            <div className="summary-info stock-health-summary">
                <div className="summary-price-group">
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.15rem',
                        alignItems: 'flex-start'
                    }}>
                        {metrics.map(m => {
                            const trend = getTrendInfo(marginData, m.key);
                            const Icon = trend.icon;
                            return (
                                <div key={m.key} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    fontSize: '0.75rem'
                                }}>
                                    <div style={{
                                        padding: '2px',
                                        borderRadius: '4px',
                                        background: 'rgba(255,255,255,0.05)',
                                        display: 'flex',
                                        color: trend.color
                                    }}>
                                        <Icon size={12} />
                                    </div>
                                    <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>{m.label}</span>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isOpen ? '1rem' : '0' }}>
                    <h3 className={styles.title} style={{ margin: 0 }}>Margin Trend</h3>
                    {onToggle && (
                        <CardToggleButton isOpen={isOpen} onClick={onToggle} />
                    )}
                </div>
            )}

            {isOpen && (
                !isETF ? (
                    <div className={styles.chartContainer} style={variant === 'transparent' ? { padding: '0.5rem 0' } : {}}>
                        {variant === 'transparent' && (
                            <h3 className={styles.title} style={{ margin: 0 }}>Margin Trend</h3>
                        )}
                        <VerticalBarChart
                            data={marginData}
                            series={series}
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

export default MarginTrendsCard;
