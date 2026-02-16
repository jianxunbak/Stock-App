import { AlertTriangle, Plus, Edit2, Trash2, Briefcase, ChevronRight, Check, X } from 'lucide-react';
import Button from '../../ui/Button';
import StockHeader from '../../ui/StockHeader/StockHeader';
import ExpandableCard from '../../ui/ExpandableCard/ExpandableCard';
import StockHealthCard from '../../ui/StockHealthCard/StockHealthCard';
import PriceChartCard from '../../ui/PriceChartCard/PriceChartCard';
import './PortfolioSummaryCard.css';

const PortfolioSummaryCard = ({
    portfolioList,
    currentPortfolioId,
    currencySymbol,
    totalValue,
    totalPerformance,
    totalCost,
    healthScore,
    twrData,
    healthCriteria,
    isCriticalRisk,
    mergedChartData,
    comparisonStocks,
    weightedBeta,
    weightedGrowth,
    hhi,
    weightedPeg,
    weightedLiquidity,
    theme,
    openCards,
    toggleCard,
    onAddComparison,
    onRemoveComparison,
    onNewPortfolio,
    onRenamePortfolio,
    onDeletePortfolio,
    onSelectPortfolio,
    onShowDetails,
    isMounted,
    isTestPortfolio = false,
    isRenaming,
    setIsRenaming,
    renameValue,
    setRenameValue,
    onRenameSubmit,
    onHide,
    loading = false
}) => {
    if (!portfolioList || portfolioList.length === 0) {
        return (
            <ExpandableCard
                title="Portfolio"
                loading={loading}
            />
        );
    }


    const currentPortfolioName = portfolioList.find(p => p.id === currentPortfolioId)?.name || 'Portfolio';

    return (
        <ExpandableCard
            title={currentPortfolioName}
            className="portfolio-summary-card"
            expanded={openCards.summary} // Controlled
            defaultExpanded={openCards.summary} // Fallback
            onToggle={(state) => toggleCard('summary')}
            onHide={onHide}
            loading={loading}

            menuItems={[
                { label: 'Select Portfolio', onClick: onSelectPortfolio, indicatorNode: <Briefcase size={14} /> },
                { label: 'New Portfolio', onClick: onNewPortfolio, indicatorNode: <Plus size={14} /> },
                { label: 'Rename Portfolio', onClick: onRenamePortfolio, indicatorNode: <Edit2 size={14} /> },
                { label: 'Delete Portfolio', onClick: onDeletePortfolio, indicatorNode: <Trash2 size={14} />, className: 'danger-item' },
                { label: 'Portfolio Details', onClick: onShowDetails, indicatorNode: <ChevronRight size={14} /> }
            ]}
            headerContent={
                <div className="stock-summary-container stacked">
                    <StockHeader
                        name={currentPortfolioName}
                        ticker="PORTFOLIO"
                        price={totalValue}
                        change={isTestPortfolio ? 0 : (totalValue - totalCost)}
                        changePercent={isTestPortfolio ? 0 : totalPerformance}
                        currencySymbol={currencySymbol}
                        currentRate={1} // totalValue is already converted
                        view="summary"
                        hideChange={isTestPortfolio}
                    />

                    <StockHealthCard
                        score={healthScore}
                        view="summary"
                        type="Health"
                    />

                    {!isTestPortfolio && (
                        <PriceChartCard
                            view="summary"
                            data={twrData?.chart_data?.map(d => ({ date: d.date, price: d.value })) || []}
                            change={totalPerformance >= 0 ? '+1' : '-1'}
                            title="Performance"
                            currentRate={1}
                            currencySymbol=""
                            isPercentageData={true}
                        />
                    )}
                </div>
            }
        >
            {/* Expanded Body: Metrics + Health Detail + Big Chart */}
            <div className="portfolio-details-grid">
                {isRenaming ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            style={{
                                fontSize: '1.5rem',
                                fontWeight: 700,
                                color: 'var(--neu-text-primary)',
                                background: 'transparent',
                                border: 'none',
                                borderBottom: '2px solid var(--neu-brand)',
                                outline: 'none',
                                width: '100%',
                                maxWidth: '300px'
                            }}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') onRenameSubmit();
                                if (e.key === 'Escape') setIsRenaming(false);
                            }}
                        />
                        <Button
                            variant="icon"
                            onClick={onRenameSubmit}
                            style={{ color: 'var(--neu-success)' }}
                            title="Confirm Rename"
                        >
                            <Check size={24} />
                        </Button>
                        <Button
                            variant="icon"
                            onClick={() => setIsRenaming(false)}
                            style={{ color: 'var(--neu-text-secondary)' }}
                            title="Cancel Rename"
                        >
                            <X size={24} />
                        </Button>
                    </div>
                ) : (
                    <StockHeader
                        name={null}
                        ticker={null}
                        price={totalValue}
                        change={isTestPortfolio ? 0 : (totalValue - totalCost)}
                        changePercent={isTestPortfolio ? 0 : totalPerformance}
                        currencySymbol={currencySymbol}
                        currentRate={1}
                        variant="transparent"
                        showFavorite={false}
                        hideChange={isTestPortfolio}
                        className="portfolio-expanded-header"
                    />
                )}

                <div className="health-section-wrapper">
                    {isCriticalRisk && (
                        <div className="critical-risk-banner">
                            <AlertTriangle size={18} />
                            <span>CRITICAL RISK: Structural vulnerabilities detected (High Concentration or Over-Speculation)</span>
                        </div>
                    )}
                    <StockHealthCard
                        score={healthScore}
                        items={healthCriteria?.map(c => ({
                            label: `${c.name}: ${c.value}`,
                            status: c.status === 'Pass' ? 'pass' : (c.status === 'Warning' ? 'warn' : 'fail'),
                        })) || []}
                        type="Portfolio Health"
                        view="expanded"
                        variant="transparent"
                    />
                </div>

                {/* Big Performance Chart */}
                {!isTestPortfolio && (
                    <div style={{ marginTop: '1rem', width: '100%' }}>
                        {isMounted && (
                            <PriceChartCard
                                view="expanded"
                                title="Portfolio Performance"
                                ticker="Portfolio"
                                isManual={true}
                                manualSeries={[
                                    { id: 'main', name: 'My Portfolio', dataKey: 'price_main', color: totalPerformance >= 0 ? 'var(--neu-success)' : 'var(--neu-error)' },
                                    ...(comparisonStocks?.map(s => {
                                        const t = typeof s === 'string' ? s : s.ticker;
                                        const col = typeof s === 'string' ? 'var(--neu-color-favorite)' : s.color;
                                        return {
                                            id: t,
                                            name: t,
                                            dataKey: `val_${t}`,
                                            color: col,
                                            strokeDasharray: null
                                        };
                                    }) || [])
                                ]}
                                manualChartData={mergedChartData.map(d => ({
                                    date: d.date,
                                    price_main: d.value,
                                    ...(comparisonStocks?.reduce((acc, s) => {
                                        const t = typeof s === 'string' ? s : s.ticker;
                                        return {
                                            ...acc,
                                            [`val_${t}`]: d[`val_${t}`]
                                        };
                                    }, {}) || {})
                                }))}
                                currencySymbol=""
                                variant="transparent"
                                chartHeight={350}
                                allowComparison={true}
                                comparisonTickers={comparisonStocks.map(s => typeof s === 'string' ? s : s.ticker)}
                                onAddSeries={onAddComparison}
                                onRemoveSeries={onRemoveComparison}
                                isPercentageData={true}
                                allowSMA={false}
                            />
                        )}
                    </div>
                )}
            </div>
        </ExpandableCard>
    );
};

export default PortfolioSummaryCard;
