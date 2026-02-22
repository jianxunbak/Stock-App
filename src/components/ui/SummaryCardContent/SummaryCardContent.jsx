import React from 'react';
import styles from './SummaryCardContent.module.css';

/**
 * SummaryCardContent
 * 
 * A unified component for all analysis card collapsed headers.
 * Ensures consistent layout, font sizes, and height across different modules.
 * 
 * @param {Array} mainMetrics - [{ label, value, color, suffix }]
 * @param {Array} gridMetrics - [{ label, icon, color }]
 * @param {string} height - Container height
 */
const SummaryCardContent = ({
    mainMetrics = [],
    gridMetrics = [],
    height = '100%',
    className = ''
}) => {
    const isCentered = false; // Always top-aligned for grid consistency

    return (
        <div
            className={`${styles.container} ${className}`}
            style={{
                height,
                justifyContent: 'flex-start'
            }}
        >
            {/* Top Section: Large Primary Metrics */}
            <div
                className={styles.mainMetricsRow}
            >
                {mainMetrics.map((m, i) => (
                    <div key={i} className={styles.mainMetric}>
                        <span className={styles.label}>{m.label}</span>
                        <span className={styles.value} style={{ color: m.color || 'var(--neu-text-primary)' }}>
                            {m.value}{m.suffix || ''}
                        </span>
                    </div>
                ))}
            </div>

            {/* Bottom Section: Trend Grid (Always render for consistent horizontal line) */}
            <div className={styles.grid}>
                {gridMetrics.map((m, i) => (
                    <div key={i} className={styles.gridItem}>
                        {m.icon && (
                            <span className={styles.gridIcon} style={{ color: m.color || 'var(--neu-text-tertiary)' }}>
                                {m.icon}
                            </span>
                        )}
                        <span className={styles.gridLabel}>{m.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SummaryCardContent;
