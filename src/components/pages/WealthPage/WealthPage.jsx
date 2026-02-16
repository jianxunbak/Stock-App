import React, { useState, useEffect, useCallback, startTransition } from 'react';
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
        // 1. If we have a data-rich event (Optimistic Update from Modal)
        if (e?.detail?.settings) {
            const settings = e.detail.settings;
            setUserSettings(settings);

            // Defer update to next idle period to prioritize Modal UI
            const defer = window.requestIdleCallback || ((cb) => setTimeout(cb, 100));

            defer(() => {
                startTransition(() => {
                    if (settings.cardVisibility?.wealth) {
                        setCardVisibility(prev => ({ ...prev, ...settings.cardVisibility.wealth }));
                    }
                    if (settings.cardOpenStates?.wealth) {
                        setOpenCards(prev => ({ ...prev, ...settings.cardOpenStates.wealth }));
                    }
                });
            });
            return;
        }

        // 2. Regular Fetch (Initial load or fallback)
        if (currentUser?.uid) {
            fetchUserSettings(currentUser.uid).then(settings => {
                setUserSettings(settings);
                if (settings?.cardVisibility?.wealth) {
                    setCardVisibility(prev => ({ ...prev, ...settings.cardVisibility.wealth }));
                }
                if (settings?.cardOpenStates?.wealth) {
                    setOpenCards(prev => ({ ...prev, ...settings.cardOpenStates.wealth }));
                }
            });
        }
    }, [currentUser?.uid]);

    useEffect(() => {
        loadSettings();

        // Listen for internal settings updates
        window.addEventListener('user-settings-updated', loadSettings);
        return () => window.removeEventListener('user-settings-updated', loadSettings);
    }, [loadSettings]);

    // Toggle card expanded/collapsed
    const toggleCard = async (card) => {
        const newStates = { ...openCards, [card]: !openCards[card] };
        setOpenCards(newStates);

        // Save to DB
        if (currentUser?.uid) {
            try {
                const currentSettings = await fetchUserSettings(currentUser.uid);
                const newSettings = {
                    ...currentSettings,
                    cardOpenStates: {
                        ...currentSettings?.cardOpenStates,
                        wealth: newStates
                    }
                };
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

    const actionGroupContent = (
        <TopNavActions
            showSearch={true}
            alwaysOpenSearch={true}
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
                <div style={{ position: 'absolute', top: '20px', left: '0px', zIndex: 60 }}>
                    <TopNavLogo />
                </div>

                <CascadingHeader
                    topRightContent={actionGroupContent}
                    bottomLeftContent={backButtonContent}
                    gap="40px"
                />

                <div className={styles.grid}>
                    {/* Wealth Summary Card */}
                    {cardVisibility.wealthSummary && (
                        <div className={`${styles.colSpan3} ${openCards.wealthSummary ? styles.expandedWrapper : ''}`}>
                            <WealthSummaryCard
                                isOpen={openCards.wealthSummary}
                                onToggle={(isOpen) => toggleCard('wealthSummary')}
                                onHide={() => handleHideRequest('wealthSummary')}
                            />
                        </div>
                    )}

                    {/* Stocks Card */}
                    {cardVisibility.stocks && (
                        <div className={`${styles.colSpan1} ${openCards.stocks ? styles.expandedWrapper : ''}`}>
                            <StocksCard
                                isOpen={openCards.stocks}
                                onToggle={(isOpen) => toggleCard('stocks')}
                                onHide={() => handleHideRequest('stocks')}
                                dateOfBirth={userSettings?.dateOfBirth}
                            />
                        </div>
                    )}

                    {/* CPF Card */}
                    {cardVisibility.cpf && (
                        <div className={`${styles.colSpan1} ${openCards.cpf ? styles.expandedWrapper : ''}`}>
                            <CPFCard
                                isOpen={openCards.cpf}
                                onToggle={(isOpen) => toggleCard('cpf')}
                                onHide={() => handleHideRequest('cpf')}
                                dateOfBirth={userSettings?.dateOfBirth}
                            />
                        </div>
                    )}

                    {/* Savings Card */}
                    {cardVisibility.savings && (
                        <div className={`${styles.colSpan1} ${openCards.savings ? styles.expandedWrapper : ''}`}>
                            <SavingsCard
                                isOpen={openCards.savings}
                                onToggle={(isOpen) => toggleCard('savings')}
                                onHide={() => handleHideRequest('savings')}
                            />
                        </div>
                    )}

                    {/* Other Investments Card */}
                    {cardVisibility.otherInvestments && (
                        <div className={`${styles.colSpan1} ${openCards.otherInvestments ? styles.expandedWrapper : ''}`}>
                            <OtherInvestmentsCard
                                isOpen={openCards.otherInvestments}
                                onToggle={(isOpen) => toggleCard('otherInvestments')}
                                onHide={() => handleHideRequest('otherInvestments')}
                            />
                        </div>
                    )}
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
