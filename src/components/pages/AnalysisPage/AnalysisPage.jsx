import React, { useState, useEffect, useCallback, useMemo, startTransition } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStockData } from '../../../hooks/useStockData';
import { useAuth } from '../../../context/AuthContext';
import { fetchUserSettings, saveUserSettings, fetchStockData } from '../../../services/api';

import MetricCard from '../../ui/MetricCard/MetricCard';

import MoatCard from '../../cards/MoatCard/MoatCard';
import ProfitabilityCard from '../../cards/ProfitabilityCard/ProfitabilityCard';
import DebtCard from '../../cards/DebtCard/DebtCard';
import GrowthCard from '../../cards/GrowthCard/GrowthCard';
import ValuationCard from '../../cards/ValuationCard/ValuationCard';
import SupportResistanceCard from '../../cards/SupportResistanceCard/SupportResistanceCard';
import FinancialTables from '../../cards/FinancialTables/FinancialTables';
import FinancialSummary from '../../ui/FinancialSummary';

import Window from '../../ui/Window/Window';
import WatchlistModal from '../../ui/Modals/WatchlistModal';
import AddStockToPortfolioModal from '../../ui/Modals/AddStockToPortfolioModal';
import { usePortfolio } from '../../../hooks/usePortfolio';
import { useWatchlist } from '../../../hooks/useWatchlist';
import HideConfirmationModal from '../../ui/Modals/HideConfirmationModal';
import { ArrowLeft, Briefcase, Zap, TrendingUp, Info, MoreVertical, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import UserProfileModal from '../../ui/Modals/UserProfileModal';
import CascadingHeader from '../../ui/CascadingHeader/CascadingHeader';
import { TopNavLogo, TopNavActions } from '../../ui/Navigation/TopNav';
import ExpandableCard from '../../ui/ExpandableCard/ExpandableCard';
import StockOverviewCard from '../../cards/StockOverviewCard/StockOverviewCard';
import Button from '../../ui/Button';
import StockInfoModal from '../../ui/Modals/StockInfoModal';
import InlineSpinner from '../../ui/InlineSpinner/InlineSpinner';

import styles from './AnalysisPage.module.css';

// AnalysisPage - v1.0.1 (Stability Fix)
const AnalysisPage = () => {
    const { stockData, loadStockData, error, loading } = useStockData();
    const [ticker, setTicker] = useState('');
    const [moatStatusLabel, setMoatStatusLabel] = useState(null);
    const [isMoatEvaluating, setIsMoatEvaluating] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [showWatchlist, setShowWatchlist] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showAddPortfolioModal, setShowAddPortfolioModal] = useState(false);
    const [showStockInfo, setShowStockInfo] = useState(false);
    const [analysisComparisons, setAnalysisComparisons] = useState([]);
    const { addToWatchlist, removeFromWatchlist, watchlist } = useWatchlist();

    const handleAddToWatchlist = (shouldAdd) => {
        if (!stockData?.overview?.symbol) return;

        if (shouldAdd) {
            addToWatchlist({
                ticker: stockData.overview.symbol,
                name: stockData.overview.name,
                price: stockData.overview.price,
                change: stockData.overview.change,
                changePercent: stockData.overview.changePercent,
                currency: currency,
                score: stockData.score?.total || 0,
                // Add default fields needed by WatchlistModal
                signal: 'Hold',
                supportLevel: 0,
                intrinsicValue: 0
            });
        } else {
            removeFromWatchlist(stockData.overview.symbol);
        }
    };
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const { portfolioList, addStockToPortfolio } = usePortfolio();

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const [searchParams, setSearchParams] = useSearchParams();
    const urlTicker = searchParams.get('ticker');
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
    const [openCards, setOpenCards] = useState({
        stockSummary: false,
        financialAnalysis: false,
        profitability: false,
        moat: false,
        debt: false,
        valuation: false,
        support: false,
        financials: false
    });

    // Load initial state from local storage on mount (fastest)
    useEffect(() => {
        const saved = localStorage.getItem('analysis_card_states');
        if (saved) {
            try {
                setOpenCards(prev => ({ ...prev, ...JSON.parse(saved) }));
            } catch (e) {
                console.error("Failed to parse saved card states", e);
            }
        }
    }, []);

    const [cardVisibility, setCardVisibility] = useState({
        stockSummary: true,
        financialAnalysis: true,
        profitability: true,
        moat: true,
        debt: true,
        valuation: true,
        support: true,
        financials: true
    });
    const [cardOrder, setCardOrder] = useState(['stockSummary', 'financialAnalysis', 'profitability', 'moat', 'debt', 'valuation', 'support', 'financials']);

    const [hideModalState, setHideModalState] = useState({
        isOpen: false,
        cardKey: null,
        cardLabel: ''
    });

    const cardLabels = {
        stockSummary: 'Stock Summary',
        financialAnalysis: 'Financial Analysis',
        profitability: 'Profitability',
        moat: 'Moat Evaluation',
        debt: 'Debt Analysis',
        valuation: 'Valuation',
        support: 'Support & Resistance',
        financials: 'Financial Statements'
    };

    const handleHideRequest = (key) => {
        setHideModalState({
            isOpen: true,
            cardKey: key,
            cardLabel: cardLabels[key] || key
        });
    };

    const handleConfirmHide = async () => {
        const { cardKey } = hideModalState;
        if (!cardKey) return;

        const newVisibility = {
            ...cardVisibility,
            [cardKey]: false
        };

        // Update local state
        setCardVisibility(newVisibility);

        // Save to DB
        if (currentUser?.uid) {
            const currentSettings = await fetchUserSettings(currentUser.uid);
            const newSettings = {
                ...currentSettings,
                cardVisibility: {
                    ...currentSettings?.cardVisibility,
                    analysis: newVisibility
                }
            };
            await saveUserSettings(currentUser.uid, newSettings);

            // Notify other components (like UserProfileModal if it were open)
            window.dispatchEvent(new CustomEvent('user-settings-updated', {
                detail: { settings: newSettings }
            }));
        }

        setHideModalState({ isOpen: false, cardKey: null, cardLabel: '' });
    };

    const handleCloseProfileModal = useCallback(() => setShowProfileModal(false), []);

    // Load User Preferences from DB
    const loadSettings = useCallback((e) => {
        // 1. If we have a data-rich event (Optimistic Update from Modal)
        if (e?.detail?.settings) {
            const settings = e.detail.settings;
            // Defer update to next idle period to prioritize Modal UI
            const defer = window.requestIdleCallback || ((cb) => setTimeout(cb, 100));

            defer(() => {
                startTransition(() => {
                    if (settings.cardVisibility?.analysis) {
                        setCardVisibility(prev => ({ ...prev, ...settings.cardVisibility.analysis }));
                    }
                    if (settings.cardOrder?.analysis) {
                        setCardOrder(settings.cardOrder.analysis);
                    }
                });
            });
            return;
        }

        // 2. Regular Fetch (Initial load or fallback)
        if (currentUser?.uid) {
            fetchUserSettings(currentUser.uid).then(settings => {
                if (settings?.analysisCardStates) {
                    setOpenCards(prev => {
                        const newState = { ...prev, ...settings.analysisCardStates };
                        localStorage.setItem('analysis_card_states', JSON.stringify(newState));
                        return newState;
                    });
                }
                if (settings?.cardVisibility?.analysis) {
                    setCardVisibility(prev => ({ ...prev, ...settings.cardVisibility.analysis }));
                }
                if (settings?.cardOrder?.analysis) {
                    setCardOrder(settings.cardOrder.analysis);
                }
                if (settings?.analysisComparisons) setAnalysisComparisons(settings.analysisComparisons);
            });
        }
    }, [currentUser?.uid]);

    useEffect(() => {
        loadSettings();

        // Listen for internal settings updates
        window.addEventListener('user-settings-updated', loadSettings);
        return () => window.removeEventListener('user-settings-updated', loadSettings);
    }, [loadSettings]);

    const toggleCard = (card) => {
        setOpenCards(prev => {
            const newState = { ...prev, [card]: !prev[card] };

            // 1. Save to Local Storage (Immediate)
            localStorage.setItem('analysis_card_states', JSON.stringify(newState));

            // 2. Save to DB (Background)
            if (currentUser?.uid) {
                saveUserSettings(currentUser.uid, { analysisCardStates: newState });
            }

            return newState;
        });
    };

    // Persistence: Load ticker from localStorage or URL on mount and update
    useEffect(() => {
        const savedTicker = localStorage.getItem('lastTicker');

        if (urlTicker) {
            setTicker(urlTicker);
            loadStockData(urlTicker).finally(() => setInitialLoading(false));
            if (urlTicker !== savedTicker) {
                localStorage.setItem('lastTicker', urlTicker);
            }

            // Reset states when ticker changes
            setMoatStatusLabel(null);
            setIsMoatEvaluating(false);

        } else if (savedTicker) {
            setSearchParams({ ticker: savedTicker });
        } else {
            setInitialLoading(false);
        }
    }, [urlTicker, loadStockData, setSearchParams]);

    const handleAddAnalysisComparison = (newTicker) => {
        const term = newTicker.toUpperCase();
        if (analysisComparisons.includes(term)) return;
        const newList = [...analysisComparisons, term];
        setAnalysisComparisons(newList);
        if (currentUser?.uid) {
            saveUserSettings(currentUser.uid, { analysisComparisons: newList });
        }
    };

    const handleRemoveAnalysisComparison = (tickerToRemove) => {
        const newList = analysisComparisons.filter(t => t !== tickerToRemove);
        setAnalysisComparisons(newList);
        if (currentUser?.uid) {
            saveUserSettings(currentUser.uid, { analysisComparisons: newList });
        }
    };

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

    const handleSearch = async (val) => {
        // Prevent default if it's an event
        if (val && val.preventDefault) val.preventDefault();

        // Check if val is a string (passed from TopNav) or event/undefined
        const tickerValue = (typeof val === 'string' ? val : ticker).trim();

        if (!tickerValue) return; // Block empty search

        const upperTicker = tickerValue.toUpperCase();

        try {
            // Validate ticker first
            await fetchStockData(upperTicker);
            // Only update URL if validation success
            setSearchParams({ ticker: upperTicker });
        } catch (error) {
            console.error("Search validation failed:", error);
            // Show error modal but DO NOT update URL
            // Ensure input reflects the failed ticker for context in error message
            if (typeof val === 'string') setTicker(upperTicker);
            setShowErrorModal(true);
        }
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



    const modifiedScore = useMemo(() => {
        if (!stockData?.score) return null;

        let total = 0;
        let max = 0;

        const newCriteria = stockData.score.criteria?.map(c => {
            const isMoat = c.name.toLowerCase().includes('moat');
            let status = c.status?.toLowerCase();

            if (isMoat) {
                if (isMoatEvaluating) status = 'evaluating';
                else if (!moatStatusLabel) status = 'pending';
                else status = moatStatusLabel.toLowerCase().includes('no') ? 'fail' : 'pass';
            }

            // Only add to score if not pending/evaluating
            if (status !== 'pending' && status !== 'evaluating') {
                max += 1;
                if (status === 'pass') total += 1;
            }

            return { ...c, status };
        });

        return {
            ...stockData.score,
            total,
            max,
            criteria: newCriteria
        };
    }, [stockData?.score, moatStatusLabel, isMoatEvaluating]);

    if (authLoading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', background: 'var(--neu-bg)' }}>
            <InlineSpinner size="40px" />
        </div>
    );

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
        <Button
            onClick={() => navigate('/')}
            variant="icon"
        >
            <ArrowLeft size={20} />
        </Button>
    );

    return (
        <div className={styles.container}>
            <div className={styles.wrapper} style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', top: '20px', left: '0px', zIndex: 80, pointerEvents: 'none' }}>
                    <TopNavLogo />
                </div>

                <CascadingHeader
                    topRightContent={actionGroupContent}
                    bottomLeftContent={backButtonContent}
                    gap="40px"
                />

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

                <div className={styles.grid}>
                    {cardOrder.map(cardKey => {
                        const isSpan1 = ['debt', 'valuation', 'support'].includes(cardKey);
                        const colSpanClass = isSpan1 ? styles.colSpan1 : styles.colSpan3;
                        const isOpen = !!openCards[cardKey];
                        const wrapperClass = `${colSpanClass} ${!isOpen ? styles.collapsedWrapper : styles.expandedWrapper}`;

                        if (cardKey === 'stockSummary' && cardVisibility.stockSummary) {
                            return (
                                <div key="stockSummary" className={wrapperClass}>
                                    <StockOverviewCard
                                        stockData={{ ...stockData, score: modifiedScore }}
                                        currencySymbol={currencySymbol}
                                        currentRate={currentRate}
                                        isOpen={isOpen}
                                        onToggle={() => toggleCard('stockSummary')}
                                        onAddToWatchlist={handleAddToWatchlist}
                                        onAddToPortfolio={() => setShowAddPortfolioModal(true)}
                                        onViewDetails={() => setShowStockInfo(true)}
                                        isFavorite={watchlist.some(item => item.ticker === stockData?.overview?.symbol)}
                                        onRefresh={() => stockData?.overview?.symbol && loadStockData(stockData.overview.symbol, true)}
                                        onHide={() => handleHideRequest('stockSummary')}
                                        comparisonTickers={analysisComparisons}
                                        onAddComparison={handleAddAnalysisComparison}
                                        onRemoveComparison={handleRemoveAnalysisComparison}
                                        loading={loading || initialLoading}
                                    />
                                </div>
                            );
                        }

                        if (cardKey === 'financialAnalysis' && cardVisibility.financialAnalysis) {
                            return (
                                <div key="financialAnalysis" className={wrapperClass}>
                                    <GrowthCard
                                        isOpen={isOpen}
                                        onToggle={() => toggleCard('financialAnalysis')}
                                        onHide={() => handleHideRequest('financialAnalysis')}
                                        isETF={stockData?.overview?.quoteType === 'ETF' || stockData?.overview?.industry === 'ETF'}
                                        loading={loading || initialLoading}
                                    />
                                </div>
                            );
                        }

                        if (cardKey === 'profitability' && cardVisibility.profitability) {
                            return (
                                <div key="profitability" className={wrapperClass}>
                                    <ProfitabilityCard
                                        currency={currency}
                                        currencySymbol={currencySymbol}
                                        currentRate={currentRate}
                                        isOpen={isOpen}
                                        onToggle={() => toggleCard('profitability')}
                                        onHide={() => handleHideRequest('profitability')}
                                        loading={loading || initialLoading}
                                    />
                                </div>
                            );
                        }

                        if (cardKey === 'moat' && cardVisibility.moat) {
                            return (
                                <div key="moat" className={wrapperClass}>
                                    <MoatCard
                                        key={stockData?.overview?.symbol || 'moat-card'}
                                        onMoatStatusChange={setMoatStatusLabel}
                                        onIsEvaluatingChange={setIsMoatEvaluating}
                                        currency={currency}
                                        currencySymbol={currencySymbol}
                                        currentRate={currentRate}
                                        isOpen={isOpen}
                                        onToggle={() => toggleCard('moat')}
                                        onHide={() => handleHideRequest('moat')}
                                        loading={loading || initialLoading}
                                    />
                                </div>
                            );
                        }

                        if (cardKey === 'debt' && cardVisibility.debt) {
                            return (
                                <div key="debt" className={wrapperClass}>
                                    <DebtCard
                                        currency={currency}
                                        currencySymbol={currencySymbol}
                                        currentRate={currentRate}
                                        isOpen={isOpen}
                                        onToggle={() => toggleCard('debt')}
                                        onHide={() => handleHideRequest('debt')}
                                        loading={loading || initialLoading}
                                    />
                                </div>
                            );
                        }

                        if (cardKey === 'valuation' && cardVisibility.valuation) {
                            return (
                                <div key="valuation" className={wrapperClass}>
                                    <ValuationCard
                                        currency={currency}
                                        currencySymbol={currencySymbol}
                                        currentRate={currentRate}
                                        isOpen={isOpen}
                                        onToggle={() => toggleCard('valuation')}
                                        onHide={() => handleHideRequest('valuation')}
                                        loading={loading || initialLoading}
                                    />
                                </div>
                            );
                        }

                        if (cardKey === 'support' && cardVisibility.support) {
                            return (
                                <div key="support" className={wrapperClass}>
                                    <SupportResistanceCard
                                        currency={currency}
                                        currencySymbol={currencySymbol}
                                        currentRate={currentRate}
                                        isOpen={isOpen}
                                        onToggle={() => toggleCard('support')}
                                        onHide={() => handleHideRequest('support')}
                                        loading={loading || initialLoading}
                                    />
                                </div>
                            );
                        }

                        if (cardKey === 'financials' && cardVisibility.financials) {
                            return (
                                <div key="financials" className={wrapperClass}>
                                    <FinancialTables
                                        currencySymbol={currencySymbol}
                                        currentRate={currentRate}
                                        isOpen={isOpen}
                                        onToggle={() => toggleCard('financials')}
                                        onHide={() => handleHideRequest('financials')}
                                        loading={loading || initialLoading}
                                    />
                                </div>
                            );
                        }

                        return null;
                    })}
                </div>

                {
                    showWatchlist && (
                        <WatchlistModal
                            isOpen={showWatchlist}
                            onClose={() => setShowWatchlist(false)}
                            currency={currency}
                            currencySymbol={currencySymbol}
                            currentRate={currentRate}
                        />
                    )
                }

                {
                    showProfileModal && currentUser && (
                        <UserProfileModal
                            isOpen={showProfileModal}
                            onClose={handleCloseProfileModal}
                            user={currentUser}
                        />
                    )
                }

                <AddStockToPortfolioModal
                    isOpen={showAddPortfolioModal}
                    onClose={() => setShowAddPortfolioModal(false)}
                    ticker={stockData?.overview?.symbol || ticker}
                    portfolioList={portfolioList}
                    onAdd={handleAddStockToPortfolio}
                    isMobile={isMobile}
                    currentRate={currentRate}
                />

                {
                    showStockInfo && stockData && (
                        <StockInfoModal
                            isOpen={showStockInfo}
                            onClose={() => setShowStockInfo(false)}
                            stockData={stockData}
                            currencySymbol={currencySymbol}
                            currentRate={currentRate}
                        />
                    )
                }

                <HideConfirmationModal
                    isOpen={hideModalState.isOpen}
                    onClose={() => setHideModalState(prev => ({ ...prev, isOpen: false }))}
                    onConfirm={handleConfirmHide}
                    cardLabel={hideModalState.cardLabel}
                />
            </div >
        </div >
    );
};

export default AnalysisPage;
