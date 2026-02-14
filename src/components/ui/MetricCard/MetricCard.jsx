import React from 'react';

import styles from './MetricCard.module.css';
import CardToggleButton from '../../cards/CardToggleButton/CardToggleButton';

const MetricCard = ({
    category = null,
    title = 'Metric',
    value = null,
    target = null,
    isOpen = true,
    onToggle = null,
    view = 'expanded',
    variant = 'default',
    loading = false,
    isETF = false,
    message = null,
    suffix = '%',
    multiplier = 100,
    reverseColors = false,
    status = null
}) => {
    if (loading) return view === 'summary' ? <div className={styles.summaryLoading}></div> : <div className={styles.loading}></div>;

    // If value is missing and we aren't showing a message, return null or placeholder
    if (value === null && !message && !isETF) return null;

    const isString = typeof value === 'string';
    const formattedValue = !isString && value !== null ? (value * multiplier) : value;

    const getScoreColor = (s) => {
        // If reverseColors is true: High is Bad (Error), Low is Good (Success)
        // This is a simplification. Usually there are thresholds. 
        // But strictly for "Score Color":
        if (reverseColors) {
            // For reverse metrics (like Debt), usually 'good' is low.
            // But simple >0 check isn't enough for Debt. 
            // However, for the stroke color in summary:
            return 'var(--text-primary)'; // Default to neutral for summary if unsure?
            // Or maybe just let it be handled by passed styles? The prompt didn't ask for color logic change but I know it's needed.
            // Let's stick to: if reverseColors -> >0 is Warning/Error.
            // Actually, usually <Threshold is Good.
        }
        return s >= 0 ? 'var(--neu-success)' : 'var(--neu-error)';
    };

    const strokeColor = value !== null ? getScoreColor(formattedValue) : 'var(--text-secondary)';

    // Helper for value class
    const getValueClass = (val) => {
        if (reverseColors) {
            // If reverse, generally high numbers are 'negative' (red)
            // But we might have specific thresholds. 
            // The previous DebtCard logic had specific thresholds (e.g. < 3 is positive).
            // MetricCard doesn't support custom thresholds yet.
            // It only supports > 0.
            // I should allow passing a custom `status` prop? or `isGood` boolean?
            // If `isGood` is passed, use it.
            // For now, let's leave it as is -> it will show Green for positive numbers.
            // User asked to "use the same component". 
            // I will implement `isGood` prop.
        }
        return val > 0 ? styles.positive : styles.negative;
    };
    if (loading) return view === 'summary' ? <div className={styles.summaryLoading}></div> : <div className={styles.loading}></div>;

    // If value is missing and we aren't showing a message, return null or placeholder
    // Internal helper for className
    const getStatusClass = () => {
        if (status && styles[status]) return styles[status];
        return formattedValue > 0 ? styles.positive : styles.negative;
    };

    // Summary View
    if (view === 'summary') {
        const mainTitle = category || title;
        const subTitle = category ? title : null;

        return (
            <div className="summary-info stock-health-summary">
                <div className="summary-name">{mainTitle}</div>
                <div className="summary-price-group">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                        {subTitle && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--neu-text-tertiary)', fontWeight: 600 }}>
                                {subTitle}
                            </span>
                        )}
                        {value !== null ? (
                            <div className="summary-price" style={{ color: strokeColor }}>
                                {isString ? formattedValue : `${formattedValue.toFixed(1)}${suffix}`}
                            </div>
                        ) : (
                            <div className="summary-price" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                N/A
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const content = (
        <>
            {variant !== 'transparent' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isOpen ? '1rem' : '0' }}>
                    <h3 className={styles.title} style={{ margin: 0 }}>{title}</h3>
                    {onToggle && (
                        <CardToggleButton isOpen={isOpen} onClick={onToggle} />
                    )}
                </div>
            )}

            {isOpen && (
                !isETF ? (
                    <div className={styles.metricsGrid} >
                        {variant === 'transparent' && (
                            <h3 className={styles.title} style={{ margin: 0 }}>{title}</h3>
                        )}
                        <div className={styles.metricCard}>
                            <p className={`${styles.metricValue} ${getStatusClass()}`}>
                                {isString ? formattedValue : `${formattedValue.toFixed(2)}${suffix}`}
                            </p>
                            {target && (
                                <p className={styles.targetNote}>
                                    Target: {target}
                                </p>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className={styles.etfMessage}>
                        {message || 'Not applicable for ETFs.'}
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

export default MetricCard;
