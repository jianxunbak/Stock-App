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
    ...props
}) => {
    const { stockData, loading, loadStockData } = useStockData();

    if (loading && !stockData) return <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
    if (!stockData) return null;

    const { growth } = stockData;
    const revenueGrowth = growth?.revenueGrowth;

    // Helper to format value
    const formattedValue = revenueGrowth !== undefined && revenueGrowth !== null
        ? (revenueGrowth * 100).toFixed(1) + '%'
        : 'N/A';

    // Color logic
    const color = (revenueGrowth > 0) ? 'var(--neu-success)' : 'var(--neu-warning)';

    // Summary View Content
    const summaryContent = (
        <FinancialSummary>
            {/* Revenue Growth Summary */}
            <div className={`summary-info stock-health-summary ${className || ''}`}>
                <div className="summary-name">Growth</div>
                <div className="summary-price-group" style={{ paddingTop: '2.25rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--neu-text-tertiary)', fontWeight: 600 }}>
                            Revenue Growth
                        </span>
                        <div className="summary-price" style={{ color: color }}>
                            {formattedValue}
                        </div>
                    </div>
                </div>
            </div>

            {/* Financial Trends Summary */}
            <FinancialPerformanceCard
                view="summary"
                isETF={isETF}
                {...props}
            />
        </FinancialSummary>
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
            headerContent={summaryContent}
            className={className}
            menuItems={menuItems}
            onRefresh={() => stockData?.overview?.symbol && loadStockData(stockData.overview.symbol, true)}
        >
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
        </ExpandableCard>
    );
};

export default GrowthCard;
