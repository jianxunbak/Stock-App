import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import Button from '../Button/Button';
import { CardAnimator } from '../Animator';
import './DropdownButton.css';

/**
 * DropdownButton Component
 * A reusable, subtle dropdown button.
 */
const DropdownButton = ({
    label,
    icon,
    triggerNode,
    items = [],
    align = 'left',
    closeOnSelect = false,
    className = '',
    contentStyle = {},
    buttonStyle = {},
    variant = 'outline',
    usePortal = false,
    disableBounce = false,
    noAnimation = false,
    ...props
}) => {
    // ... existing hooks ...
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    const triggerControls = useAnimation();
    const prevIsOpen = useRef(isOpen);

    useEffect(() => {
        // ...
        const handleClickOutside = (event) => {
            // Check if click is inside container (trigger) OR inside menu (portal)
            const isClickInMenu = menuRef.current && menuRef.current.contains(event.target);
            const isClickInTrigger = containerRef.current && containerRef.current.contains(event.target);

            if (!isClickInTrigger && !isClickInMenu) {
                setIsOpen(false);
            }
        };
        // ...
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // ... nudge logic ...
    const [nudgeOffset, setNudgeOffset] = useState({ x: 0, y: 0 });
    const [shouldFlip, setShouldFlip] = useState(false);
    const nudgeRef = useRef({ x: 0, y: 0 });
    const menuRef = useRef(null);

    useLayoutEffect(() => {
        // Skip position calculation if using portal with fixed positioning (centered)
        if (usePortal && contentStyle?.position === 'fixed') return;

        if (isOpen && menuRef.current && containerRef.current) {
            // ... existing position update logic ...
            const updatePosition = () => {
                if (!menuRef.current || !containerRef.current) return;

                // Use offsetWidth/Height for the MENU specifically because it ignores 
                // the CSS transforms (scaling) currently happening, giving us a stable size.
                const menuW = menuRef.current.offsetWidth;
                const menuH = menuRef.current.offsetHeight;

                // We still use getBoundingClientRect for the trigger and viewport as they are stable.
                const triggerRect = containerRef.current.getBoundingClientRect();
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const padding = 48;

                const currentNudge = nudgeRef.current;

                // 1. Vertical Flip Decision
                const spaceBelow = viewportHeight - triggerRect.bottom;
                const spaceAbove = triggerRect.top;

                if (spaceBelow < (menuH + padding) && spaceAbove > spaceBelow) {
                    setShouldFlip(true);
                } else {
                    setShouldFlip(false);
                }

                // 2. Nudge Calculation
                // Calculate where the menu WOULDS be without any nudge
                const baseLeft = (align === 'right')
                    ? triggerRect.right - menuW
                    : triggerRect.left;

                const baseTop = (shouldFlip)
                    ? triggerRect.top - menuH - 12
                    : triggerRect.bottom + 6;

                let nx = 0;
                if (baseLeft + menuW > viewportWidth - padding) {
                    nx = viewportWidth - padding - (baseLeft + menuW);
                } else if (baseLeft < padding) {
                    nx = padding - baseLeft;
                }

                let ny = 0;
                if (baseTop + menuH > viewportHeight - padding) {
                    ny = viewportHeight - padding - (baseTop + menuH);
                } else if (baseTop < padding) {
                    ny = padding - baseTop;
                }

                // Only update if difference is meaningful to prevent "vibrating"
                // Increased threshold to 3px for better stability
                if (Math.abs(nx - currentNudge.x) > 3 || Math.abs(ny - currentNudge.y) > 3) {
                    nudgeRef.current = { x: nx, y: ny };
                    setNudgeOffset({ x: nx, y: ny });
                }
            };

            // Run immediately and then again after entries/animations settle
            updatePosition();
            const timers = [
                setTimeout(updatePosition, 100),
                setTimeout(updatePosition, 300)
            ];
            return () => timers.forEach(t => clearTimeout(t));
        }
    }, [isOpen, shouldFlip, usePortal, contentStyle?.position]); // Updated dependencies

    // ... existing toggle logic ...
    useEffect(() => {
        if (!noAnimation && !disableBounce && prevIsOpen.current && !isOpen) {
            // Bounce effect when closing
            triggerControls.start("bounce");
        }
        prevIsOpen.current = isOpen;
    }, [isOpen, triggerControls, disableBounce, noAnimation]);

    const handleToggle = (e) => {
        if (e) e.stopPropagation();
        setIsOpen(!isOpen);
    };

    const handleItemClick = (e, item) => {
        if (e) e.stopPropagation();
        if (item.disabled) return;
        if (item.onClick) {
            item.onClick(e);
        }
        if (closeOnSelect) {
            setIsOpen(false);
        }
    };

    const renderTrigger = () => {
        if (triggerNode) {
            return (
                <div onClick={handleToggle} style={{ display: 'inline-block', cursor: 'pointer' }}>
                    {triggerNode}
                </div>
            );
        }

        // Determine if we should show the label
        // Default behavior: Always show label if provided
        // Improved behavior: If showLabelOnOpen is true, only show label when isOpen
        const showLabel = props.showLabelOnOpen ? (isOpen && label) : label;

        return (
            <Button
                variant={variant}
                onClick={handleToggle}
                className={isOpen ? 'active' : ''}
                noAnimation={noAnimation}
                style={{
                    width: showLabel ? 'auto' : '36px',
                    minWidth: '36px',
                    height: '36px',
                    padding: showLabel ? '0 0.75rem' : '0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: showLabel ? '0.5rem' : 0,
                    fontSize: '0.75rem',
                    ...buttonStyle
                }}
            >
                {icon}
                {showLabel && (
                    <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
                    >
                        {label}
                    </motion.span>
                )}
            </Button>
        );
    };

    const isFixedCentered = usePortal && contentStyle?.position === 'fixed';

    const getDropdownMenu = () => (
        <motion.div
            key="dropdown-menu-container"
            ref={menuRef}
            className="dropdown-menu-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
            style={{
                zIndex: usePortal ? 1000000 : 1000,
                position: isFixedCentered ? 'fixed' : (usePortal ? 'absolute' : 'absolute'),
                left: isFixedCentered ? '50%' : (align === 'right' ? 'auto' : 0),
                right: isFixedCentered ? 'auto' : (align === 'right' ? 0 : 'auto'),
                top: isFixedCentered ? '50%' : (shouldFlip ? 'auto' : '100%'),
                bottom: isFixedCentered ? 'auto' : (shouldFlip ? 'calc(100% + 12px)' : 'auto'),
                maxHeight: '400px', // Default max-height
                transform: isFixedCentered
                    ? `translate(-50%, -50%)`
                    : `translate(${nudgeOffset.x}px, ${nudgeOffset.y}px)`,
                ...contentStyle,
                backgroundColor: 'transparent',
                boxShadow: 'none',
                border: 'none',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <motion.div
                className="dropdown-menu-animator"
                initial={{
                    scale: 0.95,
                    y: isFixedCentered ? 10 : -10,
                }}
                animate={{
                    scale: 1,
                    y: 0,
                }}
                exit={{
                    scale: 0.95,
                    transition: { duration: 0.8, ease: "easeInOut" }
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    maxHeight: 'inherit'
                }}
            >
                <CardAnimator
                    type="fabricCard"
                    active={isOpen}
                    variant={variant === 'transparent' ? 'transparent' : 'default'}
                    surfaceColor="var(--neu-bg)"
                    distortionFactor={props.distortionFactor !== undefined ? props.distortionFactor : 0.5}
                    contentDistortionScale={props.contentDistortionScale !== undefined ? props.contentDistortionScale : 0.72}
                    disableHighlight={false}
                    disableShadow={false}
                    style={{
                        padding: '0.25rem',
                        maxHeight: 'inherit',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                >
                    <div className="dropdown-items-container">
                        {items.map((item, index) => {
                            if (item.type === 'divider') {
                                return <div key={index} className="dropdown-divider" />;
                            }
                            if (item.type === 'header') {
                                return (
                                    <div key={index} className="dropdown-header">
                                        {item.label}
                                    </div>
                                );
                            }
                            return (
                                <button
                                    key={index}
                                    className={`dropdown-item ${item.isActive ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
                                    onClick={(e) => handleItemClick(e, item)}
                                >
                                    <div className="dropdown-item-content">
                                        {item.icon ? (
                                            <span style={{ marginRight: '8px', display: 'flex', alignItems: 'center', opacity: 0.7 }}>
                                                {item.icon}
                                            </span>
                                        ) : item.indicatorNode ? (
                                            item.indicatorNode
                                        ) : item.indicatorColor ? (
                                            <div
                                                className="dropdown-dot"
                                                style={{ backgroundColor: item.indicatorColor }}
                                            />
                                        ) : (
                                            item.isActive ? (
                                                <div
                                                    className="dropdown-dot"
                                                    style={{ backgroundColor: 'currentColor', opacity: 0.6 }}
                                                />
                                            ) : (
                                                <div style={{ width: 6 }} />
                                            )
                                        )}
                                        <span>{item.label}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </CardAnimator>
            </motion.div>
        </motion.div>
    );

    return (
        <div className={`dropdown-wrapper ${className}`} ref={containerRef} {...props}>
            <motion.div
                animate={noAnimation ? {} : triggerControls}
                variants={{
                    bounce: {
                        scaleX: [1, 1.04, 0.98, 1.02, 1],
                        scaleY: [1, 0.98, 1.02, 0.99, 1],
                        transition: { duration: 0.4, ease: "easeInOut" }
                    }
                }}
            >
                {renderTrigger()}
            </motion.div>

            {usePortal ? createPortal(
                <AnimatePresence>
                    {isOpen && getDropdownMenu()}
                </AnimatePresence>,
                document.body
            ) : (
                <AnimatePresence>
                    {isOpen && getDropdownMenu()}
                </AnimatePresence>
            )}
        </div>
    );
};

export default DropdownButton;
