import React from 'react';
import { motion, AnimatePresence, usePresence } from 'framer-motion';
import { CardAnimator } from '../Animator';
import Button from '../Button';
import { X } from 'lucide-react';
import Menu from '../Menu';
import { useResizeObserver } from '../../../hooks/useResizeObserver';
import './StyledCard.css';

const StyledCard = React.memo(({
    children,
    className = "",
    expanded = false,
    onClick,
    style = {},
    title,
    controls,
    persistentControls,
    headerAlign = "center",
    headerVerticalAlign = "center",
    variant = 'default',
    layout = true,
    noScale = false,
    containerStyle = {},
    distortionFactor = 1,
    isOpen, // Ignore
    onClose, // Ignore - we use it via props.onClose inside but don't want it on DOM
    ...props
}) => {
    // Visual Setup
    const combinedClassName = `styled-card-container ${variant} ${className}`;
    const [containerRef, { width }] = useResizeObserver();

    // Helper to get children from controls prop, flattening fragments if necessary
    const getControlChildren = (node) => {
        if (!node) return [];
        const array = React.Children.toArray(node);
        // Flatten single level of fragment if the only root is a fragment
        if (array.length === 1 && array[0]?.type === React.Fragment) {
            return React.Children.toArray(array[0].props.children);
        }
        return array;
    };

    const finalControls = React.useMemo(() => {
        const pControls = persistentControls ? getControlChildren(persistentControls) : [];
        const children = controls ? getControlChildren(controls) : [];

        // If no controls, just return persistent ones
        if (children.length === 0) return pControls.length > 0 ? pControls : null;

        // If 2 or more buttons in 'controls', collapse them into our new Menu component
        if (children.length >= 2) {
            return (
                <>
                    <Menu
                        orientation="horizontal"
                        variant={variant}
                        placement="bottom-right"
                    >
                        {children}
                    </Menu>
                    {persistentControls}
                </>
            );
        }

        // If only 1 button in 'controls', show it normally alongside persistent ones
        return (
            <>
                {controls}
                {persistentControls}
            </>
        );
    }, [controls, persistentControls, variant]);

    const renderContent = () => (
        <div className={`styled-card-content ${variant}`}>
            {(title || finalControls || props.onClose) && (
                <div
                    className="styled-card-header"
                    style={{ alignItems: headerVerticalAlign }}
                >
                    {title && <div className="styled-card-title" style={{ textAlign: headerAlign === 'start' ? 'left' : headerAlign === 'end' ? 'right' : 'center' }}>{title}</div>}
                    <div className="styled-card-controls-container" style={{ display: 'flex', alignItems: 'center', gap: '0.1rem' }}>
                        {finalControls && <div className="styled-card-controls">{finalControls}</div>}
                        {onClose && (
                            <Button
                                variant="icon"
                                className="styled-card-close-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClose();
                                }}
                            >
                                <X size={16} />
                            </Button>
                        )}
                    </div>
                </div>
            )}
            {children}
        </div>
    );

    const cardBody = (
        <CardAnimator
            type="fabricCard"
            active={expanded}
            className={combinedClassName}
            variant={variant}
            noScale={noScale}
            distortionFactor={distortionFactor}
            style={{
                ...style,
                width: style.width || "100%",
                height: style.height || "auto",
            }}
        >
            {renderContent()}
        </CardAnimator>
    );

    return (
        <motion.div
            ref={containerRef}
            className="styled-card-root"
            layout={layout}
            onClick={onClick}
            style={{
                width: '100%',
                position: 'relative',
                zIndex: expanded ? 10 : 1,
                ...containerStyle
            }}
            transition={{ layout: { type: "spring", stiffness: 90, damping: 20 } }}
            {...props}
        >
            {cardBody}
        </motion.div>
    );
});

// Sub-component
StyledCard.Expandable = React.memo(({ active, children, className = "" }) => (
    <CardAnimator type="expandableContent" active={active} className={className}>
        {children}
    </CardAnimator>
));

export default StyledCard;
