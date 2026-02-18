import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useStockData } from '../../../hooks/useStockData';
import FinancialPerformanceCard from '../../ui/FinancialPerformanceCard/FinancialPerformanceCard';
import MarginTrendsCard from '../../ui/MarginTrendsCard/MarginTrendsCard';
import ExpandableCard from '../../ui/ExpandableCard/ExpandableCard';
import FinancialSummary from '../../ui/FinancialSummary/FinancialSummary';
import styles from './GrowthCard.module.css';

const GrowthCard = ({
    isOpen = true,
    onToggle = null,
    className,
    variant = 'default',
    isETF = false,
    onHide = null,
    loading: parentLoading = false,
    ...props
}) => {
    const { stockData, loading: stockLoading, loadStockData } = useStockData();
    const isLoading = parentLoading || stockLoading;

    const { growth } = stockData || {};
    const revenueGrowth = growth?.revenueGrowth || 0;
    const formattedValue = (revenueGrowth * 100).toFixed(1) + '%';
    const color = revenueGrowth > 0.15 ? 'var(--neu-success)' : (revenueGrowth < 0 ? 'var(--neu-error)' : 'var(--neu-warning)');

    const summaryContent = (
        <div className="summary-info">
            <div className="summary-name">Growth</div>
            <div className="summary-price" style={{ color: color }}>{formattedValue}</div>
        </div>
    );

    const menuItems = [];

    return (
        <ExpandableCard
            title="Growth"
            expanded={isOpen}
            onToggle={onToggle}
            onHide={onHide}
            collapsedWidth={220}
            collapsedHeight={220}
            loading={isLoading}
            headerContent={stockData ? summaryContent : null}

            className={className}
            menuItems={menuItems}
            onRefresh={() => stockData?.overview?.symbol && loadStockData(stockData.overview.symbol, true)}
        >
            {stockData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Main Title removed as it's now handled by ExpandableCard */}


                    {/* Revenue Growth Metric Section */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isOpen ? '0.25rem' : '0' }}>
                            <h3 className={styles.subTitle}>Revenue Growth</h3>
                        </div>

                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: color }}>
                            {formattedValue}
                        </div>
                    </div>

                    {/* Financial Trends Chart */}
                    <FinancialPerformanceCard
                        view="expanded"
                        variant="transparent"
                        isOpen={true}
                        isETF={isETF}
                        {...props}
                    />

                    {/* Margin Trends Chart */}
                    <MarginTrendsCard
                        view="expanded"
                        variant="transparent"
                        isOpen={true}
                        isETF={isETF}
                        {...props}
                    />
                </div>
            )}
        </ExpandableCard>
    );
};

export default GrowthCard;
