import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, MoreVertical, RefreshCcw, EyeOff } from 'lucide-react';
import StyledCard from '../StyledCard';
import Button from '../Button/Button';
import DropdownButton from '../DropdownButton/DropdownButton';

import './ExpandableCard.css';

/**
 * A generic card component that can expand/collapse to show more content.
 * 
 * Loading behaviour:
 *   1. When `loading` becomes true the card freezes at its current size.
 *      All titles, buttons, controls and children are hidden – only the
 *      spinner (rendered by StyledCard) is visible.
 *   2. When `loading` becomes false the freeze is lifted and the card
 *      can animate to its intended expanded/collapsed state.
 */
const ExpandableCard = ({
    children,
    title,
    subtitle,
    headerContent,
    controls,
    collapsedHeaderControls, // NEW: extra controls to show left of menu when collapsed
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
    containerStyle,
    ...props
}) => {
    // Loading spinner is now handled centrally by StyledCard.jsx

    // Internal state for uncontrolled mode
    const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
    const isManualRefresh = useRef(false);




    const handleRefreshClick = React.useCallback((e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        isManualRefresh.current = true;
        if (onRefresh) onRefresh(e);
    }, [onRefresh]);

    // Determine if controlled
    const isControlled = expanded !== undefined;
    const isExpanded = isControlled ? expanded : internalExpanded;

    // During loading, force collapsed so the card shows at its closed-card size
    // (expanded cards with hidden content would collapse to height 0).
    // After loading completes, the card animates to its intended open/closed state.
    const visualExpanded = loading ? false : isExpanded;

    const combinedMenuItems = React.useMemo(() => {
        const baseItems = Array.isArray(menuItems) ? [...menuItems] : [];

        if (onRefresh) {
            const alreadyHasRefresh = baseItems.some(item =>
                item && item.label && item.label.toLowerCase().includes('refresh')
            );
            if (!alreadyHasRefresh) {
                baseItems.push({
                    label: 'Refresh Data',
                    onClick: handleRefreshClick,
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

    const lastToggleTimeComp = useRef(0);
    const lastEventTypeComp = useRef(null);

    // Mobile detection for responsive defaults
    const [isMobile, setIsMobile] = useState(false);

    React.useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Unified sizing: Always span full width and auto height (content-driven)
    // Mobile check is kept only if we need other specific mobile behaviors later
    const effectiveCollapsedWidth = '100%';
    const effectiveCollapsedHeight = typeof collapsedHeight === 'number' ? `${collapsedHeight}px` : collapsedHeight;

    const handleToggle = React.useCallback((e) => {
        if (!e) return;

        // Block toggling while loading
        if (loading) return;

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
    }, [isExpanded, isControlled, onToggle, loading]);

    // Check if headerContent is a React Element to clone it with props if needed
    const finalHeaderContent = React.isValidElement(headerContent)
        ? React.cloneElement(headerContent, {
            className: `embedded-header ${headerContent.props.className || ''}`
        })
        : headerContent;

    return (
        <StyledCard
            data-collapsed={!visualExpanded}
            expanded={visualExpanded}
            className={`expandable-card ${!visualExpanded ? 'is-collapsed' : ''} ${className}`}
            layout={false}
            initial={false}
            distortionFactor={1.2}
            contentDistortionScale={0.3}
            controls={null} // We handle controls manually in summary and body mode
            persistentControls={null}
            animate={visualExpanded ? "expanded" : "collapsed"}
            variants={{
                expanded: { width: '100%', height: 'auto' },
                collapsed: { width: effectiveCollapsedWidth, height: effectiveCollapsedHeight }
            }}
            transition={loading ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }}
            containerStyle={{
                flex: visualExpanded ? '1 1 auto' : '0 0 auto',
                width: visualExpanded ? '100%' : effectiveCollapsedWidth,
                minWidth: visualExpanded ? 0 : effectiveCollapsedWidth,
                maxWidth: visualExpanded ? '100%' : effectiveCollapsedWidth,
                height: visualExpanded ? 'auto' : effectiveCollapsedHeight,
                minHeight: visualExpanded ? 0 : effectiveCollapsedHeight,
                maxHeight: visualExpanded ? 'none' : effectiveCollapsedHeight,
                overflow: 'visible',
                ...containerStyle
            }}
            style={{
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'visible',

                width: visualExpanded ? '100%' : effectiveCollapsedWidth,
                height: visualExpanded ? 'auto' : effectiveCollapsedHeight,
                maxHeight: visualExpanded ? 'none' : effectiveCollapsedHeight,
                isolation: 'isolate', // Safari clipping fix
                ...style
            }}
            loading={loading}
        >
            <motion.div
                className="expandable-card-header"
                onClick={handleToggle}
                onTouchStart={handleToggle}
                initial={false}
                animate={{
                    minHeight: visualExpanded ? 0 : effectiveCollapsedHeight,
                    height: visualExpanded ? 0 : effectiveCollapsedHeight,
                }}
                transition={loading ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    zIndex: visualExpanded ? 1 : 10,
                    cursor: loading ? 'default' : (visualExpanded ? 'default' : 'pointer'),
                    overflow: 'visible',
                    pointerEvents: loading ? 'none' : (visualExpanded ? 'none' : 'auto')
                }}
            >
                <div
                    className="expandable-card-header-content"
                    style={{
                        opacity: loading ? 0 : (visualExpanded ? 0 : 1),
                        pointerEvents: loading ? 'none' : (visualExpanded ? 'none' : 'auto'),
                        transition: loading ? 'none' : 'opacity 0.2s ease',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        boxSizing: 'border-box',
                        borderRadius: 'inherit',
                        overflow: 'visible'
                    }}
                >
                    {!loading && (
                        <>
                            {/* Top Row: Title, Controls & Toggle */}
                            <div className={`collapsed-controls-row ${stackControls ? 'vertical-stack' : ''}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                <div className="collapsed-title-group" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', flex: 1, minWidth: 0 }}>
                                    {title && <h3 className="expandable-card-expanded-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>{title}</h3>}
                                </div>

                                <div className="expandable-card-header-actions">
                                    {!visualExpanded && (
                                        <>
                                            {/* Extra controls injected to the left of the menu button */}
                                            {collapsedHeaderControls && (
                                                <div className="collapsed-header-extra-controls" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginRight: '0.25rem' }}>
                                                    {collapsedHeaderControls}
                                                </div>
                                            )}
                                            {combinedMenuItems && (
                                                <DropdownButton
                                                    items={combinedMenuItems}
                                                    variant="icon"
                                                    icon={<MoreVertical size={18} />}
                                                    align="right"
                                                    className="expandable-card-menu-btn"
                                                    usePortal={true}
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

                            {finalHeaderContent ? (
                                finalHeaderContent
                            ) : (
                                <div className="default-header">
                                    <h3>{title}</h3>
                                    {subtitle && <p className="subtitle">{subtitle}</p>}
                                </div>
                            )}
                        </>
                    )}
                </div>

            </motion.div>

            <motion.div
                className="expandable-card-body"
                initial={false}
                animate={loading ? {
                    height: visualExpanded ? 'auto' : 0,
                    opacity: 0,
                    y: visualExpanded ? 0 : -2,
                    overflow: 'hidden'
                } : (visualExpanded ? {
                    height: 'auto',
                    opacity: 1,
                    y: 0,
                    transitionEnd: { overflow: 'visible' }
                } : {
                    height: 0,
                    opacity: 0,
                    y: -2,
                    overflow: 'hidden'
                })}
                transition={loading ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }}
                style={{
                    position: 'relative',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                {visualExpanded && !loading && (
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
                    {!loading && children}
                </div>
            </motion.div>
        </StyledCard>
    );
};

export default ExpandableCard;
