import React, { useState } from 'react';
import {
    AlertTriangle, Plus, Edit2, Trash2, Briefcase, ChevronRight, Check, X,
    TrendingUp, TrendingDown, Minus, Activity, Shield, BarChart2, DollarSign, Percent
} from 'lucide-react';
import Button from '../../ui/Button';
import StockHeader from '../../ui/StockHeader/StockHeader';
import ExpandableCard from '../../ui/ExpandableCard/ExpandableCard';
import StockHealthCard from '../../ui/StockHealthCard/StockHealthCard';
import PriceChartCard from '../../ui/PriceChartCard/PriceChartCard';
import DropdownButton from '../../ui/DropdownButton/DropdownButton';
import SummaryCardContent from '../../ui/SummaryCardContent/SummaryCardContent';
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
    onRefresh,
    loading = false,
    className = ""
}) => {
    if (!portfolioList || portfolioList.length === 0) {
        return (
            <ExpandableCard
                title="Portfolio"
                loading={loading}
                onRefresh={onRefresh}
                className={className}
            />
        );
    }


    // Helper for health color
    const getHealthColor = (s) => {
        if (s >= 80) return 'var(--neu-success)';
        if (s >= 60) return 'var(--neu-color-favorite)';
        return 'var(--neu-error)';
    };

    // Helper for performance color
    const getPerfColor = (p) => p >= 0 ? 'var(--neu-success)' : 'var(--neu-error)';

    // Helper for beta color
    const getBetaColor = (b) => {
        if (b >= 0.8 && b <= 1.2) return 'var(--neu-success)';
        if (b >= 0.7 && b <= 1.3) return 'var(--neu-color-favorite)';
        return 'var(--neu-error)';
    };

    const currentPortfolioName = portfolioList.find(p => p.id === currentPortfolioId)?.name || 'Portfolio';

    const formattedValue = `${currencySymbol}${totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    const perfFormatted = `${totalPerformance >= 0 ? '+' : ''}${totalPerformance.toFixed(1)}%`;

    // Lifted chart states for collapsed header
    const [chartTimeRange, setChartTimeRange] = useState('1Y');
    const [chartMode, setChartMode] = useState('price');
    const TIME_RANGES = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'All'];

    const collapsedChartControls = (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
            <DropdownButton
                label={chartTimeRange}
                buttonStyle={{ minWidth: '36px', height: '36px', padding: '0 0.5rem', fontSize: '0.75rem' }}
                items={TIME_RANGES.map(p => ({
                    label: p,
                    isActive: chartTimeRange === p,
                    onClick: () => setChartTimeRange(p),
                }))}
                closeOnSelect={true}
                align="right"
                usePortal={true}
            />
            <Button
                variant="outline"
                onClick={() => setChartMode(prev => prev === 'price' ? 'percent' : 'price')}
                style={{ width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
                {chartMode === 'price' ? <DollarSign size={16} /> : <Percent size={16} />}
            </Button>
        </div>
    );

    const healthColor = getHealthColor(healthScore);
    const healthRadius = 16;
    const healthCircumference = 2 * Math.PI * healthRadius;
    const healthDashoffset = healthCircumference - (healthScore / 100) * healthCircumference;


    const summaryContent = (
        <div className="stock-summary-container stacked" style={{ height: '100%', width: '100%' }}>
            <div className="stock-info-column">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                        <StockHeader
                            name={null}
                            ticker={null}
                            price={totalValue}
                            change={isTestPortfolio ? 0 : (totalValue - totalCost)}
                            changePercent={isTestPortfolio ? 0 : totalPerformance}
                            currencySymbol={currencySymbol}
                            currentRate={1}
                            view="summary"
                            showFavorite={false}
                            hideChange={isTestPortfolio}
                        />
                    </div>
                    <div style={{ flexShrink: 0, marginTop: '0.25rem', marginRight: '0.25rem' }} title="Health Score">
                        <div className="summary-ring-wrapper">
                            <svg width="40" height="40" viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)' }}>
                                <circle cx="20" cy="20" r={healthRadius} stroke="var(--neu-shadow-dark)" strokeWidth="4" fill="none" opacity="0.15" />
                                <circle
                                    cx="20" cy="20" r={healthRadius}
                                    stroke={healthColor}
                                    strokeWidth="4"
                                    fill="none"
                                    strokeDasharray={healthCircumference}
                                    strokeDashoffset={healthDashoffset}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <span className="summary-score" style={{ color: healthColor, fontSize: '1rem !important' }}>{healthScore}</span>
                        </div>
                    </div>
                </div>


                <div className="summary-key-stats" style={{ marginTop: '0.15rem', gap: '0.25rem 0.5rem' }}>
                    <div className="stat-item">
                        <span className="stat-label">Beta</span>
                        <span className="stat-value" style={{ color: getBetaColor(weightedBeta || 1), fontSize: '0.8rem' }}>
                            {(weightedBeta || 0).toFixed(2)}
                        </span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Growth</span>
                        <span className="stat-value" style={{ color: weightedGrowth > 7 ? 'var(--neu-success)' : (weightedGrowth > 0 ? 'var(--neu-color-favorite)' : 'var(--neu-error)'), fontSize: '0.8rem' }}>
                            {(weightedGrowth || 0).toFixed(1)}%
                        </span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">PEG</span>
                        <span className="stat-value" style={{ color: weightedPeg > 0 && weightedPeg < 1.5 ? 'var(--neu-success)' : 'var(--neu-color-favorite)', fontSize: '0.8rem' }}>
                            {(weightedPeg || 0).toFixed(1)}
                        </span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">HHI</span>
                        <span className="stat-value" style={{ color: hhi < 0.10 ? 'var(--neu-success)' : (hhi <= 0.15 ? 'var(--neu-color-favorite)' : 'var(--neu-error)'), fontSize: '0.8rem' }}>
                            {(hhi || 0).toFixed(2)}
                        </span>
                    </div>
                </div>

            </div>

            <div className="price-chart-summary">
                {!isTestPortfolio && isMounted && (
                    <PriceChartCard
                        view="expanded"
                        ticker="Portfolio"
                        isManual={true}
                        manualSeries={[
                            { id: 'main', name: 'Performance', dataKey: 'price_main', color: totalPerformance >= 0 ? 'var(--neu-success)' : 'var(--neu-error)' }
                        ]}
                        manualChartData={mergedChartData.map(d => ({
                            date: d.date,
                            price_main: d.value
                        }))}
                        currencySymbol=""
                        variant="transparent"
                        chartHeight={135}
                        style={{ padding: 0 }}
                        allowComparison={false}
                        allowSMA={false}
                        controlledTimeRange={chartTimeRange}
                        onTimeRangeChange={setChartTimeRange}
                        controlledMode={chartMode}
                        onModeChange={setChartMode}
                    />
                )}
            </div>
        </div>
    );

    return (
        <ExpandableCard
            title={currentPortfolioName}
            className={`portfolio-summary-card ${className}`}
            expanded={openCards.summary} // Controlled
            defaultExpanded={openCards.summary} // Fallback
            onToggle={(state) => toggleCard('summary')}
            onHide={onHide}
            onRefresh={onRefresh}
            loading={loading}
            collapsedHeight={240}
            collapsedHeaderControls={collapsedChartControls}
            headerContent={summaryContent}


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
                                controlledTimeRange={chartTimeRange}
                                onTimeRangeChange={setChartTimeRange}
                                controlledMode={chartMode}
                                onModeChange={setChartMode}
                            />
                        )}
                    </div>
                )}
            </div>
        </ExpandableCard>
    );
};

export default PortfolioSummaryCard;
