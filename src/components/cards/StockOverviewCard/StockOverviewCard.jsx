import React, { useState } from 'react';
import { ExternalLink, Star, Briefcase, Zap, TrendingUp, Edit } from 'lucide-react';
import ExpandableCard from '../../ui/ExpandableCard/ExpandableCard';
import StockHeader from '../../ui/StockHeader/StockHeader';
import StockHealthCard from '../../ui/StockHealthCard/StockHealthCard';
import PriceChartCard from '../../ui/PriceChartCard/PriceChartCard';
import Menu from '../../ui/Menu';
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
    loading = false
}) => {
    // If we have stockData, we use it. If we don't, we show loading.
    const hasData = !!stockData;
    const { overview, score, history } = stockData || {};


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
            headerContent={
                hasData && (
                    <div
                        className="stock-summary-container stacked"
                        style={{ height: '100%', width: '100%' }}
                    >
                        {overview && (
                            <StockHeader
                                {...commonHeaderProps}
                                view="summary"
                            />
                        )}
                        {
                            score && (
                                <StockHealthCard
                                    view="summary"
                                    score={score.max > 0 ? Math.round((score.total / score.max) * 100) : 0}
                                    type="Fundamentals"
                                />
                            )
                        }
                        {
                            overview && (
                                <PriceChartCard
                                    view="summary"
                                    ticker={overview.symbol}
                                    data={history?.slice(-20).map(d => ({ date: d.date, price: d.close }))}
                                    change={overview?.change || '+0.00'}
                                    currencySymbol={currencySymbol}
                                    currentRate={currentRate}
                                />
                            )
                        }
                    </div >
                )
            }
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
                        />
                    )}
                </div>
            )}
        </ExpandableCard >
    );
};

export default StockOverviewCard;
