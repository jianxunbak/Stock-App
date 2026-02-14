import { motion, useMotionValue, useTransform, animate as runAnimation, usePresence } from 'framer-motion';
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';

// --- 1. The Math: Vertical Fabric Path (The Elastic Shape) ---
function useFabricPathVertical(width, height, distortion) {
    return useTransform([width, height, distortion], ([w, h, d]) => {
        if (!w || !h || w <= 0 || h <= 0) return "";

        const r = Math.min(24, w / 2, h / 2); // Radius adjusted to 24 (approx 1.5rem)
        const straightEdge = Math.max(0, h - 2 * r);
        let ratio = Math.min(1, straightEdge / 200);
        const dampener = ratio * ratio;
        const safeD = d * dampener;

        const rightControlX = w + safeD;
        const leftControlX = 0 - safeD;
        const yTop = Math.max(r, h * 0.25);
        const yBottom = Math.min(h - r, h * 0.75);

        return `
            M ${r},0 L ${w - r},0 A ${r},${r} 0 0 1 ${w},${r} 
            C ${rightControlX},${yTop} ${rightControlX},${yBottom} ${w},${h - r} 
            A ${r},${r} 0 0 1 ${w - r},${h} L ${r},${h} A ${r},${r} 0 0 1 ${0},${h - r} 
            C ${leftControlX},${yBottom} ${leftControlX},${yTop} ${0},${r} 
            A ${r},${r} 0 0 1 ${r},0 Z
        `;
    });
}

// --- 1b. The Math: Horizontal Fabric Path (Rotated 90 degrees) ---
function useFabricPathHorizontal(width, height, distortion) {
    return useTransform([width, height, distortion], ([w, h, d]) => {
        if (!w || !h || w <= 0 || h <= 0) return "";

        // INSET: We inset everything by 1px to ensure the 1px stroke is never clipped by its parent div
        const offset = 1;
        const sw = w - (offset * 2);
        const sh = h - (offset * 2);
        const r = Math.min(12, sw / 2, sh / 2);

        // DAMPING: Prevent the "Oval" effect when the bar is square or nearly square.
        // We use a cubed dropoff to ensure distortion is 100% dead by the time we approach button size.
        const extraWidth = Math.max(0, sw - sh);
        const dampener = Math.pow(Math.min(1, extraWidth / 80), 3);
        const safeD = d * dampener;

        // Coordinates: d < 0 is Concave (Pinch), d > 0 is Convex (Bulge)
        // Opening (Concave) -> topY moves DOWN (positive), bottomY moves UP (negative relative to h)
        const topY = offset - safeD;
        const bottomY = h - offset + safeD;

        const midX = w / 2;
        const xLeft = w * 0.25;
        const xRight = w * 0.75;

        // CRITICAL: Side edges (w, 0->h) and (0, 0->h) must stay strictly vertical.
        // The arcs must move vertically but stay horizontally fixed at 0 or w.
        // Path math using the inset dimensions
        return `
            M ${offset + r},${offset} 
            C ${xLeft},${offset} ${xLeft},${topY} ${midX},${topY} 
            C ${xRight},${topY} ${xRight},${offset} ${w - offset - r},${offset} 
            A ${r},${r} 0 0 1 ${w - offset},${offset + r} 
            L ${w - offset},${h - offset - r} 
            A ${r},${r} 0 0 1 ${w - offset - r},${h - offset} 
            C ${xRight},${h - offset} ${xRight},${bottomY} ${midX},${bottomY} 
            C ${xLeft},${bottomY} ${xLeft},${h - offset} ${offset + r},${h - offset} 
            A ${r},${r} 0 0 1 ${offset},${h - offset - r} 
            L ${offset},${offset + r} 
            A ${r},${r} 0 0 1 ${offset + r},${offset} Z
        `;
    });
}

