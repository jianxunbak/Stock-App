import React, { useState, useEffect, useCallback, useMemo, startTransition, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useStockData } from '../../../hooks/useStockData';
import { useAuth } from '../../../context/AuthContext';
import { fetchUserSettings, saveUserSettings } from '../../../services/api';
import { useUserSettings } from '../../../hooks/useUserSettings';
import { usePortfolio } from '../../../hooks/usePortfolio';
import { useWatchlist } from '../../../hooks/useWatchlist';

// Sub-components
import AnalysisHeader from './components/AnalysisHeader';
import AnalysisGrid from './components/AnalysisGrid';
import AnalysisModals from './components/AnalysisModals';
import InlineSpinner from '../../ui/InlineSpinner/InlineSpinner';

import styles from './AnalysisPage.module.css';

// AnalysisPage - v2.0 (Modular Refactor)
const AnalysisPage = () => {
    // 1. Data & Auth Hooks
    const { stockData, loadStockData, error, loading } = useStockData();
    const { addToWatchlist, removeFromWatchlist, watchlist } = useWatchlist();
    const { portfolioList, addStockToPortfolio } = usePortfolio();
    const { currentUser, logout, loading: authLoading } = useAuth();
    const { settings, updateSettings } = useUserSettings();
    const navigate = useNavigate();

    // 2. Search & URL State
    const [searchParams, setSearchParams] = useSearchParams();
    const urlTicker = searchParams.get('ticker');
    const [ticker, setTicker] = useState(urlTicker || '');
    const [isSearching, setIsSearching] = useState(false);
    const [initialLoading, setInitialLoading] = useState(!!urlTicker);
    const lastValidTicker = useRef(null);

    // 3. UI States (Modals, Toggles, etc.)
    const [moatStatusLabel, setMoatStatusLabel] = useState(null);
    const [isMoatEvaluating, setIsMoatEvaluating] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [showWatchlist, setShowWatchlist] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showAddPortfolioModal, setShowAddPortfolioModal] = useState(false);
    const [showStockInfo, setShowStockInfo] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [currency, setCurrency] = useState(() => settings?.baseCurrency || 'USD');
    const [analysisComparisons, setAnalysisComparisons] = useState([]);

    // Card states (Visibility, Order, Open/Closed)
    const [cardOrder, setCardOrder] = useState(['stockSummary', 'financialAnalysis', 'profitability', 'moat', 'debt', 'valuation', 'support', 'financials']);
    const [openCards, setOpenCards] = useState({
        stockSummary: false, financialAnalysis: false, profitability: false,
        moat: false, debt: false, valuation: false, support: false, financials: false
    });
    const [cardVisibility, setCardVisibility] = useState({
        stockSummary: true, financialAnalysis: true, profitability: true,
        moat: true, debt: true, valuation: true, support: true, financials: true
    });
    const [hideModalState, setHideModalState] = useState({ isOpen: false, cardKey: null, cardLabel: '' });

    // 4. Constants & Memos
    const RATES = { 'USD': 1, 'SGD': 1.35, 'EUR': 0.92, 'GBP': 0.79 };
    const currentRate = RATES[currency];
    const currencySymbol = currency === 'EUR' ? '€' : (currency === 'GBP' ? '£' : (currency === 'SGD' ? 'S$' : '$'));
    const isTickerDiverged = urlTicker && stockData?.overview?.symbol !== urlTicker.toUpperCase();
    const effectiveLoading = loading || initialLoading || isSearching || isTickerDiverged;

    const modifiedScore = useMemo(() => {
        if (!stockData?.score) return null;
        let total = 0; let max = 0;
        const newCriteria = stockData.score.criteria?.map(c => {
            const isMoat = c.name.toLowerCase().includes('moat');
            let status = c.status?.toLowerCase();
            if (isMoat) {
                if (isMoatEvaluating) status = 'evaluating';
                else if (!moatStatusLabel) status = 'pending';
                else status = moatStatusLabel.toLowerCase().includes('no') ? 'fail' : 'pass';
            }
            if (status !== 'pending' && status !== 'evaluating') {
                max += 1; if (status === 'pass') total += 1;
            }
            return { ...c, status };
        });
        return { ...stockData.score, total, max, criteria: newCriteria };
    }, [stockData?.score, moatStatusLabel, isMoatEvaluating]);

    // 5. Effects & Listeners
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!authLoading && !currentUser) navigate('/');
    }, [authLoading, currentUser, navigate]);

    useEffect(() => {
        if (error) setShowErrorModal(true);
    }, [error]);

    // Persistence: Load ticker from URL/Storage
    useEffect(() => {
        const savedTicker = localStorage.getItem('lastTicker');
        if (urlTicker) {
            setTicker(urlTicker);
            loadStockData(urlTicker)
                .then(() => {
                    lastValidTicker.current = urlTicker;
                    // Only persist valid tickers to localStorage
                    if (urlTicker !== savedTicker) localStorage.setItem('lastTicker', urlTicker);
                })
                .catch(() => {
                    // Ticker not found — will be handled by the error modal close
                })
                .finally(() => {
                    setInitialLoading(false);
                    setIsSearching(false);
                });
            setMoatStatusLabel(null); setIsMoatEvaluating(false);
        } else if (savedTicker) {
            setSearchParams({ ticker: savedTicker });
        } else {
            setInitialLoading(false);
        }
    }, [urlTicker, loadStockData, setSearchParams]);

    // Sync shielding for remote settings
    const ignoreRemoteSyncUntil = useRef(0);
    const loadSettings = useCallback((e) => {
        if (Date.now() < ignoreRemoteSyncUntil.current && e?.detail?.source !== 'internal') return;
        if (e?.detail?.settings) {
            const settings = e.detail.settings;
            const defer = window.requestIdleCallback || ((cb) => setTimeout(cb, 100));
            defer(() => {
                startTransition(() => {
                    if (settings.cardVisibility?.analysis) setCardVisibility(prev => ({ ...prev, ...settings.cardVisibility.analysis }));
                    if (settings.cardOrder?.analysis) setCardOrder(settings.cardOrder.analysis);
                    if (settings.baseCurrency) setCurrency(settings.baseCurrency);
                });
            });
            return;
        }
        if (currentUser?.uid) {
            fetchUserSettings(currentUser.uid).then(settings => {
                if (Date.now() < ignoreRemoteSyncUntil.current) return;
                if (settings?.analysisCardStates) {
                    setOpenCards(prev => {
                        const newState = { ...prev, ...settings.analysisCardStates };
                        localStorage.setItem('analysis_card_states', JSON.stringify(newState));
                        return newState;
                    });
                }
                if (settings?.cardVisibility?.analysis) setCardVisibility(prev => ({ ...prev, ...settings.cardVisibility.analysis }));
                if (settings?.cardOrder?.analysis) setCardOrder(settings.cardOrder.analysis);
                if (settings?.baseCurrency) setCurrency(settings.baseCurrency);
                if (settings?.analysisComparisons) setAnalysisComparisons(settings.analysisComparisons);
            });
        }
    }, [currentUser?.uid]);

    useEffect(() => {
        loadSettings();
        window.addEventListener('user-settings-updated', loadSettings);
        return () => window.removeEventListener('user-settings-updated', loadSettings);
    }, [loadSettings]);

    // 6. Handlers
    // 6. Handlers
    const handleSearch = useCallback((val) => {
        if (val && val.preventDefault) val.preventDefault();
        const tickerValue = (typeof val === 'string' ? val : ticker).trim();
        if (!tickerValue) return;
        const upperTicker = tickerValue.toUpperCase();
        setIsSearching(true);
        setShowErrorModal(false);
        if (upperTicker === urlTicker) {
            loadStockData(upperTicker, true).finally(() => setIsSearching(false));
            return;
        }
        setTimeout(() => setSearchParams({ ticker: upperTicker }), 0);
    }, [ticker, urlTicker, loadStockData, setSearchParams]);

    const toggleCard = useCallback((card) => {
        ignoreRemoteSyncUntil.current = Date.now() + 2000;
        setOpenCards(prev => {
            const newState = { ...prev, [card]: !prev[card] };
            localStorage.setItem('analysis_card_states', JSON.stringify(newState));
            if (currentUser?.uid) saveUserSettings(currentUser.uid, { analysisCardStates: newState });
            return newState;
        });
    }, [currentUser?.uid, saveUserSettings]);

    const handleConfirmHide = useCallback(async () => {
        const { cardKey } = hideModalState;
        if (!cardKey) return;

        try {
            const currentVisibility = { ...cardVisibility, [cardKey]: false };
            const updatedOrder = cardOrder.filter(k => k !== cardKey);

            setCardVisibility(currentVisibility);
            setCardOrder(updatedOrder);

            if (currentUser?.uid) {
                const newSettings = {
                    ...settings,
                    cardVisibility: { ...settings?.cardVisibility, analysis: currentVisibility },
                    cardOrder: { ...settings?.cardOrder, analysis: updatedOrder }
                };
                await saveUserSettings(currentUser.uid, newSettings);
                window.dispatchEvent(new CustomEvent('user-settings-updated', { detail: { settings: newSettings, source: 'internal' } }));
            }

            setHideModalState(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
            console.error('Failed to save visibility settings:', error);
        }
    }, [hideModalState, cardVisibility, cardOrder, currentUser?.uid, saveUserSettings, settings]);

    const handleAddToWatchlist = useCallback((shouldAdd) => {
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
                signal: 'Hold',
                supportLevel: 0,
                intrinsicValue: 0
            });
        } else {
            removeFromWatchlist(stockData.overview.symbol);
        }
    }, [stockData, addToWatchlist, removeFromWatchlist, currency]);

    // --- Error Handling ---
    const handleCloseError = useCallback(() => {
        setShowErrorModal(false);
        // If we have a previously valid ticker, revert back to it
        if (lastValidTicker.current && lastValidTicker.current !== urlTicker) {
            setSearchParams({ ticker: lastValidTicker.current });
            setTicker(lastValidTicker.current);
        } else if (!lastValidTicker.current) {
            // No valid data was ever loaded — navigate back to previous page
            navigate(-1);
        }
    }, [urlTicker, setSearchParams, navigate]);

    // --- Profile Modal ---
    const handleCloseProfileModal = useCallback(() => setShowProfileModal(false), []);

    // --- Portfolio Integration ---
    const handleAddStockToPortfolio = useCallback(async (data) => {
        const { portfolioIds, ...rest } = data;
        try {
            await Promise.all(portfolioIds.map(id => addStockToPortfolio(id, rest)));
            setShowAddPortfolioModal(false);
        } catch (error) {
            console.error('Failed to add stock to portfolios:', error);
            throw error;
        }
    }, [addStockToPortfolio]);

    const setShowStockInfoCallback = useCallback((val) => setShowStockInfo(val), []);
    const setShowAddPortfolioModalCallback = useCallback((val) => setShowAddPortfolioModal(val), []);
    const setShowWatchlistCallback = useCallback((val) => setShowWatchlist(val), []);
    const setShowProfileModalCallback = useCallback((val) => setShowProfileModal(val), []);

    const handleSetCurrency = useCallback((c) => {
        setCurrency(c);
        updateSettings({ baseCurrency: c });
    }, [setCurrency, updateSettings]);

    const handleLogoutAction = useCallback(async () => {
        await logout();
        navigate('/');
    }, [logout, navigate]);

    const handleHideRequest = useCallback((k) => {
        setHideModalState({ isOpen: true, cardKey: k, cardLabel: k });
    }, []);

    const handleAddComparison = useCallback((t) => {
        const upperTicker = t.toUpperCase();
        setAnalysisComparisons(prev => {
            if (prev.includes(upperTicker)) return prev;
            const newList = [...prev, upperTicker];
            if (currentUser?.uid) saveUserSettings(currentUser.uid, { analysisComparisons: newList });
            return newList;
        });
    }, [currentUser?.uid, saveUserSettings]);

    const handleRemoveComparison = useCallback((t) => {
        const upperTicker = t.toUpperCase();
        setAnalysisComparisons(prev => {
            const newList = prev.filter(x => x !== upperTicker);
            if (currentUser?.uid) saveUserSettings(currentUser.uid, { analysisComparisons: newList });
            return newList;
        });
    }, [currentUser?.uid, saveUserSettings]);


    // 7. Render
    return (
        <div className={styles.container}>
            <div className={styles.wrapper} style={{ position: 'relative' }}>
                <AnalysisHeader
                    ticker={ticker}
                    setTicker={setTicker}
                    handleSearch={handleSearch}
                    currency={currency}
                    setCurrency={handleSetCurrency}
                    setShowWatchlist={setShowWatchlistCallback}
                    setShowProfileModal={setShowProfileModalCallback}
                    handleLogout={handleLogoutAction}
                    loading={loading}
                />

                <AnalysisGrid
                    cardOrder={cardOrder}
                    openCards={openCards}
                    cardVisibility={cardVisibility}
                    ticker={ticker}
                    urlTicker={urlTicker}
                    stockData={stockData}
                    modifiedScore={modifiedScore}
                    currency={currency}
                    currencySymbol={currencySymbol}
                    currentRate={currentRate}
                    watchlist={watchlist}
                    analysisComparisons={analysisComparisons}
                    effectiveLoading={effectiveLoading}
                    styles={styles}
                    toggleCard={toggleCard}
                    handleAddToWatchlist={handleAddToWatchlist}
                    setShowAddPortfolioModal={setShowAddPortfolioModalCallback}
                    setShowStockInfo={setShowStockInfoCallback}
                    loadStockData={loadStockData}
                    handleHideRequest={handleHideRequest}
                    setMoatStatusLabel={setMoatStatusLabel}
                    setIsMoatEvaluating={setIsMoatEvaluating}
                    handleAddAnalysisComparison={handleAddComparison}
                    handleRemoveAnalysisComparison={handleRemoveComparison}
                />

                <AnalysisModals
                    showErrorModal={showErrorModal}
                    handleCloseError={handleCloseError}
                    ticker={ticker || urlTicker}
                    showWatchlist={showWatchlist}
                    setShowWatchlist={setShowWatchlistCallback}
                    currency={currency}
                    currencySymbol={currencySymbol}
                    currentRate={currentRate}
                    showProfileModal={showProfileModal}
                    handleCloseProfileModal={handleCloseProfileModal}
                    currentUser={currentUser}
                    showAddPortfolioModal={showAddPortfolioModal}
                    setShowAddPortfolioModal={setShowAddPortfolioModalCallback}
                    stockData={stockData}
                    portfolioList={portfolioList}
                    handleAddStockToPortfolio={handleAddStockToPortfolio}
                    isMobile={isMobile}
                    showStockInfo={showStockInfo}
                    setShowStockInfo={setShowStockInfoCallback}
                    hideModalState={hideModalState}
                    setHideModalState={setHideModalState}
                    handleConfirmHide={handleConfirmHide}
                />
            </div>
        </div>
    );
};

export default AnalysisPage;
