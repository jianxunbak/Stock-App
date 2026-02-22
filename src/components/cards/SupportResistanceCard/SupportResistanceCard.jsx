import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import CardToggleButton from '../CardToggleButton/CardToggleButton';
import { useStockData } from '../../../hooks/useStockData';
import styles from './SupportResistanceCard.module.css';
import ExpandableCard from '../../ui/ExpandableCard/ExpandableCard';
import SummaryCardContent from '../../ui/SummaryCardContent/SummaryCardContent';

const SupportResistanceCard = ({
    currency = 'USD',
    currencySymbol = '$',
    currentRate = 1,
    isOpen = true,
    onToggle = null,
    onHide = null,
    className = "",
    variant = 'default',
    loading: parentLoading = false,
    collapsedHeight = 198
}) => {
    const { stockData, loading: stockLoading, loadStockData } = useStockData();
    const isLoading = parentLoading || stockLoading;

    const levels = stockData?.support_resistance?.levels || [];
    const hasData = levels.length > 0;
    const currentPrice = stockData?.overview?.price;

    const header = (
        <SummaryCardContent
            mainMetrics={hasData ? [
                {
                    label: 'Primary Level',
                    value: (levels[0].price * currentRate).toFixed(2),
                    suffix: '',
                    color: Number(currentPrice) <= Number(levels[0].price) ? 'var(--neu-success)' : 'var(--neu-error)'
                },
                {
                    label: 'Action',
                    value: Number(currentPrice) <= Number(levels[0].price) ? 'BUY' : 'HOLD',
                    color: Number(currentPrice) <= Number(levels[0].price) ? 'var(--neu-success)' : 'var(--neu-error)'
                }
            ] : [
                { label: 'Levels', value: 'N/A', color: 'var(--neu-text-tertiary)' }
            ]}
            gridMetrics={hasData ? levels.slice(1, 4).map(level => ({
                label: (level.price * currentRate).toFixed(2),
                icon: level.score >= 6 ? '★' : null,
                color: Number(currentPrice) <= Number(level.price) ? 'var(--neu-success)' : 'var(--neu-error)'
            })) : []}
        />
    );

    const menuItems = [];

    return (
        <ExpandableCard
            title="Support & Resistance"
            expanded={isOpen}
            onToggle={onToggle}
            onHide={onHide}
            collapsedWidth={220}
            collapsedHeight={collapsedHeight}
            loading={isLoading}
            headerContent={stockData ? header : null}

            className={className}
            menuItems={menuItems}
            onRefresh={() => stockData?.overview?.symbol && loadStockData(stockData.overview.symbol, true)}
        >
            {stockData && (
                <div>
                    {/* Internal title removed as it's now handled by ExpandableCard */}


                    {hasData ? (
                        <div className={styles.listContainer}>
                            {levels.map((level, index) => {
                                const convertedLevelPrice = level.price * currentRate;
                                const isLevelHit = Number(currentPrice) <= Number(level.price);
                                let actionText = "Hold";

                                if (isLevelHit) {
                                    actionText = "Buy";
                                }

                                return (
                                    <div key={index} className={styles.supportRow}>
                                        <div className={styles.leftCol}>
                                            <span className={`${styles.price} ${isLevelHit ? styles.textGreen : styles.textRed}`}>
                                                {currencySymbol}{convertedLevelPrice.toFixed(2)}
                                            </span>
                                            {level.score >= 6 && (
                                                <span className={styles.strongLabel}>★</span>
                                            )}
                                        </div>
                                        <div className={styles.rightCol}>
                                            <span className={`${styles.actionText} ${isLevelHit ? styles.textGreen : styles.textRed}`}>
                                                {actionText}
                                            </span>
                                            <span className={styles.reasonText}>
                                                {level.reason}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className={styles.noDataText}>Insufficient data to determine support levels.</p>
                    )}
                </div>
            )}
        </ExpandableCard>
    );
};

export default SupportResistanceCard;
