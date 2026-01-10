import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useStockData } from '../../hooks/useStockData';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, Legend
} from 'recharts';
import styles from './OverviewCard.module.css';
import { ChevronDown, Star } from 'lucide-react';
import { fetchChartData } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { useWatchlist } from '../../hooks/useWatchlist';

const OverviewCard = ({ moatStatusLabel, isMoatEvaluating, currency = 'USD', currencySymbol = '$', currentRate = 1 }) => {
    const { stockData, loading } = useStockData();
    const { theme } = useTheme();
    const { watchlist, addToWatchlist, removeFromWatchlist } = useWatchlist();
    const [timeframe, setTimeframe] = useState('1Y');
    const [showDetails, setShowDetails] = useState(false);
    const [chartData, setChartData] = useState([]);
    const [chartLoading, setChartLoading] = useState(false);

    const isInWatchlist = useMemo(() => {
        if (!stockData?.overview?.symbol) return false;
        return watchlist.some(item => item.ticker === stockData.overview.symbol);
    }, [watchlist, stockData?.overview?.symbol]);

    // Define chart colors based on theme
    const chartColors = useMemo(() => {
        const isDark = theme === 'dark';
        return {
            grid: isDark ? "#374151" : "#e5e7eb",
            text: isDark ? "#9CA3AF" : "#6b7280",
            tooltipBg: isDark ? "#1F2937" : "#ffffff",
            tooltipColor: isDark ? "#fff" : "#111827",
            tooltipBorder: isDark ? "none" : "1px solid #e5e7eb"
        };
    }, [theme]);

    // Fetch chart data when timeframe changes
    useEffect(() => {
        if (!stockData?.overview?.symbol) return;

        const loadChartData = async () => {
            setChartLoading(true);
            try {
                const data = await fetchChartData(stockData.overview.symbol, timeframe);
                setChartData(data.data || []);
            } catch (error) {
                console.error('Error fetching chart data:', error);
                setChartData([]);
            } finally {
                setChartLoading(false);
            }
        };

        loadChartData();
    }, [timeframe, stockData?.overview?.symbol]);

    const [chartHeight, setChartHeight] = useState(400); // Default height

    useEffect(() => {
        let timeoutId;
        const handleResize = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                setChartHeight(window.innerWidth < 768 ? 300 : 400);
            }, 100);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(timeoutId);
        };
    }, []);

    // --- Intersection Observer for "Light Up" Effect & Lazy Chart Loading ---
    const cardRef = React.useRef(null);
    const [isInView, setIsInView] = useState(false);
    const [shouldRenderChart, setShouldRenderChart] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsInView(entry.isIntersecting);
                if (entry.isIntersecting) {
                    setShouldRenderChart(true);
                }
            },
            {
                threshold: 0.1, // Trigger earlier for chart loading
                rootMargin: "0px"
            }
        );

        if (cardRef.current) {
            observer.observe(cardRef.current);
        }
        return () => {
            if (cardRef.current) {
                observer.unobserve(cardRef.current);
            }
        };
    }, [loading, stockData]);

    // --- Score Logic ---
    // Recalculate criteria with overrides
    const displayedCriteria = useMemo(() => {
        const score = stockData?.score;
        if (!score?.criteria) return [];
        return score.criteria.map(c => {
            if (c.name === "Economic Moat") {
                if (isMoatEvaluating) {
                    return {
                        ...c,
                        status: "Analyzing...",
                        value: "Pending"
                    };
                }
                if (moatStatusLabel) {
                    const isPass = moatStatusLabel === "Wide Moat";
                    return {
                        ...c,
                        status: isPass ? "Pass" : "Fail",
                        value: moatStatusLabel
                    };
                } else {
                    // Not evaluating and no result yet -> Pending Evaluation
                    return {
                        ...c,
                        status: "Pending Evaluation",
                        value: "Pending"
                    };
                }
            }
            return c;
        });
    }, [stockData, moatStatusLabel, isMoatEvaluating]);

    const calculatedTotal = useMemo(() => {
        // If the backend provides a weighted score, we should ideally use that.
        // However, since we are overriding the "Economic Moat" status here in the frontend,
        // we need to recalculate the weighted score locally to reflect that change.

        // Define weights locally to match backend (simplified lookup map)
        // Note: This duplicates logic, but is necessary for dynamic frontend updates without a new API call.
        // Ideally, we would fetch the weight map from the API, but hardcoding for now based on the request.

        let total = 0;

        // Helper to determine scenario (simplified check based on criteria presence)
        const hasCCC = displayedCriteria.some(c => c.name === "CCC Stable/Reducing");
        const hasGearing = displayedCriteria.some(c => c.name === "Gearing Ratio < 45%");

        const getWeight = (name) => {
            // Normalize name
            let key = name;
            if (name.includes("Historical Trend")) key = "Historical Trend (20Y)";

            // Scenario 2: REITs
            if (hasGearing) {
                const map = {
                    "Historical Trend (20Y)": 10,
                    "Net Income Increasing": 3, "Operating Income Increasing": 3,
                    "Operating Cash Flow Increasing": 3,
                    "Revenue Increasing": 3,
                    "Gross Margin Stable/Increasing": 5,
                    "Net Margin Stable/Increasing": 5,
                    "ROE > 12-15%": 10,
                    "ROIC > 12-15%": 15,
                    "Revenue > AR or Growing Faster": 4,
                    "Economic Moat": 5,
                    "Debt/EBITDA < 3": 15,
                    "Debt Servicing Ratio < 30%": 15,
                    "Current Ratio > 1.5": 5,
                    "Gearing Ratio < 45%": 5
                };
                return map[key] || 0;
            }

            // Scenario 1: CCC Applicable
            if (hasCCC) {
                const map = {
                    "Historical Trend (20Y)": 15,
                    "Net Income Increasing": 5, "Operating Income Increasing": 5,
                    "Operating Cash Flow Increasing": 5,
                    "Revenue Increasing": 10,
                    "Gross Margin Stable/Increasing": 10,
                    "Net Margin Stable/Increasing": 5,
                    "ROE > 12-15%": 5,
                    "ROIC > 12-15%": 15,
                    "Revenue > AR or Growing Faster": 1,
                    "CCC Stable/Reducing": 3,
                    "Economic Moat": 20,
                    "Debt/EBITDA < 3": 5,
                    "Debt Servicing Ratio < 30%": 1,
                    "Current Ratio > 1.5": 5
                };
                return map[key] || 0;
            }

            // Scenario 3: Standard
            const map = {
                "Historical Trend (20Y)": 5,
                "Net Income Increasing": 10, "Operating Income Increasing": 10,
                "Operating Cash Flow Increasing": 10,
                "Revenue Increasing": 5,
                "Gross Margin Stable/Increasing": 10,
                "Net Margin Stable/Increasing": 5,
                "ROE > 12-15%": 15,
                "ROIC > 12-15%": 15,
                "Revenue > AR or Growing Faster": 5,
                "Economic Moat": 20,
                "Debt/EBITDA < 3": 5,
                "Debt Servicing Ratio < 30%": 2,
                "Current Ratio > 1.5": 3
            };
            return map[key] || 0;
        };

        displayedCriteria.forEach(c => {
            if (c.status === "Pass") {
                total += getWeight(c.name);
            }
        });

        return total;
    }, [displayedCriteria]);

    const percentageScore = useMemo(() => {
        const max = stockData?.score?.max || 100;
        return ((calculatedTotal / max) * 100).toFixed(0);
    }, [calculatedTotal, stockData]);

    const calculatedScoreColor = percentageScore >= 70 ? styles.scoreGreen : percentageScore >= 40 ? styles.scoreYellow : styles.scoreRed;

    const toggleWatchlist = () => {
        if (!stockData?.overview?.symbol) return;

        const symbol = stockData.overview.symbol;

        if (isInWatchlist) {
            removeFromWatchlist(symbol);
        } else {
            // Add
            // Extract Data
            const currentPrice = stockData.overview.price || 0;
            const intrinsicValue = stockData.valuation?.intrinsicValue || 0;

            // Support & Signal Logic
            let supportLevel = null;
            let signal = "Hold";

            if (stockData.support_resistance?.levels?.length > 0) {
                const level = stockData.support_resistance.levels[0];
                supportLevel = level.price;

                // Signal Logic (matching SupportResistanceCard)
                if (currentPrice <= level.price) {
                    signal = "Buy";
                } else if (currentPrice >= level.price * 1.5) {
                    signal = "Sell";
                }
            }

            const newItem = {
                name: stockData.overview.name, // Add name
                ticker: symbol,
                price: currentPrice,
                score: percentageScore,
                intrinsicValue: intrinsicValue,
                supportLevel: supportLevel,
                signal: signal,
                lastUpdated: new Date().toISOString()
            };
            addToWatchlist(newItem);
        }
    };

    // Apply conversion to chart data
    const processedChartData = useMemo(() => {
        if (!chartData || chartData.length === 0) return [];

        return chartData.map(item => ({
            ...item,
            close: item.close * currentRate,
            SMA_50: item.SMA_50 ? item.SMA_50 * currentRate : null,
            SMA_100: item.SMA_100 ? item.SMA_100 * currentRate : null,
            SMA_150: item.SMA_150 ? item.SMA_150 * currentRate : null,
            SMA_200: item.SMA_200 ? item.SMA_200 * currentRate : null,
        }));
    }, [chartData, timeframe, currentRate]);

    // Generate Custom Ticks based on timeframe requirements
    const customTicks = useMemo(() => {
        if (!processedChartData || processedChartData.length === 0) return undefined;

        const ticks = [];
        const data = processedChartData;
        const ONE_DAY = 1000 * 60 * 60 * 24;

        if (timeframe === '1D') {
            // 1D: every 15 mins (10:15, 10:30...)
            data.forEach(item => {
                const d = new Date(item.date);
                if (d.getMinutes() % 15 === 0) {
                    const lastTick = ticks.length > 0 ? new Date(ticks[ticks.length - 1]) : null;
                    if (!lastTick || lastTick.getMinutes() !== d.getMinutes() || lastTick.getHours() !== d.getHours()) {
                        ticks.push(item.date);
                    }
                }
            });
        } else if (timeframe === '5D') {
            // 5D: Show date (e.g., 1, 2, 3, 4, 5)
            let lastDate = -1;
            data.forEach(item => {
                const d = new Date(item.date);
                const day = d.getDate();
                if (day !== lastDate) {
                    ticks.push(item.date);
                    lastDate = day;
                }
            });
        } else if (timeframe === '1M' || timeframe === '3M') {
            // 1M/3M: Start of month (for month name) AND approximately end of week (for date).
            let lastMonth = -1;
            let lastTickTime = 0; // Last timestamp added

            data.forEach(item => {
                const d = new Date(item.date);
                const month = d.getMonth();
                const day = d.getDate();
                const time = d.getTime();

                // 1. Add if it's the start of a new month (day 1, 2, or 3)
                if (month !== lastMonth && day <= 5) { // Check day <= 5 to catch the earliest data point near the 1st
                    ticks.push(item.date);
                    lastMonth = month;
                    lastTickTime = time;
                }
                // 2. Add if it's been approximately 7 days since the last added tick
                else if (time - lastTickTime >= 7 * ONE_DAY) {
                    ticks.push(item.date);
                    lastTickTime = time;
                }
            });
        } else if (timeframe === '6M' || timeframe === '1Y' || timeframe === 'YTD') {
            // 1Y/YTD: Month in short form
            let lastMonth = -1;
            data.forEach(item => {
                const d = new Date(item.date);
                if (d.getMonth() !== lastMonth) {
                    ticks.push(item.date);
                    lastMonth = d.getMonth();
                }
            });
        } else if (timeframe === '5Y') {
            // 5Y: Year at start, then Jul
            let lastYear = -1;
            let hasAddedJul = false;
            data.forEach(item => {
                const d = new Date(item.date);
                const year = d.getFullYear();
                const month = d.getMonth();

                if (year !== lastYear) {
                    ticks.push(item.date);
                    lastYear = year;
                    hasAddedJul = false;
                } else if (month === 6 && !hasAddedJul) {
                    ticks.push(item.date);
                    hasAddedJul = true;
                }
            });
        } else if (timeframe === 'All') {
            // ALL: Years only
            let lastYear = -1;
            data.forEach(item => {
                const d = new Date(item.date);
                const year = d.getFullYear();
                if (year !== lastYear) {
                    ticks.push(item.date);
                    lastYear = year;
                }
            });
        }

        return ticks.length > 0 ? ticks : undefined;
    }, [processedChartData, timeframe]);


    const formatXAxis = useCallback((tickItem) => {
        if (!tickItem) return '';
        const date = new Date(tickItem);
        if (isNaN(date.getTime())) return tickItem;

        // Define formatting options
        const shortMonth = { month: 'short' };
        const numericDay = { day: 'numeric' };
        const numericYear = { year: 'numeric' };
        const timeFormat = { hour: '2-digit', minute: '2-digit', hour12: false };

        if (timeframe === '1D') {
            // Time (e.g., 09:30)
            return date.toLocaleTimeString([], timeFormat);
        }
        if (timeframe === '5D') {
            // Day of the month (e.g., 25)
            return date.toLocaleDateString([], numericDay);
        }

        if (timeframe === '1M' || timeframe === '3M') {
            // Start of month: show month name (Nov)
            // Mid-month: show day (7)
            if (date.getDate() <= 3) { // Check if it's the 1st, 2nd, or 3rd (start of month cluster)
                return date.toLocaleDateString('default', shortMonth);
            }
            return date.toLocaleDateString('default', numericDay);
        }

        if (timeframe === '6M' || timeframe === '1Y' || timeframe === 'YTD') {
            // Month abbreviation (Nov)
            return date.toLocaleDateString('default', shortMonth);
        }

        if (timeframe === '5Y') {
            // Year (2023) or Jul
            const month = date.getMonth();
            if (month === 0 || month === 11) { // Jan or Dec (Start/End of year)
                return date.toLocaleDateString('default', numericYear);
            }
            if (month === 6) { // July
                return 'Jul';
            }
            return ''; // Hide other ticks

        }
        if (timeframe === 'All') {
            // Year only (2023)
            return date.toLocaleDateString('default', numericYear);
        }

        return tickItem;
    }, [timeframe]);

    // const formatXAxis = useCallback((tickItem) => {
    //     if (!tickItem) return '';
    //     const date = new Date(tickItem);
    //     if (isNaN(date.getTime())) return tickItem;

    //     if (timeframe === '1D') {
    //         return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    //     }
    //     if (timeframe === '5D') {
    //         return date.getDate();
    //     }
    //     if (timeframe === '1M') {
    //         return date.toLocaleTimeString([],);
    //     }
    //     if (timeframe === '3M') {
    //         if (date.getDate() <= 4) {
    //             return date.toLocaleString('default', { month: 'short' });
    //         }
    //         return date.getDate();
    //     }
    //     if (timeframe === '6M' || timeframe === '1Y' || timeframe === 'YTD') {
    //         return date.toLocaleString('default', { month: 'short' });
    //     }
    //     if (timeframe === '5Y') {
    //         const month = date.getMonth();
    //         if (month <= 1) return date.getFullYear();
    //         if (month === 6) return 'Jul';
    //         return '';
    //     }
    //     if (timeframe === 'All') {
    //         return date.getFullYear();
    //     }

    //     return tickItem;
    // }, [timeframe]);

    // Early returns AFTER all hooks
    if (loading) return <div className={styles.loading}></div>;
    if (!stockData) return null;

    const { overview, score, history, intraday_history, news } = stockData;

    if (!overview) return <div className={styles.card}><p className="text-red-400">Overview data not available</p></div>;

    return (
        <div ref={cardRef} className={`${styles.card} ${isInView ? styles.inView : ''}`}>
            {/* <LiquidGlassBackground /> */}
            {/* Top Zone: Split into Left (Details) and Right (Score) */}
            <div className={styles.topZone}>
                {/* Left: Stock Details */}
                <div className={styles.detailsSection}>
                    <div className={styles.header}>
                        <div>
                            <div className={styles.titleRow}>
                                <h2 className={styles.companyName}>{overview.name}</h2>
                                <button
                                    onClick={toggleWatchlist}
                                    className={styles.watchlistBtn}
                                    title={isInWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
                                >
                                    <Star
                                        size={24}
                                        fill={isInWatchlist ? "#F59E0B" : "none"}
                                        color={isInWatchlist ? "#F59E0B" : "#9CA3AF"}
                                    />
                                </button>
                            </div>
                            <p className={styles.ticker}>{overview.symbol} • {overview.exchange}</p>
                            <div className={styles.priceContainer}>
                                <p className={styles.price}>
                                    {currencySymbol}{(overview.price * currentRate)?.toFixed(2)}
                                </p>
                                <p className={`${styles.change} ${overview.change >= 0 ? styles.positive : styles.negative}`}>
                                    {overview.change > 0 ? '+' : ''}{(overview.change * currentRate)?.toFixed(2)} ({overview.changePercent ? (overview.changePercent * 100).toFixed(2) : '0.00'}%)
                                </p>
                            </div>

                            {/* Badges Row */}
                            <div className={styles.badgesContainer}>
                                <div className={styles.badge}>
                                    <span className={styles.badgeLabel}>Beta:</span>
                                    <span className={styles.badgeValue}>{overview.beta?.toFixed(2)}</span>
                                </div>
                                <div className={styles.badge}>
                                    <span className={styles.badgeLabel}>PEG:</span>
                                    <span className={styles.badgeValue}>{overview.pegRatio ? overview.pegRatio.toFixed(2) : 'N/A'}</span>
                                </div>
                                <div className={styles.badge}>
                                    <span className={styles.badgeLabel}>Mkt Cap:</span>
                                    <span className={styles.badgeValue}>{currencySymbol}{((overview.marketCap * currentRate) / 1e9).toFixed(2)}B</span>
                                </div>
                                <div className={styles.badge}>
                                    <span className={styles.badgeLabel}>Shares:</span>
                                    <span className={styles.badgeValue}>{stockData.sharesOutstanding ? (stockData.sharesOutstanding / 1e9).toFixed(2) + 'B' : 'N/A'}</span>
                                </div>
                                <button className={`${styles.viewDetailsBtn} ${styles.iconButton}`} onClick={() => setShowDetails(!showDetails)}>
                                    <ChevronDown className={`${styles.chevron} ${showDetails ? styles.chevronUp : ''}`} />
                                </button>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Right: Scoring System */}
                <div className={styles.scoreSection}>
                    <div className={styles.scoreHeader}>
                        <h3 className={styles.scoreTitle}>Stock Health Score</h3>
                        {(overview.quoteType !== 'ETF' && overview.industry !== 'ETF') ? (
                            <div className={`${styles.totalScore} ${calculatedScoreColor}`}>
                                {percentageScore}%
                            </div>
                        ) : (
                            <div className={styles.etfNote}>
                                N/A
                            </div>
                        )}
                    </div>
                    {(overview.quoteType !== 'ETF' && overview.industry !== 'ETF') ? (
                        <>
                            <div className={styles.criteriaList}>
                                {displayedCriteria.map((c, idx) => (
                                    <div key={idx} className={styles.criteriaItem}>
                                        <span className={styles.criteriaName}>{c.name}</span>
                                        <span className={`${styles.criteriaStatus} ${c.status === 'Pass' ? styles.pass : (c.status === 'Analyzing...' || c.status === 'Pending Evaluation') ? styles.pending : styles.fail}`}>
                                            {c.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className={styles.scrollIndicator}>
                                <span className={styles.scrollText}>Scroll for details</span>
                                <ChevronDown size={14} className={styles.scrollIcon} />
                            </div>
                        </>
                    ) : (
                        <div className={styles.etfMessage}>
                            This is an ETF and Stock Health Score is not applicable.
                        </div>
                    )}
                </div>
            </div>

            {/* Details Modal / Expandable Section */}
            {showDetails && (
                <div className={styles.detailsModal}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalSection}>
                            <h4>Description</h4>
                            <p className={styles.description}>{overview.description}</p>
                        </div>
                        <div className={styles.modalGrid}>
                            <div className={styles.detailsColumn}>
                                <div className={styles.modalSection}>
                                    <h4>CEO</h4>
                                    <p>{overview.ceo}</p>
                                </div>
                                <div className={styles.modalSection}>
                                    <h4>Sector</h4>
                                    <p>{overview.sector}</p>
                                </div>
                                <div className={styles.modalSection}>
                                    <h4>Industry</h4>
                                    <p>{overview.industry}</p>
                                </div>
                            </div>

                            <div className={styles.eventsColumn}>
                                <div className={styles.modalSection}>
                                    <h4>Earnings and Revenues</h4>
                                    {stockData.calendar && Object.keys(stockData.calendar).length > 0 ? (
                                        <ul className={styles.eventsList}>
                                            {Object.entries(stockData.calendar).map(([key, value]) => (
                                                <li key={key} className={styles.eventItem}>
                                                    <strong className={styles.eventKey}>{key}:</strong>
                                                    <span className={styles.eventValue}>
                                                        {Array.isArray(value) ? value.join(", ") : String(value)}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : <p>No other details avaliable.</p>}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* Bottom Zone: Chart */}
            <div className={styles.bottomZone}>
                <div className={styles.chartContainer}>
                    <div className={styles.chartHeader}>
                        <h3 className={styles.chartTitle}>Price History</h3>
                        <div className={styles.timeframeControls}>
                            {['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'All'].map(tf => (
                                <button
                                    key={tf}
                                    className={`${styles.tfButton} ${timeframe === tf ? styles.activeTf : ''}`}
                                    onClick={() => setTimeframe(tf)}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>
                    </div>
                    {chartLoading || processedChartData.length === 0 ? (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <p>
                                {chartLoading ? 'Loading chart...' : 'Chart data not available.'}
                            </p>
                        </div>
                    ) : (
                        <div className={styles.chartWrapper}>
                            {shouldRenderChart ? (
                                <ResponsiveContainer width="100%" height={chartHeight}>
                                    <ComposedChart data={processedChartData} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                                        <XAxis
                                            dataKey="date"
                                            stroke={chartColors.text}
                                            tickFormatter={formatXAxis}
                                            ticks={customTicks}
                                            tick={{ fontSize: 10, fill: chartColors.text }}
                                        />
                                        <YAxis
                                            domain={['auto', 'auto']}
                                            stroke={chartColors.text}
                                            tick={{ fontSize: 10, fill: chartColors.text }}
                                            tickFormatter={(val) => `${currencySymbol}${val.toFixed(2)}`}
                                        />
                                        <Tooltip
                                            wrapperStyle={{ outline: 'none', backgroundColor: 'transparent' }}
                                            contentStyle={{
                                                // 1. BACKGROUND (Increased Opacity for Readability and Blur Function)
                                                backgroundColor: theme === 'dark' ? 'rgba(20, 20, 20, 0.7)' : 'rgba(255, 255, 255, 0.7)', // Fix 1

                                                // 2. BORDER RADIUS
                                                borderRadius: '15px',

                                                // 3. BACKDROP FILTER (Use a noticeable blur like 10px-20px)
                                                backdropFilter: 'blur(15px) saturate(150%) brightness(1.2)',
                                                WebkitBackdropFilter: 'blur(15px) saturate(150%) brightness(1.2)',

                                                // 4. BORDERS (Keep your aesthetic borders)
                                                borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid rgb(255, 255, 255)',
                                                borderLeft: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid rgb(255, 255, 255)',
                                                borderRight: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.2)',
                                                borderBottom: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.2)',

                                                // 5. BOX SHADOW (Keep)
                                                boxShadow: theme === 'dark'
                                                    ? '0 10px 20px rgba(0, 0, 0, 0.5), inset 2px 2px 3px rgba(255, 255, 255, 0.2), inset -1px -1px 3px rgba(0, 0, 0, 0.5)'
                                                    : '10px 10px 20px rgba(0, 0, 0, 0.2), -3px -3px 10px rgba(0, 0, 0, 0.1), inset 2px 2px 3px rgba(255, 255, 255, 0.2), inset -1px -1px 3px rgba(0, 0, 0, 0.5)',

                                                // 6. FONT/TEXT STYLES
                                                color: chartColors.tooltipColor,
                                                fontSize: '12px',
                                                padding: '8px 10px'
                                            }}
                                            formatter={(value, name) => [`${currencySymbol}${Number(value).toFixed(2)}`, name]}
                                            itemStyle={{ margin: '0', padding: '0' }}
                                            labelStyle={{
                                                margin: '0 0 3px 0',
                                                padding: '0',
                                                fontWeight: 'bold'
                                            }}
                                        />

                                        <Legend wrapperStyle={{ width: '100%', display: 'flex', justifyContent: 'center', paddingTop: 10, paddingLeft: 35, fontSize: '12px', alignItems: 'center' }} />
                                        <Area type="monotone" dataKey="close" stroke="#3B82F6" fillOpacity={1} fill="url(#colorPrice)" name="Price" isAnimationActive={false} />
                                        {/* SMAs - Show on all timeframes - Order: 50, 100, 150, 200 */}
                                        <Line type="monotone" dataKey="SMA_50" stroke="#3B82F6" strokeDasharray="5 5" dot={false} name="50 SMA" strokeWidth={2} isAnimationActive={false} />
                                        <Line type="monotone" dataKey="SMA_100" stroke="#F59E0B" strokeDasharray="5 5" dot={false} name="100 SMA" strokeWidth={2} isAnimationActive={false} />
                                        <Line type="monotone" dataKey="SMA_150" stroke="#10B981" strokeDasharray="5 5" dot={false} name="150 SMA" strokeWidth={2} isAnimationActive={false} />
                                        <Line type="monotone" dataKey="SMA_200" stroke="#EF4444" strokeDasharray="5 5" dot={false} name="200 SMA" strokeWidth={2} isAnimationActive={false} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            ) : <div style={{ height: chartHeight }} />}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OverviewCard;