// --- 2. The Renderer: Fabric Background (Purely physical surface) ---
const FabricBackground = React.memo(({ active, isStrokeOnly = false, orientation = 'vertical', surfaceColor = "var(--neu-bg)" }) => {
    const containerRef = useRef(null);
    const lastActive = useRef(null);

    const [size, setSize] = useState({ w: 0, h: 0 });
    const [dimsReady, setDimsReady] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    const width = useMotionValue(0);
    const height = useMotionValue(0);
    const distortion = useMotionValue(0);

    const vPath = useFabricPathVertical(width, height, distortion);
    const hPath = useFabricPathHorizontal(width, height, distortion);
    const pathD = orientation === 'horizontal' ? hPath : vPath;

    const isReady = dimsReady && size.w > 0;

    useLayoutEffect(() => {
        if (!containerRef.current) return;
        const updateSize = (entries) => {
            const entry = entries[0];
            if (entry) {
                const { width: w, height: h } = entry.contentRect;
                if (w > 0 && h > 0) {
                    width.set(w);
                    height.set(h);
                    setSize({ w, h });
                    setDimsReady(true);
                }
            }
        };
        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, [width, height]);

    useEffect(() => {
        if (active === lastActive.current) return;
        const duration = 0.6;
        setIsAnimating(true);

        if (active) {
            runAnimation(distortion, [0, orientation === 'horizontal' ? -8 : -16, 0], { duration, times: [0, 0.4, 1], ease: "easeInOut" });
        } else {
            runAnimation(distortion, [0, orientation === 'horizontal' ? 6 : 16, 0], { duration, times: [0, 0.4, 1], ease: "easeInOut" });
        }

        const timer = setTimeout(() => {
            setIsAnimating(false);
            lastActive.current = active;
        }, duration * 1000);

        return () => clearTimeout(timer);
    }, [active, distortion, orientation]);

    return (
        <div
            ref={containerRef}
            style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                zIndex: 0,
                opacity: isReady ? 1 : 0,
                overflow: 'visible',
                background: 'transparent !important',
                boxShadow: 'none !important',
                border: 'none !important',
                borderRadius: orientation === 'horizontal' ? 'var(--neu-radius-sm)' : 'var(--neu-radius-lg)',
                transition: 'none',
                pointerEvents: 'none',
                boxSizing: 'border-box'
            }}
        >

            {/* 1. Dark Shadow Layer - HTML Div Blur (Safari Fix) */}
            {!isStrokeOnly && orientation !== 'horizontal' && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    transform: 'translate3d(6px, 6px, 0)',
                    filter: 'blur(8px)',
                    WebkitFilter: 'blur(8px)',
                    opacity: 0.8,
                    zIndex: -1
                }}>
                    <svg style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                        <motion.path d={pathD} fill="var(--neu-shadow-dark)" stroke="none" />
                    </svg>
                </div>
            )}

            {/* 2. Light Highlight Layer - HTML Div Blur (Safari Fix) */}
            {!isStrokeOnly && orientation !== 'horizontal' && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    transform: 'translate3d(-6px, -6px, 0)',
                    filter: 'blur(8px)',
                    WebkitFilter: 'blur(8px)',
                    opacity: 1,
                    zIndex: -1
                }}>
                    <svg style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                        <motion.path d={pathD} fill="var(--neu-shadow-light)" stroke="none" />
                    </svg>
                </div>
            )}

            {/* 3. Main Surface */}
            <svg
                style={{
                    width: '100%', height: '100%', overflow: 'visible', display: 'block',
                    position: 'absolute', top: 0, left: 0,
                    opacity: isReady ? 1 : 0,
                    transition: 'opacity 0.1s',
                    zIndex: 0
                }}
            >
                <motion.path
                    d={pathD}
                    fill={isStrokeOnly ? "none" : surfaceColor}
                    stroke={isStrokeOnly ? "var(--neu-border-subtle)" : "none"}
                    strokeWidth="1"
                    strokeLinejoin="round"
                    style={{
                        padding: 0,
                        vectorEffect: 'non-scaling-stroke'
                    }}
                />
            </svg>
        </div>
    );
});

