import React from 'react';
import { ChevronDown, ChevronUp, RefreshCcw } from 'lucide-react';
import CardToggleButton from '../CardToggleButton/CardToggleButton';
import MetricCard from '../../ui/MetricCard/MetricCard';
import { useStockData } from '../../../hooks/useStockData';
import styles from './DebtCard.module.css';
import ExpandableCard from '../../ui/ExpandableCard/ExpandableCard';

const DebtCard = ({
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

    const { debt } = stockData;
    if (!debt) return null;

    const d2eColor = debt?.debtToEbitda != null && debt.debtToEbitda < 3 ? 'var(--neu-success)' : 'var(--neu-warning)';
    const dsrColor = debt?.debtServicingRatio != null && debt.debtServicingRatio < 30 ? 'var(--neu-success)' : 'var(--neu-warning)';
    const crColor = (debt?.currentRatio || 0) > 1.5 ? 'var(--neu-success)' : 'var(--neu-error)';

    const header = (
        <div className="summary-info">
            <div className="summary-name">Conservative Debt</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: '0.25rem', columnGap: '1rem', width: '100%', fontSize: '0.8rem', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Debt/EBITDA</span>
                <span style={{ color: d2eColor, fontWeight: 600, textAlign: 'right' }}>
                    {debt.debtToEbitda != null ? `${debt.debtToEbitda.toFixed(1)}x` : 'N/A'}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>Debt Svc</span>
                <span style={{ color: dsrColor, fontWeight: 600, textAlign: 'right' }}>
                    {debt.debtServicingRatio != null ? `${debt.debtServicingRatio.toFixed(1)}%` : 'N/A'}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>Curr Ratio</span>
                <span style={{ color: crColor, fontWeight: 600, textAlign: 'right' }}>
                    {debt.currentRatio != null ? debt.currentRatio.toFixed(2) : 'N/A'}
                </span>
            </div>
        </div>
    );

    const menuItems = [];

    return (
        <ExpandableCard
            title="Conservative Debt"
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


                {(stockData.overview.quoteType !== 'ETF' && stockData.overview.industry !== 'ETF') ? (
                    <div className={styles.metricsContainer}>
                        <MetricCard
                            title="Debt / EBITDA Ratio"
                            value={debt.debtToEbitda}
                            target="< 3x"
                            variant="transparent"
                            isOpen={true}
                            suffix="x"
                            multiplier={1}
                            status={debt.debtToEbitda != null && debt.debtToEbitda < 3 ? 'positive' : 'negative'}
                        />

                        <MetricCard
                            title="Debt Servicing Ratio"
                            value={debt.debtServicingRatio}
                            target="< 30%"
                            variant="transparent"
                            isOpen={true}
                            suffix="%"
                            multiplier={1}
                            status={debt.debtServicingRatio != null && debt.debtServicingRatio < 30 ? 'positive' : 'warning'}
                        />

                        <MetricCard
                            title="Current Ratio"
                            value={debt.currentRatio}
                            target="> 1.5"
                            variant="transparent"
                            isOpen={true}
                            suffix=""
                            multiplier={1}
                            status={debt.currentRatio > 1.5 ? 'positive' : 'negative'}
                        />

                        {debt.isREIT && (
                            <MetricCard
                                title="Gearing Ratio (MRQ)"
                                value={debt.gearingRatio}
                                target="< 45%"
                                variant="transparent"
                                isOpen={true}
                                suffix="%"
                                multiplier={1}
                                status={debt.gearingRatio != null && debt.gearingRatio < 45 ? 'positive' : 'negative'}
                            />
                        )}
                    </div>
                ) : (
                    <div className={styles.etfMessage}>
                        This is an ETF and Conservative Debt is not applicable.
                    </div>
                )}
            </div>
        </ExpandableCard>
    );
};

export default DebtCard;
