import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, MoreVertical, RefreshCcw } from 'lucide-react';
import StyledCard from '../StyledCard';
import Button from '../Button/Button';
import DropdownButton from '../DropdownButton/DropdownButton';
import './ExpandableCard.css';

/**
 * A generic card component that can expand/collapse to show more content.
 */
const ExpandableCard = ({
    children,
    title,
    subtitle,
    headerContent,
    controls,
    menuItems,
    onRefresh,
    expanded, // NEW: Controlled state
    defaultExpanded = false,
    collapsedWidth = 210,
    collapsedHeight = 210,
    onToggle,
    style,
    className = "",
    stackControls = false,
    isOpen, // Ignore
    ...props
}) => {
    // Internal state for uncontrolled mode
    const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);

    // Determine if controlled
    const isControlled = expanded !== undefined;
    const isExpanded = isControlled ? expanded : internalExpanded;

    const combinedMenuItems = React.useMemo(() => {
        const baseItems = Array.isArray(menuItems) ? [...menuItems] : [];

        if (!onRefresh) return menuItems;

        const alreadyHasRefresh = baseItems.some(item =>
            item && item.label && item.label.toLowerCase().includes('refresh')
        );

        if (alreadyHasRefresh) return baseItems;

        const refreshItem = {
            label: 'Refresh Data',
            onClick: onRefresh,
            indicatorNode: <RefreshCcw size={14} />
        };

        return [refreshItem, ...baseItems];
    }, [menuItems, onRefresh]);

    const handleToggle = (e) => {
        // Prevent toggle if clicking a button or link inside header, EXCLUDING the toggle button itself
        const isToggleButton =
            e.target.closest('.expandable-card-btn') ||
            e.target.closest('.styled-card-menu-trigger') ||
            e.target.closest('.expandable-card-menu-btn') ||
            e.target.closest('.dropdown-wrapper');

        if (!isToggleButton && (e.target.closest('button') || e.target.closest('a'))) return;

        // If it's a dropdown or other action, don't toggle expansion
        if (isToggleButton && !e.target.closest('.expandable-card-btn')) {
            e.stopPropagation();
            return;
        }

        const newState = !isExpanded;

        // Only update internal state if uncontrolled
        if (!isControlled) {
            setInternalExpanded(newState);
        }

        if (onToggle) onToggle(newState);
    };

    // Check if headerContent is a React Element to clone it with props if needed
    const finalHeaderContent = React.isValidElement(headerContent)
        ? React.cloneElement(headerContent, {
            className: `embedded-header ${headerContent.props.className || ''}`
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
                    {/* Top Row: Title, Controls & Toggle */}
                    <div className={`collapsed-controls-row ${stackControls ? 'vertical-stack' : ''}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <div className="expandable-card-title-container">
                            {/* Title removed to avoid duplication with summary content */}
                        </div>
                        <div className="expandable-card-header-actions">
                            {!isExpanded && (
                                <>
                                    <div className="collapsed-custom-controls">
                                        {controls}
                                    </div>
                                    {combinedMenuItems && (
                                        <DropdownButton
                                            items={combinedMenuItems}
                                            variant="icon"
                                            icon={<MoreVertical size={18} />}
                                            align="right"
                                            className="expandable-card-menu-btn"
                                        />
                                    )}
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
                                </>
                            )}
                        </div>
                    </div>

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
                    <div className={`expandable-card-controls-group ${stackControls ? 'vertical-stack' : ''}`}>
                        <div className="expandable-card-title-container">
                            {title && <h3 className="expandable-card-expanded-title">{title}</h3>}
                        </div>
                        <div className="expandable-card-body-actions">
                            {controls}
                            {combinedMenuItems && (
                                <DropdownButton
                                    items={combinedMenuItems}
                                    variant="icon"
                                    icon={<MoreVertical size={18} />}
                                    align="right"
                                    className="expandable-card-menu-btn"
                                />
                            )}
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
                    </div>
                )}
                <div className="expandable-card-components-group" style={{ paddingTop: 0 }}>
                    {children}
                </div>
            </motion.div>
        </StyledCard>
    );
};

export default ExpandableCard;
