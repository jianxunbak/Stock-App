import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, MoreVertical, RefreshCcw, EyeOff } from 'lucide-react';
import StyledCard from '../StyledCard';
import Button from '../Button/Button';
import DropdownButton from '../DropdownButton/DropdownButton';
import InlineSpinner from '../InlineSpinner/InlineSpinner';
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
    onHide, // NEW: Prop to handle hiding the card
    expanded, // NEW: Controlled state
    defaultExpanded = false,
    collapsedWidth = 210,
    collapsedHeight = 210,
    onToggle,
    loading = false, // Add loading prop
    style,
    className = "",
    stackControls = false,
    isOpen, // Ignore
    ...props
}) => {
    // Determine the spinner to use
    const renderLoading = () => (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            width: '100%',
            minHeight: '100px',
            padding: '2rem'
        }}>
            <InlineSpinner size="32px" />
        </div>
    );

    // Internal state for uncontrolled mode
    const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);

    // Determine if controlled
    const isControlled = expanded !== undefined;
    const isExpanded = isControlled ? expanded : internalExpanded;

    const combinedMenuItems = React.useMemo(() => {
        const baseItems = Array.isArray(menuItems) ? [...menuItems] : [];

        if (onRefresh) {
            const alreadyHasRefresh = baseItems.some(item =>
                item && item.label && item.label.toLowerCase().includes('refresh')
            );
            if (!alreadyHasRefresh) {
                baseItems.push({
                    label: 'Refresh Data',
                    onClick: onRefresh,
                    indicatorNode: <RefreshCcw size={14} />
                });
            }
        }

        if (onHide) {
            baseItems.push({
                label: 'Hide Card',
                onClick: (e) => {
                    if (e && e.stopPropagation) e.stopPropagation();
                    onHide();
                },
                indicatorNode: <EyeOff size={14} />,
                style: { color: 'var(--neu-danger)' }
            });
        }

        return baseItems;
    }, [menuItems, onRefresh, onHide]);

    const lastToggleTimeComp = React.useRef(0);
    const lastEventTypeComp = React.useRef(null);

    const handleToggle = React.useCallback((e) => {
        if (!e) return;

        const now = Date.now();
        const eventType = e.type;

        // 1. Ignore "ghost" clicks that follow touch events
        if (eventType === 'click' && lastEventTypeComp.current === 'touchstart' && (now - lastToggleTimeComp.current < 1000)) {
            return;
        }

        // 2. Strict 1-second cooldown to prevent double-toggling
        if (now - lastToggleTimeComp.current < 1000) return;

        // Find if we clicked an interactive element
        const target = e.target;
        const interactiveSelector = 'button, a, input, select, textarea, [role="button"], .dropdown-wrapper, .expandable-card-menu-btn, .expandable-card-btn, svg, path';
        const interactiveEl = target.closest(interactiveSelector);

        // Check specifically for our toggle button or its children
        const toggleBtn = target.closest('.expandable-card-btn');

        // 3. If we clicked an interactive element that IS NOT our toggle button, return
        if (interactiveEl && !toggleBtn) {
            return;
        }

        // 4. Force stop everything
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
        if (e.nativeEvent && e.nativeEvent.stopImmediatePropagation) {
            e.nativeEvent.stopImmediatePropagation();
        }

        lastToggleTimeComp.current = now;
        lastEventTypeComp.current = eventType;

        const newState = !isExpanded;

        // Only update internal state if uncontrolled
        if (!isControlled) {
            setInternalExpanded(newState);
        }

        if (onToggle) onToggle(newState);
    }, [isExpanded, isControlled, onToggle]);

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
            distortionFactor={0}
            controls={null} // We handle controls manually in summary and body mode
            persistentControls={null}
            animate={isExpanded ? "expanded" : "collapsed"}
            variants={{
                expanded: { width: '100%', height: 'auto' },
                collapsed: { width: collapsedWidth, height: collapsedHeight }
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            containerStyle={{
                flex: isExpanded ? '1 1 auto' : '0 0 auto',
                width: isExpanded ? '100%' : collapsedWidth,
                minWidth: isExpanded ? 0 : collapsedWidth,
                maxWidth: isExpanded ? '100%' : collapsedWidth,
            }}
            style={{
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'visible',
                width: isExpanded ? '100%' : collapsedWidth,
                height: isExpanded ? 'auto' : collapsedHeight,
                isolation: 'isolate', // Safari clipping fix
                ...style
            }}
        >

            <motion.div
                className="expandable-card-header"
                onClick={handleToggle}
                onTouchStart={handleToggle}
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
                    zIndex: isExpanded ? 1 : 10,
                    cursor: isExpanded ? 'default' : 'pointer',
                    overflow: 'visible',
                    pointerEvents: isExpanded ? 'none' : 'auto'
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
                        <div className="collapsed-left-controls">
                            {!isExpanded && controls}
                        </div>
                        <div className="expandable-card-header-actions">
                            {!isExpanded && (
                                <>
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
                                        onClick={handleToggle}
                                        onTouchStart={handleToggle}
                                    >
                                        <ChevronDown size={20} />
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Summary Content */}
                    <div className="collapsed-summary-wrapper">
                        {loading ? renderLoading() : (finalHeaderContent ? (
                            finalHeaderContent
                        ) : (
                            <div className="default-header">
                                <h3>{title}</h3>
                                {subtitle && <p className="subtitle">{subtitle}</p>}
                            </div>
                        ))}
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
                        <div
                            className="expandable-card-title-container"
                            onClick={handleToggle}
                            onTouchStart={handleToggle}
                            style={{ cursor: 'pointer' }}
                        >
                            {title && <h3 className="expandable-card-expanded-title">{title}</h3>}
                            {subtitle && <span className="expandable-card-subtitle">{subtitle}</span>}
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
                                onClick={handleToggle}
                                onTouchStart={handleToggle}
                            >
                                <ChevronUp size={20} />
                            </Button>
                        </div>
                    </div>
                )}
                <div className="expandable-card-components-group" style={{ paddingTop: 0 }}>
                    {loading ? renderLoading() : children}
                </div>
            </motion.div>
        </StyledCard>
    );
};

export default ExpandableCard;
