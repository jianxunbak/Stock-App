import React from 'react';
import { AnimatePresence } from 'framer-motion';
import Window from '../../../ui/Window/Window';
import WatchlistModal from '../../../ui/Modals/WatchlistModal';
import UserProfileModal from '../../../ui/Modals/UserProfileModal';
import AddStockToPortfolioModal from '../../../ui/Modals/AddStockToPortfolioModal';
import StockInfoModal from '../../../ui/Modals/StockInfoModal';
import HideConfirmationModal from '../../../ui/Modals/HideConfirmationModal';

const AnalysisModals = ({
    showErrorModal,
    handleCloseError,
    ticker,
    showWatchlist,
    setShowWatchlist,
    currency,
    currencySymbol,
    currentRate,
    showProfileModal,
    handleCloseProfileModal,
    currentUser,
    showAddPortfolioModal,
    setShowAddPortfolioModal,
    stockData,
    portfolioList,
    handleAddStockToPortfolio,
    isMobile,
    showStockInfo,
    setShowStockInfo,
    hideModalState,
    setHideModalState,
    handleConfirmHide
}) => {
    return (
        <>
            <Window
                isOpen={showErrorModal}
                onClose={handleCloseError}
                title="Stock Not Found"
                headerAlign="start"
                width="400px"
                height="auto"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '0.5rem' }}>
                    <div style={{ color: 'var(--neu-text-primary)' }}>
                        <p style={{ lineHeight: '1.5' }}>Could not find {ticker}. Please check the ticker and try again.</p>
                    </div>
                </div>
            </Window>

            <WatchlistModal
                isOpen={showWatchlist}
                onClose={() => setShowWatchlist(false)}
                currency={currency}
                currencySymbol={currencySymbol}
                currentRate={currentRate}
            />

            <UserProfileModal
                isOpen={showProfileModal}
                onClose={handleCloseProfileModal}
                user={currentUser}
            />

            <AddStockToPortfolioModal
                isOpen={showAddPortfolioModal}
                onClose={() => setShowAddPortfolioModal(false)}
                ticker={stockData?.overview?.symbol || ticker}
                portfolioList={portfolioList}
                onAdd={handleAddStockToPortfolio}
                isMobile={isMobile}
                currentRate={currentRate}
                currencySymbol={currencySymbol}
            />

            <StockInfoModal
                isOpen={showStockInfo}
                onClose={() => setShowStockInfo(false)}
                stockData={stockData}
                currencySymbol={currencySymbol}
                currentRate={currentRate}
            />

            <HideConfirmationModal
                isOpen={hideModalState.isOpen}
                onClose={() => setHideModalState(prev => ({ ...prev, isOpen: false }))}
                onConfirm={handleConfirmHide}
                cardLabel={hideModalState.cardLabel}
            />
        </>
    );
};

export default React.memo(AnalysisModals);
