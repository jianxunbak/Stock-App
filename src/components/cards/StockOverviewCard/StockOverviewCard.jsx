import React, { useState } from 'react';
import { ExternalLink, Star, Briefcase, Zap, TrendingUp, Edit, DollarSign, Percent } from 'lucide-react';
import ExpandableCard from '../../ui/ExpandableCard/ExpandableCard';
import StockHeader from '../../ui/StockHeader/StockHeader';
import StockHealthCard from '../../ui/StockHealthCard/StockHealthCard';
import PriceChartCard from '../../ui/PriceChartCard/PriceChartCard';
import DropdownButton from '../../ui/DropdownButton/DropdownButton';
import Button from '../../ui/Button';
import './StockOverviewCard.css';

const StockOverviewCard = ({
    stockData,
    currencySymbol,
    currentRate,
    isOpen,
    onToggle,
    onAddToWatchlist,
    onAddToPortfolio,
    onViewDetails,
    isFavorite = false,
    onRefresh,
    comparisonTickers = [],
    onAddComparison,
    onRemoveComparison,
    onHide,
    collapsedWidth = 220,
    collapsedHeight = 220,
    loading = false,
    className = ""
}) => {
    // If we have stockData, we use it. If we don't, we show loading.
    const hasData = !!stockData;
    const { overview, score, history } = stockData || {};

    // Lifted chart controls state so buttons can appear in collapsed header
    const [chartTimeRange, setChartTimeRange] = useState('1Y');
    const [chartMode, setChartMode] = useState('price'); // 'price' or 'percent'

    const TIME_RANGES = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'All'];

    const collapsedChartControls = (
        <>
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
        </>
    );

    // Build menu items dynamically
    const menuItems = [
        {
            label: 'Add Stock to Portfolio',
            onClick: () => onAddToPortfolio && onAddToPortfolio(),
            indicatorNode: <Briefcase size={14} />
        },
        {
            label: 'View Details',
            onClick: () => onViewDetails && onViewDetails(),
            indicatorNode: <ExternalLink size={14} />
        }
    ];

    // When closed (collapsed), add the Watchlist toggle to the menu items
    if (!isOpen) {
        menuItems.push({
            label: isFavorite ? 'Remove from Watchlist' : 'Add to Watchlist',
            onClick: () => onAddToWatchlist && onAddToWatchlist(!isFavorite),
            indicatorNode: <Star size={14} style={{ fill: isFavorite ? 'currentColor' : 'none' }} />
        });
    }

    const commonHeaderProps = {
        name: overview?.name,
        ticker: overview?.symbol,
        price: overview?.price,
        change: overview?.change,
        changePercent: overview?.changePercent,
        currencySymbol,
        currentRate,
        onAddToWatchlist,
        onAddToPortfolio,
        onViewDetails,
        isFavorite
    };

    const formatMarketCap = (cap) => {
        if (!cap) return '-';
        if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
        if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
        if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`;
        return `$${cap}`;
    };

    // Inline Health Score details (replacing bulky summary view)
    const healthScore = score && score.max > 0 ? Math.round((score.total / score.max) * 100) : 0;
    const getScoreColor = (s) => {
        if (s >= 80) return 'var(--neu-success)';
        if (s >= 60) return 'var(--neu-color-favorite)';
        return 'var(--neu-error)';
    };
    const healthColor = getScoreColor(healthScore);
    const healthRadius = 16;
    const healthCircumference = 2 * Math.PI * healthRadius;
    const healthDashoffset = healthCircumference - (healthScore / 100) * healthCircumference;

    const headerContentNode = hasData ? (
        <div
            className="stock-summary-container stacked"
            style={{ height: '100%', width: '100%' }}
        >
            {/* Left Column: Identity, Health, and Key Stats */}
            <div className="stock-info-column">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    {overview && (
                        <div style={{ flex: 1 }}>
                            <StockHeader
                                {...commonHeaderProps}
                                view="summary"
                            />
                        </div>
                    )}
                    {score && (
                        <div style={{ flexShrink: 0, marginTop: '0.5rem', marginRight: '0.5rem' }} title="Health Score">
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
                                <span className="summary-score" style={{ color: healthColor, fontSize: '0.9rem !important' }}>{healthScore}</span>
                            </div>
                        </div>
                    )}
                </div>

                {overview && (
                    <div className="summary-key-stats">
                        <div className="stat-item">
                            <span className="stat-label">Market Cap</span>
                            <span className="stat-value">{formatMarketCap(overview.marketCap)}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">P/E Ratio</span>
                            <span className="stat-value">{overview.peRatio ? overview.peRatio.toFixed(1) : '-'}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Div Yield</span>
                            <span className="stat-value">
                                {overview.dividendYield ? `${(overview.dividendYield * 100).toFixed(2)}%` : '-'}
                            </span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Beta</span>
                            <span className="stat-value">{overview.beta ? overview.beta.toFixed(2) : '-'}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Right Column: Interactive Chart */}
            <div className="price-chart-summary">
                {overview && (
                    <PriceChartCard
                        view="expanded" // Upgrade to full interactive view!
                        ticker={overview.symbol}
                        data={history?.map(d => ({ date: d.date, price: d.close })) || []}
                        change={overview?.change || '+0.00'}
                        currencySymbol={currencySymbol}
                        currentRate={currentRate}
                        variant="transparent" // Clean look inside the summary card
                        allowComparison={false} // Disable extra controls for summary view
                        allowSMA={false}
                        chartHeight={150} // Keep it relatively compact but fully functional
                        style={{ padding: 0 }} // Remove extra card padding
                        controlledTimeRange={chartTimeRange}
                        onTimeRangeChange={setChartTimeRange}
                        controlledMode={chartMode}
                        onModeChange={setChartMode}
                    />
                )}
            </div>
        </div >
    ) : null;

    return (
        <ExpandableCard
            title="Stock Summary"
            expanded={isOpen}
            defaultExpanded={isOpen}
            onToggle={onToggle}
            onHide={onHide}
            collapsedWidth={collapsedWidth}
            collapsedHeight={collapsedHeight}
            menuItems={menuItems}
            onRefresh={onRefresh}
            loading={loading || !hasData}
            className={className}
            headerContent={headerContentNode}
            collapsedHeaderControls={collapsedChartControls}
        >
            {hasData && (
                <div
                    className="stock-overview-body"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr',
                        gap: '2rem',
                        width: '100%',
                    }}
                >
                    {overview && (
                        <StockHeader
                            {...commonHeaderProps}
                            industry={overview.industry}
                            sector={overview.sector}
                            description={overview.description}
                            variant="transparent"
                        />
                    )}

                    {score && (
                        <StockHealthCard
                            score={score.max > 0 ? Math.round((score.total / score.max) * 100) : 0}
                            type="Fundamentals"
                            items={score.criteria?.map(c => {
                                const status = c.status?.toLowerCase();
                                let finalStatus = 'warn';
                                if (status === 'pass') finalStatus = 'pass';
                                else if (status === 'fail') finalStatus = 'fail';
                                else if (status === 'pending') finalStatus = 'pending';
                                else if (status === 'evaluating') finalStatus = 'evaluating';

                                return {
                                    label: c.name,
                                    status: finalStatus,
                                    value: c.value
                                };
                            }) || []}
                            variant="transparent"
                            isOpen={true}
                        />
                    )}

                    {overview && (
                        <PriceChartCard
                            ticker={overview.symbol}
                            data={history} // Full history for expanded chart
                            currencySymbol={currencySymbol}
                            currentRate={currentRate}
                            change={overview?.change}
                            variant="transparent"
                            isOpen={true}
                            comparisonTickers={comparisonTickers}
                            onAddSeries={onAddComparison}
                            onRemoveSeries={onRemoveComparison}
                            controlledTimeRange={chartTimeRange}
                            onTimeRangeChange={setChartTimeRange}
                            controlledMode={chartMode}
                            onModeChange={setChartMode}
                        />
                    )}
                </div>
            )}
        </ExpandableCard >
    );
};

export default StockOverviewCard;
