import React from 'react';
import { useStockData } from '../../hooks/useStockData';
import styles from './ValuationCard.module.css';

const ValuationCard = ({ currency = 'USD', currencySymbol = '$', currentRate = 1 }) => {
    const { stockData, loading } = useStockData();

    if (loading) return <div className={styles.loading}></div>;
    if (!stockData) return null;

    const { valuation, overview } = stockData;
    const isETF = stockData?.overview?.quoteType === 'ETF' || stockData?.overview?.industry === 'ETF';

    if (!valuation && !isETF) return null;

    return (
        <div className={styles.card}>
            {/* <LiquidGlassBackground /> */}
            <h3 className={styles.title}>Intrinsic Value</h3>
            {isETF ? (
                <div className={styles.etfMessage}>
                    This is an ETF and Intrinsic Value is not applicable.
                </div>
            ) : (
                <>
                    <div className={styles.section}>
                        <div className={styles.valueRow}>
                            <div className={styles.valuationContainer}>
                                <h4 className={styles.valuationLabel}>Current Price</h4>
                                <p className={`${styles.priceValue} ${overview?.price <= valuation.intrinsicValue ? styles.positive : styles.negative}`}>{currencySymbol}{(overview?.price * currentRate)?.toFixed(2)}</p>
                            </div>
                            <div className={styles.valuationContainer}>
                                <h4 className={styles.valuationLabel}>Intrinsic Value</h4>
                                <p className={styles.intrinsicValue}>{currencySymbol}{valuation.intrinsicValue ? (valuation.intrinsicValue * currentRate).toFixed(2) : 'N/A'}</p>
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
                                            "Sales Per Share (TTM)",
                                            "Current Book Value Per Share",
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
                                    .filter(([key, value]) => {
                                        // Always hide "Growth Note"
                                        if (key === "Growth Note") {
                                            return false;
                                        }
                                        return true;
                                    })
                                    .map(([key, value]) => {
                                        let displayValue = value;
                                        const trimmedKey = key.trim();
                                        const monetaryKeywords = ["Income", "Cash Flow", "Debt", "Cash", "Sales", "Book Value"];
                                        const isMonetary = monetaryKeywords.some(keyword => trimmedKey.includes(keyword));
                                        const raw = valuation.raw_assumptions || {};

                                        if (isMonetary) {
                                            let numericValue = undefined;

                                            if (trimmedKey.includes("Operating Cash Flow") || trimmedKey.includes("Net Income") || trimmedKey.includes("Free Cash Flow")) {
                                                numericValue = raw.base_value;
                                            } else if (trimmedKey.includes("Total Debt")) {
                                                numericValue = raw.total_debt;
                                            } else if (trimmedKey.includes("Cash & Equivalents") || (trimmedKey.includes("Cash") && !trimmedKey.includes("Flow"))) {
                                                numericValue = raw.cash_and_equivalents;
                                            } else if (trimmedKey.includes("Sales Per Share")) {
                                                numericValue = raw.sales_per_share;
                                            } else if (trimmedKey.includes("Book Value")) {
                                                numericValue = raw.book_value;
                                            }

                                            // Fallback: Parse from string if raw data is missing or zero while the string is not
                                            const stringHasValue = value && value !== "N/A" && /[0-9]/.test(value);
                                            if (stringHasValue && (numericValue === undefined || numericValue === null || (numericValue === 0 && !value.includes("0.00")))) {
                                                try {
                                                    // Extract number from string like "$123.45B" or "$10.50"
                                                    const cleanStr = value.replace(/[$,B%]/g, '').trim();
                                                    const parsed = parseFloat(cleanStr);
                                                    if (!isNaN(parsed)) {
                                                        // If it had a 'B', it's in billions in the string
                                                        if (value.toUpperCase().includes('B')) {
                                                            numericValue = parsed * 1e9;
                                                        } else {
                                                            numericValue = parsed;
                                                        }
                                                    }
                                                } catch (e) {
                                                    console.error("Error parsing assumption value:", e);
                                                }
                                            }

                                            // Apply conversion if we have valid numeric data
                                            if (numericValue !== undefined && numericValue !== null && !isNaN(numericValue)) {
                                                const converted = numericValue * currentRate;
                                                const isPerShare = trimmedKey.includes("Per Share");

                                                if (isPerShare) {
                                                    displayValue = `${currencySymbol}${converted.toFixed(2)}`;
                                                } else {
                                                    // Billions format
                                                    displayValue = `${currencySymbol}${(converted / 1e9).toFixed(2)}B`;
                                                }
                                            }
                                        }

                                        return (
                                            <div key={key} className={styles.assumptionRow}>
                                                <span className={styles.assumptionKey}>{key}</span>
                                                <span className={styles.assumptionValue}>{displayValue}</span>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>


                    </div>
                </>
            )}

        </div>
    );
};

export default ValuationCard;
