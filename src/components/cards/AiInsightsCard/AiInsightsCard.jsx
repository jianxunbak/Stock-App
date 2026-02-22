import React from 'react';
import ExpandableCard from '../../ui/ExpandableCard/ExpandableCard';
import SummaryCardContent from '../../ui/SummaryCardContent/SummaryCardContent';
import Button from '../../ui/Button';
import { Trash2, Sparkles, Edit, CheckCircle, Clock, AlertCircle, FileText } from 'lucide-react';
import InlineSpinner from '../../ui/InlineSpinner/InlineSpinner';
import styles from './AiInsightsCard.module.css';


const AiInsightsCard = ({
    portfolioList,
    analysis,
    analyzing,
    openCards,
    toggleCard,
    handleAnalyzePortfolio,
    setShowClearAnalysisModal, // Pass the setter or handler
    notes = '',
    onSaveNotes,
    onHide,
    loading = false,
    className = ""
}) => {

    const [userNote, setUserNote] = React.useState(notes);
    const timeoutRef = React.useRef(null);

    React.useEffect(() => {
        setUserNote(notes);
    }, [notes]);

    // Cleanup timeout on unmount
    React.useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const handleNoteChange = (e) => {
        const val = e.target.value;
        setUserNote(val);

        // Debounce save (500ms)
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            if (onSaveNotes) onSaveNotes(val);
        }, 500);
    };

    const handleNoteBlur = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (onSaveNotes) onSaveNotes(userNote);
    };

    if (!portfolioList || portfolioList.length === 0) {
        return (
            <ExpandableCard
                title="AI Insights"
                loading={loading}
                onHide={onHide}
            />
        );
    }


    const menuItems = [
        {
            label: 'Re-evaluate with AI',
            onClick: () => handleAnalyzePortfolio(true),
            indicatorNode: <Sparkles size={14} />,
            disabled: analyzing
        },
        {
            label: 'Clear Notes',
            onClick: () => {
                setUserNote('');
                if (onSaveNotes) onSaveNotes('');
            },
            indicatorNode: <Edit size={14} />
        },
        {
            label: 'Clear Analysis',
            onClick: () => setShowClearAnalysisModal(true),
            indicatorNode: <Trash2 size={14} />,
            disabled: !analysis
        }
    ];

    const hasNotes = notes && notes.trim().length > 0;

    const statusLabel = analyzing ? 'Analyzing...' : (analysis ? 'Ready' : 'No Analysis');
    const statusColor = analyzing ? 'var(--neu-warning)' : (analysis ? 'var(--neu-success)' : 'var(--neu-text-secondary)');
    const statusIcon = analyzing ? <Clock size={14} /> : (analysis ? <CheckCircle size={14} /> : <AlertCircle size={14} />);

    const summary = (
        <SummaryCardContent
            mainMetrics={[
                { label: 'AI Analysis', value: statusLabel, color: statusColor }
            ]}
            gridMetrics={[
                { label: analyzing ? 'Processing...' : (analysis ? 'Analysis Available' : 'Not Analyzed'), icon: statusIcon, color: statusColor },
                ...(hasNotes ? [{ label: '1 Note Saved', icon: <FileText size={14} />, color: 'var(--neu-brand)' }] : [])
            ]}
        />
    );

    return (
        <ExpandableCard
            title="AI Insights"
            className={className}
            expanded={openCards.ai}
            defaultExpanded={openCards.ai}
            onToggle={() => toggleCard('ai')}
            onHide={onHide}
            loading={loading}
            menuItems={menuItems}
            headerContent={summary}
            collapsedHeight={198}
        >
            <div className={styles.insightCard}>
                <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {analyzing ? (
                        <div className={styles.evaluatingText}>
                            <InlineSpinner size="16px" color="var(--text-secondary)" />
                        </div>
                    ) : (
                        <>
                            {analysis ? (
                                <>
                                    <div
                                        className={styles.description}
                                        dangerouslySetInnerHTML={{
                                            __html: analysis.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                        }}
                                    />
                                    <Button
                                        variant="icon"
                                        onClick={() => handleAnalyzePortfolio(true)}
                                        className={styles.aiButton}
                                        title="Re-evaluate with AI"
                                    >
                                        <Sparkles size={18} />
                                    </Button>
                                </>
                            ) : (
                                <div className={styles.emptyState}>
                                    <p>No analysis yet.</p>
                                    <p className={styles.promptText}>Click the button to get AI-powered insights for your portfolio.</p>
                                    <Button
                                        variant="icon"
                                        onClick={() => handleAnalyzePortfolio(true)}
                                        className={styles.aiButton}
                                        title="Ask AI to Evaluate"
                                    >
                                        <Sparkles size={18} />
                                    </Button>
                                </div>
                            )}
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
        </ExpandableCard>
    );
};

export default AiInsightsCard;
