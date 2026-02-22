import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import StyledCard from '../StyledCard/StyledCard';
import './Window.css';

const Window = ({
    isOpen,
    onClose,
    title,
    children,
    width = '500px',
    height = '85vh',
    controls,
    headerAlign = 'center',
    headerVerticalAlign = 'center',
    hideCloseButton = false,
    contentClassName,
    maxHeight = '85vh'
}) => {
    const [isExpanded, setIsExpanded] = React.useState(false);

    useEffect(() => {
        if (isOpen) {
            // Slight delay to ensure CardAnimator detects the mount-then-active transition
            const timer = setTimeout(() => setIsExpanded(true), 50);

            // Calculate scrollbar width before locking
            const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
            document.body.style.overflow = 'hidden';
            document.body.classList.add('window-open');
            if (scrollbarWidth > 0) {
                document.body.style.paddingRight = `${scrollbarWidth}px`;
            }
            return () => clearTimeout(timer);
        } else {
            setIsExpanded(false);
            document.body.style.overflow = 'unset';
            document.body.style.paddingRight = '0px';
            document.body.classList.remove('window-open');
        }
    }, [isOpen]);

    const backdropVariants = {
        closed: { opacity: 0 },
        open: { opacity: 0.9 }
    };

    const contentVariants = {
        closed: { opacity: 0, scale: 0.8, rotateX: 10, y: 50 },
        open: {
            opacity: 1,
            y: 0,
            scale: 1,
            rotateX: 0,
            transition: {
                type: 'spring',
                stiffness: 280,
                damping: 24,
                opacity: { duration: 0.3 }
            }
        },
        exit: {
            opacity: 0,
            y: 30,
            scale: 0.9,
            rotateX: -5,
            transition: { duration: 0.4, ease: "easeInOut" }
        }
    };

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="window-wrapper"
                    className="window-wrapper"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    style={{ perspective: '1200px' }}
                >
                    <motion.div
                        className="window-overlay"
                        initial="closed"
                        animate="open"
                        exit="closed"
                        variants={backdropVariants}
                        transition={{ duration: 0.4 }}
                        onClick={onClose}
                    />
                    <motion.div
                        variants={contentVariants}
                        initial="closed"
                        animate="open"
                        exit="exit"
                        style={{
                            width,
                            height,
                            maxHeight,
                            maxWidth: '95vw',
                            display: 'flex',
                            flexDirection: 'column',
                            zIndex: 10,
                            pointerEvents: 'auto',
                            position: 'relative',
                            transformStyle: 'preserve-3d'
                        }}
                    >
                        <StyledCard
                            className="window-card"
                            title={title}
                            expanded={isExpanded}
                            onClose={hideCloseButton ? undefined : onClose}
                            headerAlign={headerAlign}
                            headerVerticalAlign={headerVerticalAlign}
                            controls={controls}
                            variant="default"
                            containerStyle={{
                                margin: 0,
                                height: '100%',
                                width: '100%',
                                minHeight: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'visible'
                            }}
                            distortionFactor={1.4}
                            contentDistortionScale={0.3}
                            noScale={false}
                            style={{
                                flex: 1,
                                height: '100%',
                                minHeight: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'visible'
                            }}
                        >
                            <div className={`window-content ${contentClassName || ''}`}>
                                {children}
                            </div>
                        </StyledCard>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default Window;
