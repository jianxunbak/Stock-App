import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './HeroPage.module.css';
import SearchBar from '../../ui/SearchBar/SearchBar';
import { useAuth } from '../../../context/AuthContext';
import { usePortfolio } from '../../../hooks/usePortfolio';
import Window from '../../ui/Window/Window';
import Button from '../../ui/Button';

// ... (existing imports)

// ... (inside HeroPage return)


import ThemeToggle from '../../ui/Navigation/ThemeToggle';
import TopNav from '../../ui/Navigation/TopNav';
import WatchlistModal from '../../ui/Modals/WatchlistModal';
import UserProfileModal from '../../ui/Modals/UserProfileModal';
import { fetchStockData } from '../../../services/api';
import LoadingScreen from '../../ui/LoadingScreen/LoadingScreen';

const HeroPage = () => {
    const [ticker, setTicker] = useState('');
    const [failedTicker, setFailedTicker] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [showWatchlist, setShowWatchlist] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    // isSearchExpanded removed
    const [isValidating, setIsValidating] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const navigate = useNavigate();
    const { currentUser, login, logout } = useAuth();



    const handleSearch = async (searchTicker) => {
        // searchTicker comes from SearchBar (string)
        // If called without arg, fallback to ticker state (though SearchBar should pass it)
        const val = typeof searchTicker === 'string' ? searchTicker : ticker;
        const trimmedTicker = val.trim().toUpperCase();
        if (!trimmedTicker) return;

        setIsValidating(true); // Start loading

        // Validate ticker before navigating
        try {
            console.log(`HeroPage: Search triggered for ${trimmedTicker}...`);
            console.log(`HeroPage: Validating ticker ${trimmedTicker}... using fetchStockData`);
            const data = await fetchStockData(trimmedTicker);
            console.log(`HeroPage: Ticker ${trimmedTicker} validated successfully.`);

            // If valid, navigate
            navigate(`/analysis?ticker=${trimmedTicker}`);
        } catch (error) {
            console.error("HeroPage Error validating ticker:", error);
            setIsValidating(false);
            setFailedTicker(trimmedTicker);
            setErrorMessage(error.message || 'Error validating ticker.');
            setShowErrorModal(true);
        }
    };

    const handleLogin = async () => {
        setIsLoggingIn(true);
        try {
            await login();
        } catch (error) {
            console.error("Failed to log in", error);
            setIsLoggingIn(false);
        }
    };

    // Reset logging in state when user is detected
    useEffect(() => {
        if (currentUser) {
            setIsLoggingIn(false);
        }
    }, [currentUser]);

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };

    const handleCloseError = () => {
        setShowErrorModal(false);
        setErrorMessage('');
    };

    // --- Background Prefetching Strategy ---
    const { portfolioList } = usePortfolio();

    // Silently pre-fetch portfolio data in background when user is idle on Hero Page
    useEffect(() => {
        const firstPortfolioItems = portfolioList?.[0]?.portfolio || [];
        if (currentUser && firstPortfolioItems.length > 0) {
            const uniqueTickers = [...new Set(firstPortfolioItems.map(p => p.ticker))];

            // Wait 5s (increased from 1s) after load to allow user to search comfortably first
            const timer = setTimeout(() => {
                console.log("HeroPage: Starting background prefetch for first portfolio...");

                uniqueTickers.forEach((ticker, index) => {
                    // Stagger requests every 500ms (slower) to avoid clogging network
                    setTimeout(() => {
                        fetchStockData(ticker).then(() => {
                            console.log(`HeroPage: Prefetched ${ticker}`);
                        }).catch(() => {
                            // Ignore errors in prefetch
                        });
                    }, index * 500);
                });
            }, 5000);

            return () => clearTimeout(timer);
        }
    }, [currentUser, portfolioList]);
    // ---------------------------------------

    return (
        <div className={styles.container}>
            <div className={styles.headerWrapper}>
                <div className={styles.headerContent}>
                    <TopNav
                        showLogo={true}
                        showSearch={false}
                        showCurrency={false}
                        setShowWatchlist={setShowWatchlist}
                        setShowProfileModal={setShowProfileModal}
                        handleLogout={handleLogout}
                        showThemeToggle={!currentUser}
                    />
                </div>
            </div>

            <div className={styles.content}>
                <div className={styles.heroTitleContainer}>
                    <h1 className={styles.title}>Stock Analyser</h1>
                </div>

                <p className={styles.subtitle}>
                    Financial analysis for the modern investor.
                </p>

                {!currentUser ? (
                    <>
                        <p className={styles.subtitleInstruction}>
                            Login to get started.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                            <button
                                onClick={handleLogin}
                                className={styles.loginButton}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="30" height="30" viewBox="0 0 48 48">
                                    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
                                </svg> Log in with Google
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <p className={styles.subtitleInstruction}>
                            Enter a ticker to get started.
                        </p>
                        <SearchBar
                            placeholder="Search ticker..."
                            alwaysOpen={true}
                            onEnter={handleSearch}
                            onSearch={setTicker}
                            className={styles.searchBarOverride}
                        />

                    </>
                )}
            </div>
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
                        <p style={{ lineHeight: '1.5' }}>Could not find {failedTicker}. Please check the ticker and try again.</p>
                    </div>
                </div>
            </Window>

            {showWatchlist && (
                <WatchlistModal
                    isOpen={showWatchlist}
                    onClose={() => setShowWatchlist(false)}
                />
            )}

            {showProfileModal && currentUser && (
                <UserProfileModal
                    isOpen={showProfileModal}
                    onClose={() => setShowProfileModal(false)}
                    user={currentUser}
                />
            )}

            {(isValidating || isLoggingIn) && (
                <LoadingScreen fullScreen={true} message={isValidating ? 'Validating Ticker...' : 'Logging in...'} />
            )}
        </div>
    );
};

export default HeroPage;
