import React from 'react';
import { useStockData } from '../../hooks/useStockData';
import styles from './ValuationCard.module.css';

const ValuationCard = () => {
    const { stockData, loading } = useStockData();

    if (loading) return <div className={styles.loading}></div>;
    if (!stockData) return null;

    const { valuation, overview } = stockData;

    if (!valuation) return null;

    return (
        <div className={styles.card}>
            {/* <LiquidGlassBackground /> */}
            <h3 className={styles.title}>Intrinsic Value</h3>
            <div className={styles.section}>
                <div className={styles.valueRow}>
                    <div className={styles.valuationContainer}>
                        <h4 className={styles.valuationLabel}>Current Price</h4>
                        <p className={`${styles.priceValue} ${overview?.price <= valuation.intrinsicValue ? styles.positive : styles.negative}`}>${overview?.price?.toFixed(2)}</p>
                    </div>
                    <div className={styles.valuationContainer}>
                        <h4 className={styles.valuationLabel}>Intrinsic Value</h4>
                        <p className={styles.intrinsicValue}>${valuation.intrinsicValue ? valuation.intrinsicValue.toFixed(2) : 'N/A'}</p>
                    </div>
                    <div className={styles.valuationContainer}>
                        <h4 className={styles.valuationLabel}>Difference</h4>
                        <p className={`${styles.differenceValue} ${valuation.differencePercent > 0 ? styles.overvalued : styles.undervalued}`}>
                            {valuation.differencePercent ? (valuation.differencePercent > 0 ? '+' : '') + (valuation.differencePercent * 100).toFixed(2) : '0.00'}%
                        </p>
                    </div>
                    <div className={styles.valuationContainer}>
                        <h4 className={styles.valuationLabel}>Valuation</h4>
                        <div className={`${styles.statusBadge} ${valuation.status === 'Undervalued' ? styles.statusUndervalued : valuation.status === 'Overvalued' ? styles.statusOvervalued : styles.statusFair}`}>
                            {valuation.status}
                        </div>
                    </div>

                </div>
                {(() => {
                    const diff = valuation.differencePercent;
                    let warningMsg = null;
                    if (diff >= 1.0) {
                        warningMsg = "Price is too high, consider selling all.";
                    } else if (diff >= 0.8) {
                        warningMsg = "Price is too high, consider selling more.";
                    } else if (diff >= 0.5) {
                        warningMsg = "Price is too high, consider selling some.";
                    }

                    return warningMsg ? (
                        <div className={styles.warningNote}>
                            {warningMsg}
                        </div>
                    ) : null;
                })()}
            </div>
            <div className={styles.metricsContainer}>
                <div className={styles.section}>
                    <h4 className={styles.label}>Method Used</h4>
                    <p className={styles.methodValue}>{valuation.method || 'N/A'}</p>
                </div>

                <div className={styles.section}>
                    <h4 className={styles.label}>Key Assumptions</h4>
                    <div className={styles.assumptionsContainer}>
                        {valuation.assumptions && Object.entries(valuation.assumptions)
                            .sort(([keyA], [keyB]) => {
                                const order = [
                                    "Current Operating Cash Flow",
                                    "Current Net Income",
                                    "Current Free Cash Flow",
                                    "Total Debt",
                                    "Cash & Equivalents",
                                    "Growth Rate (Yr 1-5)",
                                    "Growth Rate (Yr 6-10)",
                                    "Growth Rate (Yr 11-20)",
                                    "Shares Outstanding",
                                    "Discount Rate",
                                    "Beta"
                                ];
                                let indexA = order.indexOf(keyA);
                                let indexB = order.indexOf(keyB);

                                if (indexA === -1) indexA = 999;
                                if (indexB === -1) indexB = 999;

                                return indexA - indexB;
                            })
                            .map(([key, value]) => (
                                <div key={key} className={styles.assumptionRow}>
                                    <span className={styles.assumptionKey}>{key}</span>
                                    <span className={styles.assumptionValue}>{value}</span>
                                </div>
                            ))}
                    </div>
                </div>


            </div>

        </div>
    );
};

export default ValuationCard;
