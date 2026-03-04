import React, { useState, useEffect, useCallback, useMemo, startTransition, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { fetchUserSettings, saveUserSettings, fetchCurrencyRate, fetchStockDataBatch } from '../../../services/api';
import { useGlobalData } from '../../../context/GlobalDataContext';
import { useMarketData } from '../../../context/MarketDataContext';
import { ArrowLeft } from 'lucide-react';
import CascadingHeader from '../../ui/CascadingHeader/CascadingHeader';
import { TopNavLogo, TopNavActions } from '../../ui/Navigation/TopNav';
import Button from '../../ui/Button';
import WatchlistModal from '../../ui/Modals/WatchlistModal';
import UserProfileModal from '../../ui/Modals/UserProfileModal';
import HideConfirmationModal from '../../ui/Modals/HideConfirmationModal';
import WealthSummaryCard from '../../cards/WealthSummaryCard/WealthSummaryCard';
import StocksCard from '../../cards/StocksCard/StocksCard';
import CPFCard from '../../cards/CPFCard/CPFCard';
import SavingsCard from '../../cards/SavingsCard/SavingsCard';
import OtherInvestmentsCard from '../../cards/OtherInvestmentsCard/OtherInvestmentsCard';
import InlineSpinner from '../../ui/InlineSpinner/InlineSpinner';
import styles from './WealthPage.module.css';

const WealthPage = () => {
    const navigate = useNavigate();
    const { currentUser, logout, loading: authLoading } = useAuth();
    const {
        settings: userSettings,
        portfolioList,
        loading: dataLoading,
        updateSettings: handleUpdateSettings
    } = useGlobalData();

    const {
        livePrices,
        currencyRates,
        pricesLoading: marketLoading,
        refreshStockPrices: handleRefreshPrices
    } = useMarketData();

    const [showWatchlist, setShowWatchlist] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [ticker, setTicker] = useState('');
    const [displayCurrency, setDisplayCurrency] = useState('USD');
    const [baseCurrency, setBaseCurrency] = useState('USD');
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Sync local currency selection with user base preference initially
    useEffect(() => {
        if (userSettings?.baseCurrency) {
            setBaseCurrency(userSettings.baseCurrency);
            setDisplayCurrency(userSettings.baseCurrency);
        }
    }, [userSettings?.baseCurrency]);

    const { baseToDisplayRate, usdToDisplayRate, sgdToDisplayRate } = useMemo(() => {
        const displayRate = currencyRates[displayCurrency] || 1;
        const baseRate = currencyRates[baseCurrency] || 1;
        const sgdRate = currencyRates['SGD'] || 1.35;

        return {
            baseToDisplayRate: baseRate !== 0 ? displayRate / baseRate : 1,
            usdToDisplayRate: displayRate,
            sgdToDisplayRate: sgdRate !== 0 ? displayRate / sgdRate : 1
        };
    }, [displayCurrency, baseCurrency, currencyRates]);

    let totalPortfolioValue = 0;
    try {
        if (portfolioList && Array.isArray(portfolioList)) {
            const mainPortfolios = portfolioList.filter(p => !p.type || p.type === 'main' || p.type === 'test');

            mainPortfolios.forEach(p => {
                const items = p.portfolio || [];
                items.forEach(item => {
                    const ticker = (item.ticker || '').trim().toUpperCase();
                    const tickerData = livePrices[ticker];
                    // Fallback to item.price if live data hasn't loaded yet
                    const price = tickerData !== undefined
                        ? (typeof tickerData === 'number' ? tickerData : (tickerData?.price || 0))
                        : (Number(item.price) || 0);
                    const shares = Number(item.shares) || 0;
                    totalPortfolioValue += price * shares;
                });
            });
        }
    } catch (err) {
        console.error("Error calculating portfolio value", err);
    }

    const displayCurrencySymbol = useMemo(() => {
        if (displayCurrency === 'SGD') return 'S$';
        if (displayCurrency === 'EUR') return '€';
        if (displayCurrency === 'GBP') return '£';
        return '$';
    }, [displayCurrency]);

    const baseCurrencySymbol = useMemo(() => {
        if (baseCurrency === 'SGD') return 'S$';
        if (baseCurrency === 'EUR') return '€';
        if (baseCurrency === 'GBP') return '£';
        return '$';
    }, [baseCurrency]);

    // Card visibility state (derived from settings in context)
    const [cardVisibility, setCardVisibility] = useState({
        wealthSummary: true,
        stocks: true,
        cpf: true,
        savings: true,
        otherInvestments: true
    });
    const [cardOrder, setCardOrder] = useState(['wealthSummary', 'stocks', 'cpf', 'savings', 'otherInvestments']);
    const [openCards, setOpenCards] = useState({
        wealthSummary: false,
        stocks: false,
        cpf: false,
        savings: false,
        otherInvestments: false
    });

    // Update visibility and order when settings change
    useEffect(() => {
        if (userSettings?.cardVisibility?.wealth) {
            setCardVisibility(prev => ({ ...prev, ...userSettings.cardVisibility.wealth }));
        }
        if (userSettings?.cardOrder?.wealth) {
            setCardOrder(userSettings.cardOrder.wealth);
        }
        if (userSettings?.cardOpenStates?.wealth) {
            setOpenCards(prev => ({ ...prev, ...userSettings.cardOpenStates.wealth }));
        }
    }, [userSettings]);

    // Hide Modal State
    const [hideModalState, setHideModalState] = useState({
        isOpen: false,
        cardKey: null,
        cardLabel: ''
    });

    const cardLabels = {
        wealthSummary: 'Estimated Net Worth',
        stocks: 'Stocks',
        cpf: 'CPF',
        savings: 'Savings',
        otherInvestments: 'Other Investments'
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

        handleUpdateSettings({
            cardVisibility: {
                ...userSettings?.cardVisibility,
                wealth: newVisibility
            }
        });

        setHideModalState({ isOpen: false, cardKey: null, cardLabel: '' });
    };

    const handleCurrencyChange = (newCurrency) => {
        setDisplayCurrency(newCurrency);
    };

    const handleRefresh = useCallback(async () => {
        flushSync(() => {
            setIsRefreshing(true);
        });

        try {
            await handleRefreshPrices();
        } catch (err) {
            console.error("Refresh failed:", err);
        } finally {
            setTimeout(() => setIsRefreshing(false), 600);
        }
    }, [handleRefreshPrices]);

    const toggleCard = async (card, forcedState) => {
        const nextState = forcedState !== undefined ? forcedState : !openCards[card];
        if (openCards[card] === nextState) return;

        const newStates = { ...openCards, [card]: nextState };
        setOpenCards(newStates);

        handleUpdateSettings({
            cardOpenStates: {
                ...(userSettings?.cardOpenStates || {}),
                wealth: newStates
            }
        });
    };


    // Auth Protection


    const handleLogout = async () => {
        try {
            await logout();
            navigate('/');
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };

    if (authLoading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', background: 'var(--neu-bg)' }}>
            <InlineSpinner size="40px" />
        </div>
    );


    const handleSearch = (val) => {
        const t = (typeof val === 'string' ? val : ticker).trim().toUpperCase();
        if (!t) return;
        navigate(`/analysis?ticker=${t}`);
    };

    const isMobile = window.innerWidth < 768;
    const actionGroupContent = (
        <TopNavActions
            showSearch={true}
            alwaysOpenSearch={false}
            searchTicker={ticker}
            setSearchTicker={setTicker}
            handleSearch={handleSearch}
            currency={displayCurrency}
            setCurrency={handleCurrencyChange}
            setShowWatchlist={setShowWatchlist}
            setShowProfileModal={setShowProfileModal}
            handleLogout={handleLogout}
        />
    );

    const backButtonContent = (
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

                <div className={styles.grid}>
                    {cardOrder.map(cardKey => {
                        const isSpan3 = cardKey === 'wealthSummary';
                        const colSpanClass = isSpan3 ? styles.colSpan3 : styles.colSpan1;
                        const isOpen = openCards[cardKey];
                        const className = `${colSpanClass} ${isOpen ? styles.expandedWrapper : styles.collapsedWrapper}`;

                        if (cardKey === 'wealthSummary' && cardVisibility.wealthSummary) {
                            return (
                                <WealthSummaryCard
                                    key="wealthSummary"
                                    className={className}
                                    isOpen={isOpen}
                                    onToggle={(val) => toggleCard('wealthSummary', val)}
                                    onHide={() => handleHideRequest('wealthSummary')}
                                    baseCurrency={baseCurrency}
                                    baseCurrencySymbol={baseCurrencySymbol}
                                    displayCurrency={displayCurrency}
                                    displayCurrencySymbol={displayCurrencySymbol}
                                    baseToDisplayRate={baseToDisplayRate}
                                    usdToDisplayRate={usdToDisplayRate}
                                    sgdToDisplayRate={sgdToDisplayRate}
                                    settings={userSettings}
                                    onUpdateSettings={handleUpdateSettings}
                                    loading={!userSettings || isRefreshing || dataLoading || marketLoading}
                                    currentPortfolioValueUSD={totalPortfolioValue}
                                    onRefresh={handleRefresh}
                                />
                            );
                        }

                        const inflationRate = userSettings?.wealth?.inflationRate || 0;

                        if (cardKey === 'stocks' && cardVisibility.stocks) {
                            return (
                                <StocksCard
                                    key="stocks"
                                    className={className}
                                    isOpen={isOpen}
                                    onToggle={(val) => toggleCard('stocks', val)}
                                    onHide={() => handleHideRequest('stocks')}
                                    dateOfBirth={userSettings?.dateOfBirth}
                                    baseCurrency={baseCurrency}
                                    baseCurrencySymbol={baseCurrencySymbol}
                                    displayCurrency={displayCurrency}
                                    displayCurrencySymbol={displayCurrencySymbol}
                                    baseToDisplayRate={baseToDisplayRate}
                                    usdToDisplayRate={usdToDisplayRate}
                                    settings={userSettings}
                                    onUpdateSettings={handleUpdateSettings}
                                    loading={!userSettings || isRefreshing || dataLoading || marketLoading}
                                    currentPortfolioValueUSD={totalPortfolioValue}
                                    inflationRate={inflationRate}
                                    portfolioOptions={portfolioList?.map(p => {
                                        let val = 0;
                                        (p.portfolio || []).forEach(item => {
                                            const ticker = (item.ticker || '').trim().toUpperCase();
                                            const tickerData = livePrices[ticker];
                                            const price = tickerData !== undefined
                                                ? (typeof tickerData === 'number' ? tickerData : (tickerData?.price || 0))
                                                : (Number(item.price) || 0);
                                            val += price * (Number(item.shares) || 0);
                                        });
                                        return { name: p.name, valueUSD: val };
                                    })}
                                    onRefresh={handleRefresh}
                                />
                            );
                        }

                        if (cardKey === 'cpf' && cardVisibility.cpf) {
                            return (
                                <CPFCard
                                    key="cpf"
                                    className={className}
                                    isOpen={isOpen}
                                    onToggle={(val) => toggleCard('cpf', val)}
                                    onHide={() => handleHideRequest('cpf')}
                                    dateOfBirth={userSettings?.dateOfBirth}
                                    baseCurrency={baseCurrency}
                                    baseCurrencySymbol={baseCurrencySymbol}
                                    displayCurrency={displayCurrency}
                                    displayCurrencySymbol={displayCurrencySymbol}
                                    baseToDisplayRate={baseToDisplayRate}
                                    usdToDisplayRate={usdToDisplayRate}
                                    sgdToDisplayRate={sgdToDisplayRate}
                                    settings={userSettings}
                                    onUpdateSettings={handleUpdateSettings}
                                    loading={!userSettings || isRefreshing || dataLoading || marketLoading}
                                    inflationRate={inflationRate}
                                    onRefresh={handleRefresh}
                                />
                            );
                        }

                        if (cardKey === 'savings' && cardVisibility.savings) {
                            return (
                                <SavingsCard
                                    key="savings"
                                    className={className}
                                    isOpen={isOpen}
                                    onToggle={(val) => toggleCard('savings', val)}
                                    onHide={() => handleHideRequest('savings')}
                                    baseCurrency={baseCurrency}
                                    baseCurrencySymbol={baseCurrencySymbol}
                                    displayCurrency={displayCurrency}
                                    displayCurrencySymbol={displayCurrencySymbol}
                                    baseToDisplayRate={baseToDisplayRate}
                                    usdToDisplayRate={usdToDisplayRate}
                                    sgdToDisplayRate={sgdToDisplayRate}
                                    settings={userSettings}
                                    onUpdateSettings={handleUpdateSettings}
                                    loading={!userSettings || isRefreshing || dataLoading || marketLoading}
                                    inflationRate={inflationRate}
                                    onRefresh={handleRefresh}
                                />

                            );
                        }

                        if (cardKey === 'otherInvestments' && cardVisibility.otherInvestments) {
                            return (
                                <OtherInvestmentsCard
                                    key="otherInvestments"
                                    className={className}
                                    isOpen={isOpen}
                                    onToggle={(val) => toggleCard('otherInvestments', val)}
                                    onHide={() => handleHideRequest('otherInvestments')}
                                    baseCurrency={baseCurrency}
                                    baseCurrencySymbol={baseCurrencySymbol}
                                    displayCurrency={displayCurrency}
                                    displayCurrencySymbol={displayCurrencySymbol}
                                    baseToDisplayRate={baseToDisplayRate}
                                    usdToDisplayRate={usdToDisplayRate}
                                    settings={userSettings}
                                    onUpdateSettings={handleUpdateSettings}
                                    loading={!userSettings || isRefreshing || dataLoading || marketLoading}
                                    inflationRate={inflationRate}
                                    onRefresh={handleRefresh}
                                />
                            );
                        }

                        return null;
                    })}

                </div>

                {showWatchlist && (
                    <WatchlistModal
                        isOpen={showWatchlist}
                        onClose={() => setShowWatchlist(false)}
                        currency={displayCurrency}
                        currencySymbol={displayCurrencySymbol}
                        currentRate={usdToDisplayRate}
                        onAddToPortfolio={() => { }}
                    />
                )}



                {showProfileModal && currentUser && (
                    <UserProfileModal
                        isOpen={showProfileModal}
                        onClose={() => setShowProfileModal(false)}
                        user={currentUser}
                    />
                )}

                <HideConfirmationModal
                    isOpen={hideModalState.isOpen}
                    onClose={() => setHideModalState(prev => ({ ...prev, isOpen: false }))}
                    onConfirm={handleConfirmHide}
                    cardLabel={hideModalState.cardLabel}
                />
            </div>
        </div>
    );
};

export default WealthPage;
