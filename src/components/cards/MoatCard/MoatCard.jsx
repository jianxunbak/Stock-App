import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStockData } from '../../../hooks/useStockData';
import { evaluateMoat } from '../../../services/gemini';
import { savePublicMoatAnalysis, getPublicMoatAnalysis, savePrivateMoatAnalysis, getPrivateMoatAnalysis, deletePrivateMoatAnalysis } from '../../../services/moatFirestore';
import { Sparkles, Loader2, ChevronDown, ChevronUp, ArrowUp, ArrowDown, X, Trash2, Edit } from 'lucide-react';
import Button from '../../ui/Button/Button';
import CardToggleButton from '../CardToggleButton/CardToggleButton';
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
    AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip
} from 'recharts';
import Modal from '../../ui/Modals/Modal';
import styles from './MoatCard.module.css';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import ExpandableCard from '../../ui/ExpandableCard/ExpandableCard';

const MoatCard = ({
    onMoatStatusChange,
    onIsEvaluatingChange,
    currency = 'USD',
    currencySymbol = '$',
    currentRate = 1,
    isOpen = true,
    onToggle = null,
    className = "",
    variant = 'default'
}) => {
    const { stockData, loading } = useStockData();
    const { theme } = useTheme();
    const { currentUser } = useAuth();

    // Lazy load charts
    const [isInView, setIsInView] = useState(false);
    const cardRef = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.1 }
        );

        if (cardRef.current) {
            observer.observe(cardRef.current);
        }

        return () => observer.disconnect();
    }, [loading, stockData]);

    const [scores, setScores] = useState({
        brand: 0,
        barriers: 0,
        scale: 0,
        network: 0,
        switching: 0
    });
    const [aiDescription, setAiDescription] = useState('');
    const [userNote, setUserNote] = useState('');
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [hasEvaluated, setHasEvaluated] = useState(false);
    const [evaluator, setEvaluator] = useState(null);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [error, setError] = useState(null);
    const [errorTitle, setErrorTitle] = useState('Error');
    const prevMoatStatusLabel = useRef();

    const categories = [
        { id: 'brand', label: 'Brand Monopoly' },
        { id: 'barriers', label: 'High Barriers to Entry' },
        { id: 'scale', label: 'High Economies of Scale' },
        { id: 'network', label: 'Network Effect' },
        { id: 'switching', label: 'High Switching Cost' }
    ];

    // Check Firestore for cached analysis
    useEffect(() => {
        const checkCache = async () => {
            if (!stockData?.overview?.symbol) return;

            setScores({ brand: 0, barriers: 0, scale: 0, network: 0, switching: 0 });
            setAiDescription('');
            setIsEvaluating(false);
            setHasEvaluated(false);
            prevMoatStatusLabel.current = undefined;
            if (onIsEvaluatingChange) onIsEvaluatingChange(false);
            setEvaluator(null);

            if (currentUser) {
                try {
                    const privateData = await getPrivateMoatAnalysis(currentUser.uid, stockData.overview.symbol);
                    if (privateData) {
                        setScores(privateData.scores);
                        setAiDescription(privateData.description);
                        setEvaluator(privateData.evaluator);
                        setUserNote(privateData.userNote || '');
                        setHasEvaluated(true);
                        return;
                    }
                } catch (err) {
                    console.error("Error checking private moat cache:", err);
                }
            }

            try {
                const publicData = await getPublicMoatAnalysis(stockData.overview.symbol);
                if (publicData) {
                    setScores(publicData.scores);
                    setAiDescription(publicData.description);
                    setEvaluator(publicData.evaluator || 'Gemini AI');
                    setUserNote('');
                    setHasEvaluated(true);
                }
            } catch (err) {
                console.error("Error checking public moat cache:", err);
            }
        };

        checkCache();
    }, [stockData?.overview?.symbol, currentUser]);

    const handleAiEvaluation = async () => {
        if (!stockData?.overview?.symbol) return;

        setIsEvaluating(true);
        if (onIsEvaluatingChange) onIsEvaluatingChange(true);

        try {
            const result = await evaluateMoat(stockData.overview.symbol);
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
            setScores(newScores);
            setAiDescription(result.description || '');
            setHasEvaluated(true);
            setEvaluator('Gemini AI');

            await savePublicMoatAnalysis(stockData.overview.symbol, {
                scores: newScores,
                description: result.description || '',
                evaluator: 'Gemini AI'
            });

            if (currentUser) {
                await deletePrivateMoatAnalysis(currentUser.uid, stockData.overview.symbol);
            }
        } catch (err) {
            console.error("AI Evaluation failed:", err);
            setAiDescription("Failed to retrieve moat from AI, please evaluate yourself.");
        } finally {
            setIsEvaluating(false);
            if (onIsEvaluatingChange) onIsEvaluatingChange(false);
        }
    };

    const handleScoreChange = async (category, value) => {
        const newScores = { ...scores, [category]: parseFloat(value) };
        setScores(newScores);
        setHasEvaluated(true);

        const newEvaluator = currentUser ? (currentUser.displayName || currentUser.email) : 'User';
        setEvaluator(newEvaluator);

        if (stockData?.overview?.symbol && currentUser) {
            await savePrivateMoatAnalysis(currentUser.uid, stockData.overview.symbol, {
                scores: newScores,
                description: aiDescription,
                evaluator: newEvaluator,
                userNote: userNote
            });
        }
    };

    const handleNoteChange = (e) => setUserNote(e.target.value);

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

    const totalScore = useMemo(() => Object.values(scores).reduce((a, b) => (a || 0) + (b || 0), 0), [scores]);

    const isActuallyEvaluated = useMemo(() => {
        return aiDescription.length > 0 || Object.values(scores).some(v => v !== null);
    }, [aiDescription, scores]);

    const moatStatus = useMemo(() => {
        if (totalScore < 2) return { label: "No Moat", color: styles.statusRed };
        if (totalScore <= 3) return { label: "Narrow Moat", color: styles.statusYellow };
        return { label: "Wide Moat", color: styles.statusGreen };
    }, [totalScore]);

    React.useEffect(() => {
        const statusToSend = isActuallyEvaluated ? moatStatus.label : null;
        if (onMoatStatusChange && prevMoatStatusLabel.current !== statusToSend) {
            onMoatStatusChange(statusToSend);
            prevMoatStatusLabel.current = statusToSend;
        }
    }, [moatStatus, isActuallyEvaluated, onMoatStatusChange]);

    if (loading && !stockData) return <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
    if (!stockData) return null;

    const isETF = stockData?.overview?.quoteType === 'ETF' || stockData?.overview?.industry === 'ETF';

    const header = (
        <div className="summary-info">
            <div className="summary-name">Economic Moat</div>
            {isActuallyEvaluated ? (
                <>
                    <div className="summary-price" style={{ color: totalScore < 2 ? 'var(--neu-error)' : (totalScore <= 3 ? 'var(--neu-warning)' : 'var(--neu-success)') }}>
                        {moatStatus.label}
                    </div>
                    <div className="summary-change" style={{ color: 'var(--neu-text-tertiary)' }}>
                        {totalScore} / 5 Score
                    </div>
                </>
            ) : (
                <>
                    <div className="summary-price" style={{ color: 'var(--neu-text-tertiary)' }}>
                        {isEvaluating ? 'Evaluating...' : 'Pending'}
                    </div>
                    <div className="summary-change" style={{ color: 'var(--neu-text-tertiary)' }}>
                        Action Required
                    </div>
                </>
            )}
        </div>
    );

    const handleClearAnalysis = async () => {
        if (!stockData?.overview?.symbol) return;

        setScores({ brand: null, barriers: null, scale: null, network: null, switching: null });
        setAiDescription('');
        setHasEvaluated(false);
        setEvaluator(null);

        if (currentUser) {
            try {
                await deletePrivateMoatAnalysis(currentUser.uid, stockData.overview.symbol);
            } catch (err) {
                console.error("Failed to clear private analysis:", err);
            }
        }
    };

    const handleClearNotes = async () => {
        if (!stockData?.overview?.symbol) return;
        setUserNote('');
        if (currentUser) {
            try {
                const newEvaluator = currentUser.displayName || currentUser.email || 'User';
                await savePrivateMoatAnalysis(currentUser.uid, stockData.overview.symbol, {
                    scores,
                    description: aiDescription,
                    evaluator: newEvaluator,
                    userNote: ''
                });
            } catch (err) {
                console.error("Failed to clear notes in DB:", err);
            }
        }
    };

    const menuItems = [
        { label: 'Re-evaluate AI', onClick: handleAiEvaluation, indicatorNode: <Sparkles size={14} /> },
        { label: 'Clear Notes', onClick: handleClearNotes, indicatorNode: <Edit size={14} /> },
        { label: 'Clear Analysis', onClick: handleClearAnalysis, indicatorNode: <Trash2 size={14} /> },
    ];

    return (
        <ExpandableCard
            title="Economic Moat"
            expanded={isOpen}
            defaultExpanded={isOpen}
            onToggle={onToggle}
            collapsedWidth={220}
            collapsedHeight={220}
            headerContent={header}
            className={className}
            menuItems={menuItems}
            onRefresh={() => stockData?.overview?.symbol && loadStockData(stockData.overview.symbol, true)}
        >
            <div ref={cardRef}>
                {/* Internal title removed as it's now handled by ExpandableCard */}


                {isETF ? (
                    <div className={styles.etfMessage}>This is an ETF and Economic Moat is not applicable.</div>
                ) : (
                    <div className={styles.topZone}>
                        <div className={styles.scoreSection}>
                            <div className={styles.scoreCard}>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%' }}>
                                    {isEvaluating ? (
                                        <div className={styles.evaluatingText}>
                                            <Loader2 className={styles.spin} size={16} />
                                            <span>AI Analyzing Moat...</span>
                                        </div>
                                    ) : (
                                        <>
                                            {hasEvaluated ? (
                                                <div className={styles.score}>
                                                    <div className={`${styles.scoreValue} ${moatStatus.color}`}>{totalScore} <span className={styles.scoreMax}>/ 5</span></div>
                                                    <p className={`${styles.scoreStatus} ${moatStatus.color}`}>{moatStatus.label}</p>
                                                    {evaluator && <p className={styles.evaluatorNote}>Evaluated by {evaluator}</p>}
                                                </div>
                                            ) : (
                                                <div className={styles.emptyState}>
                                                    <p>No analysis yet.</p>
                                                    <p className={styles.promptText}>Click the AI button to evaluate with AI or rate the categories manually.</p>
                                                </div>
                                            )}

                                            {aiDescription && <p className={styles.description}>{aiDescription}</p>}

                                            <Button
                                                variant="icon"
                                                onClick={handleAiEvaluation}
                                                style={{ position: 'absolute', top: '10px', right: '10px' }}
                                                title={aiDescription ? "Re-evaluate with AI" : "Ask AI to Evaluate"}
                                            >
                                                <Sparkles size={18} />
                                            </Button>
                                        </>
                                    )}
                                </div>

                                <textarea
                                    className={styles.userNoteInput}
                                    placeholder="Add your personal notes or assumptions here..."
                                    value={userNote}
                                    onChange={handleNoteChange}
                                    onBlur={handleNoteBlur}
                                    rows={3}
                                />
                            </div>
                        </div>

                        <div className={styles.checklistSection}>
                            <h4 className={styles.checklistSubtitle}>Rate Moat Strength</h4>
                            <div className={styles.checklistContainer}>
                                {categories.map(cat => (
                                    <div key={cat.id} className={styles.checklistItem}>
                                        <label className={styles.checklistLabel}>{cat.label}</label>
                                        <div className={styles.buttonGroup}>
                                            <Button variant="icon" onClick={() => handleScoreChange(cat.id, 1)} className={scores[cat.id] === 1 ? 'active' : ''} title="High"><ArrowUp size={18} /></Button>
                                            <Button variant="icon" onClick={() => handleScoreChange(cat.id, 0.5)} className={scores[cat.id] === 0.5 ? 'active' : ''} title="Low"><ArrowDown size={18} /></Button>
                                            <Button variant="icon" onClick={() => handleScoreChange(cat.id, 0)} className={scores[cat.id] === 0 ? 'active' : ''} title="None"><X size={18} /></Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <Modal isOpen={showErrorModal} onClose={() => setShowErrorModal(false)} title={errorTitle} message={error} />
        </ExpandableCard>
    );
};

export default MoatCard;
