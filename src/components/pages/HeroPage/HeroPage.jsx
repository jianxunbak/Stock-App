import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './HeroPage.module.css';
import SearchBar from '../../ui/SearchBar/SearchBar';
import { useAuth } from '../../../context/AuthContext';
import { usePortfolio } from '../../../hooks/usePortfolio';
import { useUserSettings } from '../../../hooks/useUserSettings';
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
import StyledCard from '../../ui/StyledCard';
import { Wallet, TrendingUp, Sparkles, Clock } from 'lucide-react';

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

    // --- Background Prefetching & Overview Data Strategy ---
    const { portfolioList } = usePortfolio();
    const { settings, loading: settingsLoading } = useUserSettings();
    const [liveData, setLiveData] = useState({});
    const [pricesLoading, setPricesLoading] = useState(false);

    // Fetch live prices for all portfolio items to calculate total value
    useEffect(() => {
        if (!currentUser || !portfolioList?.length) {
            setPricesLoading(false);
            return;
        }

        const allTickers = [...new Set(portfolioList.flatMap(p => (p.portfolio || []).map(item => item.ticker?.toUpperCase())))].filter(Boolean);
        const missingTickers = allTickers.filter(t => !liveData[t]);

        if (missingTickers.length > 0) {
            setPricesLoading(true);
            let completedCount = 0;
            missingTickers.forEach((ticker, index) => {
                // Staggered fetch to avoid hitting rate limits too fast on hero page
                setTimeout(() => {
                    fetchStockData(ticker).then(data => {
                        setLiveData(prev => ({
                            ...prev,
                            [ticker]: { price: data.overview?.price || 0 }
                        }));
                    }).catch(() => { })
                        .finally(() => {
                            completedCount++;
                            if (completedCount === missingTickers.length) {
                                setPricesLoading(false);
                            }
                        });
                }, index * 200);
            });
        } else if (allTickers.length > 0) {
            // All already in liveData
            setPricesLoading(false);
        }
    }, [currentUser, portfolioList]);

    const totalPortfolioValue = useMemo(() => {
        let total = 0;
        // Only sum 'main' portfolios for real-world value calculation
        const mainPortfolios = portfolioList.filter(p => (p.type || 'main') === 'main');

        mainPortfolios.forEach(p => {
            (p.portfolio || []).forEach(item => {
                const ticker = item.ticker?.toUpperCase();
                const price = liveData[ticker]?.price || 0;
                total += price * (item.shares || 0);
            });
        });
        return total;
    }, [portfolioList, liveData]);

    const formatCurrency = (val) => {
        if (typeof val !== 'number' || isNaN(val)) return '---';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
        }).format(val);
    };

    const estimatedNetWorth = useMemo(() => {
        if (!settings) return null;

        // 1. Savings Scenario Data - Match Wealth page's active scenario logic
        const activeScenarioId = settings.savings?.activeScenarioId;
        const savingsScenario = settings.savings?.scenarios?.find(s => s.id === activeScenarioId) || settings.savings?.scenarios?.[0];
        const initialSavings = Number(savingsScenario?.initialSavings || 0);

        // 2. CPF Data
        const initialCpf = Number(settings.cpf?.balances?.oa || 0) +
            Number(settings.cpf?.balances?.sa || 0) +
            Number(settings.cpf?.balances?.ma || 0) +
            Number(settings.cpf?.balances?.ra || 0);

        // 3. Other Investments
        const otherData = settings.otherInvestments || { items: [], groups: [] };
        const sourceData = Array.isArray(otherData) ? { items: otherData, groups: [] } : otherData;
        const otherItems = [...(sourceData.items || []), ...(sourceData.groups || []).flatMap(g => g.items || [])];
        const otherValue = otherItems.reduce((sum, item) => sum + Number(item.value || 0), 0);

        // 4. Stocks (To match Wealth Summary chart's Year 0, we use Scenario Initial Deposit)
        let totalStocksScenario = 0;
        const stocksScenarioIds = settings.stocks?.activeScenarioIds || {};
        (settings.stocks?.charts || []).forEach(chart => {
            const sId = stocksScenarioIds[chart.id];
            const s = chart.scenarios?.find(sc => sc.id === sId) || chart.scenarios?.[0];
            totalStocksScenario += Number(s?.initialDeposit || 0);
        });

        // Current Net Worth (Scenario-based for consistency with Wealth page chart)
        return Math.round(initialSavings + initialCpf + otherValue + totalStocksScenario);
    }, [settings]);

    // --- Projection Logic (Replicated from WealthSummaryCard) ---
    const currentAge = useMemo(() => {
        if (!settings?.dateOfBirth) return null;
        const birth = new Date(settings.dateOfBirth);
        if (isNaN(birth.getTime())) return null;
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    }, [settings?.dateOfBirth]);

    const projectedYear = settings?.wealth?.projectedYear || 0;
    const targetAge = currentAge !== null ? currentAge + projectedYear : null;
    const targetYear = new Date().getFullYear() + projectedYear;

    const projectedValues = useMemo(() => {
        if (!settings || projectedYear === 0) return { netWorth: estimatedNetWorth, stocks: totalPortfolioValue };

        // 1. Savings & CPF Projection
        const activeScenarioId = settings.savings?.activeScenarioId;
        const scenario = settings.savings?.scenarios?.find(s => s.id === activeScenarioId) || settings.savings?.scenarios?.[0];

        const calculateTotalExpenses = (expensesData) => {
            if (!expensesData) return 0;
            if (typeof expensesData === 'object' && !expensesData.items && !expensesData.groups) {
                return Object.values(expensesData).reduce((a, b) => a + Number(b || 0), 0);
            }
            const { items = [], groups = [], linked = [] } = expensesData;
            const getItemMonthly = (item) => {
                const val = Number(item.value || 0);
                if (item.frequency === 'Yearly') return val / 12;
                if (item.frequency === 'Quarterly') return val / 3;
                return val;
            };
            let total = 0;
            items.forEach(i => total += getItemMonthly(i));
            groups.forEach(g => (g.items || []).forEach(i => total += getItemMonthly(i)));
            linked.forEach(i => total += getItemMonthly(i));
            return total;
        };

        const monthlyPay = Number(scenario?.monthlyPay || 0);
        const totalExpenses = calculateTotalExpenses(scenario?.expenses);
        const cpfSalary = Number(settings?.cpf?.monthlySalary || monthlyPay);
        const annualBonus = Number(settings?.cpf?.annualBonus || 0);
        const owCeiling = 8000;
        const annualCeiling = 102000;
        const cpfContributionEmployee = Math.min(monthlyPay, owCeiling) * 0.2;
        const monthlySavings = monthlyPay - cpfContributionEmployee - totalExpenses;
        const bankInterestRate = Number(scenario?.bankInterestRate || 0) / 100;

        let savingsBalance = Number(scenario?.initialSavings || 0);
        const initialCpf = Number(settings?.cpf?.balances?.oa || 0) +
            Number(settings?.cpf?.balances?.sa || 0) +
            Number(settings?.cpf?.balances?.ma || 0) +
            Number(settings?.cpf?.balances?.ra || 0);
        let cpfBalance = initialCpf;

        for (let y = 1; y <= projectedYear; y++) {
            savingsBalance = (savingsBalance * (1 + bankInterestRate)) + (monthlySavings * 12);
            const ageAtYear = (currentAge || 30) + y - 1;
            let contributionRate = 0.37;
            if (ageAtYear > 55) contributionRate = 0.34;
            if (ageAtYear > 60) contributionRate = 0.25;
            if (ageAtYear > 65) contributionRate = 0.165;
            if (ageAtYear > 70) contributionRate = 0.125;
            const annualOW = Math.min(cpfSalary, owCeiling) * 12;
            const annualAW = Math.min(annualBonus, Math.max(0, annualCeiling - annualOW));
            const annualTotalContr = (annualOW + annualAW) * contributionRate;
            cpfBalance = (cpfBalance * 1.033) + annualTotalContr;
        }

        // 2. Stocks Projection
        let stocksTotal = 0;
        const stocksScenarioIds = settings.stocks?.activeScenarioIds || {};
        (settings.stocks?.charts || []).forEach(chart => {
            const sId = stocksScenarioIds[chart.id];
            const s = chart.scenarios?.find(sc => sc.id === sId) || chart.scenarios?.[0];
            if (!s) return;
            const initialDeposit = Number(s.initialDeposit || 0);
            const contributionAmount = Number(s.contributionAmount || 0);
            const annualRate = Number(s.estimatedRate || 0) / 100;
            const periodsPerYear = s.contributionFrequency === 'monthly' ? 12 : s.contributionFrequency === 'quarterly' ? 4 : 1;
            const ratePerPeriod = annualRate / periodsPerYear;
            const totalPeriods = projectedYear * periodsPerYear;
            let val = initialDeposit;
            for (let p = 1; p <= totalPeriods; p++) {
                val = (val + contributionAmount) * (1 + ratePerPeriod);
            }
            stocksTotal += val;
        });

        // 3. Other Investments
        const otherData = settings.otherInvestments || { items: [], groups: [] };
        const sourceData = Array.isArray(otherData) ? { items: otherData, groups: [] } : otherData;
        const allOtherItems = [...(sourceData.items || []), ...(sourceData.groups || []).flatMap(g => g.items || [])];
        const otherInvTotal = allOtherItems.reduce((sum, item) => {
            const currentVal = Number(item.value || 0);
            const payment = Number(item.paymentAmount || 0);
            const frequency = item.frequency || 'One-time';
            if (frequency === 'One-time') return sum + currentVal;
            let annualContribution = 0;
            if (frequency === 'Monthly') annualContribution = payment * 12;
            else if (frequency === 'Quarterly') annualContribution = payment * 4;
            else if (frequency === 'Yearly') annualContribution = payment;
            return sum + currentVal + (annualContribution * projectedYear);
        }, 0);

        return {
            netWorth: Math.round(stocksTotal + savingsBalance + cpfBalance + otherInvTotal),
            stocks: Math.round(stocksTotal)
        };
    }, [settings, projectedYear, estimatedNetWorth, currentAge]);

    // Silently pre-fetch first portfolio data more aggressively for quick transition
    useEffect(() => {
        const firstPortfolioItems = portfolioList?.[0]?.portfolio || [];
        if (currentUser && firstPortfolioItems.length > 0) {
            const uniqueTickers = [...new Set(firstPortfolioItems.map(p => p.ticker))];

            const timer = setTimeout(() => {
                uniqueTickers.forEach((ticker, index) => {
                    setTimeout(() => {
                        fetchStockData(ticker).catch(() => { });
                    }, index * 300);
                });
            }, 3000);

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
                        showThemeToggle={false}
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
                            <Button
                                onClick={handleLogin}
                                className={styles.loginButton}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="30" height="30" viewBox="0 0 48 48">
                                    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
                                </svg> Log in with Google
                            </Button>
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

                        {currentUser && (
                            <div className={styles.overviewSection}>
                                {/* Card 1: Current Overview */}
                                <StyledCard
                                    className={styles.heroOverviewCard}
                                    containerStyle={{ width: '100%', maxWidth: '700px' }}
                                >
                                    <div className={styles.cardHeaderSmall}>
                                        <span>CURRENT OVERVIEW</span>
                                    </div>
                                    <div className={styles.cardRow}>
                                        <div className={styles.cardCol} onClick={() => navigate('/wealth')}>
                                            <div className={styles.colLabel}>
                                                <Wallet size={14} />
                                                <span>EST. NET WORTH</span>
                                            </div>
                                            <div className={styles.colValue}>
                                                {settingsLoading ? (
                                                    <div className={styles.spinnerWrapper}><div className={styles.smallSpinner} /></div>
                                                ) : (
                                                    estimatedNetWorth !== null ? formatCurrency(estimatedNetWorth) : '---'
                                                )}
                                            </div>
                                        </div>
                                        <div className={styles.colDivider} />
                                        <div className={styles.cardCol} onClick={() => navigate('/portfolio')}>
                                            <div className={styles.colLabel}>
                                                <TrendingUp size={14} />
                                                <span>PORTFOLIO VALUE</span>
                                            </div>
                                            <div className={styles.colValue}>
                                                {pricesLoading ? (
                                                    <div className={styles.spinnerWrapper}><div className={styles.smallSpinner} /></div>
                                                ) : (
                                                    totalPortfolioValue > 0 ? formatCurrency(totalPortfolioValue) : '---'
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </StyledCard>

                                {/* Card 2: Projected Overview */}
                                <StyledCard
                                    className={styles.heroOverviewCard}
                                    containerStyle={{ width: '100%', maxWidth: '700px' }}
                                >
                                    <div className={styles.cardHeaderSmall}>
                                        <span>PROJECTED OVERVIEW AT AGE {targetAge} IN YEAR {targetYear}</span>
                                    </div>
                                    <div className={styles.cardRow}>
                                        <div className={styles.cardCol} onClick={() => navigate('/wealth')}>
                                            <div className={styles.colLabel}>
                                                <span>PROJECTED NET WORTH</span>
                                            </div>
                                            <div className={styles.colValueProjected}>
                                                {settingsLoading || pricesLoading ? (
                                                    <div className={styles.spinnerWrapper}><div className={styles.smallSpinner} /></div>
                                                ) : (
                                                    formatCurrency(projectedValues.netWorth)
                                                )}
                                            </div>
                                        </div>
                                        <div className={styles.colDivider} />
                                        <div className={styles.cardCol} onClick={() => navigate('/wealth')}>
                                            <div className={styles.colLabel}>
                                                <span>PROJECTED STOCKS VALUE</span>
                                            </div>
                                            <div className={styles.colValueProjected}>
                                                {settingsLoading || pricesLoading ? (
                                                    <div className={styles.spinnerWrapper}><div className={styles.smallSpinner} /></div>
                                                ) : (
                                                    formatCurrency(projectedValues.stocks)
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </StyledCard>
                            </div>
                        )}
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
