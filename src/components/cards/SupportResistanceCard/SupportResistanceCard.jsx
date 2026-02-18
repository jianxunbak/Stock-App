import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import CardToggleButton from '../CardToggleButton/CardToggleButton';
import { useStockData } from '../../../hooks/useStockData';
import styles from './SupportResistanceCard.module.css';
import ExpandableCard from '../../ui/ExpandableCard/ExpandableCard';

const SupportResistanceCard = ({
    currency = 'USD',
    currencySymbol = '$',
    currentRate = 1,
    isOpen = true,
    onToggle = null,
    onHide = null,
    className = "",
    variant = 'default',
    loading: parentLoading = false
}) => {
    const { stockData, loading: stockLoading, loadStockData } = useStockData();
    const isLoading = parentLoading || stockLoading;

    const levels = stockData?.support_resistance?.levels || [];
    const hasData = levels.length > 0;
    const currentPrice = stockData?.overview?.price;

    const header = (
        <div className="summary-info">
            <div className="summary-name">Support & Resistance</div>
            {hasData ? (
                <div className="summary-price" style={{ color: 'var(--neu-success)' }}>
                    {levels.length} Levels
                </div>
            ) : (
                <div className="summary-price" style={{ color: 'var(--neu-text-tertiary)' }}>N/A</div>
            )}
        </div>
    );

    const menuItems = [];

    return (
        <ExpandableCard
            title="Support & Resistance"
            expanded={isOpen}
            onToggle={onToggle}
            onHide={onHide}
            collapsedWidth={220}
            collapsedHeight={220}
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
