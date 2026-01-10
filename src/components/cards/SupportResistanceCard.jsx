import React from 'react';
import { useStockData } from '../../hooks/useStockData';
import styles from './SupportResistanceCard.module.css';

const SupportResistanceCard = ({ currency = 'USD', currencySymbol = '$', currentRate = 1 }) => {
    const { stockData, loading } = useStockData();

    if (loading) return <div className={styles.loading}></div>;
    if (!stockData) return null;

    const { support_resistance } = stockData;

    if (!support_resistance || !support_resistance.levels || support_resistance.levels.length === 0) {
        return (
            <div className={styles.card}>
                {/* <LiquidGlassBackground /> */}
                <h3 className={styles.title}>Major Support Levels</h3>
                <p className={styles.noDataText}>Insufficient data to determine support levels.</p>
            </div>
        );
    }

    const { levels } = support_resistance;

    return (
        <div className={styles.card}>
            {/* <LiquidGlassBackground /> */}
            <h3 className={styles.title}>Support Levels</h3>

            <div className={styles.listContainer}>
                {levels.map((level, index) => {
                    const currentPrice = stockData?.overview?.price || 0;
                    const convertedLevelPrice = level.price * currentRate;
                    const isHit = Number(currentPrice) <= Number(level.price);
                    let actionText = "Hold";
                    let actionClass = styles.actionHold;
                    let note = "";

                    if (isHit) {
                        actionText = "Buy";
                        actionClass = styles.actionBuy;
                    }

                    return (
                        <div key={index} className={styles.supportRow}>
                            <div className={styles.rowHeader}>
                                <span className={`${styles.price} ${isHit ? styles.textGreen : styles.textRed}`}>
                                    {currencySymbol}{convertedLevelPrice.toFixed(2)}
                                </span>
                                <div className={styles.actionWrapper}>
                                    <span className={`${styles.actionBadge} ${actionClass}`}>
                                        {actionText}
                                    </span>
                                    {note && <span className={styles.actionNote}>{note}</span>}
                                </div>
                            </div>

                            <div className={styles.reasonText}>
                                {level.reason}
                                <br></br>
                                {level.score >= 6 && (
                                    <span className={styles.strongLabel}>★ Strong</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div >
    );
};

export default SupportResistanceCard;
