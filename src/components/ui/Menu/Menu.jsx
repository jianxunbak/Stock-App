import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { MoreVertical } from 'lucide-react';
import Button from '../Button/Button';
import { CardAnimator } from '../Animator';
import './Menu.css';

/**
 * A versatile Menu component that can collapse/expand.
 * Supports horizontal and vertical orientations and any number of buttons.
 */
const Menu = ({
    children,
    trigger,
    orientation = 'vertical',
    placement = 'bottom-right',
    className = '',
    contentClassName = '',
    variant = 'default',
    surfaceColor,
    maxRadius = 12,
    contentStyle = {},
    distortionFactor = 1,
    contentDistortionScale = 1,
    ...props
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    const toggleMenu = (e) => {
        if (e) {
            e.stopPropagation();
            if (e.preventDefault) e.preventDefault();
        }
        setIsOpen(!isOpen);
    };

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        const handleEscape = (e) => {
            if (e.key === 'Escape') setIsOpen(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    const triggerControls = useAnimation();
    const prevIsOpen = useRef(isOpen);

    useEffect(() => {
        if (prevIsOpen.current && !isOpen) {
            triggerControls.start("bounce");
        }
        prevIsOpen.current = isOpen;
    }, [isOpen, triggerControls]);

    const renderTrigger = () => {
        const triggerStyle = {
            opacity: isOpen && orientation === 'horizontal' ? 0 : 1,
            transition: `opacity ${isOpen ? '0.1s' : '0.5s'} ease-in-out`
        };

        if (trigger) {
            return React.cloneElement(trigger, {
                onClick: (e) => {
                    if (trigger.props.onClick) trigger.props.onClick(e);
                    toggleMenu(e);
                },
                className: `${trigger.props.className || ''} ${isOpen ? 'active' : ''}`,
                style: { ...trigger.props.style, ...triggerStyle }
            });
        }

        return (
            <Button
                variant="icon"
                className={`menu-trigger-btn ${isOpen ? 'active' : ''}`}
                onClick={toggleMenu}
                aria-label="Toggle menu"
                style={triggerStyle}
            >
                <MoreVertical size={20} />
            </Button>
        );
    };

    return (
        <div className={`menu-wrapper ${className}`} ref={menuRef} {...props}>
            <motion.div
                animate={triggerControls}
                variants={{
                    bounce: {
                        scaleX: [1, 1.12, 0.92, 1.04, 1],
                        scaleY: [1, 0.92, 1.08, 0.96, 1],
                        transition: {
                            delay: 0.25,
                            duration: 0.5,
                            ease: "easeInOut"
                        }
                    }
                }}
            >
                {renderTrigger()}
            </motion.div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className={`menu-dropdown-wrapper ${placement} ${orientation}`}
                        onClick={(e) => e.stopPropagation()}
                        variants={orientation === 'horizontal' ? {
                            hidden: {
                                width: "2.25rem",
                                opacity: 1,
                                scale: 1,
                                y: "-50%",
                                transformOrigin: placement.includes('right') ? 'center right' : 'center left'
                            },
                            visible: {
                                width: "auto",
                                opacity: 1,
                                scale: 1,
                                y: "-50%",
                                transition: {
                                    type: "spring",
                                    stiffness: 400,
                                    damping: 30,
                                    staggerChildren: 0.05
                                }
                            },
                            exit: {
                                width: "2.25rem",
                                opacity: [1, 1, 0],
                                scale: 1,
                                y: "-50%",
                                transition: {
                                    duration: 0.4,
                                    opacity: { times: [0, 0.8, 1], duration: 0.4 },
                                    default: { duration: 0.8, ease: "easeInOut" }
                                }
                            }
                        } : {
                            hidden: {
                                opacity: 0,
                                scale: 0.92,
                                y: placement.includes('bottom') ? -10 : 10,
                                filter: 'blur(10px)'
                            },
                            visible: {
                                opacity: 1,
                                scale: 1,
                                y: 0,
                                filter: 'blur(0px)',
                                transition: {
                                    type: "spring",
                                    stiffness: 300,
                                    damping: 30,
                                    staggerChildren: 0.08,
                                    delayChildren: 0.05
                                }
                            },
                            exit: {
                                opacity: 0,
                                scale: 0.95,
                                transition: { duration: 0.8, ease: "easeInOut" }
                            }
                        }}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        style={{
                            background: 'transparent',
                            boxShadow: 'none',
                            border: 'none',
                            borderRadius: 0
                        }}
                    >
                        <CardAnimator
                            type={orientation === 'horizontal' ? 'fabricHorizontal' : 'fabricCard'}
                            active={isOpen}
                            variant={variant === 'transparent' ? 'default' : variant}
                            className={`menu-content-container ${variant === 'transparent' ? 'default' : variant} ${contentClassName}`}
                            surfaceColor={surfaceColor}
                            maxRadius={maxRadius}
                            distortionFactor={distortionFactor}
                            contentDistortionScale={contentDistortionScale}
                            disableShadow={false}
                            disableHighlight={false}
                            style={{
                                width: 'auto',
                                height: 'auto',
                                padding: '0.5rem',
                                ...contentStyle
                            }}
                        >
                            <div
                                className={`menu-items-grid ${orientation}`}
                            >
                                {React.Children.toArray(children).filter(Boolean).map((child, index) => (
                                    <motion.div
                                        key={index}
                                        variants={{
                                            hidden: { opacity: 0, y: 15 },
                                            visible: {
                                                opacity: 1,
                                                y: 0,
                                                transition: {
                                                    type: "spring",
                                                    stiffness: 300,
                                                    damping: 20
                                                }
                                            },
                                            exit: { opacity: 0, scale: 0.5, transition: { duration: 0.2 } }
                                        }}
                                        style={{ display: 'flex' }}
                                    >
                                        {child}
                                    </motion.div>
                                ))}
                            </div>
                        </CardAnimator>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Menu;
