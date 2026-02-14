import React from 'react';
import Window from '../Window/Window';
import styles from './StockInfoModal.module.css';

const StockInfoModal = ({ isOpen, onClose, stockData, currencySymbol = '$', currentRate = 1 }) => {
    if (!stockData) return null;

    const { overview, score, history, calendar } = stockData;
    if (!overview) return null;

    const infoGroups = [
        { label: 'Beta', value: overview.beta?.toFixed(2) || 'N/A' },
        { label: 'PEG Ratio', value: overview.pegRatio?.toFixed(2) || 'N/A' },
        { label: 'Market Cap', value: `${currencySymbol}${((overview.marketCap * currentRate) / 1e9).toFixed(2)}B` },
        { label: 'Shares Out.', value: stockData.sharesOutstanding ? (stockData.sharesOutstanding / 1e9).toFixed(2) + 'B' : 'N/A' },
        { label: 'Sector', value: overview.sector || 'N/A' },
        { label: 'Industry', value: overview.industry || 'N/A' },
        { label: 'CEO', value: overview.ceo || 'N/A' },
    ];

    return (
        <Window
            isOpen={isOpen}
            onClose={onClose}
            title={`${overview.name} (${overview.symbol}) Information`}
            width="650px"
            height="85vh"
            headerAlign="start"
        >
            <div className={styles.container}>
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Company Overview</h3>
                    <p className={styles.description}>{overview.description}</p>
                </div>

                <div className={styles.infoGrid}>
                    {infoGroups.map((item, idx) => (
                        <div key={idx} className={styles.infoCard}>
                            <span className={styles.infoLabel}>{item.label}</span>
                            <span className={styles.infoValue}>{item.value}</span>
                        </div>
                    ))}
                </div>

                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Earnings & Revenues</h3>
                    {calendar && Object.keys(calendar).length > 0 ? (
                        <div className={styles.calendarGrid}>
                            {Object.entries(calendar).map(([key, value]) => (
                                <div key={key} className={styles.calendarItem}>
                                    <span className={styles.calendarKey}>{key}:</span>
                                    <span className={styles.calendarValue}>
                                        {Array.isArray(value) ? value.join(", ") : String(value)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className={styles.noData}>No specific earnings data available.</p>
                    )}
                </div>
            </div>
        </Window>
    );
};

export default StockInfoModal;
