import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StyledCard from '../StyledCard/StyledCard';
import './SideDrawer.css';

const SideDrawer = ({
    isOpen,
    onClose,
    title,
    children,
    width = '500px'
}) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const backdropVariants = {
        closed: { opacity: 0 },
        open: { opacity: 1 }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="side-drawer-wrapper">
                    <motion.div
                        className="side-drawer-overlay open"
                        initial="closed"
                        animate="open"
                        exit="closed"
                        variants={backdropVariants}
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        style={{
                            width,
                            maxWidth: '95vw',
                            zIndex: 1001,
                            pointerEvents: 'auto'
                        }}
                    >
                        <StyledCard
                            title={title}
                            expanded={true}
                            onClose={onClose}
                            variant="default"
                            containerStyle={{ margin: 0 }}
                            distortionFactor={1.5}
                            noScale={false}
                            style={{
                                maxHeight: '85vh',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            <div className="side-drawer-content">
                                {children}
                            </div>
                        </StyledCard>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default SideDrawer;
