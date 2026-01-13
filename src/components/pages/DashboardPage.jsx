import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStockData } from '../../hooks/useStockData';
import { useAuth } from '../../context/AuthContext';
import OverviewCard from '../cards/OverviewCard';
import GrowthCard from '../cards/GrowthCard';
import MoatCard from '../cards/MoatCard';
import ProfitabilityCard from '../cards/ProfitabilityCard';
import DebtCard from '../cards/DebtCard';
import ValuationCard from '../cards/ValuationCard';
import SupportResistanceCard from '../cards/SupportResistanceCard';
import FinancialTables from '../cards/FinancialTables';

import Modal from '../ui/Modal';
import WatchlistModal from '../ui/WatchlistModal';
import AddStockToPortfolioModal from '../ui/AddStockToPortfolioModal';
import { usePortfolio } from '../../hooks/usePortfolio';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import UserProfileModal from '../ui/UserProfileModal';
import CascadingHeader from '../CascadingHeader';
import { TopNavLogo, TopNavActions } from '../ui/TopNav';
import FluidCard from '../ui/FluidCard';
import styles from './DashboardPage.module.css';


const DashboardPage = () => {
    const { stockData, loadStockData, error, loading } = useStockData();
    const [ticker, setTicker] = useState('');
    const [moatStatusLabel, setMoatStatusLabel] = useState(null);
    const [isMoatEvaluating, setIsMoatEvaluating] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [showWatchlist, setShowWatchlist] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showAddPortfolioModal, setShowAddPortfolioModal] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const { portfolioList, addStockToPortfolio } = usePortfolio();

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { currentUser, logout, loading: authLoading } = useAuth();

    const [currency, setCurrency] = useState('USD');

    // Currency conversion rates (base: USD)
    const RATES = { 'USD': 1, 'SGD': 1.35, 'EUR': 0.92, 'GBP': 0.79 };
    const currentRate = RATES[currency];
    const currencySymbol = currency === 'EUR' ? '€' : (currency === 'GBP' ? '£' : '$');

    const [initialLoading, setInitialLoading] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return !!params.get('ticker');
    });

    // Collapsible Cards State
    // Collapsible Cards State
    const [openCards, setOpenCards] = useState(() => {
        const saved = localStorage.getItem('analysis_card_states');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error("Failed to parse saved card states", e);
            }
        }
        return {
            overview: true,
            growth: true,
            profitability: true,
            moat: true,
            debt: true,
            valuation: true,
            support: true,
            financials: true
        };
    });

    const toggleCard = (card) => {
        setOpenCards(prev => {
            const newState = { ...prev, [card]: !prev[card] };
            localStorage.setItem('analysis_card_states', JSON.stringify(newState));
            return newState;
        });
    };

    // Persistence: Load ticker from localStorage or URL on mount
    // Persistence: Load ticker from localStorage or URL on mount and update
    useEffect(() => {
        const urlTicker = searchParams.get('ticker');
        const savedTicker = localStorage.getItem('lastTicker');

        if (urlTicker) {
            setTicker(urlTicker);
            loadStockData(urlTicker).finally(() => setInitialLoading(false));
            localStorage.setItem('lastTicker', urlTicker);

            // Reset states when ticker changes
            setMoatStatusLabel(null);
            setIsMoatEvaluating(false);

        } else if (savedTicker) {
            setTicker(savedTicker);
            loadStockData(savedTicker).finally(() => setInitialLoading(false));
        } else {
            setInitialLoading(false);
        }
    }, [searchParams]); // Run when URL params change

    // Auth Protection
    useEffect(() => {
        if (!authLoading && !currentUser) {
            navigate('/');
        }
    }, [authLoading, currentUser, navigate]);

    // Error Handling: Show Modal on error
    useEffect(() => {
        if (error) {
            setShowErrorModal(true);
        }
    }, [error]);

    const handleSearch = (e) => {
        if (e) e.preventDefault();

        const tickerValue = ticker.trim();

        if (!tickerValue) return; // Block empty search

        const upperTicker = tickerValue.toUpperCase();

        // loadStockData(upperTicker); // Handled by useEffect
        // setMoatStatusLabel(null); 
        // localStorage.setItem('lastTicker', upperTicker);
        setSearchParams({ ticker: upperTicker }); // Update URL trigger useEffect
    };

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/');
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };



    const handleCloseError = () => {
        setShowErrorModal(false);
    };

    const handleAddStockToPortfolio = async (data) => {
        const { portfolioIds, ...stockData } = data;

        try {
            const promises = portfolioIds.map(async (id) => {
                return addStockToPortfolio(id, stockData);
            });

            await Promise.all(promises);
            setShowAddPortfolioModal(false);
        } catch (error) {
            console.error("Failed to add stock to portfolio(s):", error);
            throw error;
        }
    };



    if (authLoading) return <div>Loading...</div>; // Or a spinner

    const actionGroupContent = (
        <TopNavActions
            searchTicker={ticker}
            setSearchTicker={setTicker}
            handleSearch={handleSearch}
            currency={currency}
            setCurrency={setCurrency}
            setShowWatchlist={setShowWatchlist}
            setShowProfileModal={setShowProfileModal}
            handleLogout={handleLogout}
        />
    );

    const backButtonContent = !loading && (
        <div
            onClick={() => navigate('/')}
            className={styles.backButton}
        >
            <ArrowLeft size={20} />
        </div>
    );

    return (
        <div className={styles.container}>
            <div className={styles.wrapper} style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', top: '20px', left: '0px', zIndex: 60 }}>
                    <TopNavLogo />
                </div>

                <CascadingHeader
                    topRightContent={actionGroupContent}
                    bottomLeftContent={backButtonContent}
                    gap="40px"
                />

                <Modal
                    isOpen={showErrorModal}
                    onClose={handleCloseError}
                    title="Stock Not Found"
                    message={error ? `Could not find stock. Please check the ticker and try again.\nError: ${error}` : "An error occurred."}
                />

                <div className={styles.grid}>
                    <div className={styles.colSpan3} style={{ position: 'relative' }}>

                        <FluidCard>
                            <OverviewCard
                                moatStatusLabel={moatStatusLabel}
                                isMoatEvaluating={isMoatEvaluating}
                                currency={currency}
                                currencySymbol={currencySymbol}
                                currentRate={currentRate}
                                isOpen={openCards.overview}
                                onToggle={() => toggleCard('overview')}
                                onAddToPortfolio={() => setShowAddPortfolioModal(true)}
                            />
                        </FluidCard>

                    </div>
                    <div className={styles.colSpan3}>

                        <FluidCard>
                            <GrowthCard
                                currency={currency}
                                currencySymbol={currencySymbol}
                                currentRate={currentRate}
                                isOpen={openCards.growth}
                                onToggle={() => toggleCard('growth')}
                            />
                        </FluidCard>

                    </div>
                    <div className={styles.colSpan3}>

                        <FluidCard>
                            <ProfitabilityCard
                                currency={currency}
                                currencySymbol={currencySymbol}
                                currentRate={currentRate}
                                isOpen={openCards.profitability}
                                onToggle={() => toggleCard('profitability')}
                            />
                        </FluidCard>

                    </div>
                    <div className={styles.colSpan3}>

                        <FluidCard>
                            <MoatCard
                                key={stockData?.overview?.symbol || 'moat-card'}
                                onMoatStatusChange={setMoatStatusLabel}
                                onIsEvaluatingChange={setIsMoatEvaluating}
                                currency={currency}
                                currencySymbol={currencySymbol}
                                currentRate={currentRate}
                                isOpen={openCards.moat}
                                onToggle={() => toggleCard('moat')}
                            />
                        </FluidCard>

                    </div>
                    <div className={styles.colSpan1}>

                        <FluidCard>
                            <DebtCard
                                currency={currency}
                                currencySymbol={currencySymbol}
                                currentRate={currentRate}
                                isOpen={openCards.debt}
                                onToggle={() => toggleCard('debt')}
                            />
                        </FluidCard>

                    </div>

                    <div className={styles.colSpan1}>

                        <FluidCard>
                            <ValuationCard
                                currency={currency}
                                currencySymbol={currencySymbol}
                                currentRate={currentRate}
                                isOpen={openCards.valuation}
                                onToggle={() => toggleCard('valuation')}
                            />
                        </FluidCard>

                    </div>

                    <div className={styles.colSpan1}>

                        <FluidCard>
                            <SupportResistanceCard
                                currency={currency}
                                currencySymbol={currencySymbol}
                                currentRate={currentRate}
                                isOpen={openCards.support}
                                onToggle={() => toggleCard('support')}
                            />
                        </FluidCard>

                    </div>

                    <div className={styles.colSpan3}>

                        <FluidCard>
                            <FinancialTables
                                currency={currency}
                                currencySymbol={currencySymbol}
                                currentRate={currentRate}
                                isOpen={openCards.financials}
                                onToggle={() => toggleCard('financials')}
                            />
                        </FluidCard>

                    </div>


                </div>

                {showWatchlist && (
                    <WatchlistModal
                        isOpen={showWatchlist}
                        onClose={() => setShowWatchlist(false)}
                        currency={currency}
                        currencySymbol={currencySymbol}
                        currentRate={currentRate}
                    />
                )}

                {showProfileModal && currentUser && (
                    <UserProfileModal
                        isOpen={showProfileModal}
                        onClose={() => setShowProfileModal(false)}
                        user={currentUser}
                    />
                )}

                <AddStockToPortfolioModal
                    isOpen={showAddPortfolioModal}
                    onClose={() => setShowAddPortfolioModal(false)}
                    ticker={stockData?.overview?.symbol || ticker}
                    portfolioList={portfolioList}
                    onAdd={handleAddStockToPortfolio}
                    isMobile={isMobile}
                    currentRate={currentRate}
                />
            </div>
            {
                (loading || initialLoading) && (
                    <div className={styles.loadingOverlay}>
                        <div className={styles.spinner}></div>
                        <div className={styles.loadingText}>Loading Data...</div>
                    </div>
                )
            }
        </div>
    );
};

export default DashboardPage;
