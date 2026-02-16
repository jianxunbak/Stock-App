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
    useEffect(() => {
        if (isOpen) {
            // Calculate scrollbar width before locking
            const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

            document.body.style.overflow = 'hidden';
            document.body.classList.add('window-open');
            if (scrollbarWidth > 0) {
                document.body.style.paddingRight = `${scrollbarWidth}px`;
            }
        } else {
            document.body.style.overflow = 'unset';
            document.body.style.paddingRight = '0px';
            document.body.classList.remove('window-open');
        }

        return () => {
            document.body.style.overflow = 'unset';
            document.body.style.paddingRight = '0px';
            document.body.classList.remove('window-open');
        };
    }, [isOpen]);

    const backdropVariants = {
        closed: { opacity: 0 },
        open: { opacity: 1 }
    };

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="window-wrapper">
                    <motion.div
                        className="window-overlay open"
                        initial="closed"
                        animate="open"
                        exit="closed"
                        variants={backdropVariants}
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{
                            type: 'spring',
                            stiffness: 260,
                            damping: 20,
                            opacity: { duration: 0.2 }
                        }}
                        style={{
                            width,
                            height,
                            maxHeight,
                            maxWidth: '95vw',
                            display: 'flex',
                            flexDirection: 'column',
                            zIndex: 10,
                            pointerEvents: 'auto',
                            position: 'relative'
                        }}
                    >
                        <StyledCard
                            className="window-card"
                            title={title}
                            expanded={true}
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
                                overflow: 'visible' // Allow shadows/highlights to show
                            }}
                            distortionFactor={1.2}
                            noScale={false}
                            style={{
                                flex: 1,
                                height: '100%',
                                minHeight: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'visible' // Allow shadows on the animator level too
                            }}
                        >
                            <div className={`window-content ${contentClassName || ''}`}>
                                {children}
                            </div>
                        </StyledCard>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default Window;
