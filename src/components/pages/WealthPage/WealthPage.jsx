import React, { useState, useEffect, useCallback, useMemo, startTransition, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { fetchUserSettings, saveUserSettings, fetchCurrencyRate, fetchStockDataBatch } from '../../../services/api';
import { usePortfolio } from '../../../hooks/usePortfolio';
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
import styles from './WealthPage.module.css';

const WealthPage = () => {
    const navigate = useNavigate();
    const { currentUser, logout, loading: authLoading } = useAuth();
    const [showWatchlist, setShowWatchlist] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [ticker, setTicker] = useState('');
    const [displayCurrency, setDisplayCurrency] = useState('USD');
    const [baseCurrency, setBaseCurrency] = useState('USD');
    const [baseToDisplayRate, setBaseToDisplayRate] = useState(1);
    const [usdToDisplayRate, setUsdToDisplayRate] = useState(1);
    const [sgdToDisplayRate, setSgdToDisplayRate] = useState(1);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const { portfolioList } = usePortfolio();

    const [livePrices, setLivePrices] = useState({});

    // Fetch live prices for all portfolios
    useEffect(() => {
        if (!portfolioList || !Array.isArray(portfolioList)) return;

        const mainPortfolios = portfolioList.filter(p => !p.type || p.type === 'main' || p.type === 'test');
        const allTickers = new Set();

        mainPortfolios.forEach(p => {
            (p.portfolio || []).forEach(item => {
                if (item.ticker) allTickers.add(item.ticker.trim().toUpperCase());
            });
        });

        const tickers = Array.from(allTickers);
        const missing = tickers.filter(t => !livePrices[t]);

        if (missing.length > 0) {
            const fetchPrices = async () => {
                try {
                    const batchData = await fetchStockDataBatch(missing);
                    const newPrices = {};
                    Object.entries(batchData).forEach(([ticker, data]) => {
                        newPrices[ticker] = data.overview?.price || 0;
                    });
                    setLivePrices(prev => ({ ...prev, ...newPrices }));
                } catch (err) {
                    console.error("Error fetching stock prices:", err);
                }
            };
            fetchPrices();
        }
    }, [portfolioList, livePrices]);

    let totalPortfolioValue = 0;
    try {
        if (portfolioList && Array.isArray(portfolioList)) {
            const mainPortfolios = portfolioList.filter(p => !p.type || p.type === 'main' || p.type === 'test');

            mainPortfolios.forEach(p => {
                const items = p.portfolio || [];
                items.forEach(item => {
                    const ticker = (item.ticker || '').trim().toUpperCase();
                    // Use live price if available, otherwise fallback
                    const price = livePrices[ticker] !== undefined ? livePrices[ticker] : (Number(item.price) || 0);
                    const shares = Number(item.shares) || 0;
                    const val = price * shares;
                    totalPortfolioValue += val;
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

    // Fetch currency rates when currencies change
    useEffect(() => {
        const updateRates = async () => {
            const cache = {};
            const getRate = async (curr) => {
                if (curr === 'USD') return 1;
                if (cache[curr]) return cache[curr];
                const res = await fetchCurrencyRate(curr);
                const rate = res?.rate || res || 1;
                cache[curr] = rate;
                return rate;
            };

            const displayRate = await getRate(displayCurrency);
            // 1. Base to Display Rate
            if (baseCurrency === displayCurrency) {
                setBaseToDisplayRate(1);
            } else {
                const baseRate = await getRate(baseCurrency);
                setBaseToDisplayRate(displayRate / baseRate);
            }

            // 2. USD to Display Rate
            setUsdToDisplayRate(displayRate);

            // 3. SGD to Display Rate
            if (displayCurrency === 'SGD') {
                setSgdToDisplayRate(1);
            } else {
                let sgdRate = await getRate('SGD');
                // Fallback: If API returns 1 for SGD (unlikely 1:1 with USD), verify/force standard rate
                if (sgdRate === 1) sgdRate = 1.35;

                const calculatedRate = displayRate / sgdRate;
                setSgdToDisplayRate(calculatedRate);
            }
        };

        updateRates();
    }, [displayCurrency, baseCurrency]);


    // Card visibility state
    const [cardVisibility, setCardVisibility] = useState({
        wealthSummary: true,
        stocks: true,
        cpf: true,
        savings: true,
        otherInvestments: true
    });
    const [cardOrder, setCardOrder] = useState(['wealthSummary', 'stocks', 'cpf', 'savings', 'otherInvestments']);

    // Card open/collapsed state
    const [openCards, setOpenCards] = useState({
        wealthSummary: false,
        stocks: false,
        cpf: false,
        savings: false,
        otherInvestments: false
    });

    // Hide modal state
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

    // Handle hide request
    const handleHideRequest = (key) => {
        setHideModalState({
            isOpen: true,
            cardKey: key,
            cardLabel: cardLabels[key] || key
        });
    };

    // Handle confirm hide
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
                    wealth: newVisibility
                }
            };
            await saveUserSettings(currentUser.uid, newSettings);

            // Notify other components
            window.dispatchEvent(new CustomEvent('user-settings-updated', {
                detail: { settings: newSettings, source: 'internal' }
            }));
        }

        setHideModalState({ isOpen: false, cardKey: null, cardLabel: '' });
    };

    // User settings (including DOB)
    const [userSettings, setUserSettings] = useState(null);

    // Load User Preferences from DB
    const ignoreRemoteSyncUntil = useRef(0);

    // Initial Currency Sync
    useEffect(() => {
        if (userSettings?.baseCurrency) {
            setDisplayCurrency(userSettings.baseCurrency);
            setBaseCurrency(userSettings.baseCurrency);
        }
    }, [userSettings?.baseCurrency]);

    const handleCurrencyChange = (newCurrency) => {
        setDisplayCurrency(newCurrency);
        handleUpdateSettings({ baseCurrency: newCurrency });
    };

    const loadSettings = useCallback((e) => {
        if (Date.now() < ignoreRemoteSyncUntil.current && e?.detail?.source !== 'internal') {
            return;
        }

        const processSettings = (data) => {
            if (!data) return;
            // SYNC SHIELD: If we recently toggled, ignore remote data during the settlement period
            if (Date.now() < ignoreRemoteSyncUntil.current) return;

            startTransition(() => {
                setUserSettings(prev => (JSON.stringify(prev) === JSON.stringify(data) ? prev : data));

                if (data.cardVisibility?.wealth) {
                    setCardVisibility(prev => {
                        const next = { ...prev, ...data.cardVisibility.wealth };
                        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
                    });
                }
                if (data.baseCurrency) {
                    setBaseCurrency(data.baseCurrency);
                }
                if (data.cardOrder?.wealth) {
                    setCardOrder(prev => (JSON.stringify(prev) === JSON.stringify(data.cardOrder.wealth) ? prev : data.cardOrder.wealth));
                }
                if (data.cardOpenStates?.wealth) {
                    setOpenCards(prev => {
                        const next = { ...prev, ...data.cardOpenStates.wealth };
                        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
                    });
                }
            });
        };

        if (e?.detail?.source === 'internal') return;

        if (e?.detail?.settings) {
            processSettings(e.detail.settings);
            return Promise.resolve();
        } else if (currentUser?.uid) {
            return fetchUserSettings(currentUser.uid).then(settings => {
                // SYNC SHIELD: Catch in-flight requests that might be stale
                if (Date.now() < ignoreRemoteSyncUntil.current) return;
                // If settings are null (new user or empty), set to empty object to stop loading
                processSettings(settings || {});
            }).catch(err => {
                console.error("Failed to fetch settings", err);
                // On error, also unblock loading
                processSettings({});
                return {};
            });
        }
        return Promise.resolve();
    }, [currentUser?.uid]);

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        // 1. Reset live prices to trigger refetch
        setLivePrices({});
        // 2. Bypass sync shield
        ignoreRemoteSyncUntil.current = 0;
        // 3. Force reload settings
        try {
            await loadSettings();
        } catch (err) {
            console.error("Refresh failed:", err);
        } finally {
            // Add a small delay so the user sees the refresh happen
            setTimeout(() => setIsRefreshing(false), 600);
        }
    }, [loadSettings]);

    useEffect(() => {
        loadSettings();

        // Listen for internal settings updates
        window.addEventListener('user-settings-updated', loadSettings);
        return () => window.removeEventListener('user-settings-updated', loadSettings);
    }, [loadSettings]);

    const lastToggleTime = useRef(0);

    // Toggle card expanded/collapsed
    const toggleCard = async (card, forcedState) => {
        const now = Date.now();
        // Ignore rapid-fire toggles (prevents Safari ghost clicks/double-toggles)
        if (now - lastToggleTime.current < 1000) return;
        lastToggleTime.current = now;

        const nextState = forcedState !== undefined ? forcedState : !openCards[card];
        if (openCards[card] === nextState) return;

        // Block remote sync for 2 seconds to allow DB to update and avoid stale overwrites
        ignoreRemoteSyncUntil.current = Date.now() + 2000;

        const newStates = { ...openCards, [card]: nextState };
        setOpenCards(newStates);

        if (currentUser?.uid) {
            const newSettings = {
                ...(userSettings || {}),
                cardOpenStates: {
                    ...(userSettings?.cardOpenStates || {}),
                    wealth: newStates
                }
            };
            setUserSettings(newSettings);

            // Broadcast for OTHER pages, but loadSettings will handle the equality check
            window.dispatchEvent(new CustomEvent('user-settings-updated', {
                detail: { settings: newSettings, source: 'internal' }
            }));

            try {
                await saveUserSettings(currentUser.uid, newSettings);
            } catch (error) {
                console.error("Failed to save card open states", error);
            }
        }
    };

    // Centralized settings update handler for child components
    const handleUpdateSettings = async (newSettingsFragment) => {
        if (!currentUser?.uid) return;

        // 1. Optimistic Update
        const updatedSettings = { ...userSettings, ...newSettingsFragment };
        setUserSettings(updatedSettings);

        // 2. Broadcast immediately
        window.dispatchEvent(new CustomEvent('user-settings-updated', {
            detail: { settings: updatedSettings, source: 'internal' }
        }));

        // 3. Save to Backend
        try {
            // Block remote sync briefly to avoid "flicker" from our own write echoing back
            ignoreRemoteSyncUntil.current = Date.now() + 2000;

            // We trust our local state (updatedSettings) is the most recent
            await saveUserSettings(currentUser.uid, updatedSettings);
        } catch (error) {
            console.error("Failed to save settings:", error);
        }
    };


    // Auth Protection
    useEffect(() => {
        if (!authLoading && !currentUser) {
            navigate('/');
        }
    }, [authLoading, currentUser, navigate]);

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/');
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };

    if (authLoading) return <div>Loading...</div>;


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
                        const wrapperClass = `${colSpanClass} ${isOpen ? styles.expandedWrapper : ''}`;

                        if (cardKey === 'wealthSummary' && cardVisibility.wealthSummary) {
                            return (
                                <div key="wealthSummary" className={wrapperClass}>
                                    <WealthSummaryCard
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
                                        loading={!userSettings || isRefreshing}
                                        currentPortfolioValueUSD={totalPortfolioValue}
                                        onRefresh={handleRefresh}
                                    />
                                </div>
                            );
                        }

                        if (cardKey === 'stocks' && cardVisibility.stocks) {
                            return (
                                <div key="stocks" className={wrapperClass}>
                                    <StocksCard
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
                                        loading={!userSettings || isRefreshing}
                                        currentPortfolioValueUSD={totalPortfolioValue}
                                        portfolioOptions={portfolioList?.map(p => {
                                            let val = 0;
                                            (p.portfolio || []).forEach(item => {
                                                const ticker = (item.ticker || '').trim().toUpperCase();
                                                const price = livePrices[ticker] !== undefined ? livePrices[ticker] : (Number(item.price) || 0);
                                                val += price * (Number(item.shares) || 0);
                                            });
                                            return { name: p.name, valueUSD: val };
                                        })}
                                        onRefresh={handleRefresh}
                                    />
                                </div>
                            );
                        }

                        if (cardKey === 'cpf' && cardVisibility.cpf) {
                            return (
                                <div key="cpf" className={wrapperClass}>
                                    <CPFCard
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
                                        loading={!userSettings || isRefreshing}
                                        onRefresh={handleRefresh}
                                    />
                                </div>
                            );
                        }

                        if (cardKey === 'savings' && cardVisibility.savings) {
                            return (
                                <div key="savings" className={wrapperClass}>
                                    <SavingsCard
                                        isOpen={isOpen}
                                        onToggle={(val) => toggleCard('savings', val)}
                                        onHide={() => handleHideRequest('savings')}
                                        baseCurrency={baseCurrency}
                                        baseCurrencySymbol={baseCurrencySymbol}
                                        displayCurrency={displayCurrency}
                                        displayCurrencySymbol={displayCurrencySymbol}
                                        baseToDisplayRate={baseToDisplayRate}
                                        usdToDisplayRate={usdToDisplayRate}
                                        settings={userSettings}
                                        onUpdateSettings={handleUpdateSettings}
                                        loading={!userSettings || isRefreshing}
                                        onRefresh={handleRefresh}
                                    />
                                </div>
                            );
                        }

                        if (cardKey === 'otherInvestments' && cardVisibility.otherInvestments) {
                            return (
                                <div key="otherInvestments" className={wrapperClass}>
                                    <OtherInvestmentsCard
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
                                        loading={!userSettings || isRefreshing}
                                        onRefresh={handleRefresh}
                                    />
                                </div>
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
