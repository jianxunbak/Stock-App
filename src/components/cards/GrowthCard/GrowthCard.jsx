import React from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useStockData } from '../../../hooks/useStockData';
import FinancialPerformanceCard from '../../ui/FinancialPerformanceCard/FinancialPerformanceCard';
import MarginTrendsCard from '../../ui/MarginTrendsCard/MarginTrendsCard';
import ExpandableCard from '../../ui/ExpandableCard/ExpandableCard';
import FinancialSummary from '../../ui/FinancialSummary/FinancialSummary';
import SummaryCardContent from '../../ui/SummaryCardContent/SummaryCardContent';
import styles from './GrowthCard.module.css';

const GrowthCard = ({
    isOpen = true,
    onToggle = null,
    className,
    variant = 'default',
    isETF = false,
    onHide = null,
    loading: parentLoading = false,
    collapsedHeight = 198,
    ...props
}) => {
    const { stockData, loading: stockLoading, loadStockData } = useStockData();
    const isLoading = parentLoading || stockLoading;

    const { growth, financials, profitability } = stockData || {};

    // Fallback for revenue growth if 0
    let revenueGrowth = growth?.revenueGrowth || 0;
    const isInvalidGrowth = Math.abs(revenueGrowth) < 0.001 || !Number.isFinite(revenueGrowth) || Math.abs(revenueGrowth + 1) < 0.001;
    if (isInvalidGrowth && financials?.income_statement?.metrics) {
        // Try to calculate from revenue
        const revenueMetric = financials.income_statement.metrics.find(m => m.name.toLowerCase().includes('revenue') || m.name.toLowerCase().includes('sales'));

        if (revenueMetric && revenueMetric.values.length >= 2) {
            // values structure is usually [TTM, Year0, Year1, Year2, ...]

            // We prioritize "Latest Valid Annual vs Previous Annual"
            // Skip TTM (index 0)
            const annuals = revenueMetric.values.slice(1);
            let found = false;

            for (let i = 0; i < annuals.length - 1; i++) {
                const curr = annuals[i];
                const prev = annuals[i + 1];

                // Ensure both current and previous years have valid non-zero data
                if (curr > 0 && prev > 0) {
                    revenueGrowth = (curr - prev) / prev;
                    found = true;
                    break;
                }
            }

            // Fallback: TTM vs Latest Annual
            if (!found && revenueMetric.values[0] > 0) {
                const firstValidAnnual = annuals.find(v => v > 0);
                if (firstValidAnnual > 0) {
                    revenueGrowth = (revenueMetric.values[0] - firstValidAnnual) / firstValidAnnual;
                }
            }
        }
    }

    const formattedValue = Number.isFinite(revenueGrowth) ? (revenueGrowth * 100).toFixed(1) + '%' : 'N/A';
    const color = revenueGrowth > 0.15 ? 'var(--neu-success)' : (revenueGrowth < 0 ? 'var(--neu-error)' : '#facc15');

    // Helper to determine trend
    const getTrend = (dataArray) => {
        if (!dataArray || dataArray.length < 2) return { icon: <div style={{ width: 14 }} />, color: 'var(--neu-text-tertiary)' };

        const validValues = dataArray.filter(v => v !== null && v !== undefined).slice(0, 5); // Look at last 5 years
        if (validValues.length < 2) return { icon: <div style={{ width: 14 }} />, color: 'var(--neu-text-tertiary)' };

        const first = validValues[0];
        const last = validValues[validValues.length - 1]; // Oldest in slice

        if (first > last * 1.05) return { icon: <TrendingUp size={14} />, color: 'var(--neu-success)' };
        if (first < last * 0.95) return { icon: <TrendingDown size={14} />, color: 'var(--neu-error)' };
        return { icon: <Minus size={14} />, color: 'var(--neu-warning)' }; // Flat/Yellow for margins usually means stable which is ok, but minus icon is good
    };

    // Prepare trend data
    // Revenue
    const revData = financials?.income_statement?.metrics?.find(m => m.name.toLowerCase().includes('revenue'))?.values || [];
    const revTrend = getTrend(revData);

    // Net Income
    const netIncData = financials?.income_statement?.metrics?.find(m => m.name.toLowerCase().includes('net income'))?.values || [];
    const netIncTrend = getTrend(netIncData);

    // Operating Income
    const opIncData = financials?.income_statement?.metrics?.find(m => m.name.toLowerCase().includes('operating income'))?.values || [];
    const opIncTrend = getTrend(opIncData);

    // Operating Cash Flow
    const ocfData = financials?.cash_flow?.metrics?.find(m => m.name.toLowerCase().includes('operating cash flow'))?.values || [];
    const ocfTrend = getTrend(ocfData);

    // Gross Margin (calculate if needed)
    // financial tables usually have values, not margins. We might need to compute or check profitability history
    // We try to calc ratio history from income statement if possible.

    let grossMarginData = [];
    if (revData.length > 0) {
        // Find Cost of Revenue
        const cogsData = financials?.income_statement?.metrics?.find(m => m.name.toLowerCase().includes('cost of') || m.name.toLowerCase().includes('cogs'))?.values;
        if (cogsData) {
            grossMarginData = revData.map((r, i) => {
                const c = cogsData[i];
                if (r === 0 || c === undefined) return null;
                return (r - c) / r;
            });
        }
    }
    const gmTrend = getTrend(grossMarginData);

    // Net Margin
    let netMarginData = [];
    if (revData.length > 0 && netIncData.length > 0) {
        netMarginData = revData.map((r, i) => {
            const n = netIncData[i];
            if (r === 0 || n === undefined) return null;
            return n / r;
        });
    }
    const nmTrend = getTrend(netMarginData);


    const summaryContent = (
        <SummaryCardContent
            mainMetrics={[
                { label: 'Rev Growth', value: formattedValue, color: color }
            ]}
            gridMetrics={[
                { label: 'Revenue', icon: revTrend.icon, color: revTrend.color },
                { label: 'Net Income', icon: netIncTrend.icon, color: netIncTrend.color },
                { label: 'Op Cash Flow', icon: ocfTrend.icon, color: ocfTrend.color },
                { label: 'Op Income', icon: opIncTrend.icon, color: opIncTrend.color },
                { label: 'Gross Margin', icon: gmTrend.icon, color: gmTrend.color },
                { label: 'Net Margin', icon: nmTrend.icon, color: nmTrend.color }
            ]}
        />
    );

    const menuItems = [];

    return (
        <ExpandableCard
            title="Growth"
            expanded={isOpen}
            onToggle={onToggle}
            onHide={onHide}
            collapsedWidth={220}
            collapsedHeight={collapsedHeight}
            loading={isLoading}
            headerContent={stockData ? summaryContent : null}
            className={className}
            menuItems={menuItems}
            onRefresh={() => stockData?.overview?.symbol && loadStockData(stockData.overview.symbol, true)}
        >
            {stockData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
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
