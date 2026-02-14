import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import StyledCard from '../StyledCard';
import Button from '../Button/Button';
import './ExpandableCard.css';

/**
 * A generic card component that can expand/collapse to show more content.
 * 
 * @param {string} title - The main title of the card header.
 * @param {string} subtitle - The subtitle of the card header.
 * @param {React.ReactNode} headerContent - Custom content for the left side of the header (overrides title/subtitle).
 * @param {React.ReactNode} children - The content to display when expanded.
 * @param {string} className - Additional CSS classes.
 * @param {boolean} defaultExpanded - Whether the card is expanded by default.
 * @param {function} onToggle - Optional callback when toggled.
 */
const ExpandableCard = ({
    children,
    title,
    subtitle,
    headerContent,
    controls,
    defaultExpanded = false,
    collapsedWidth = 210,
    collapsedHeight = 210,
    onToggle,
    style,
    className = "",
    ...props
}) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const handleToggle = (e) => {
        // Prevent toggle if clicking a button or link inside header, EXCLUDING the toggle button itself
        const isToggleButton = e.target.closest('.expandable-card-btn') || e.target.closest('.styled-card-menu-trigger');
        if (!isToggleButton && (e.target.closest('button') || e.target.closest('a'))) return;

        const newState = !isExpanded;
        setIsExpanded(newState);
        if (onToggle) onToggle(newState);
    };

    // Standard Wrapper Layout
    // We treat headerContent as the "Title" area content, and inject our Toggle Button into the "Controls" area.
    // This allows StyledCard (the wrapper) to handle the layout: [Title Area (StockHeader)] ... [Controls Area (Chevron)]
    // To make this seamless, StockHeader should ideally be 'transparent' so it doesn't look like a nested card.

    // Check if headerContent is a React Element to clone it with props if needed
    const finalHeaderContent = React.isValidElement(headerContent)
        ? React.cloneElement(headerContent, {
            // We hint to the child that it's embedded. 
            // Note: If the child is StockHeader, 'transparent' might hide buttons depending on implementation.
            // We will address that in StockHeader if needed. For now, we just pass the content.
            className: `embedded-header ${headerContent.props.className || ''}`
            /* We avoid passing variant='transparent' blindly if it hides buttons */
        })
        : headerContent;

    return (
        <StyledCard
            expanded={isExpanded}
            className={`expandable-card ${!isExpanded ? 'is-collapsed' : ''} ${className}`}
            layout={false}
            initial={false}
            distortionFactor={isExpanded ? 0.3 : 1}
            controls={null} // We handle controls manually in summary and body mode
            persistentControls={null}
            animate={isExpanded ? "expanded" : "collapsed"}
            variants={{
                expanded: { width: '100%', height: 'auto' },
                collapsed: { width: collapsedWidth, height: collapsedHeight }
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            containerStyle={{
                flex: isExpanded ? '1 1 100%' : '0 0 auto',
                width: isExpanded ? '100%' : collapsedWidth,
                minWidth: isExpanded ? '100%' : collapsedWidth,
                maxWidth: isExpanded ? '100%' : collapsedWidth,
            }}
            style={{
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'visible',
                ...style
            }}
        >

            <motion.div
                className="expandable-card-header"
                onClick={handleToggle}
                initial={false}
                animate={{
                    minHeight: isExpanded ? 0 : collapsedHeight,
                    height: isExpanded ? 0 : collapsedHeight,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    zIndex: 10,
                    cursor: 'pointer',
                    overflow: 'visible'
                }}
            >
                <div
                    className="expandable-card-header-content"
                    style={{
                        opacity: isExpanded ? 0 : 1,
                        pointerEvents: isExpanded ? 'none' : 'auto',
                        transition: 'opacity 0.2s ease',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        boxSizing: 'border-box'
                    }}
                >
                    {/* Top Row: Controls & Toggle */}
                    {!isExpanded && (
                        <div className="collapsed-controls-row" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.25rem' }}>
                            <div className="collapsed-custom-controls">
                                {controls}
                            </div>
                            <Button
                                variant="icon"
                                className="expandable-card-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggle(e);
                                }}
                            >
                                <ChevronDown size={20} />
                            </Button>
                        </div>
                    )}

                    {/* Summary Content */}
                    <div className="collapsed-summary-wrapper">
                        {finalHeaderContent ? (
                            finalHeaderContent
                        ) : (
                            <div className="default-header">
                                <h3>{title}</h3>
                                {subtitle && <p className="subtitle">{subtitle}</p>}
                            </div>
                        )}
                    </div>
                </div>

            </motion.div>

            <motion.div
                className="expandable-card-body"
                initial={false}
                animate={isExpanded ? {
                    height: 'auto',
                    opacity: 1,
                    y: 0,
                    transitionEnd: { overflow: 'visible' }
                } : {
                    height: 0,
                    opacity: 0,
                    y: -2,
                    overflow: 'hidden'
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                style={{
                    position: 'relative'
                }}
            >
                {isExpanded && (
                    <div className="expandable-card-controls-group">
                        {controls}
                        <Button
                            variant="icon"
                            className="expandable-card-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleToggle(e);
                            }}
                        >
                            <ChevronUp size={20} />
                        </Button>
                    </div>
                )}
                <div className="expandable-card-components-group">
                    {children}
                </div>
            </motion.div>
        </StyledCard>
    );
};

export default ExpandableCard;
