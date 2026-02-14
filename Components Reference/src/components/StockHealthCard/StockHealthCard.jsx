import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Check, X, AlertCircle } from 'lucide-react';
import StyledCard from '../StyledCard';
import { ButtonAnimator } from '../Animator';
import Button from '../Button/Button';
import './StockHealthCard.css';

const StockHealthCard = ({
    score = 0,
    items = [],
    type = 'Analysis',
    className = '',
    scrollAnimated = false,
    variant = 'default',
    view = 'expanded',
    ...props
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const toggleExpand = () => setIsExpanded(!isExpanded);

    const getScoreColor = (s) => {
        if (s >= 80) return 'var(--neu-success)';
        if (s >= 60) return 'var(--neu-color-favorite)';
        return 'var(--neu-error)';
    };

    const strokeColor = getScoreColor(score);

    // Summary View (Direct match to StockSummary layout)
    if (view === 'summary') {
        const summaryRadius = 35; // Significantly bigger
        const summaryCircumference = 2 * Math.PI * summaryRadius;
        const summaryDashoffset = summaryCircumference - (score / 100) * summaryCircumference;
        const grading = score >= 80 ? 'Excellent' : score >= 60 ? 'Average' : 'Critical';

        return (
            <div className="summary-health stock-health-summary">
                <div className="summary-health-content">
                    <h3 className="summary-health-title">{type}</h3>
                    <div className="summary-ring-group">
                        <div className="summary-ring-wrapper">
                            <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                                <circle cx="40" cy="40" r={summaryRadius} stroke="var(--neu-shadow-dark)" strokeWidth="6" fill="none" opacity="0.15" />
                                <circle
                                    cx="40" cy="40" r={summaryRadius}
                                    stroke={strokeColor}
                                    strokeWidth="6"
                                    fill="none"
                                    strokeDasharray={summaryCircumference}
                                    strokeDashoffset={summaryDashoffset}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <span className="summary-score" style={{ color: strokeColor }}>{score}</span>
                        </div>
                        <div className="summary-grading" style={{ color: strokeColor }}>{grading}</div>
                    </div>
                </div>
            </div>
        );
    }

    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    const effectiveExpanded = variant === 'transparent' ? true : isExpanded;

    return (
        <StyledCard
            expanded={effectiveExpanded}
            className={`stock-health-wrapper ${className}`}
            variant={variant}
            {...props}
        >
            {/* HEADER */}
            <div className="stock-health-header" onClick={variant === 'transparent' ? null : toggleExpand}>
                {/* Left Side: Score & Text */}
                <div className="stock-health-header-content">
                    <div className="score-ring-wrapper">
                        <svg width="80" height="80" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
                            <circle cx="50" cy="50" r={radius} stroke="var(--neu-shadow-dark)" strokeWidth="8" fill="none" opacity="0.3" />
                            <circle cx="50" cy="50" r={radius} stroke={strokeColor} strokeWidth="8" fill="none" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
                        </svg>
                        <span className="score-text" style={{ color: strokeColor }}>{score}</span>
                    </div>
                    <div className="score-label-group">
                        <h3 className="health-title">{type}</h3>
                        <div className="health-subtitle">
                            {score >= 80 ? 'Excellent' : score >= 60 ? 'Average' : 'Critical'}
                        </div>
                    </div>
                </div>

                {/* Right Side: Button (Hide if transparent/nested) */}
                {variant !== 'transparent' && (
                    <Button
                        onClick={(e) => { e.stopPropagation(); toggleExpand(); }}
                        variant="icon"
                        className="expand-btn-wrapper"
                    >
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </Button>
                )}
            </div>

            {/* INNER BODY */}
            <StyledCard.Expandable active={effectiveExpanded}>
                <div className="stock-health-body-wrapper">
                    <div className="health-checklist">
                        {items.map((item, index) => {
                            const statusConfig = {
                                pass: { icon: Check, color: 'var(--neu-success)' },
                                fail: { icon: X, color: 'var(--neu-error)' },
                                warn: { icon: AlertCircle, color: 'var(--neu-color-favorite)' }
                            }[item.status || 'warn'];
                            const Icon = statusConfig.icon;

                            return (
                                <ButtonAnimator key={index} type="expansionItem" as="div" className="checklist-item">
                                    <div className={`status-icon status-${item.status}`}>
                                        <Icon size={18} strokeWidth={3} />
                                    </div>
                                    <span className="item-label">{item.label}</span>
                                </ButtonAnimator>
                            );
                        })}
                    </div>
                    {/* Only visible on mobile via CSS */}
                    <div className="scroll-hint">Scroll for more ↓</div>
                </div>
            </StyledCard.Expandable>
        </StyledCard>
    );
};

export default StockHealthCard;