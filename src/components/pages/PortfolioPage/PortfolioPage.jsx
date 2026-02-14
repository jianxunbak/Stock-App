import React, { useState, useEffect, useMemo, useCallback, useRef, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Menu, X, Plus, Edit2, Trash2, ChevronDown, Briefcase, Check } from 'lucide-react';
import styles from './PortfolioPage.module.css';

// Hooks & Services
import { usePortfolio } from '../../../hooks/usePortfolio';
import { fetchStockData, fetchCurrencyRate, calculatePortfolioTWR, analyzePortfolio, fetchUserSettings, saveUserSettings } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';

// UI Components
import Modal from '../../ui/Modals/Modal';
import Window from '../../ui/Window/Window';
import CascadingHeader from '../../ui/CascadingHeader/CascadingHeader';
import { TopNavLogo, TopNavActions } from '../../ui/Navigation/TopNav';
import WatchlistModal from '../../ui/Modals/WatchlistModal';
import UserProfileModal from '../../ui/Modals/UserProfileModal';
import LogoutConfirmationModal from '../../ui/Modals/LogoutConfirmationModal';
import Button from '../../ui/Button';

// Refactored Components
import PortfolioSummaryCard from '../../cards/PortfolioSummaryCard/PortfolioSummaryCard';
import AllocationCard from '../../cards/AllocationCard/AllocationCard';
import AiInsightsCard from '../../cards/AiInsightsCard/AiInsightsCard';
import HoldingsCard from '../../cards/HoldingsCard/HoldingsCard';

import CustomSelect from '../../ui/CustomSelect/CustomSelect';
import CustomDatePicker from '../../ui/CustomDatePicker/CustomDatePicker';

// Styles used for legacy parts or layout
import '../../cards/PortfolioSummaryCard/PortfolioSummaryCard.css';

