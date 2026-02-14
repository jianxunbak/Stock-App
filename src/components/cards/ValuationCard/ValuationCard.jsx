import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, Info, Activity, TrendingUp, DollarSign, Book, BarChart2, ShieldCheck } from 'lucide-react';
import { useStockData } from '../../../hooks/useStockData';
import styles from './ValuationCard.module.css';
import CardToggleButton from '../CardToggleButton/CardToggleButton';
import MetricCard from '../../ui/MetricCard/MetricCard';
import ExpandableCard from '../../ui/ExpandableCard/ExpandableCard';
import DropdownButton from '../../ui/DropdownButton/DropdownButton';
import Button from '../../ui/Button/Button';

const ValuationCard = ({
    currency = 'USD',
    currencySymbol = '$',
    currentRate = 1,
    isOpen = true,
    onToggle = null,
    className = "",
    variant = 'default',
    ...props
}) => {
    const { stockData, loading, loadStockData } = useStockData();
    const [selectedMethodName, setSelectedMethodName] = useState(null);

    // Sync selected method when stockData changes
    useEffect(() => {
        if (stockData?.valuation?.recommendedMethod) {
            setSelectedMethodName(stockData.valuation.recommendedMethod);
        }
    }, [stockData?.overview?.symbol, stockData?.valuation?.recommendedMethod]);

    const { valuation, overview } = stockData || {};
    const isETF = stockData?.overview?.quoteType === 'ETF' || stockData?.overview?.industry === 'ETF';

    // Determine current valuation data based on selection
    const currentValuation = useMemo(() => {
        if (!valuation) return null;
        if (!selectedMethodName || !valuation.allMethods) return valuation;

        const methodData = valuation.allMethods.find(m => m.method === selectedMethodName);
        if (!methodData) return valuation;

        // Re-calculate difference and status if switching method
        const diff_percent = methodData.intrinsicValue > 0 ? ((overview?.price / methodData.intrinsicValue) - 1) : 0;
        let status = "Fairly Valued";
        if (diff_percent > 0.15) status = "Overvalued";
        else if (diff_percent < -0.15) status = "Undervalued";

        return {
            ...valuation,
            ...methodData,
            differencePercent: diff_percent,
            status: status
        };
    }, [valuation, selectedMethodName, overview?.price]);

    // Diagnostic log to investigate why allMethods might be missing
    useEffect(() => {
        if (valuation && !valuation.allMethods) {
            console.warn("Valuation data received without allMethods. Current valuation:", valuation);
        }
    }, [valuation]);

    if (loading && !stockData) return <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
    if (!stockData) return null;
    if (!valuation && !isETF) return null;

    // Updated color logic based on percentage difference
    const diff = currentValuation?.differencePercent || 0;
    const statusColor = diff > 0.05 ? 'var(--neu-error)' : (diff < -0.05 ? 'var(--neu-success)' : 'var(--neu-warning)');
    const statusType = diff > 0.05 ? 'negative' : (diff < -0.05 ? 'positive' : 'warning');

    const header = (
        <div className="summary-info">
            {isETF ? (
                <>
                    <div className="summary-name">Valuation</div>
                    <div className="summary-price" style={{ color: 'var(--neu-text-tertiary)' }}>N/A</div>
                </>
            ) : (
                <>
                    <div className="summary-name" style={{ color: 'var(--neu-text-primary)' }}>Intrinsic Value</div>
                    <div className="summary-price" style={{ color: statusColor }}>
                        {currencySymbol}{(currentValuation.intrinsicValue * currentRate)?.toFixed(2)}
                    </div>
                    <div className="summary-change" style={{ color: statusColor }}>
                        {currentValuation.status}
                    </div>
                </>
            )}
        </div>
    );

    const activeMethod = selectedMethodName || valuation.recommendedMethod || valuation.method;

    const getMethodIcon = (methodName, size = 14) => {
        if (!methodName) return <Activity size={size} />;
        if (methodName.includes("Free Cash Flow")) return <Activity size={size} />;
        if (methodName.includes("Operating Cash Flow")) return <TrendingUp size={size} />;
        if (methodName.includes("Net Income")) return <DollarSign size={size} />;
        if (methodName.includes("Price-to-Book")) return <Book size={size} />;
        if (methodName.includes("Sales Growth")) return <BarChart2 size={size} />;
        if (methodName.includes("Graham")) return <ShieldCheck size={size} />;
        return <Activity size={size} />;
    };

    const valMenuItems = [];
    if (!isETF) {
        const methods = valuation?.allMethods || [];
        if (methods.length > 0) {
            methods.forEach(m => {
                valMenuItems.push({
                    label: m.method,
                    icon: getMethodIcon(m.method),
                    isActive: activeMethod === m.method,
                    onClick: () => setSelectedMethodName(m.method),
                    indicatorNode: m.method === valuation.recommendedMethod ? <span className={styles.preferredBadge}>Pref</span> : null
                });
            });
        } else {
            valMenuItems.push({
                label: 'Load Methods',
                icon: <Activity size={14} />,
                onClick: () => stockData?.overview?.symbol && loadStockData(stockData.overview.symbol, true)
            });
        }
    }

    return (
        <ExpandableCard
            title="Intrinsic Value"
            expanded={isOpen}
            onToggle={onToggle}
            collapsedWidth={220}
            collapsedHeight={220}
            headerContent={header}
            className={className}
            menuItems={valMenuItems}
            onRefresh={() => stockData?.overview?.symbol && loadStockData(stockData.overview.symbol, true)}
        >
            <div>
                {isETF ? (
                    <div className={styles.etfMessage}>
                        This is an ETF and Intrinsic Value is not applicable.
                    </div>
                ) : (
                    <>
                        <div className={styles.section}>
                            <div className={styles.valueRow}>
                                <MetricCard
                                    title="Current Price"
                                    value={`${currencySymbol}${(overview?.price * currentRate)?.toFixed(2)}`}
                                    variant="transparent"
                                    isOpen={true}
                                    status="neutral"
                                />
                                <MetricCard
                                    title="Intrinsic Value"
                                    value={`${currencySymbol}${currentValuation.intrinsicValue ? (currentValuation.intrinsicValue * currentRate).toFixed(2) : 'N/A'}`}
                                    variant="transparent"
                                    isOpen={true}
                                    status={statusType}
                                />
                                <MetricCard
                                    title="Difference"
                                    value={`${currentValuation.differencePercent ? (currentValuation.differencePercent > 0 ? '+' : '') + (currentValuation.differencePercent * 100).toFixed(2) : '0.00'}%`}
                                    variant="transparent"
                                    isOpen={true}
                                    status={statusType}
                                />
                                <MetricCard
                                    title="Valuation Status"
                                    value={currentValuation.status}
                                    variant="transparent"
                                    isOpen={true}
                                    status={statusType}
                                />
                            </div>
                            {(() => {
                                const diff = currentValuation.differencePercent;
                                let warningMsg = null;
                                if (diff >= 1.0) {
                                    warningMsg = "Price is significant higher than valuation. Extreme risk.";
                                } else if (diff >= 0.5) {
                                    warningMsg = "Price is significantly higher than valuation. Use caution.";
                                }

                                return warningMsg ? (
                                    <div className={styles.warningNote}>
                                        {warningMsg}
                                    </div>
                                ) : null;
                            })()}
                        </div>

                        <div className={styles.metricsContainer}>
                            <div className={styles.section} style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    {getMethodIcon(activeMethod, 16)}
                                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--neu-text-primary)' }}>
                                        {activeMethod}
                                    </span>
                                    {activeMethod === valuation.recommendedMethod && (
                                        <span className={styles.preferredBadge}>Recommended</span>
                                    )}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--neu-text-secondary)', lineHeight: 1.4 }}>
                                    {currentValuation.explanation || "No description available."}
                                </div>
                            </div>

                            <div className={styles.section}>
                                <h4 className={styles.label}>Calculated Assumptions</h4>
                                <div className={styles.assumptionsContainer}>
                                    {currentValuation.assumptions && Object.entries(currentValuation.assumptions)
                                        .map(([key, value]) => {
                                            const trimmedKey = key.trim();
                                            const monetaryKeywords = ["Income", "Cash Flow", "Debt", "Cash", "Sales", "Book Value"];
                                            const isMonetary = monetaryKeywords.some(keyword => trimmedKey.includes(keyword));

                                            let displayValue = value;

                                            if (isMonetary && currentRate !== 1) {
                                                // Simple attempt to parse and convert monetary strings from backend
                                                try {
                                                    const stringHasValue = typeof value === 'string' && value.includes('$');
                                                    if (stringHasValue) {
                                                        const isBillions = value.toUpperCase().includes('B');
                                                        const cleanStr = value.replace(/[$,B]/g, '').trim();
                                                        const parsed = parseFloat(cleanStr);

                                                        if (!isNaN(parsed)) {
                                                            const converted = parsed * currentRate;
                                                            if (isBillions) {
                                                                displayValue = `${currencySymbol}${converted.toFixed(2)}B`;
                                                            } else {
                                                                displayValue = `${currencySymbol}${converted.toFixed(2)}`;
                                                            }
                                                        }
                                                    }
                                                } catch (e) {
                                                    console.warn("Could not convert assumption currency:", e);
                                                }
                                            } else if (isMonetary) {
                                                // Just replace $ with currencySymbol if rate is 1 but symbol is different
                                                displayValue = String(value).replace('$', currencySymbol);
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

                            {activeMethod !== valuation.recommendedMethod && valuation.preferredMethodExplanation && (
                                <div className={styles.preferredFootnote}>
                                    <div className={styles.footnoteHeader}>
                                        <Info size={14} />
                                        Recommended Method: {valuation.recommendedMethod}
                                    </div>
                                    <p style={{ margin: 0 }}>
                                        {valuation.preferredMethodExplanation}
                                    </p>
                                </div>
                            )}

                        </div>
                    </>
                )}
            </div>
        </ExpandableCard >
    );
};

export default ValuationCard;
