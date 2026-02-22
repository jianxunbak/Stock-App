import React from 'react';
import StockOverviewCard from '../../../cards/StockOverviewCard/StockOverviewCard';
import GrowthCard from '../../../cards/GrowthCard/GrowthCard';
import ProfitabilityCard from '../../../cards/ProfitabilityCard/ProfitabilityCard';
import MoatCard from '../../../cards/MoatCard/MoatCard';
import DebtCard from '../../../cards/DebtCard/DebtCard';
import ValuationCard from '../../../cards/ValuationCard/ValuationCard';
import SupportResistanceCard from '../../../cards/SupportResistanceCard/SupportResistanceCard';
import FinancialTables from '../../../cards/FinancialTables/FinancialTables';

const AnalysisGrid = ({
    cardOrder,
    openCards,
    cardVisibility,
    ticker,
    urlTicker,
    stockData,
    modifiedScore,
    currency,
    currencySymbol,
    currentRate,
    watchlist,
    analysisComparisons,
    effectiveLoading,
    styles,
    // Handlers
    toggleCard,
    handleAddToWatchlist,
    setShowAddPortfolioModal,
    setShowStockInfo,
    loadStockData,
    handleHideRequest,
    setMoatStatusLabel,
    setIsMoatEvaluating,
    handleAddAnalysisComparison,
    handleRemoveAnalysisComparison
}) => {

    const cardTicker = ticker || urlTicker || 'no-ticker';

    const renderCard = (cardKey) => {
        if (!cardVisibility[cardKey]) return null;

        const isOpen = !!openCards[cardKey];
        const sharedProps = {
            className: `${cardKey === 'stockSummary' ? styles.colSpan3 : styles.colSpan1} ${!isOpen ? styles.collapsedWrapper : styles.expandedWrapper}`,
            isOpen: isOpen,
            onToggle: () => toggleCard(cardKey),
            onHide: () => handleHideRequest(cardKey),
            loading: effectiveLoading,
            collapsedHeight: cardKey === 'stockSummary' ? 280 : 198
        };

        const cardId = `${cardKey}-${cardTicker}`;

        switch (cardKey) {
            case 'stockSummary':
                return (
                    <StockOverviewCard
                        key={cardId}
                        {...sharedProps}
                        stockData={{ ...stockData, score: modifiedScore }}
                        currencySymbol={currencySymbol}
                        currentRate={currentRate}
                        onAddToWatchlist={handleAddToWatchlist}
                        onAddToPortfolio={() => setShowAddPortfolioModal(true)}
                        onViewDetails={() => setShowStockInfo(true)}
                        isFavorite={watchlist.some(item => item.ticker === stockData?.overview?.symbol)}
                        onRefresh={() => stockData?.overview?.symbol && loadStockData(stockData.overview.symbol, true)}
                        comparisonTickers={analysisComparisons}
                        onAddComparison={handleAddAnalysisComparison}
                        onRemoveComparison={handleRemoveAnalysisComparison}
                    />
                );
            case 'financialAnalysis':
                return (
                    <GrowthCard
                        key={cardId}
                        {...sharedProps}
                        isETF={stockData?.overview?.quoteType === 'ETF' || stockData?.overview?.industry === 'ETF'}
                    />
                );
            case 'profitability':
                return (
                    <ProfitabilityCard
                        key={cardId}
                        {...sharedProps}
                        currency={currency}
                        currencySymbol={currencySymbol}
                        currentRate={currentRate}
                    />
                );
            case 'moat':
                return (
                    <MoatCard
                        key={cardId}
                        {...sharedProps}
                        onMoatStatusChange={setMoatStatusLabel}
                        onIsEvaluatingChange={setIsMoatEvaluating}
                        currency={currency}
                        currencySymbol={currencySymbol}
                        currentRate={currentRate}
                    />
                );
            case 'debt':
                return (
                    <DebtCard
                        key={cardId}
                        {...sharedProps}
                        containerStyle={!isOpen ? { height: '198px', maxHeight: '198px' } : {}}
                        currency={currency}
                        currencySymbol={currencySymbol}
                        currentRate={currentRate}
                    />
                );
            case 'valuation':
                return (
                    <ValuationCard
                        key={cardId}
                        {...sharedProps}
                        currency={currency}
                        currencySymbol={currencySymbol}
                        currentRate={currentRate}
                    />
                );
            case 'support':
                return (
                    <SupportResistanceCard
                        key={cardId}
                        {...sharedProps}
                        currency={currency}
                        currencySymbol={currencySymbol}
                        currentRate={currentRate}
                    />
                );
            case 'financials':
                return (
                    <FinancialTables
                        key={cardId}
                        {...sharedProps}
                        currencySymbol={currencySymbol}
                        currentRate={currentRate}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className={styles.grid}>
            {cardOrder.map(renderCard)}
        </div>
    );
};

export default React.memo(AnalysisGrid);