const PortfolioPage = () => {
    const { currentUser, logout } = useAuth();
    const { theme } = useTheme();
    const navigate = useNavigate();
    const isMobile = window.innerWidth < 768;

    // Local state for current portfolio selection
    const [currentPortfolioId, setCurrentPortfolioId] = useState(() => {
        return localStorage.getItem('lastViewedPortfolioId') || 'main';
    });

    // Save to LocalStorage whenever it changes
    useEffect(() => {
        if (currentPortfolioId) {
            localStorage.setItem('lastViewedPortfolioId', currentPortfolioId);
        }
    }, [currentPortfolioId]);

    const [cardVisibility, setCardVisibility] = useState({
        summary: true,
        allocation: true,
        ai: true,
        holdings: true
    });

    // Load User Preferences for Portfolio ID and Visibility
    const loadSettings = useCallback((e) => {
        // 1. If we have a data-rich event (Optimistic Update from Modal)
        if (e?.detail?.settings) {
            const settings = e.detail.settings;
            // Defer update to next idle period to prioritize Modal UI
            const defer = window.requestIdleCallback || ((cb) => setTimeout(cb, 100));

            defer(() => {
                startTransition(() => {
                    if (settings.cardVisibility?.portfolio) {
                        setCardVisibility(prev => ({ ...prev, ...settings.cardVisibility.portfolio }));
                    }
                });
            });
            return;
        }

        // 2. Regular Fetch (Initial load or fallback)
        if (currentUser?.uid) {
            fetchUserSettings(currentUser.uid).then(settings => {
                if (settings?.lastViewedPortfolioId) {
                    setCurrentPortfolioId(settings.lastViewedPortfolioId);
                    localStorage.setItem('lastViewedPortfolioId', settings.lastViewedPortfolioId);
                }
                if (settings?.cardVisibility?.portfolio) {
                    setCardVisibility(prev => ({ ...prev, ...settings.cardVisibility.portfolio }));
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

    // Save to Backend on Change
    const handlePortfolioChange = (newId) => {
        setCurrentPortfolioId(newId);
        if (currentUser?.uid) {
            saveUserSettings(currentUser.uid, { lastViewedPortfolioId: newId });
        }
    };

    // --- State ---
    const [liveData, setLiveData] = useState({});
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [currency, setCurrency] = useState('USD');
    const [hiddenColumns, setHiddenColumns] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showWatchlist, setShowWatchlist] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [showColumnModal, setShowColumnModal] = useState(false);

    const {
        portfolio,
        addToPortfolio,
        updatePortfolioItem,
        removeFromPortfolio,
        createPortfolio,
        portfolioList,
        renamePortfolio,
        deletePortfolio,
        copyItemsFromPortfolio,
        clearPortfolio,
        comparisonStocks,
        updateComparisonStocks,
        portfolioLoading,
        notes,
        saveNotes,
        analysis: savedAnalysis,
        clearAnalysis
    } = usePortfolio(currentPortfolioId);



    // Add Stock Form
    const [newTicker, setNewTicker] = useState('');
    const [newShares, setNewShares] = useState('');
    const [newCost, setNewCost] = useState('');
    const [newDate, setNewDate] = useState('');
    const [newCategory, setNewCategory] = useState('Core');
    const [addError, setAddError] = useState('');

    const [searchTicker, setSearchTicker] = useState('');
    const [currentRate, setCurrentRate] = useState(1);
    const [twrData, setTwrData] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState(null);
    const [userClearedAnalysis, setUserClearedAnalysis] = useState(false);

    // --- Restored Portfolio Type & UI State ---
    const [portfolioType, setPortfolioType] = useState('main'); // 'main' | 'test'
    const [typeSelectorOpen, setTypeSelectorOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newPortfolioName, setNewPortfolioName] = useState('');
    const [newPortfolioType, setNewPortfolioType] = useState('main');

    // Rename State
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');

    // Delete Portfolio Modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    // Clear Portfolio & Copy Modal
    const [showClearPortfolioModal, setShowClearPortfolioModal] = useState(false);
    const [showCopyModal, setShowCopyModal] = useState(false);
    const [copySourceId, setCopySourceId] = useState('');
    const [sourceItems, setSourceItems] = useState([]);
    const [selectedCopyItems, setSelectedCopyItems] = useState([]);

    // Clear Analysis Modal
    const [showClearAnalysisModal, setShowClearAnalysisModal] = useState(false);
    const [showPortfolioDetails, setShowPortfolioDetails] = useState(false);
    const [showSelectPortfolioModal, setShowSelectPortfolioModal] = useState(false);

    // Search Error State
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [failedTicker, setFailedTicker] = useState('');


    // Portfolio UI States (Cards)
    const [portfolioUIStates, setPortfolioUIStates] = useState({});
    // const [portfolioNotes, setPortfolioNotes] = useState({}); // Removed in favor of persistent notes
    const [openCards, setOpenCards] = useState({
        allocation: true,
        ai: true,
        holdings: true,
        summary: true
    });

    const [menuOpenHoldings, setMenuOpenHoldings] = useState(false);

    // Initial Portfolio Selection Effect
    useEffect(() => {
        if (!currentPortfolioId && portfolioList.length > 0) {
            // Find first portfolio of current type, default to first available
            const first = portfolioList.find(p => (p.type || 'main') === portfolioType);
            if (first) setCurrentPortfolioId(first.id);
            else if (portfolioList.length > 0) setCurrentPortfolioId(portfolioList[0].id);
        }
    }, [portfolioList, currentPortfolioId, portfolioType]);

    useEffect(() => {
        setAnalysis(null);
    }, [currentPortfolioId]);

    // Sync saved analysis from Firestore
    useEffect(() => {
        if (savedAnalysis) {
            setAnalysis(savedAnalysis);
        }
    }, [savedAnalysis]);

    // Currency Effect
    useEffect(() => {
        if (currency === 'USD') setCurrentRate(1);
        else fetchCurrencyRate(currency).then(r => setCurrentRate(r || 1));
    }, [currency]);

    // Sync Portfolio Type with Current Selection AND Filter logic
    useEffect(() => {
        if (currentPortfolioId && portfolioList.length > 0) {
            const current = portfolioList.find(p => p.id === currentPortfolioId);
            if (current) {
                const type = current.type || 'main'; // Default to main if undefined
                if (type !== portfolioType) setPortfolioType(type);
            }
        }
    }, [currentPortfolioId, portfolioList]);

    // Filter Portfolios based on Type
    const filteredPortfolios = useMemo(() => {
        return portfolioList.filter(p => (p.type || 'main') === portfolioType);
    }, [portfolioList, portfolioType]);

    // Handlers
    const handleTypeChange = (type) => {
        setPortfolioType(type);
        setTypeSelectorOpen(false);
        // Auto-select first portfolio of new type if available
        const first = portfolioList.find(p => (p.type || 'main') === type);
        if (first) handlePortfolioChange(first.id);
        else handlePortfolioChange(null);
    };

    const handleRenameStart = () => {
        const current = portfolioList.find(p => p.id === currentPortfolioId);
        if (current) {
            setRenameValue(current.name);
            setIsRenaming(true);
        }
    };

    const handleRenameSubmit = async () => {
        if (renameValue.trim() && currentPortfolioId) {
            await renamePortfolio(currentPortfolioId, renameValue.trim());
            setIsRenaming(false);
        } else {
            setIsRenaming(false); // Cancel if empty
        }
    };

    // Fetch Live Data
    useEffect(() => {
        if (portfolio.length === 0) {
            setLiveData({});
            return;
        }

        const tickers = [...new Set(portfolio.map(p => (p.ticker || '').trim().toUpperCase()))].filter(Boolean);
        const missing = tickers.filter(t => !liveData[t]);

        if (missing.length > 0) {
            setIsLoadingData(true);
            const loadData = async () => {
                await Promise.all(missing.map(async (ticker) => {
                    try {
                        const data = await fetchStockData(ticker);

                        // Fix: Correctly extract from overview
                        const price = data.overview?.price || 0;
                        const beta = data.overview?.beta || 1;
                        const sector = data.overview?.sector || 'Unknown';
                        const pegRatio = data.overview?.pegRatio || 0;

                        // Fix: Extract from valuation raw_assumptions or use 0
                        const totalCash = data.valuation?.raw_assumptions?.cash_and_equivalents || 0;
                        const totalDebt = data.valuation?.raw_assumptions?.total_debt || 0;

                        // Fix: Extract growth from valuation assumptions string or default
                        let growth = 0;
                        const growthStr = data.valuation?.assumptions?.["Growth Rate (Yr 1-5)"] ||
                            data.valuation?.assumptions?.["Projected Sales Growth"];

                        if (growthStr) {
                            growth = parseFloat(String(growthStr).replace('%', '').replace(',', ''));
                        } else {
                            // Deep fallback if no valuation assumptions found
                            growth = (data.growth?.revenueGrowth || 0) * 100;
                        }

                        setLiveData(prev => ({
                            ...prev,
                            [ticker]: { price, beta, sector, growth, pegRatio, totalCash, totalDebt }
                        }));
                    } catch (e) {
                        console.error(`Failed to fetch ${ticker}`, e);
                    }
                }));
                setIsLoadingData(false);
            };
            loadData();
        }
    }, [portfolio]); // Removed liveData to prevent infinite loop

    // Fetch TWR
    useEffect(() => {
        if (portfolio && portfolio.length > 0) {
            const normalizedItems = portfolio
                .map(item => ({
                    ...item,
                    totalCost: item.totalCost !== undefined ? Number(item.totalCost) : (item.cost !== undefined ? Number(item.cost) : 0),
                    purchaseDate: (item.purchaseDate || new Date().toISOString().split('T')[0]).split('T')[0]
                }))
                .filter(item => item.totalCost > 0 && item.purchaseDate);

            if (normalizedItems.length > 0) {
                const comparisonTickers = comparisonStocks?.map(s => s.ticker) || [];
                calculatePortfolioTWR(normalizedItems, currentUser?.uid, comparisonTickers).then(data => {
                    if (data) setTwrData(data);
                });
            }
        } else {
            setTwrData(null);
        }
    }, [portfolio, comparisonStocks]);


    // --- Processing & Grouping (useMemo) ---
    const { displayList, totalValue, totalCost, mergedChartData, hhi, weightedBeta, weightedGrowth, weightedPeg, weightedLiquidity, totalPerformance, isTotalTWR, sectorData, categoryData, healthScore, healthCriteria, isCriticalRisk } = useMemo(() => {
        let tVal = 0;
        let tCost = 0;

        const items = portfolio.map(item => {
            const rawTicker = (item.ticker || '').trim().toUpperCase();
            const data = liveData[rawTicker] || { price: 0, beta: 1, sector: 'Unknown', growth: 0, pegRatio: 0, totalCash: 0, totalDebt: 0 };
            const currentPrice = (data.price || 0) * currentRate;
            const shares = parseFloat(item.shares) || 0;
            const totalPrincipal = (parseFloat(item.totalCost) || 0) * currentRate;
            const currentValue = currentPrice * shares;
            const performance = totalPrincipal > 0 ? ((currentValue - totalPrincipal) / totalPrincipal) * 100 : 0;
            const itemCategory = item.category || 'Uncategorized';

            return { ...item, ...data, ticker: rawTicker, category: itemCategory, price: currentPrice, currentValue, principal: totalPrincipal, performance };
        });

        const groups = {};
        items.forEach(item => {
            if (!groups[item.ticker]) {
                groups[item.ticker] = {
                    ticker: item.ticker,
                    category: item.category,
                    sector: item.sector,
                    beta: item.beta,
                    growth: item.growth,
                    pegRatio: item.pegRatio,
                    totalCash: item.totalCash,
                    totalDebt: item.totalDebt,
                    price: item.price,
                    shares: 0,
                    principal: 0,
                    currentValue: 0,
                    items: []
                };
            }
            const g = groups[item.ticker];
            g.items.push(item);
            g.shares += item.shares;
            g.principal += item.principal;
            g.currentValue += item.currentValue;
            if (item.category && item.category !== 'Uncategorized') g.category = item.category; // Ensure valid category
            tVal += item.currentValue;
            tCost += item.principal;
        });

        const groupList = Object.values(groups).map(g => {
            let performance = g.principal > 0 ? ((g.currentValue - g.principal) / g.principal) * 100 : 0;
            let isTWR = false;
            if (twrData && twrData.tickers && twrData.tickers[g.ticker] !== undefined) {
                performance = twrData.tickers[g.ticker];
                isTWR = true;
            }
            g.items.forEach(sub => {
                sub.weightPercent = tVal > 0 ? (sub.currentValue / tVal) * 100 : 0;
            });
            return {
                ...g,
                performance,
                weightPercent: tVal > 0 ? (g.currentValue / tVal) * 100 : 0,
            };
        });

        // Stats Calculation (HHI, Beta, etc)
        // We calculate weights relative to total portfolio value (tVal)
        let h = 0;
        let sumWb = 0, weightWithBeta = 0;
        let sumWg = 0, weightWithGrowth = 0;
        let sumWPeg = 0, weightWithPeg = 0;
        let sumWLiq = 0, weightWithLiq = 0;

        groupList.forEach(g => {
            const weight = tVal > 0 ? (g.currentValue / tVal) : 0;
            if (weight <= 0) return;

            // HHI (Concentration) - based on ALL items
            h += (weight * weight);

            // Beta
            if (g.beta !== undefined && g.beta !== null) {
                sumWb += (g.beta * weight);
                weightWithBeta += weight;
            }

            // Growth
            if (g.growth > 0) {
                sumWg += (g.growth * weight);
                weightWithGrowth += weight;
            }

            // PEG
            if (g.pegRatio > 0) {
                sumWPeg += (g.pegRatio * weight);
                weightWithPeg += weight;
            }

            // Liquidity
            const liqRatio = g.totalDebt > 0 ? g.totalCash / g.totalDebt : 2.0;
            sumWLiq += (liqRatio * weight);
            weightWithLiq += weight;
        });

        // Normalize weighted averages
        const wb = weightWithBeta > 0 ? sumWb / weightWithBeta : 1.0;
        const wg = weightWithGrowth > 0 ? sumWg / weightWithGrowth : 0;
        const wPeg = weightWithPeg > 0 ? sumWPeg / weightWithPeg : 0;
        const wLiq = weightWithLiq > 0 ? sumWLiq / weightWithLiq : 2.0;

        // Filter valid list
        let filteredList = groupList.sort((a, b) => a.ticker.localeCompare(b.ticker));
        if (searchTicker) {
            filteredList = filteredList.filter(g => g.ticker.toLowerCase().includes(searchTicker.toLowerCase()));
        }

        let tPerf = tCost > 0 ? ((tVal - tCost) / tCost) * 100 : 0;
        let isTotTWR = false;
        if (twrData && twrData.total_twr !== undefined && twrData.total_twr !== null) {
            tPerf = twrData.total_twr;
            isTotTWR = true;
        }

        // Charts data
        const secMap = {}; const catMap = {};
        groupList.forEach(g => {
            secMap[g.sector] = (secMap[g.sector] || 0) + g.currentValue;
            catMap[g.category] = (catMap[g.category] || 0) + g.currentValue;
        });
        const sectorData = Object.keys(secMap).map(k => ({ name: k, value: secMap[k] }));
        const categoryData = Object.keys(catMap).map(k => ({ name: k, value: catMap[k] }));

        // Health Score Calculation
        let earnedPoints = 0;
        const criteria = [];
        const addCriteria = (name, pts, max, val) => {
            const status = pts === max ? 'Pass' : (pts >= max * 0.5 ? 'Warning' : 'Fail');
            criteria.push({ name, value: val, points: pts, max, status });
            earnedPoints += pts;
        };

        // 1. HHI concentration (Max 15)
        let divPts = 0;
        if (h < 0.10) divPts = 15;
        else if (h <= 0.15) divPts = 7;
        else divPts = 0;
        addCriteria("HHI concentration", divPts, 15, h.toFixed(3));

        // 2. Category Allocation (Max 35)
        let catPointsSum = 0;
        const uncategorizedVal = groupList.filter(g => g.category === 'Uncategorized').reduce((a, b) => a + b.currentValue, 0);
        const uncategorizedPct = tVal > 0 ? (uncategorizedVal / tVal) * 100 : 0;

        // Speculative (10 pts)
        const specItem = categoryData.find(c => c.name === 'Speculative');
        const specPctValue = tVal > 0 ? ((specItem?.value || 0) / tVal) * 100 : 0;
        let specPtsSub = 10;
        if (specPctValue >= 14) {
            specPtsSub = 0;
        } else if (specPctValue > 10) {
            specPtsSub -= Math.floor((specPctValue - 10) / 2) * 5;
        }
        catPointsSum += Math.max(0, specPtsSub);

        // Growth (5 pts): 30% – 40%
        const growthItem = categoryData.find(c => c.name === 'Growth');
        const growthPctValue = tVal > 0 ? ((growthItem?.value || 0) / tVal) * 100 : 0;
        if (growthPctValue >= 30 && growthPctValue <= 40) catPointsSum += 5;

        // Core (5 pts): 20% – 30%
        const coreItem = categoryData.find(c => c.name === 'Core');
        const corePctValue = tVal > 0 ? ((coreItem?.value || 0) / tVal) * 100 : 0;
        if (corePctValue >= 20 && corePctValue <= 30) catPointsSum += 5;

        // Compounder (5 pts): 20% – 25%
        const compItem = categoryData.find(c => c.name === 'Compounder');
        const compPctValue = tVal > 0 ? ((compItem?.value || 0) / tVal) * 100 : 0;
        if (compPctValue >= 20 && compPctValue <= 25) catPointsSum += 5;

        // Defensive (5 pts): 15% – 20%
        const defItem = categoryData.find(c => c.name === 'Defensive');
        const defPctValue = tVal > 0 ? ((defItem?.value || 0) / tVal) * 100 : 0;
        if (defPctValue >= 15 && defPctValue <= 20) catPointsSum += 5;

        // Portfolio Balance (5 pts)
        if (tVal > 0) catPointsSum += 5;

        addCriteria("Category allocation", catPointsSum, 35, `${(100 - uncategorizedPct).toFixed(1)}% Categorized`);

        // 3. Portfolio Beta (Max 10)
        let betaPts = 0;
        if (wb >= 0.8 && wb <= 1.2) betaPts = 10;
        else if (wb >= 0.7 && wb <= 1.3) betaPts = 3;
        addCriteria("Portfolio beta", betaPts, 10, wb.toFixed(2));

        // 4. Sector Allocation (Max 10)
        let sectPtsSum = 10;
        const SECTOR_LIMITS = {
            'Information Technology': 30,
            'Technology': 30,
            'Financials': 25,
            'Financial Services': 25,
            'Healthcare': 20,
            'Communication Services': 20,
            'Consumer Defensive': 20,
            'Non-Cyclical': 20
        };

        sectorData.forEach(s => {
            const pct = tVal > 0 ? (s.value / tVal) * 100 : 0;
            const limit = SECTOR_LIMITS[s.name] || 15;
            if (pct > limit) sectPtsSum -= 2;
        });
        sectPtsSum = Math.max(0, sectPtsSum);
        const maxSectorPctVal = sectorData.length > 0 ? Math.max(...sectorData.map(s => (s.value / tVal) * 100)) : 0;
        addCriteria("Sector allocation", sectPtsSum, 10, maxSectorPctVal > 0 ? `${maxSectorPctVal.toFixed(1)}% Max` : 'N/A');

        // 5. Portfolio est 5y growth (Max 10)
        let growthPtsScore = 0;
        if (wg > 10) growthPtsScore = 10;
        else if (wg >= 7) growthPtsScore = 5;
        addCriteria("Portfolio est 5y growth", growthPtsScore, 10, `${wg.toFixed(1)}%`);

        // 6. Portfolio peg ratio (Max 10)
        let pegPtsScore = 0;
        if (wPeg > 0 && wPeg < 1.5) pegPtsScore = 10;
        else if (wPeg >= 1.5 && wPeg <= 2.0) pegPtsScore = 5;
        addCriteria("Portfolio peg ratio", pegPtsScore, 10, wPeg > 0 ? wPeg.toFixed(2) : 'N/A');

        // 7. Portfolio debt to cash ratio (Max 10)
        let liqPtsScore = 0;
        if (wLiq > 0.8) liqPtsScore = 10;
        else if (wLiq >= 0.4) liqPtsScore = 5;
        addCriteria("Financial stability", liqPtsScore, 10, wLiq.toFixed(2));

        // Calculate final percentage score
        const finalHealthScore = Math.min(100, earnedPoints);

        // Merged Chart Data
        const chart_data_final = twrData?.chart_data?.map(d => ({ ...d })) || [];

        // Critical Risk Warning
        const criticalRiskActive = h > 0.15 || specPctValue > 15;

        return {
            displayList: filteredList,
            totalValue: tVal,
            totalCost: tCost,
            hhi: h,
            weightedBeta: wb,
            weightedGrowth: wg,
            weightedPeg: wPeg,
            weightedLiquidity: wLiq,
            totalPerformance: tPerf,
            isTotalTWR: isTotTWR,
            sectorData,
            categoryData,
            healthScore: finalHealthScore,
            healthCriteria: criteria,
            isCriticalRisk: criticalRiskActive,
            mergedChartData: chart_data_final
        };
    }, [portfolio, liveData, currentRate, searchTicker, twrData]);


    // Handlers
    const handleAddStock = async () => {
        if (!currentPortfolioId) { setAddError("Please select or create a portfolio first"); return; }
        if (!newTicker || !newShares || !newCost) { setAddError("Please fill all required fields"); return; }

        setIsLoadingData(true);
        setAddError("");

        try {
            // Validate ticker
            const data = await fetchStockData(newTicker.toUpperCase());
            if (!data || !data.overview || !data.overview.symbol) {
                setAddError("Invalid ticker. Please check and try again.");
                setIsLoadingData(false);
                return;
            }

            const costInUSD = parseFloat(newCost) / currentRate;
            await addToPortfolio({
                ticker: newTicker.toUpperCase(),
                shares: parseFloat(newShares),
                totalCost: costInUSD,
                purchaseDate: newDate,
                category: newCategory
            });
            setShowAddModal(false);
            setNewTicker('');
            setNewShares('');
            setNewCost('');
            setNewDate('');
            setAddError('');
        } catch (e) {
            setAddError("Error validating ticker. Please try again.");
        } finally {
            setIsLoadingData(false);
        }
    };

    const handleCreatePortfolioSubmit = () => {
        if (newPortfolioName.trim()) {
            createPortfolio(newPortfolioName.trim(), newPortfolioType);
            setIsCreating(false);
            setNewPortfolioName('');
        }
    };

    const handleAnalyzePortfolio = useCallback(async (force = false) => {
        if (!portfolio.length || !currentPortfolioId) return;
        setAnalyzing(true);
        try {
            const metrics = { weightedBeta: weightedBeta.toFixed(2), weightedGrowth: weightedGrowth.toFixed(2) };
            const result = await analyzePortfolio(portfolio, metrics, currentUser?.uid, force, currentPortfolioId);
            if (result && result.analysis) setAnalysis(result.analysis);
        } catch (e) {
            console.error(e);
        } finally {
            setAnalyzing(false);
        }
    }, [portfolio, currentPortfolioId, weightedBeta, weightedGrowth, currentUser]);

    // Load User Preferences
    useEffect(() => {
        if (currentUser?.uid) {
            fetchUserSettings(currentUser.uid).then(settings => {
                if (settings?.portfolioUIStates) setPortfolioUIStates(settings.portfolioUIStates);
                if (settings?.hiddenColumns) setHiddenColumns(settings.hiddenColumns);
            });
        }
    }, [currentUser]);

    // Sync active cards
    useEffect(() => {
        if (currentPortfolioId && portfolioUIStates[currentPortfolioId]) {
            setOpenCards(portfolioUIStates[currentPortfolioId]);
        } else {
            setOpenCards({ allocation: true, ai: true, holdings: true, summary: true });
        }
    }, [currentPortfolioId, portfolioUIStates]);

    const toggleCard = (key) => {
        const newState = { ...openCards, [key]: !openCards[key] };
        setOpenCards(newState);
        setPortfolioUIStates(prev => ({ ...prev, [currentPortfolioId]: newState }));
        if (currentUser?.uid && currentPortfolioId) {
            saveUserSettings(currentUser.uid, { portfolioUIStates: { ...portfolioUIStates, [currentPortfolioId]: newState } });
        }
    };


    const handleSaveNotes = (newNotes) => {
        if (!currentPortfolioId) return;
        setPortfolioNotes(prev => {
            const newState = { ...prev, [currentPortfolioId]: newNotes };
            if (currentUser?.uid) {
                saveUserSettings(currentUser.uid, { portfolioNotes: newState });
            }
            return newState;
        });
    };

    const handleCopyClick = () => {
        setShowCopyModal(true);
        const other = portfolioList.filter(p => p.id !== currentPortfolioId);
        if (other.length > 0) handleSourceChange(other[0].id);
    };

    const handleSourceChange = (id) => {
        setCopySourceId(id);
        const p = portfolioList.find(x => x.id === id);
        setSourceItems(p?.portfolio || []);
    };

    const handleCopySubmit = async () => {
        const items = sourceItems.filter(i => selectedCopyItems.includes(i.id));
        await copyItemsFromPortfolio(currentPortfolioId, items);
        setShowCopyModal(false);
        setSelectedCopyItems([]);
    };

    const handleSelectAllHoldings = () => {
        setSelectedCopyItems(sourceItems.map(i => i.id));
    };

    const handleClearHoldingsSelection = () => {
        setSelectedCopyItems([]);
    };

    const handleConfirmDelete = async () => {
        const targetId = actionTargetId || currentPortfolioId;
        if (targetId) {
            await deletePortfolio(targetId);
            setShowDeleteModal(false);
            if (targetId === currentPortfolioId) {
                setCurrentPortfolioId(null);
            }
            setActionTargetId(null);
        }
    };

    const handleClearAll = () => setShowClearPortfolioModal(true);
    const handleConfirmClearAll = async () => { await clearPortfolio(); setShowClearPortfolioModal(false); };
    const handleConfirmClearAnalysis = async () => {
        await clearAnalysis(); // Clear from DB
        setAnalysis(null); // Clear locally
        setShowClearAnalysisModal(false);
    };

    // List Action Handlers
    const [actionTargetId, setActionTargetId] = useState(null);

    const handleListDeleteStart = (id) => {
        setActionTargetId(id);
        setShowDeleteModal(true);
    };

    const toggleColumn = (key) => {
        const newState = hiddenColumns.includes(key) ? hiddenColumns.filter(k => k !== key) : [...hiddenColumns, key];
        setHiddenColumns(newState);
        if (currentUser?.uid) saveUserSettings(currentUser.uid, { hiddenColumns: newState });
    };

    const logoContainerContent = (<TopNavLogo customTitle={isMobile ? null : "My Portfolio"} />);
    const backButtonContent = (
        <Button
            onClick={() => navigate('/')}
            variant="icon"
        >
            <ArrowLeft size={20} />
        </Button>
    );

    // Header Actions
    const actionGroupContent = (
        <TopNavActions
            searchTicker={searchTicker} setSearchTicker={setSearchTicker}
            handleSearch={async (val) => {
                if (val && val.preventDefault) val.preventDefault();
                const tickerVal = (typeof val === 'string' ? val : searchTicker).trim().toUpperCase();
                if (!tickerVal) return;

                try {
                    // Validate
                    await fetchStockData(tickerVal);
                    navigate(`/analysis?ticker=${tickerVal}`);
                    setSearchTicker('');
                } catch (e) {
                    setFailedTicker(tickerVal);
                    setShowErrorModal(true);
                }
            }}
            currency={currency} setCurrency={setCurrency}
            setShowWatchlist={setShowWatchlist}
            setShowProfileModal={setShowProfileModal}
            handleLogout={logout}
        />
    );

    const ALL_COLUMNS = [
        { key: 'ticker', label: 'Ticker' }, { key: 'category', label: 'Category' },
        { key: 'sector', label: 'Sector' }, { key: 'beta', label: 'Beta' },
        { key: 'initAmt', label: 'Cost Basis' }, { key: 'invDate', label: 'Date' },
        { key: 'price', label: 'Price' }, { key: 'position', label: 'Position' },
        { key: 'totalValue', label: 'Total Value' }, { key: 'weight', label: 'Weight' },
        { key: 'return', label: 'Return' }, { key: 'growth', label: 'Growth' }
    ];

    const SERIES_COLORS = ['var(--neu-success)', 'var(--neu-color-favorite)', '#60a5fa', '#f87171', '#a78bfa'];

    const handleAddComparison = (ticker) => {
        const term = ticker.toUpperCase();
        if (comparisonStocks.some(s => s.ticker === term)) return;
        const newStocks = [...comparisonStocks, {
            ticker: term,
            color: SERIES_COLORS[(comparisonStocks.length + 1) % SERIES_COLORS.length]
        }];
        updateComparisonStocks(newStocks);
    };

    const handleRemoveComparison = (ticker) => {
        const newStocks = comparisonStocks.filter(s => s.ticker !== ticker);
        updateComparisonStocks(newStocks);
    };

    return (
        <div className={styles.container}>
            {/* Logo Wrapper aligned with grid */}
            <div style={{ maxWidth: '80rem', margin: '0 auto', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '2rem', left: '0', zIndex: 60 }}>
                    {logoContainerContent}
                </div>
            </div>

            <CascadingHeader
                topRightContent={actionGroupContent}
                bottomLeftContent={backButtonContent}
                gap="40px"
            />

            <div className={styles.pageGrid}>
                {cardVisibility.summary && (
                    <PortfolioSummaryCard
                        portfolioList={portfolioList}
                        currentPortfolioId={currentPortfolioId}
                        currencySymbol={currency === 'USD' ? '$' : 'S$'}
                        totalValue={totalValue}
                        totalPerformance={totalPerformance}
                        totalCost={totalCost}
                        healthScore={healthScore}
                        twrData={twrData}
                        healthCriteria={healthCriteria}
                        isCriticalRisk={isCriticalRisk}
                        mergedChartData={mergedChartData}
                        comparisonStocks={comparisonStocks}
                        weightedBeta={weightedBeta}
                        weightedGrowth={weightedGrowth}
                        hhi={hhi}
                        weightedPeg={weightedPeg}
                        weightedLiquidity={weightedLiquidity}
                        theme={theme}
                        openCards={openCards}
                        toggleCard={toggleCard}
                        onAddComparison={handleAddComparison}
                        onRemoveComparison={handleRemoveComparison}
                        onNewPortfolio={() => { setIsCreating(true); setNewPortfolioName(''); setNewPortfolioType(portfolioType); }}
                        onRenamePortfolio={handleRenameStart}
                        onDeletePortfolio={() => setShowDeleteModal(true)}
                        onSelectPortfolio={() => setShowSelectPortfolioModal(true)}
                        onShowDetails={() => setShowPortfolioDetails(true)}
                        isMounted={true}
                        // Inline Rename Props
                        isRenaming={isRenaming}
                        setIsRenaming={setIsRenaming}
                        renameValue={renameValue}
                        setRenameValue={setRenameValue}
                        onRenameSubmit={handleRenameSubmit}
                    />
                )}

                {cardVisibility.allocation && (
                    <AllocationCard
                        portfolioList={portfolioList}
                        portfolioLength={portfolio.length}
                        openCards={openCards}
                        toggleCard={toggleCard}
                        categoryData={categoryData}
                        sectorData={sectorData}
                        totalValue={totalValue}
                        currencySymbol={currency === 'USD' ? '$' : 'S$'}
                        isMounted={true}
                        onRefresh={() => window.location.reload()}
                    />
                )}

                {cardVisibility.ai && (
                    <AiInsightsCard
                        portfolioList={portfolioList}
                        analysis={analysis}
                        analyzing={analyzing}
                        openCards={openCards}
                        toggleCard={toggleCard}
                        handleAnalyzePortfolio={handleAnalyzePortfolio}
                        setShowClearAnalysisModal={setShowClearAnalysisModal}
                        notes={notes}
                        onSaveNotes={saveNotes}
                    />
                )}

                {cardVisibility.holdings && (
                    <HoldingsCard
                        portfolioList={portfolio}
                        displayList={displayList}
                        openCards={openCards}
                        toggleCard={toggleCard}
                        hiddenColumns={hiddenColumns}
                        currency={currency}
                        currencySymbol={currency === 'USD' ? '$' : 'S$'}
                        currentRate={currentRate}
                        isMobile={isMobile}
                        menuOpenHoldings={menuOpenHoldings}
                        setMenuOpenHoldings={setMenuOpenHoldings}
                        onAdd={() => setShowAddModal(true)}
                        onCopy={handleCopyClick}
                        onClear={handleClearAll}
                        onColumnToggle={() => setShowColumnModal(true)}
                        updatePortfolioItem={updatePortfolioItem}
                        removeFromPortfolio={removeFromPortfolio}
                    />
                )}
            </div>

            {/* Globals Modals */}

            {showAddModal && (
                <Window
                    isOpen={showAddModal}
                    onClose={() => setShowAddModal(false)}
                    title="Add Stock"
                    width="450px"
                    height="auto"
                    headerAlign="start"
                    hideCloseButton={true}
                    controls={
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <Button
                                variant="icon"
                                onClick={() => setShowAddModal(false)}
                                title="Cancel"
                                style={{ color: 'var(--neu-text-secondary)' }}
                            >
                                <X size={20} />
                            </Button>
                            <Button
                                variant="icon"
                                onClick={handleAddStock}
                                title="Add Holding"
                                style={{ color: 'var(--neu-brand)' }}
                            >
                                <Check size={20} />
                            </Button>
                        </div>
                    }
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className={styles.addForm} style={{ padding: 0 }}>
                            <div className={styles.formGroup}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--neu-text-tertiary)', fontWeight: 600 }}>Ticker</label>
                                <input
                                    type="text"
                                    value={newTicker}
                                    onChange={e => setNewTicker(e.target.value)}
                                    placeholder="e.g. AAPL"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--neu-text-tertiary)', fontWeight: 600 }}>Shares</label>
                                <input
                                    type="number"
                                    value={newShares}
                                    onChange={e => setNewShares(e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--neu-text-tertiary)', fontWeight: 600 }}>Cost</label>
                                <input
                                    type="number"
                                    value={newCost}
                                    onChange={e => setNewCost(e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--neu-text-tertiary)', fontWeight: 600 }}>Date</label>
                                <CustomDatePicker value={newDate} onChange={setNewDate} isMobile={isMobile} />
                            </div>
                            <div className={styles.formGroup}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--neu-text-tertiary)', fontWeight: 600 }}>Category</label>
                                <CustomSelect
                                    value={newCategory}
                                    onChange={setNewCategory}
                                    options={['Core', 'Growth', 'Compounder', 'Defensive', 'Speculative']}
                                />
                            </div>
                            {addError && <p className={styles.error}>{addError}</p>}
                        </div>
                    </div>
                </Window>
            )}

            {showWatchlist && <WatchlistModal isOpen={showWatchlist} onClose={() => setShowWatchlist(false)} currency={currency} currencySymbol={currency === 'USD' ? '$' : 'S$'} currentRate={currentRate} />}
            {showProfileModal && currentUser && <UserProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} user={currentUser} onLogout={() => setShowLogoutConfirm(true)} />}

            <LogoutConfirmationModal
                isOpen={showLogoutConfirm}
                onClose={() => setShowLogoutConfirm(false)}
                onConfirm={logout}
            />

            {showClearAnalysisModal && (
                <Window
                    isOpen={showClearAnalysisModal}
                    onClose={() => setShowClearAnalysisModal(false)}
                    title="Clear Analysis"
                    width="400px"
                    height="auto"
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <p style={{ color: 'var(--neu-text-secondary)', lineHeight: '1.5' }}>
                            Are you sure you want to clear the current portfolio analysis?
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <Button onClick={() => setShowClearAnalysisModal(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleConfirmClearAnalysis} style={{ color: 'var(--neu-danger)' }}>
                                Clear Analysis
                            </Button>
                        </div>
                    </div>
                </Window>
            )}

            {showColumnModal && (
                <Window
                    isOpen={showColumnModal}
                    onClose={() => setShowColumnModal(false)}
                    title="Column Visibility"
                    width="400px"
                    height="auto"
                    headerAlign="start"
                >
                    <div className={styles.columnToggleGrid}>
                        {ALL_COLUMNS.map(col => {
                            const isActive = !hiddenColumns.includes(col.key);
                            return (
                                <div
                                    key={col.key}
                                    className={`${styles.columnToggleItem} ${isActive ? styles.active : ''}`}
                                    onClick={() => toggleColumn(col.key)}
                                >
                                    <div className={styles.columnToggleCheck}>
                                        {isActive && <Check size={14} />}
                                    </div>
                                    <span className={styles.columnToggleLabel}>{col.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </Window>
            )}

            {showClearPortfolioModal && (
                <Window
                    isOpen={showClearPortfolioModal}
                    onClose={() => setShowClearPortfolioModal(false)}
                    title="Clear Holdings"
                    width="400px"
                    height="auto"
                    headerAlign="start"
                    hideCloseButton={true}
                    controls={
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <Button
                                variant="icon"
                                onClick={() => setShowClearPortfolioModal(false)}
                                title="Cancel"
                                style={{ color: 'var(--neu-text-secondary)' }}
                            >
                                <X size={20} />
                            </Button>
                            <Button
                                variant="icon"
                                onClick={handleConfirmClearAll}
                                title="Clear All"
                                style={{ color: 'var(--neu-danger)' }}
                            >
                                <Check size={20} />
                            </Button>
                        </div>
                    }
                >
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <p style={{ color: 'var(--neu-text-secondary)', lineHeight: '1.5' }}>
                            Are you sure you want to delete all items from your holdings? This action cannot be undone.
                        </p>
                    </div>
                </Window>
            )}



            {/* Window for Portfolio Selection */}
            {showSelectPortfolioModal && (
                <PortfolioSelectWindow
                    isOpen={showSelectPortfolioModal}
                    onClose={() => setShowSelectPortfolioModal(false)}
                    portfolioList={portfolioList}
                    currentPortfolioId={currentPortfolioId}
                    setCurrentPortfolioId={handlePortfolioChange}
                    setPortfolioType={setPortfolioType}
                    portfolioType={portfolioType}
                    styles={styles}
                    onNewPortfolio={() => { setIsCreating(true); setNewPortfolioName(''); setNewPortfolioType(portfolioType); }}
                    onRename={(id, name) => renamePortfolio(id, name)}
                    onDelete={handleListDeleteStart}
                />
            )}

            {/* New Portfolio Window */}
            {isCreating && (
                <Window
                    isOpen={isCreating}
                    onClose={() => setIsCreating(false)}
                    title="New Portfolio"
                    width="400px"
                    height="auto"
                    headerAlign="start"
                    hideCloseButton={true}
                    controls={
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <Button
                                variant="icon"
                                onClick={() => setIsCreating(false)}
                                title="Cancel"
                                style={{ color: 'var(--neu-text-secondary)' }}
                            >
                                <X size={20} />
                            </Button>
                            <Button
                                variant="icon"
                                onClick={handleCreatePortfolioSubmit}
                                title="Add"
                                style={{ color: 'var(--neu-success)' }}
                            >
                                <Check size={20} />
                            </Button>
                        </div>
                    }
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <div
                                onClick={() => setNewPortfolioType('main')}
                                style={{
                                    paddingRight: '1rem',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    background: newPortfolioType === 'main' ? 'var(--neu-brand)' : 'transparent',
                                    color: newPortfolioType === 'main' ? '#000000ff' : 'var(--neu-text-secondary)',
                                    fontWeight: 600,
                                    fontSize: '0.9rem',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                Main
                            </div>
                            <div
                                onClick={() => setNewPortfolioType('test')}
                                style={{
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    background: newPortfolioType === 'test' ? 'var(--neu-brand)' : 'transparent',
                                    color: newPortfolioType === 'test' ? '#000000ff' : 'var(--neu-text-secondary)',
                                    fontWeight: 600,
                                    fontSize: '0.9rem',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                Test
                            </div>
                        </div>

                        <input
                            value={newPortfolioName}
                            onChange={(e) => setNewPortfolioName(e.target.value)}
                            placeholder="Portfolio Name"
                            autoFocus
                            style={{
                                width: '100%',
                                padding: '0.8rem',
                                borderRadius: '12px',
                                border: '1px solid var(--neu-border-subtle)',
                                background: 'var(--neu-bg)',
                                color: 'var(--neu-text-primary)',
                                fontSize: '1rem',
                                outline: 'none'
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreatePortfolioSubmit()}
                        />
                    </div>
                </Window>
            )}

            {/* Delete Confirmation Window */}
            {showDeleteModal && (
                <Window
                    isOpen={showDeleteModal}
                    onClose={() => setShowDeleteModal(false)}
                    title="Delete Portfolio"
                    width="400px"
                    height="auto"
                    headerAlign="start"
                    hideCloseButton={true}
                    controls={
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <Button
                                variant="icon"
                                onClick={() => setShowDeleteModal(false)}
                                title="Cancel"
                                style={{ color: 'var(--neu-text-secondary)' }}
                            >
                                <X size={20} />
                            </Button>
                            <Button
                                variant="icon"
                                onClick={handleConfirmDelete}
                                title="Delete"
                                style={{ color: 'var(--neu-danger)' }}
                            >
                                <Check size={20} />
                            </Button>
                        </div>
                    }
                >
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <p style={{ color: 'var(--neu-text-secondary)', lineHeight: '1.5' }}>
                            Are you sure you want to delete <strong>{portfolioList.find(p => p.id === (actionTargetId || currentPortfolioId))?.name}</strong>? This action cannot be undone.
                        </p>
                    </div>
                </Window>
            )}

            {/* Window for Portfolio Details (Metrics) */}
            {showPortfolioDetails && (
                <Window
                    isOpen={showPortfolioDetails}
                    onClose={() => setShowPortfolioDetails(false)}
                    title="Portfolio Details"
                    width="500px"
                    height="auto"
                >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem' }}>
                        <div className="metric-card secondary">
                            <span className="metric-label">Portfolio Beta</span>
                            <span className="metric-value">{weightedBeta?.toFixed(2)}</span>
                        </div>
                        <div className="metric-card secondary">
                            <span className="metric-label">Est. 5Y Growth</span>
                            <span className="metric-value">{weightedGrowth?.toFixed(1)}%</span>
                        </div>
                        <div className="metric-card secondary">
                            <span className="metric-label">HHI Concentration</span>
                            <span className="metric-value">{hhi?.toFixed(3)}</span>
                        </div>
                        <div className="metric-card secondary">
                            <span className="metric-label">Portfolio PEG</span>
                            <span className="metric-value">{weightedPeg?.toFixed(2)}</span>
                        </div>
                        <div className="metric-card secondary">
                            <span className="metric-label">Debt to Cash</span>
                            <span className="metric-value">{weightedLiquidity?.toFixed(2)}</span>
                        </div>
                    </div>
                </Window>
            )}

            {showCopyModal && (
                <Window
                    isOpen={showCopyModal}
                    onClose={() => setShowCopyModal(false)}
                    title="Copy Holdings"
                    width="450px"
                    height="auto"
                    headerAlign="start"
                    hideCloseButton={true}
                    controls={
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <Button
                                variant="icon"
                                onClick={() => setShowCopyModal(false)}
                                title="Cancel"
                                style={{ color: 'var(--neu-text-secondary)' }}
                            >
                                <X size={20} />
                            </Button>
                            <Button
                                variant="icon"
                                onClick={handleCopySubmit}
                                title="Copy Holdings"
                                style={{ color: 'var(--neu-brand)' }}
                            >
                                <Check size={20} />
                            </Button>
                        </div>
                    }
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className={styles.formGroup}>
                            <label style={{ fontSize: '0.85rem', color: 'var(--neu-text-tertiary)', fontWeight: 600 }}>Source Portfolio</label>
                            <CustomSelect
                                value={copySourceId}
                                onChange={handleSourceChange}
                                options={portfolioList.filter(p => p.id !== currentPortfolioId).map(p => ({ label: p.name, value: p.id }))}
                                placeholder="Select Portfolio"
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--neu-text-tertiary)', fontWeight: 600 }}>Select holdings to copy</label>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <button
                                        onClick={handleSelectAllHoldings}
                                        style={{ background: 'none', border: 'none', color: 'var(--neu-brand)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                                    >
                                        Select All
                                    </button>
                                    <button
                                        onClick={handleClearHoldingsSelection}
                                        style={{ background: 'none', border: 'none', color: 'var(--neu-text-tertiary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                                    >
                                        Clear All
                                    </button>
                                </div>
                            </div>

                            <div
                                className="window-content"
                                style={{
                                    maxHeight: '250px',
                                    border: '1px solid var(--neu-border-subtle)',
                                    borderRadius: '16px',
                                    padding: '1rem',
                                    background: 'rgba(255, 255, 255, 0.02)',
                                    overflowY: 'auto'
                                }}
                            >
                                <div className={styles.columnToggleGrid}>
                                    {sourceItems.map(i => {
                                        const isSelected = selectedCopyItems.includes(i.id);
                                        return (
                                            <div
                                                key={i.id}
                                                className={`${styles.columnToggleItem} ${isSelected ? styles.active : ''}`}
                                                onClick={() => setSelectedCopyItems(p => p.includes(i.id) ? p.filter(x => x !== i.id) : [...p, i.id])}
                                            >
                                                <div className={styles.columnToggleCheck}>
                                                    {isSelected && <Check size={14} />}
                                                </div>
                                                <span className={styles.columnToggleLabel}>{i.ticker}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                {sourceItems.length === 0 && (
                                    <div style={{ padding: '2.5rem', textAlign: 'center', opacity: 0.5, fontSize: '0.9rem' }}>
                                        No holdings available to copy
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </Window>
            )}

            {portfolioLoading || isLoadingData ? <div className={styles.loadingOverlay}><div className={styles.spinner}></div></div> : null}

            {/* Search Error Window */}
            <Window
                isOpen={showErrorModal}
                onClose={() => setShowErrorModal(false)}
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

        </div>
    );
};

const PortfolioSelectWindow = ({ isOpen, onClose, portfolioList, currentPortfolioId, setCurrentPortfolioId, portfolioType, styles, onNewPortfolio, onRename, onDelete }) => {
    const [tempSelectedId, setTempSelectedId] = useState(currentPortfolioId);
    const [activeTab, setActiveTab] = useState(portfolioType || 'main');

    // Inline Editing State
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState('');

    // Reset states when opening
    useEffect(() => {
        if (isOpen) {
            setTempSelectedId(currentPortfolioId);
            setActiveTab(portfolioType || 'main');
            setEditingId(null);
        }
    }, [isOpen, currentPortfolioId, portfolioType]);

    const filteredPortfolios = useMemo(() => {
        return portfolioList.filter(p => (p.type || 'main') === activeTab);
    }, [portfolioList, activeTab]);

    const handleConfirm = () => {
        if (tempSelectedId) {
            setCurrentPortfolioId(tempSelectedId);
            onClose();
        }
    };

    const startEditing = (e, id, name) => {
        e.stopPropagation();
        setEditingId(id);
        setEditValue(name);
    };

    const saveEdit = async (e) => {
        e.stopPropagation();
        if (editValue.trim() && editingId) {
            await onRename(editingId, editValue.trim());
            setEditingId(null);
        }
    };

    const cancelEdit = (e) => {
        e.stopPropagation();
        setEditingId(null);
        setEditValue('');
    };

    return (
        <Window
            isOpen={isOpen}
            onClose={onClose}
            title="Select Portfolio"
            width="450px"
            height="auto"
            headerAlign="start"
            hideCloseButton={true}
            controls={
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <Button
                        variant="icon"
                        onClick={onNewPortfolio}
                        title="New Portfolio"
                        style={{ color: 'var(--neu-brand)', marginRight: '0.5rem' }}
                    >
                        <Plus size={20} />
                    </Button>
                    {!editingId && (
                        <>
                            <Button
                                variant="icon"
                                onClick={onClose}
                                title="Cancel"
                                style={{ color: 'var(--neu-text-secondary)' }}
                            >
                                <X size={20} />
                            </Button>
                            <Button
                                variant="icon"
                                onClick={handleConfirm}
                                title="Confirm"
                                style={{ color: 'var(--neu-success)' }}
                            >
                                <Check size={20} />
                            </Button>
                        </>
                    )}
                </div>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>

                {/* Type Selector Tabs */}
                <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid var(--neu-border-subtle)' }}>
                    <div
                        onClick={() => setActiveTab('main')}
                        style={{
                            padding: '0.75rem 0.5rem',
                            cursor: 'pointer',
                            borderBottom: activeTab === 'main' ? '2px solid var(--neu-brand)' : '2px solid transparent',
                            color: activeTab === 'main' ? 'var(--neu-text-primary)' : 'var(--neu-text-secondary)',
                            fontWeight: activeTab === 'main' ? 600 : 400,
                            transition: 'all 0.2s ease'
                        }}
                    >
                        Main
                    </div>
                    <div
                        onClick={() => setActiveTab('test')}
                        style={{
                            padding: '0.75rem 0.5rem',
                            cursor: 'pointer',
                            borderBottom: activeTab === 'test' ? '2px solid var(--neu-brand)' : '2px solid transparent',
                            color: activeTab === 'test' ? 'var(--neu-text-primary)' : 'var(--neu-text-secondary)',
                            fontWeight: activeTab === 'test' ? 600 : 400,
                            transition: 'all 0.2s ease'
                        }}
                    >
                        Test
                    </div>
                </div>

                {/* List */}
                <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '400px', overflowY: 'auto' }}>
                    {filteredPortfolios.map(p => (
                        <div
                            key={p.id}
                            onClick={() => !editingId && setTempSelectedId(p.id)}
                            style={{
                                padding: '0.75rem 0.5rem',
                                borderBottom: '1px solid var(--neu-border-subtle)',
                                cursor: editingId ? 'default' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'background 0.2s ease',
                                background: p.id === tempSelectedId ? 'rgba(var(--neu-text-primary-rgb), 0.05)' : 'transparent',
                                position: 'relative'
                            }}
                            className={styles.portfolioListItem}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, marginRight: '1rem' }}>
                                {editingId === p.id ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                                        <input
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            autoFocus
                                            style={{
                                                background: 'var(--neu-bg)',
                                                border: '1px solid var(--neu-border)',
                                                borderRadius: '4px',
                                                padding: '4px 8px',
                                                color: 'var(--neu-text-primary)',
                                                width: '100%',
                                                outline: 'none'
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') saveEdit(e);
                                                if (e.key === 'Escape') cancelEdit(e);
                                            }}
                                        />
                                        <Button
                                            variant="icon"
                                            onClick={saveEdit}
                                            style={{ color: 'var(--neu-success)' }}
                                            title="Save"
                                        >
                                            <Check size={24} />
                                        </Button>
                                        <Button
                                            variant="icon"
                                            onClick={cancelEdit}
                                            style={{ color: 'var(--neu-text-secondary)' }} // Matching footer cancel style
                                            title="Cancel"
                                        >
                                            <X size={24} />
                                        </Button>
                                    </div>
                                ) : (
                                    <span style={{
                                        fontWeight: p.id === tempSelectedId ? 600 : 400,
                                        color: p.id === tempSelectedId ? 'var(--neu-text-primary)' : 'var(--neu-text-secondary)'
                                    }}>
                                        {p.name}
                                    </span>
                                )}
                            </div>

                            {!editingId && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {p.id === tempSelectedId && <Check size={18} color="var(--neu-success)" style={{ marginRight: '0.5rem' }} />}

                                    <div className={styles.portfolioItemActions} style={{ display: 'flex', gap: '0.25rem' }}>
                                        <Button
                                            variant="icon"
                                            onClick={(e) => startEditing(e, p.id, p.name)}
                                            title="Rename"
                                            style={{ color: 'var(--neu-text-secondary)' }}
                                        >
                                            <Edit2 size={24} />
                                        </Button>
                                        <Button
                                            variant="icon"
                                            onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
                                            title="Delete"
                                            className="danger-item"
                                            style={{ color: 'var(--neu-danger)' }}
                                        >
                                            <Trash2 size={24} />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {filteredPortfolios.length === 0 && <div style={{ textAlign: 'center', opacity: 0.6, padding: '2rem' }}>No portfolios found.</div>}
                </div>
            </div>

        </Window >
    );
};

export default PortfolioPage;
