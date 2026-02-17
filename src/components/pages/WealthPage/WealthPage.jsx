import React, { useState, useEffect, useCallback, startTransition, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { fetchUserSettings, saveUserSettings } from '../../../services/api';
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
    const [currency, setCurrency] = useState('USD');

    // Currency conversion rates (base: USD)
    const RATES = { 'USD': 1, 'SGD': 1.35, 'EUR': 0.92, 'GBP': 0.79 };
    const currentRate = RATES[currency];
    const currencySymbol = currency === 'EUR' ? '€' : (currency === 'GBP' ? '£' : '$');

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
                detail: { settings: newSettings }
            }));
        }

        setHideModalState({ isOpen: false, cardKey: null, cardLabel: '' });
    };

    // User settings (including DOB)
    const [userSettings, setUserSettings] = useState(null);

    // Load User Preferences from DB
    const loadSettings = useCallback((e) => {
        const processSettings = (data) => {
            if (!data) return;
            startTransition(() => {
                setUserSettings(prev => (JSON.stringify(prev) === JSON.stringify(data) ? prev : data));

                if (data.cardVisibility?.wealth) {
                    setCardVisibility(prev => {
                        const next = { ...prev, ...data.cardVisibility.wealth };
                        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
                    });
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

        if (e?.detail?.settings) {
            processSettings(e.detail.settings);
        } else if (currentUser?.uid && !userSettings) {
            fetchUserSettings(currentUser.uid).then(processSettings);
        }
    }, [currentUser?.uid, userSettings]);

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
        if (now - lastToggleTime.current < 450) return;
        lastToggleTime.current = now;

        const nextState = forcedState !== undefined ? forcedState : !openCards[card];
        if (openCards[card] === nextState) return;

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
                detail: { settings: newSettings }
            }));

            try {
                await saveUserSettings(currentUser.uid, newSettings);
            } catch (error) {
                console.error("Failed to save card open states", error);
            }
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
            alwaysOpenSearch={!isMobile}
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
