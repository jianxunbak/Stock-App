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
    variant = 'default'
}) => {
    const { stockData, loading, loadStockData } = useStockData();

    if (loading && !stockData) return <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
    if (!stockData) return null;

    const { support_resistance } = stockData;
    const majorLevel = support_resistance?.levels?.[0];
    const currentPrice = stockData?.overview?.price || 0;
    const isHit = majorLevel && Number(currentPrice) <= Number(majorLevel.price);

    const header = (
        <div className="summary-info">
            <div className="summary-name" style={{ color: 'var(--neu-text-primary)' }}>Support Level</div>
            <div className="summary-price" style={{ color: isHit ? 'var(--neu-success)' : 'var(--neu-error)' }}>
                {majorLevel ? `${currencySymbol}${(majorLevel.price * currentRate).toFixed(0)}` : 'N/A'}
            </div>
            <div className="summary-change" style={{ color: isHit ? 'var(--neu-success)' : 'var(--neu-error)' }}>
                Action: {isHit ? 'BUY' : 'HOLD'}
            </div>
        </div>
    );

    const hasData = support_resistance && support_resistance.levels && support_resistance.levels.length > 0;
    const levels = hasData ? support_resistance.levels : [];

    const menuItems = [];

    return (
        <ExpandableCard
            title="Support & Resistance"
            expanded={isOpen}
            onToggle={onToggle}
            onHide={onHide}
            collapsedWidth={220}
            collapsedHeight={220}
            headerContent={header}
            className={className}
            menuItems={menuItems}
            onRefresh={() => stockData?.overview?.symbol && loadStockData(stockData.overview.symbol, true)}
        >
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
        </ExpandableCard>
    );
};

export default SupportResistanceCard;