// --- 3. Main Export: Animation Controller ---
const CardAnimator = React.memo(({
    type = 'fabricCard',
    active = false,
    children,
    as,
    className = '',
    layout = false,
    style = {},
    variant = 'default',
    noScale = false,
    distortionFactor = 1,
    surfaceColor,
    ...props
}) => {
    if (type === 'expandableContent') {
        // ... (lines 187-211 omitted for brevity if matching logic works, but easier to just target the useEffect block? No, I need to add the prop first)

        // Let's target the component definition start to add the prop
        const [isAnimating, setIsAnimating] = useState(false);

        return (
            <motion.div
                initial="collapsed"
                animate={active ? "expanded" : "collapsed"}
                variants={{
                    collapsed: {
                        opacity: 0, height: 0, overflow: "hidden", y: -10,
                        transition: { duration: 0.3, ease: "easeInOut" }
                    },
                    expanded: {
                        opacity: 1, height: "auto", overflow: isAnimating ? "hidden" : "visible", y: 0,
                        transition: { duration: 0.4, ease: "easeOut", delay: 0.05 }
                    }
                }}
                onAnimationStart={() => setIsAnimating(true)}
                onAnimationComplete={() => setIsAnimating(false)}
                className={className}
            >
                {children}
            </motion.div>
        );
    }

    if (type === 'fabricCard' || type === 'fabricHorizontal') {
        const BaseComponent = motion[as || 'div'];
        const [isPresent, safeToRemove] = usePresence();
        const contentScaleX = useMotionValue(1);
        const contentScaleY = useMotionValue(1);
        const prevActive = useRef(null);
        const isHorizontal = type === 'fabricHorizontal';
        const effectiveActive = active && isPresent;

        // Fix doubling: Strip all style-carrying classes from the container using regex
        const cleanClassName = className
            .replace(/\b(neu-btn-base|active|pressed-latch|hover-pop)\b/g, '')
            .trim();

        useEffect(() => {
            if (!isPresent && safeToRemove) {
                const timer = setTimeout(safeToRemove, 500);
                return () => clearTimeout(timer);
            }
        }, [isPresent, safeToRemove]);

        useEffect(() => {
            if (prevActive.current === effectiveActive || noScale) return;
            const duration = 0.5;
            const ease = "easeInOut";
            const times = [0, 0.4, 1];
            const d = distortionFactor;

            if (isHorizontal) {
                if (effectiveActive) {
                    runAnimation(contentScaleX, [1, 1 + (0.04 * d), 1], { duration, times, ease });
                    runAnimation(contentScaleY, [1, 1 - (0.04 * d), 1], { duration, times, ease });
                } else {
                    runAnimation(contentScaleX, [1, 1 - (0.03 * d), 1], { duration, times, ease });
                    runAnimation(contentScaleY, [1, 1 + (0.03 * d), 1], { duration, times, ease });
                }
            } else {
                if (effectiveActive) {
                    runAnimation(contentScaleX, [1, 1 - (0.06 * d), 1], { duration, times, ease });
                    runAnimation(contentScaleY, [1, 1 + (0.06 * d), 1], { duration, times, ease });
                } else {
                    runAnimation(contentScaleX, [1, 1 + (0.05 * d), 1], { duration, times, ease });
                    runAnimation(contentScaleY, [1, 1 - (0.05 * d), 1], { duration, times, ease });
                }
            }
            prevActive.current = effectiveActive;
        }, [effectiveActive, contentScaleX, contentScaleY, isHorizontal, noScale, distortionFactor]);

        return (
            <BaseComponent
                layout={layout}
                style={{
                    position: 'relative',
                    zIndex: 1,
                    transformOrigin: isHorizontal ? "center left" : "top center",
                    willChange: "transform",
                    ...style,
                    // OVERRIDES MUST BE LAST
                    background: 'transparent !important',
                    boxShadow: 'none !important',
                    border: 'none !important',
                }}
                className={cleanClassName}
                {...props}
            >
                {variant !== 'transparent' && (
                    <FabricBackground
                        active={effectiveActive}
                        orientation={isHorizontal ? 'horizontal' : 'vertical'}
                        surfaceColor={surfaceColor}
                    />
                )}
                <motion.div
                    style={{
                        position: 'relative',
                        zIndex: 2,
                        scaleX: contentScaleX,
                        scaleY: contentScaleY,
                        transformOrigin: "center center",
                        display: isHorizontal ? 'flex' : 'block',
                        alignItems: isHorizontal ? 'center' : 'initial',
                        width: '100%',
                        height: '100%'
                    }}
                >
                    {children}
                </motion.div>
                {/* Stroke Layer Removed for Borderless Look */}
            </BaseComponent>
        );
    }
    return null;
});

export default CardAnimator;