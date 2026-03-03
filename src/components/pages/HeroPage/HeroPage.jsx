import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './HeroPage.module.css';
import { useAuth } from '../../../context/AuthContext';
import { usePortfolio } from '../../../hooks/usePortfolio';
import { useUserSettings } from '../../../hooks/useUserSettings';
import { fetchStockPricesBatch, fetchCurrencyRate } from '../../../services/api';
import { calculateCPFProjection } from '../../../utils/cpfUtils';
import { calculateStockProjection } from '../../../utils/stockUtils';
import { calculateOtherInvestmentProjection } from '../../../utils/otherInvestmentUtils';
import { ArrowRight } from 'lucide-react';

// UI Components
import CascadingHeader from '../../ui/CascadingHeader/CascadingHeader';
import { TopNavLogo, TopNavActions } from '../../ui/Navigation/TopNav';
import WatchlistModal from '../../ui/Modals/WatchlistModal';
import UserProfileModal from '../../ui/Modals/UserProfileModal';
import StyledCard from '../../ui/StyledCard/StyledCard';

const HeroPage = () => {
    const navigate = useNavigate();
    const { currentUser, login, logout } = useAuth();
    const { portfolioList } = usePortfolio();
    const { settings, loading: settingsLoading } = useUserSettings();

    // State
    const [ticker, setTicker] = useState('');
    const [showWatchlist, setShowWatchlist] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [isLoginExpanded, setIsLoginExpanded] = useState(false); // Added for login animation
    const [displayCurrency, setDisplayCurrency] = useState('USD');
    const [baseCurrency, setBaseCurrency] = useState('USD'); // Added
    const [liveData, setLiveData] = useState({});
    const [pricesLoading, setPricesLoading] = useState(true);

    // Currency conversion rates
    const [baseToDisplayRate, setBaseToDisplayRate] = useState(1);
    const [usdToDisplayRate, setUsdToDisplayRate] = useState(1); // Renamed from usdToBase for clarity
    const [sgdToDisplayRate, setSgdToDisplayRate] = useState(1); // Added

    const [currencyLoading, setCurrencyLoading] = useState(false);

    // Initial Currency Sync
    useEffect(() => {
        if (settings?.baseCurrency) {
            setDisplayCurrency(settings.baseCurrency);
            setBaseCurrency(settings.baseCurrency);
        }
    }, [settings?.baseCurrency]);

    // Currency Rate Fetch (Aligned with WealthPage)
    useEffect(() => {
        const updateRates = async () => {
            setCurrencyLoading(true);
            const cache = {};
            const getRate = async (curr) => {
                if (curr === 'USD') return 1;
                if (cache[curr]) return cache[curr];
                try {
                    const res = await fetchCurrencyRate(curr);
                    const rate = typeof res === 'object' ? res.rate : res;
                    const finalRate = rate || 1;
                    cache[curr] = finalRate;
                    return finalRate;
                } catch (e) {
                    console.error("Currency fetch error", e);
                    return 1;
                }
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
                // Fallback: If API returns 1 for SGD (unlikely 1:1 with USD), and display isn't SGD, maybe assume ~1.35
                if (sgdRate === 1) sgdRate = 1.35;
                const calculatedRate = displayRate / sgdRate;
                setSgdToDisplayRate(calculatedRate);
            }
            setCurrencyLoading(false);
        };

        updateRates();
    }, [displayCurrency, baseCurrency]);

    // Batch Stock Price Fetch
    useEffect(() => {
        if (!portfolioList || portfolioList.length === 0) return;
        const allItems = portfolioList.flatMap(p => p.portfolio || []);
        const tickers = [...new Set(allItems.map(i => i.ticker))].filter(Boolean);
        const missingTickers = tickers.filter(t => !liveData[t]);

        if (missingTickers.length > 0) {
            setPricesLoading(true);
            fetchStockPricesBatch(missingTickers)
                .then(results => {
                    if (!results || typeof results !== 'object') return;
                    const newLiveData = {};
                    Object.entries(results).forEach(([ticker, data]) => {
                        newLiveData[ticker] = { price: data.price };
                    });
                    setLiveData(prev => ({ ...prev, ...newLiveData }));
                })
                .catch(err => console.error("Failed to fetch batch prices", err))
                .finally(() => setPricesLoading(false));
        }
    }, [portfolioList]);

    // 1. Current Portfolio Value
    const totalPortfolioValue = useMemo(() => {
        if (!portfolioList) return 0;
        let total = 0;
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

    // Helper: Calculate Age
    const currentAge = useMemo(() => {
        if (!settings?.dateOfBirth) return 30; // Default
        const birth = new Date(settings.dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    }, [settings?.dateOfBirth]);

    // 2. Current Estimates
    const estimatedNetWorth = useMemo(() => {
        if (!settings) return 0;

        // Savings
        const activeSavingsId = settings.savings?.activeScenarioId;
        const savingsScenario = settings.savings?.scenarios?.find(s => s.id === activeSavingsId) || settings.savings?.scenarios?.[0];
        const currentSavings = Number(savingsScenario?.initialSavings || 0);

        // CPF
        const currentCpfBalances = Object.values(settings.cpf?.balances || {}).reduce((a, b) => a + Number(b || 0), 0);
        const currentCpfisTotal = [
            ...(settings.cpf?.cpfisData?.items || []),
            ...(settings.cpf?.cpfisData?.groups || []).flatMap(g => g.items || [])
        ].reduce((sum, item) => sum + Number(item.value || 0), 0);
        const currentCpf = currentCpfBalances + currentCpfisTotal;

        // Other
        let currentOther = 0;
        try {
            const otherData = settings.otherInvestments || { items: [], groups: [] };
            const otherProjection = calculateOtherInvestmentProjection({
                data: otherData,
                projectionYears: 0,
                currentAge: 0,
                startYear: new Date().getFullYear()
            });
            currentOther = otherProjection[0] ? otherProjection[0].value : 0;
        } catch (e) { }

        return Math.round(
            (currentSavings * baseToDisplayRate) +
            (currentCpf * sgdToDisplayRate) +
            (currentOther * baseToDisplayRate) +
            (totalPortfolioValue * usdToDisplayRate)
        );
    }, [settings, totalPortfolioValue, baseToDisplayRate, sgdToDisplayRate, usdToDisplayRate]);


    // 3. Age 55 Projections
    const { netWorthAt55, stocksAt55 } = useMemo(() => {
        if (!settings) return { netWorthAt55: 0, stocksAt55: 0 };

        const targetAge = 55;
        const yearsToProjection = Math.max(0, targetAge - currentAge);

        if (yearsToProjection === 0) return { netWorthAt55: estimatedNetWorth, stocksAt55: totalPortfolioValue * usdToDisplayRate };

        // --- A. Savings Projection ---
        const activeSavingsId = settings.savings?.activeScenarioId;
        const savingsScenario = settings.savings?.scenarios?.find(s => s.id === activeSavingsId) || settings.savings?.scenarios?.[0];

        let projectedSavings = 0;
        if (savingsScenario) {
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

            const monthlyPay = Number(savingsScenario.monthlyPay || 0);
            const totalExpenses = calculateTotalExpenses(savingsScenario.expenses);
            const bankInterestRate = Number(savingsScenario.bankInterestRate || 0) / 100;
            const expenseGrowthRate = Number(savingsScenario.annualExpenseGrowth || 0) / 100;

            // CPF / Tax deduction approximation matching WealthCard logic
            // Note: WealthCard uses CPF settings if available, else 20% estimate
            const cpfContributionEmployee = Math.min(monthlyPay, 6000) * 0.2; // Using standard 6k ceiling for simplified calc if not syncing exact CPF logic perfectly, but better to match wealth card:
            // Actually WealthCard uses: Math.min(monthlyPay, 8000) * 0.2; 
            const owCeiling = 8000;

            // If CPF is linked, it is already in totalExpenses (so we deduct 0 effectively to avoid double counting)
            // If CPF is NOT linked, user has removed it, so we deducting 0.
            const cpfDeduct = 0;

            let savingsBalance = Number(savingsScenario.initialSavings || 0);

            for (let y = 1; y <= yearsToProjection; y++) {
                // Grow expenses
                const grownExpenses = totalExpenses * Math.pow(1 + expenseGrowthRate, y);
                const yearMonthlySavings = monthlyPay - cpfDeduct - grownExpenses;
                savingsBalance = (savingsBalance * (1 + bankInterestRate)) + (yearMonthlySavings * 12);
            }
            projectedSavings = savingsBalance;
        }

        // --- B. CPF Projection ---
        let projectedCpf = 0;
        try {
            const cpfProjection = calculateCPFProjection({
                currentAge, dateOfBirth: settings.dateOfBirth,
                monthlySalary: Number(settings.cpf?.monthlySalary || 0),
                annualBonus: Number(settings.cpf?.annualBonus || 0),
                salaryGrowth: Number(settings.cpf?.salaryGrowth || 0),
                projectionYears: yearsToProjection,
                balances: settings.cpf?.balances || { oa: 0, sa: 0, ma: 0, ra: 0 },
                cpfisData: settings.cpf?.cpfisData
            });
            const target = cpfProjection.projection ? (cpfProjection.projection[yearsToProjection] || cpfProjection.projection[cpfProjection.projection.length - 1]) : null;
            projectedCpf = target ? target.total : 0;
        } catch (e) { }

        // --- C. Stocks Projection ---
        let projectedStocks = 0;
        try {
            // Filter to use ONLY the active scenario for each chart, matching WealthSummaryCard
            const activeScenarioIds = settings.stocks?.activeScenarioIds || {};

            const activeStockCharts = (settings.stocks?.charts || []).map(chart => {
                const selectedScenarioId = activeScenarioIds[chart.id];
                const scenarios = chart.scenarios || [];
                // Default to first visible if no active ID found
                const targetScenario = selectedScenarioId
                    ? scenarios.find(s => s.id === selectedScenarioId)
                    : (scenarios.find(s => s.visible) || scenarios[0]);

                return {
                    ...chart,
                    visible: true,
                    scenarios: scenarios.map(s => ({
                        ...s,
                        visible: targetScenario ? s.id === targetScenario.id : false
                    }))
                };
            });

            const stockProjection = calculateStockProjection({
                charts: activeStockCharts,
                projectionYears: yearsToProjection,
                currentAge,
                startYear: new Date().getFullYear()
            });
            const target = stockProjection[yearsToProjection] || stockProjection[stockProjection.length - 1];
            projectedStocks = target ? target.totalValue : 0;
        } catch (e) { }

        // --- D. Other Projection ---
        let projectedOther = 0;
        try {
            const otherProjection = calculateOtherInvestmentProjection({
                data: settings.otherInvestments,
                projectionYears: yearsToProjection,
                currentAge, startYear: new Date().getFullYear()
            });
            projectedOther = otherProjection[yearsToProjection]?.value || 0;
        } catch (e) { }

        // Final Aggregation in Display Currency with Inflation Adjustment
        // Savings, Stocks, Other are in Base (user entered). CPF is in SGD.
        // Portfolio Value (Stocks) is technically projected in Base because inputs were Base.

        const inflationRate = settings.wealth?.inflationRate || 0;
        const inflationDiscountFactor = (yearsToProjection === 0 || !inflationRate)
            ? 1
            : 1 / Math.pow(1 + (Number(inflationRate) / 100), yearsToProjection);

        const totalNetWorth =
            ((projectedSavings * baseToDisplayRate) +
                (projectedCpf * sgdToDisplayRate) +
                (projectedStocks * baseToDisplayRate) +
                (projectedOther * baseToDisplayRate)) * inflationDiscountFactor;

        const totalStocks = (projectedStocks * baseToDisplayRate) * inflationDiscountFactor;

        return {
            netWorthAt55: Math.round(totalNetWorth),
            stocksAt55: Math.round(totalStocks)
        };

    }, [settings, currentAge, estimatedNetWorth, totalPortfolioValue, baseToDisplayRate, sgdToDisplayRate, usdToDisplayRate]);


    const formatCurrency = (val) => {
        if (typeof val !== 'number' || isNaN(val)) return '---';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: displayCurrency,
            maximumFractionDigits: 0
        }).format(val);
    };

    const handleCurrencyChange = (newCurrency) => {
        setDisplayCurrency(newCurrency);
        updateSettings({ baseCurrency: newCurrency });
    };

    const handleSearch = (val) => {
        const t = (typeof val === 'string' ? val : ticker).trim().toUpperCase();
        if (!t) return;
        navigate(`/analysis?ticker=${t}`);
    };

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    const handleLogin = async () => {
        setIsLoginExpanded(true);
        // Concave pulse triggered by true, then convex pulse triggered by false
        setTimeout(async () => {
            setIsLoginExpanded(false);
            try {
                await login();
            } catch (err) {
                console.error("Login failed", err);
            }
        }, 400);
    };

    return (
        <div className={styles.container}>
            <div className={styles.wrapper}>
                <div style={{ position: 'relative', zIndex: 100, paddingBottom: 0 }}>
                    <div style={{ position: 'absolute', top: '20px', left: '0px', zIndex: 80, pointerEvents: 'none' }}>
                        <TopNavLogo />
                    </div>
                    <CascadingHeader
                        topRightContent={
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
                        }
                        gap="40px"
                    />
                </div>

                <div className={styles.centeredContent}>
                    <div className={styles.textStack}>
                        <h1 className={styles.mainTitle}>
                            {currentUser
                                ? `Hello, ${settings?.name || currentUser?.displayName || 'Investor'}`
                                : 'Welcome back'}
                        </h1>
                        <p className={styles.subTitle}>
                            {currentUser ? 'Here is your financial summary.' : 'Log in to continue'}
                        </p>
                    </div>

                    {currentUser ? (
                        <div className={styles.cardStack}>
                            {/* Card 1: Current */}
                            <StyledCard
                                className={styles.heroCard}
                                variant="default"
                                onClick={() => navigate('/portfolio')}
                                style={{ cursor: 'pointer' }}
                                shadowScale={1}
                                contentDistortionScale={0.3}
                                distortionFactor={1}
                                loading={settingsLoading || pricesLoading}
                            >
                                <div className={styles.cardRow}>
                                    <div className={styles.dataItem}>
                                        <span className={styles.label}>Current Estimated Net Worth</span>
                                        <span className={styles.value}>
                                            {formatCurrency(estimatedNetWorth)}
                                        </span>
                                    </div>
                                    <div className={styles.divider}></div>
                                    <div className={styles.dataItem}>
                                        <span className={styles.label}>Current Portfolio Value</span>
                                        <span className={styles.value}>
                                            {formatCurrency(totalPortfolioValue * usdToDisplayRate)}
                                        </span>
                                    </div>
                                </div>
                                <div className={styles.shortcutLink}>
                                    <span>View Portfolio Details</span>
                                    <ArrowRight size={16} />
                                </div>
                            </StyledCard>

                            {/* Card 2: Age 55 */}
                            <StyledCard
                                className={styles.heroCard}
                                variant="default"
                                onClick={() => navigate('/wealth')}
                                style={{ cursor: 'pointer' }}
                                shadowScale={1}
                                contentDistortionScale={0.3}
                                distortionFactor={1}
                                loading={settingsLoading}
                            >
                                <div className={styles.cardRow}>
                                    <div className={styles.dataItem}>
                                        <span className={styles.label}>Estimated Net Worth @ Age 55</span>
                                        <span className={styles.value}>
                                            {formatCurrency(netWorthAt55)}
                                        </span>
                                    </div>
                                    <div className={styles.divider}></div>
                                    <div className={styles.dataItem}>
                                        <span className={styles.label}>Estimated Stock Value @ Age 55</span>
                                        <span className={styles.value}>
                                            {formatCurrency(stocksAt55)}
                                        </span>
                                    </div>
                                </div>
                                <div className={styles.shortcutLink}>
                                    <span>Go into Wealth Projection</span>
                                    <ArrowRight size={16} />
                                </div>
                            </StyledCard>
                        </div>
                    ) : (
                        <div className={styles.loginContainer}>
                            <StyledCard
                                className={styles.loginCard}
                                onClick={handleLogin}
                                expanded={isLoginExpanded}
                                distortionFactor={0.5}
                                shadowScale={1.0}
                                variant="default"
                            >
                                <div className={styles.loginButton}>
                                    <div className={styles.googleIcon}>
                                        <svg viewBox="0 0 24 24" width="24" height="24">
                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                        </svg>
                                    </div>
                                    <span className={styles.loginText}>Sign in with Google</span>
                                </div>
                            </StyledCard>
                        </div>
                    )}
                </div>
            </div>

            {showWatchlist && <WatchlistModal isOpen={showWatchlist} onClose={() => setShowWatchlist(false)} />}
            {showProfileModal && currentUser && <UserProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} user={currentUser} />}
        </div>
    );
};

export default HeroPage;
