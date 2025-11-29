import React, { useState, useMemo } from 'react';
import { useStockData } from '../../hooks/useStockData';
import { evaluateMoat } from '../../services/gemini';
import { savePublicMoatAnalysis, getPublicMoatAnalysis, savePrivateMoatAnalysis, getPrivateMoatAnalysis, deletePrivateMoatAnalysis } from '../../services/moatFirestore';
import { Sparkles, Loader2 } from 'lucide-react';
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
    AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip
} from 'recharts';
import Modal from '../ui/Modal';
import styles from './MoatCard.module.css';
import { useTheme } from '../../context/ThemeContext';

import { useAuth } from '../../context/AuthContext';

const MoatCard = ({ onMoatStatusChange, onIsEvaluatingChange }) => {
    const { stockData, loading } = useStockData();
    const { theme } = useTheme();
    const { currentUser } = useAuth();
    const [chartHeight, setChartHeight] = React.useState(300);
    // ... existing refs ...
    const [evaluator, setEvaluator] = useState(null);

    const prevMoatStatusLabel = React.useRef();
    const lastEvaluatedSymbol = React.useRef(null);
    const [comparisonTicker, setComparisonTicker] = useState('');
    const [comparisonStocks, setComparisonStocks] = useState([]);
    const [error, setError] = useState(null);
    const [errorTitle, setErrorTitle] = useState('Error');
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [hasEvaluated, setHasEvaluated] = useState(false);

    // State for the 5 moat categories
    // Values: 1 (High), 0.5 (Low), 0 (None)
    const [scores, setScores] = useState({
        brand: 0,
        barriers: 0,
        scale: 0,
        network: 0,
        switching: 0
    });
    const [aiDescription, setAiDescription] = useState('');
    const [userNote, setUserNote] = useState('');

    const handleNoteChange = (e) => {
        setUserNote(e.target.value);
    };

    const handleNoteBlur = async () => {
        if (stockData?.overview?.symbol && currentUser) {
            const newEvaluator = currentUser.displayName || currentUser.email || 'User';
            await savePrivateMoatAnalysis(currentUser.uid, stockData.overview.symbol, {
                scores,
                description: aiDescription,
                evaluator: newEvaluator,
                userNote: userNote
            });
        }
    };

    // Lazy load charts
    const [isInView, setIsInView] = React.useState(false);
    const cardRef = React.useRef(null);

    // ... existing useEffects ...

    // Check Firestore for cached analysis when symbol changes
    React.useEffect(() => {
        const checkCache = async () => {
            if (!stockData?.overview?.symbol) return;

            // Reset state first
            console.log("Resetting MoatCard state for symbol:", stockData.overview.symbol);
            setScores({
                brand: 0,
                barriers: 0,
                scale: 0,
                network: 0,
                switching: 0
            });
            setAiDescription('');
            setIsEvaluating(false);
            setHasEvaluated(false);
            prevMoatStatusLabel.current = undefined;
            if (onIsEvaluatingChange) onIsEvaluatingChange(false);
            setEvaluator(null); // Reset evaluator

            // 1. Try Private Cache (User's own evaluation)
            if (currentUser) {
                console.log(`[checkCache] Checking private cache for User UID: ${currentUser.uid}, Ticker: ${stockData.overview.symbol}`);
                try {
                    const privateData = await getPrivateMoatAnalysis(currentUser.uid, stockData.overview.symbol);
                    if (privateData) {
                        console.log("[checkCache] Found PRIVATE moat analysis:", privateData);
                        setScores(privateData.scores);
                        setAiDescription(privateData.description);
                        setEvaluator(privateData.evaluator);
                        setUserNote(privateData.userNote || ''); // Load user note
                        setHasEvaluated(true);
                        return; // Stop here if private found
                    } else {
                        console.log("[checkCache] No private analysis found.");
                    }
                } catch (err) {
                    console.error("[checkCache] Error checking private moat cache:", err);
                }
            } else {
                console.log("[checkCache] No currentUser, skipping private cache check.");
            }

            // 2. Try Public Cache (AI evaluation)
            try {
                const publicData = await getPublicMoatAnalysis(stockData.overview.symbol);
                if (publicData) {
                    console.log("Found PUBLIC moat analysis:", publicData);
                    setScores(publicData.scores);
                    setAiDescription(publicData.description);
                    setEvaluator(publicData.evaluator || 'Gemini AI'); // Default to Gemini AI if missing
                    setUserNote(''); // Clear user note for public data
                    setHasEvaluated(true);
                }
            } catch (err) {
                console.error("Error checking public moat cache:", err);
            }
        };

        checkCache();
    }, [stockData?.overview?.symbol, currentUser]); // Added currentUser dependency

    const handleAiEvaluation = async () => {
        if (!stockData?.overview?.symbol) return;

        setIsEvaluating(true);
        if (onIsEvaluatingChange) onIsEvaluatingChange(true);

        try {
            const result = await evaluateMoat(stockData.overview.symbol);

            console.log("Gemini Result:", result); // Debug log

            // Map Gemini response to our score state
            // Gemini returns "High", "Low", "None"
            const mapValue = (val) => {
                const v = val?.toString().toLowerCase().trim() || '';
                if (v === 'high') return 1;
                if (v === 'low') return 0.5;
                return 0;
            };

            const newScores = {
                brand: mapValue(result.brandMonopoly),
                barriers: mapValue(result.highBarrierToEntry),
                scale: mapValue(result.economyOfScale),
                network: mapValue(result.networkEffect),
                switching: mapValue(result.highSwitchingCost)
            };

            console.log("Mapped Scores:", newScores); // Debug log
            setScores(newScores);
            setAiDescription(result.description || '');
            setUserNote(''); // Clear user note on new AI run
            setHasEvaluated(true);
            lastEvaluatedSymbol.current = stockData.overview.symbol;

            const newEvaluator = 'Gemini AI';
            setEvaluator(newEvaluator);

            // Save to PUBLIC Firestore
            await savePublicMoatAnalysis(stockData.overview.symbol, {
                scores: newScores,
                description: result.description || '',
                evaluator: newEvaluator
            });

            // If user has a private override, delete it so they see the new AI result
            if (currentUser) {
                await deletePrivateMoatAnalysis(currentUser.uid, stockData.overview.symbol);
            }

            console.log("State updated: Scores, Description, HasEvaluated");
        } catch (err) {
            console.error("AI Evaluation failed:", err);
            setAiDescription("Failed to retrieve moat from AI, please evaluate yourself.");
        } finally {
            setIsEvaluating(false);
            if (onIsEvaluatingChange) onIsEvaluatingChange(false);
            console.log("Evaluation finished, isEvaluating set to false");
        }
    };

    React.useEffect(() => {
        let timeoutId;
        const handleResize = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                // Use 400px for desktop (>= 768px), 300px for mobile (< 768px)
                setChartHeight(window.innerWidth < 768 ? 300 : 400);
            }, 100); // 100ms debounce
        };
        handleResize(); // Initial call
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(timeoutId);
        };
    }, []);

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

    // Comparison & Error State




    const categories = [
        { id: 'brand', label: 'Brand Monopoly' },
        { id: 'barriers', label: 'High Barriers to Entry' },
        { id: 'scale', label: 'High Economies of Scale' },
        { id: 'network', label: 'Network Effect' },
        { id: 'switching', label: 'High Switching Cost' }
    ];

    const handleScoreChange = async (category, value) => {
        const newScores = {
            ...scores,
            [category]: parseFloat(value)
        };
        setScores(newScores);
        setHasEvaluated(true);

        const newEvaluator = currentUser ? (currentUser.displayName || currentUser.email) : 'User';
        setEvaluator(newEvaluator);

        if (stockData?.overview?.symbol && currentUser) {
            // Save to PRIVATE Firestore
            await savePrivateMoatAnalysis(currentUser.uid, stockData.overview.symbol, {
                scores: newScores,
                description: aiDescription, // Preserve existing description
                evaluator: newEvaluator,
                userNote: userNote // Save user note
            });
        }
    };

    const totalScore = useMemo(() => {
        return Object.values(scores).reduce((a, b) => a + b, 0);
    }, [scores]);

    const moatStatus = useMemo(() => {
        if (totalScore < 2) return { label: "No Moat", color: styles.statusRed };
        if (totalScore <= 3) return { label: "Narrow Moat", color: styles.statusYellow };
        return { label: "Wide Moat", color: styles.statusGreen };
    }, [totalScore]);



    // Notify parent of status change
    React.useEffect(() => {
        const statusToSend = hasEvaluated ? moatStatus.label : null;
        if (onMoatStatusChange && prevMoatStatusLabel.current !== statusToSend) {
            onMoatStatusChange(statusToSend);
            prevMoatStatusLabel.current = statusToSend;
        }
    }, [moatStatus, hasEvaluated, onMoatStatusChange]);

    const history = stockData?.history;

    // Filter history for last 20 years and calculate percentage growth
    const chartData = useMemo(() => {
        if (!history || history.length === 0) return [];

        const twentyYearsAgo = new Date();
        twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20);

        const filtered = history.filter(item => new Date(item.date) >= twentyYearsAgo);

        if (filtered.length === 0) return [];

        const startPrice = filtered[0].close;

        // Downsample data: Take 1 point every ~20 points (approx monthly if daily data)
        // This reduces ~5000 points to ~250 points, significantly improving render performance
        const downsampled = filtered.filter((_, index) => index % 20 === 0 || index === filtered.length - 1);

        return downsampled.map(item => ({
            date: item.date,
            value: ((item.close - startPrice) / startPrice) * 100
        }));
    }, [history]);

    // Comparison Logic

    const handleAddComparison = async () => {
        if (!comparisonTicker) return;
        try {
            // Fetch history for comparison ticker
            const apiUrl = import.meta.env.VITE_API_URL || '/api';
            const response = await fetch(`${apiUrl}/stock/history/${comparisonTicker}`);
            if (!response.ok) throw new Error('Failed to fetch');
            const historyData = await response.json();

            if (!historyData || historyData.length === 0) {
                setError('No data found for this ticker');
                setErrorTitle("Comparison Error");
                setShowErrorModal(true);
                return;
            }

            // Process data: Filter last 20 years and normalize
            const twentyYearsAgo = new Date();
            twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20);
            const filtered = historyData.filter(item => new Date(item.date) >= twentyYearsAgo);

            if (filtered.length === 0) {
                setError('Insufficient data for this ticker');
                setErrorTitle("Comparison Error");
                setShowErrorModal(true);
                return;
            }

            const startPrice = filtered[0].close;
            const processedData = filtered.map(item => ({
                date: item.date,
                [`value_${comparisonTicker}`]: ((item.close - startPrice) / startPrice) * 100
            }));

            // Assign a random color
            const colors = ['#3B82F6', '#10B981', '#EC4899', '#8B5CF6', '#F472B6'];
            const color = colors[comparisonStocks.length % colors.length];

            setComparisonStocks([...comparisonStocks, { ticker: comparisonTicker, data: processedData, color }]);
            setComparisonTicker('');
        } catch (e) {
            console.error("Error adding comparison stock", e);
            setError('Error adding stock. Please check the ticker.');
            setErrorTitle("Comparison Error");
            setShowErrorModal(true);
        }
    };

    const removeComparison = (ticker) => {
        setComparisonStocks(comparisonStocks.filter(s => s.ticker !== ticker));
    };

    // Merge chart data
    const mergedChartData = useMemo(() => {
        if (!chartData.length) return [];

        let merged = [...chartData];

        comparisonStocks.forEach(stock => {
            // Merge stock.data into merged based on date
            // This is O(N*M), can be optimized but fine for small datasets
            merged = merged.map(item => {
                const match = stock.data.find(d => d.date === item.date); // Exact date match might be tricky if trading days differ
                // Better approach: Create a map of dates
                return match ? { ...item, ...match } : item;
            });

            // Note: If dates don't align perfectly (different holidays), this simple merge might miss points.
            // For a robust solution, we'd collect all unique dates and fill.
            // But for this MVP, exact date match on daily data usually works for major exchanges.
        });

        return merged;
    }, [chartData, comparisonStocks]);

    if (loading) return <div className={styles.loading}></div>;
    if (!stockData) return null;

    // Lazy load charts (Moved to top)

    return (
        <div ref={cardRef} className={styles.card}>
            {/* <LiquidGlassBackground /> */}
            <h3 className={styles.title}>Economic Moat</h3>

            {/* Top Zone: Score (Zone 1) and Checklist (Zone 2) */}
            <div className={styles.topZone}>
                {/* Zone 1: Total Moat Score */}
                <div className={styles.scoreSection}>
                    <div className={styles.scoreCard}>

                        {/* <Sparkles size={16} className={styles.aiIcon} /> */}

                        {/* <p className={styles.scoreLabel}>Total Moat Score</p> */}
                        {isEvaluating ? (
                            <div className={styles.evaluatingText}>
                                <Loader2 className={styles.spin} size={16} />
                                <span>AI Analyzing Moat...</span>
                            </div>
                        ) : (
                            <>
                                {hasEvaluated && (
                                    <div className={styles.score}>
                                        <div className={`${styles.scoreValue} ${moatStatus.color}`}>{totalScore} <span className={styles.scoreMax}>/ 5</span></div>
                                        <p className={`${styles.scoreStatus} ${moatStatus.color}`}>{moatStatus.label}</p>

                                        {/* User Note Area - Only visible if evaluated by user or if user wants to add notes */}
                                        {evaluator && evaluator !== 'Gemini AI' && (
                                            <textarea
                                                className={styles.userNoteInput}
                                                placeholder="Add your notes here..."
                                                value={userNote}
                                                onChange={handleNoteChange}
                                                onBlur={handleNoteBlur}
                                                rows={3}
                                            />
                                        )}

                                        {evaluator && (
                                            <p className={styles.evaluatorNote}>Evaluated by {evaluator}</p>
                                        )}
                                    </div>
                                )}

                                {aiDescription && <p className={styles.description}>{aiDescription}</p>}

                                <button onClick={handleAiEvaluation} className={styles.aiButton}>
                                    <Sparkles size={14} />
                                    {aiDescription ? "Re-evaluate with AI" : "Ask AI to Evaluate"}
                                </button>
                            </>
                        )}
                    </div>

                    {/* <p className={styles.gradingNote}>Graded by Gemini AI.</p> */}
                </div>

                {/* Zone 2: Interactive Checklist */}
                <div className={styles.checklistSection}>
                    <div className={styles.checklistContainer}>
                        {categories.map(cat => (
                            <div key={cat.id} className={styles.checklistItem}>
                                <label className={styles.checklistLabel}>{cat.label}</label>
                                <div className={styles.buttonGroup}>
                                    <button
                                        onClick={() => handleScoreChange(cat.id, 1)}
                                        className={`${styles.button} ${scores[cat.id] === 1 ? styles.buttonHighActive : styles.buttonHighInactive}`}
                                    >
                                        High
                                    </button>
                                    <button
                                        onClick={() => handleScoreChange(cat.id, 0.5)}
                                        className={`${styles.button} ${scores[cat.id] === 0.5 ? styles.buttonMedActive : styles.buttonMedInactive}`}
                                    >
                                        Low
                                    </button>
                                    <button
                                        onClick={() => handleScoreChange(cat.id, 0)}
                                        className={`${styles.button} ${scores[cat.id] === 0 ? styles.buttonLowActive : styles.buttonLowInactive}`}
                                    >
                                        None
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>


            {/* Zone 3: Chart (Bottom) */}
            <div className={styles.bottomZone}>
                <div className={styles.chartContainer}>
                    <h4 className={styles.chartTitle}>20-Year Growth Performance (%)</h4>
                    <p className={styles.chartNote}>(in hundreds)</p>

                    <div className={styles.comparisonControls}>
                        <input
                            type="text"
                            value={comparisonTicker}
                            onChange={(e) => setComparisonTicker(e.target.value.toUpperCase())}
                            placeholder="Add symbol (e.g. MSFT)"
                            className={styles.tickerInput}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddComparison();
                                }
                            }}
                        />
                        <button onClick={handleAddComparison} className={styles.addButton}>Add</button>
                    </div>

                    {comparisonStocks.length > 0 && (
                        <div className={styles.activeComparisons}>
                            {comparisonStocks.map(stock => (
                                <span key={stock.ticker} className={styles.comparisonTag} style={{ borderColor: stock.color, color: stock.color }}>
                                    {stock.ticker}
                                    <button onClick={() => removeComparison(stock.ticker)} className={styles.removeButton}>×</button>
                                </span>
                            ))}
                        </div>
                    )}

                    <div className={styles.chartWrapper}>
                        <ResponsiveContainer width="100%" height={chartHeight}>
                            <AreaChart data={mergedChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorPriceMoat" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                                <XAxis
                                    dataKey="date"
                                    stroke={chartColors.text}
                                    tick={{ fontSize: 10, fill: chartColors.text }}
                                    tickFormatter={(val) => val.substring(0, 4)} // Show Year only
                                    minTickGap={50}
                                />
                                <YAxis
                                    stroke={chartColors.text}
                                    tick={{ fontSize: 10, fill: chartColors.text, angle: -60 }}
                                    // tickFormatter={(val) => `${val.toFixed(0)}%`}
                                    width={50}
                                    tickFormatter={(val) => {
                                        // Ensure val is treated as a percentage (0-100) and display divided by 100
                                        return `${(val / 100).toFixed(1)}%`;
                                    }}

                                />
                                <Tooltip
                                    wrapperStyle={{ outline: 'none', backgroundColor: 'transparent' }}
                                    contentStyle={{
                                        // 1. BACKGROUND
                                        backgroundColor: theme === 'dark' ? 'rgba(20, 20, 20, 0.7)' : 'rgba(255, 255, 255, 0.7)',

                                        // 2. BORDER RADIUS
                                        borderRadius: '15px',

                                        // 3. BACKDROP FILTER
                                        backdropFilter: 'blur(15px) saturate(150%) brightness(1.2)',
                                        WebkitBackdropFilter: 'blur(15px) saturate(150%) brightness(1.2)',

                                        // 4. BORDERS
                                        borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid rgb(255, 255, 255)',
                                        borderLeft: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid rgb(255, 255, 255)',
                                        borderRight: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.2)',
                                        borderBottom: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.2)',

                                        // 5. BOX SHADOW
                                        boxShadow: theme === 'dark'
                                            ? '0 10px 20px rgba(0, 0, 0, 0.5), inset 2px 2px 3px rgba(255, 255, 255, 0.2), inset -1px -1px 3px rgba(0, 0, 0, 0.5)'
                                            : '10px 10px 20px rgba(0, 0, 0, 0.2), -3px -3px 10px rgba(0, 0, 0, 0.1), inset 2px 2px 3px rgba(255, 255, 255, 0.2), inset -1px -1px 3px rgba(0, 0, 0, 0.5)',

                                        // 6. FONT/TEXT STYLES
                                        color: chartColors.tooltipColor,
                                        fontSize: '12px',
                                        padding: '8px 10px'
                                    }}
                                    formatter={(value, name) => [`$${Number(value).toFixed(2)}`, name]}
                                    itemStyle={{ margin: '0', padding: '0' }}
                                    labelStyle={{
                                        margin: '0 0 3px 0',
                                        padding: '0',
                                        fontWeight: 'bold'
                                    }}
                                />
                                <Area type="monotone" dataKey="value" name={stockData.overview?.symbol || 'Stock'} stroke="#F59E0B" fillOpacity={1} fill="url(#colorPriceMoat)" />
                                {comparisonStocks.map((stock, index) => (
                                    <Area
                                        key={stock.ticker}
                                        type="monotone"
                                        dataKey={`value_${stock.ticker}`}
                                        name={stock.ticker}
                                        stroke={stock.color}
                                        fillOpacity={0}
                                        strokeWidth={2}
                                    />
                                ))}
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <Modal
                isOpen={showErrorModal}
                onClose={() => setShowErrorModal(false)}
                title={errorTitle}
                message={error}
            />
        </div >
    );
};

export default MoatCard;
