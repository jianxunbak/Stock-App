import React from 'react';
import { CardAnimator } from '../Animator';
import Button from '../Button';
import { X } from 'lucide-react';
import Menu from '../Menu';
import InlineSpinner from '../InlineSpinner/InlineSpinner';
import Skeleton from '../Skeleton/Skeleton';
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
    loading = false,
    skeleton = null,
    isOpen, // Ignore
    onClose, // Ignore - we use it via props.onClose inside but don't want it on DOM
    contentDistortionScale = 1,
    shadowScale = 1,
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
                        orientation="vertical"
                        variant="default"
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
        <div
            className={`styled-card-content ${variant}`}
            style={{
                height: '100%',
                minHeight: 'inherit',
                position: 'relative',
                opacity: loading ? 0 : 1,
                pointerEvents: loading ? 'none' : 'auto'
            }}
        >
            {(title || finalControls || props.onClose) && (
                <div
                    className="styled-card-header"
                    style={{ alignItems: headerVerticalAlign }}
                >
                    {title && (
                        <div
                            className="styled-card-title"
                            style={{
                                textAlign: headerAlign === 'start' ? 'left' : headerAlign === 'end' ? 'right' : 'center',
                                overflow: typeof title !== 'string' ? 'visible' : undefined,
                                whiteSpace: typeof title !== 'string' ? 'normal' : undefined,
                                textOverflow: typeof title !== 'string' ? 'clip' : undefined
                            }}
                        >
                            {title}
                        </div>
                    )}
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

    return (
        <CardAnimator
            ref={containerRef}
            type="fabricCard"
            active={expanded}
            className={combinedClassName}
            variant={variant}
            layout={layout}
            noScale={noScale || loading}
            distortionFactor={loading ? 0 : distortionFactor}
            contentDistortionScale={loading ? 0 : contentDistortionScale}
            shadowScale={shadowScale}
            onClick={onClick}
            style={{
                ...style,
                width: style.width || "100%",
                height: style.height || "auto",
                position: 'relative',
                zIndex: expanded ? 10 : 1,
                ...containerStyle
            }}
            transition={{ layout: { type: "spring", stiffness: 90, damping: 20 } }}
            {...props}
        >
            {renderContent()}

            {/* Skeleton / Loading Overlay */}
            {loading && (
                <div className="expandable-card-loading-overlay">
                    {skeleton ? skeleton : (
                        <div style={{ width: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <Skeleton width="40%" height="1.2rem" />
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <Skeleton width="30%" height="3rem" />
                                <Skeleton width="30%" height="3rem" />
                                <Skeleton width="30%" height="3rem" />
                            </div>
                            <Skeleton width="90%" height="1rem" />
                            <Skeleton width="70%" height="1rem" />
                        </div>
                    )}
                </div>
            )}
        </CardAnimator>
    );

});

// Sub-component
StyledCard.Expandable = React.memo(({ active, children, className = "" }) => (
    <CardAnimator type="expandableContent" active={active} className={className}>
        {children}
    </CardAnimator>
));

export default StyledCard;
