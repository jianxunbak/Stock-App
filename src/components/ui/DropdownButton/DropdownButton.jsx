import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
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
    ...props
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    const triggerControls = useAnimation();
    const prevIsOpen = useRef(isOpen);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const [nudgeOffset, setNudgeOffset] = useState({ x: 0, y: 0 });
    const [shouldFlip, setShouldFlip] = useState(false);
    const nudgeRef = useRef({ x: 0, y: 0 });
    const menuRef = useRef(null);

    useLayoutEffect(() => {
        if (isOpen && menuRef.current && containerRef.current) {
            const updatePosition = () => {
                if (!menuRef.current || !containerRef.current) return;

                const rect = menuRef.current.getBoundingClientRect();
                const triggerRect = containerRef.current.getBoundingClientRect();
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const padding = 24;

                const currentNudge = nudgeRef.current;

                // 1. Vertical Flip Decision (Based on trigger space, more stable)
                const menuHeight = rect.height;
                const spaceBelow = viewportHeight - triggerRect.bottom;
                const spaceAbove = triggerRect.top;

                if (spaceBelow < (menuHeight + padding) && spaceAbove > spaceBelow) {
                    setShouldFlip(true);
                } else {
                    setShouldFlip(false);
                }

                // 2. Nudge Calculation
                // Important: Subtract the CURRENT nudge to find where it WOULDA been (the "Base" position)
                const baseRect = {
                    left: rect.left - currentNudge.x,
                    right: rect.right - currentNudge.x,
                    top: rect.top - currentNudge.y,
                    bottom: rect.bottom - currentNudge.y
                };

                let nx = 0;
                if (baseRect.right > viewportWidth - padding) {
                    nx = viewportWidth - padding - baseRect.right;
                } else if (baseRect.left < padding) {
                    nx = padding - baseRect.left;
                }

                let ny = 0;
                // Vertical nudge is tricky because flipping changes the baseRect.top/bottom.
                // We calculate ny relative to the current painted position's overflow.
                if (rect.bottom > viewportHeight - padding) {
                    ny = (viewportHeight - padding - rect.bottom);
                } else if (rect.top < padding) {
                    ny = (padding - rect.top);
                }

                // Add existing nudge to ny to make it absolute to base
                const totalNy = currentNudge.y + ny;

                // Only update if difference is meaningful to prevent "vibrating"
                if (Math.abs(nx - currentNudge.x) > 2 || Math.abs(totalNy - currentNudge.y) > 2) {
                    nudgeRef.current = { x: nx, y: totalNy };
                    setNudgeOffset({ x: nx, y: totalNy });
                }
            };

            // Run immediately and then again after entries/animations settle
            updatePosition();
            const timers = [
                setTimeout(updatePosition, 100),
                setTimeout(updatePosition, 300)
            ];
            return () => timers.forEach(t => clearTimeout(t));
        } else if (!isOpen) {
            setNudgeOffset({ x: 0, y: 0 });
            setShouldFlip(false);
        }
    }, [isOpen, shouldFlip]);

    useEffect(() => {
        if (prevIsOpen.current && !isOpen) {
            // Bounce effect when closing
            triggerControls.start("bounce");
        }
        prevIsOpen.current = isOpen;
    }, [isOpen, triggerControls]);

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

    return (
        <div className={`dropdown-wrapper ${className}`} ref={containerRef} {...props}>
            <motion.div
                animate={triggerControls}
                variants={{
                    bounce: {
                        scaleX: [1, 1.1, 0.95, 1.05, 1],
                        scaleY: [1, 0.95, 1.05, 0.98, 1],
                        transition: { duration: 0.4, ease: "easeInOut" }
                    }
                }}
            >
                {renderTrigger()}
            </motion.div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={menuRef}
                        className="dropdown-menu"
                        initial={{ opacity: 0, y: -5, x: 0, scale: 0.95, filter: 'blur(4px)' }}
                        animate={{
                            opacity: 1,
                            y: nudgeOffset.y,
                            x: nudgeOffset.x,
                            scale: 1,
                            filter: 'blur(0px)'
                        }}
                        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        style={{
                            [align === 'right' ? 'right' : 'left']: 0,
                            [align === 'right' ? 'left' : 'right']: 'auto',
                            top: shouldFlip ? 'auto' : '100%',
                            bottom: shouldFlip ? 'calc(100% + 12px)' : 'auto',
                            ...contentStyle
                        }}
                    >
                        <CardAnimator
                            type="fabricCard"
                            active={isOpen}
                            variant={variant === 'transparent' ? 'transparent' : 'default'}
                            style={{ padding: '0.25rem' }}
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
                )}
            </AnimatePresence>
        </div>
    );
};

export default DropdownButton;
