import { motion, useMotionValue, useTransform, animate as runAnimation, usePresence } from 'framer-motion';
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';

// --- 1. The Math: Vertical Fabric Path (The Elastic Shape) ---
const f = (val) => Math.round(val * 10) / 10;

function useFabricPathVertical(width, height, distortion, maxRadius = 24) {
    return useTransform([width, height, distortion], ([w, h, d]) => {
        if (!w || !h || w <= 0 || h <= 0) return "";

        const r = Math.min(maxRadius, w / 2, h / 2);
        const straightEdge = Math.max(0, h - 2 * r);
        let ratio = Math.min(1, straightEdge / 60);
        const dampener = ratio * ratio;
        const safeD = d * dampener;

        const rightControlX = f(w + safeD);
        const leftControlX = f(0 - safeD);
        const yTop = f(Math.max(r, h * 0.25));
        const yBottom = f(Math.min(h - r, h * 0.75));
        const rw = f(w);
        const rh = f(h);
        const rr = f(r);

        return `
            M ${rr},0 L ${f(w - r)},0 A ${rr},${rr} 0 0 1 ${rw},${rr} 
            C ${rightControlX},${yTop} ${rightControlX},${yBottom} ${rw},${f(h - r)} 
            A ${rr},${rr} 0 0 1 ${f(w - r)},${rh} L ${rr},${rh} A ${rr},${rr} 0 0 1 ${0},${f(h - r)} 
            C ${leftControlX},${yBottom} ${leftControlX},${yTop} ${0},${rr} 
            A ${rr},${rr} 0 0 1 ${rr},0 Z
        `;
    });
}

function useFabricPathHorizontal(width, height, distortion, maxRadius = 12) {
    return useTransform([width, height, distortion], ([w, h, d]) => {
        if (!w || !h || w <= 0 || h <= 0) return "";

        const offset = 1;
        const sw = w - (offset * 2);
        const sh = h - (offset * 2);
        const r = Math.min(maxRadius, sw / 2, sh / 2);

        const extraWidth = Math.max(0, sw - sh);
        const dampener = Math.pow(Math.min(1, extraWidth / 80), 3);
        const safeD = d * dampener;

        const topY = f(offset - safeD);
        const bottomY = f(h - offset + safeD);
        const midX = f(w / 2);
        const xLeft = f(w * 0.25);
        const xRight = f(w * 0.75);
        const ro = f(offset);
        const rw = f(w);
        const rh = f(h);
        const rr = f(r);

        return `
            M ${f(offset + r)},${ro} 
            C ${xLeft},${ro} ${xLeft},${topY} ${midX},${topY} 
            C ${xRight},${topY} ${xRight},${ro} ${f(w - offset - r)},${ro} 
            A ${rr},${rr} 0 0 1 ${f(w - offset)},${f(offset + r)} 
            L ${f(w - offset)},${f(h - offset - r)} 
            A ${rr},${rr} 0 0 1 ${f(w - offset - r)},${f(h - offset)} 
            C ${xRight},${f(h - offset)} ${xRight},${bottomY} ${midX},${bottomY} 
            C ${xLeft},${bottomY} ${xLeft},${f(h - offset)} ${f(offset + r)},${f(h - offset)} 
            A ${rr},${rr} 0 0 1 ${ro},${f(h - offset - r)} 
            L ${ro},${f(offset + r)} 
            A ${rr},${rr} 0 0 1 ${f(offset + r)},${ro} Z
        `;
    });
}

const FabricBackground = React.memo(({ active, isStrokeOnly = false, orientation = 'vertical', surfaceColor = "var(--neu-bg)", maxRadius = 24, flat = false, distortionFactor = 1, disableHighlight = false, disableShadow = false, shadowScale = 1 }) => {
    const containerRef = useRef(null);
    const lastActive = useRef(null);

    const [size, setSize] = useState({ w: 0, h: 0 });
    const [dimsReady, setDimsReady] = useState(false);

    const width = useMotionValue(0);
    const height = useMotionValue(0);
    const distortion = useMotionValue(0);

    const vPath = useFabricPathVertical(width, height, distortion, maxRadius);
    const hPath = useFabricPathHorizontal(width, height, distortion, maxRadius);
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
        // Only run if active actually changes
        if (active === lastActive.current) return;

        const duration = 1.0;
        const prev = lastActive.current;
        lastActive.current = active;

        const targetDistortion = 12 * distortionFactor;
        const targetDistortionHorizontal = 6 * distortionFactor;

        // Ensure we reset to 0 even if interrupted
        runAnimation(distortion, [distortion.get(), active ? -targetDistortion : targetDistortion, 0], {
            duration,
            times: [0, 0.35, 1],
            ease: "easeInOut"
        });

    }, [active, distortion, orientation, distortionFactor]);

    return (
        <div
            ref={containerRef}
            style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                zIndex: 0,
                opacity: isReady ? 1 : 0,
                overflow: 'visible',
                background: 'transparent',
                borderRadius: `${maxRadius}px`,
                pointerEvents: 'none'
            }}
        >
            {!isStrokeOnly && !flat && !disableShadow && orientation !== 'horizontal' && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    transform: `translate3d(${6 * shadowScale}px, ${6 * shadowScale}px, 0)`,
                    filter: `blur(${8 * shadowScale}px)`,
                    WebkitFilter: `blur(${8 * shadowScale}px)`,
                    opacity: 0.8 * shadowScale,
                    zIndex: -1
                }}>
                    <svg style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                        <motion.path d={pathD} fill="var(--neu-shadow-dark)" stroke="none" />
                    </svg>
                </div>
            )}

            {!isStrokeOnly && !flat && !disableHighlight && orientation !== 'horizontal' && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    transform: `translate3d(${-6 * shadowScale}px, ${-6 * shadowScale}px, 0)`,
                    filter: `blur(${8 * shadowScale}px)`,
                    WebkitFilter: `blur(${8 * shadowScale}px)`,
                    opacity: shadowScale,
                    zIndex: -1
                }}>
                    <svg style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                        <motion.path d={pathD} fill="var(--neu-shadow-light)" stroke="none" />
                    </svg>
                </div>
            )}

            <svg
                style={{
                    width: '100%', height: '100%', overflow: 'visible', display: 'block',
                    position: 'absolute', top: 0, left: 0,
                    opacity: isReady ? 1 : 0,
                    zIndex: 0
                }}
            >
                <motion.path
                    d={pathD}
                    fill={isStrokeOnly ? "none" : surfaceColor}
                    stroke={isStrokeOnly ? "var(--neu-border-subtle)" : "none"}
                    strokeWidth="1"
                    strokeLinejoin="round"
                />
            </svg>
        </div>
    );
});

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
    contentDistortionScale = 1,
    surfaceColor,
    maxRadius = 24,
    flat = false,
    disableHighlight = false,
    disableShadow = false,
    shadowScale = 1,
    ...props
}) => {
    const [isInternalAnimating, setIsInternalAnimating] = useState(false);

    if (type === 'expandableContent') {
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
                        opacity: 1, height: "auto", overflow: isInternalAnimating ? "hidden" : "visible", y: 0,
                        transition: { duration: 0.4, ease: "easeOut", delay: 0.05 }
                    }
                }}
                onAnimationStart={() => setIsInternalAnimating(true)}
                onAnimationComplete={() => setIsInternalAnimating(false)}
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
        const isHorizontal = type === 'fabricHorizontal';
        const effectiveActive = active && isPresent;
        const prevActive = useRef(null);

        useEffect(() => {
            if (!isPresent && safeToRemove) {
                const timer = setTimeout(safeToRemove, 500);
                return () => clearTimeout(timer);
            }
        }, [isPresent, safeToRemove]);


        useEffect(() => {
            if (prevActive.current === effectiveActive || noScale) {
                prevActive.current = effectiveActive;
                return;
            }

            const duration = 1.0;
            const ease = "easeInOut";
            const times = [0, 0.35, 1];
            const d = distortionFactor;
            const scaleAmount = 0.08 * d * contentDistortionScale;

            if (isHorizontal) {
                if (effectiveActive) {
                    runAnimation(contentScaleX, [contentScaleX.get(), 1 + (scaleAmount * 0.3), 1], { duration, times, ease });
                    runAnimation(contentScaleY, [contentScaleY.get(), 1 - scaleAmount, 1], { duration, times, ease });
                } else {
                    runAnimation(contentScaleX, [contentScaleX.get(), 1 - (scaleAmount * 0.3), 1], { duration, times, ease });
                    runAnimation(contentScaleY, [contentScaleY.get(), 1 + scaleAmount, 1], { duration, times, ease });
                }
            } else {
                if (effectiveActive) {
                    runAnimation(contentScaleX, [contentScaleX.get(), 1 - scaleAmount, 1], { duration, times, ease });
                    runAnimation(contentScaleY, [contentScaleY.get(), 1 + (scaleAmount * 0.3), 1], { duration, times, ease });
                } else {
                    runAnimation(contentScaleX, [contentScaleX.get(), 1 + scaleAmount, 1], { duration, times, ease });
                    runAnimation(contentScaleY, [contentScaleY.get(), 1 - (scaleAmount * 0.3), 1], { duration, times, ease });
                }
            }
            prevActive.current = effectiveActive;
        }, [effectiveActive, isHorizontal, noScale, distortionFactor, contentDistortionScale]);

        return (
            <BaseComponent
                layout={layout}
                style={{
                    position: 'relative',
                    zIndex: 1,
                    transformOrigin: isHorizontal ? "center left" : "top center",
                    willChange: "transform",
                    ...style,
                    background: 'transparent',
                    boxShadow: 'none',
                    border: 'none',
                }}
                className={className}
                {...props}
            >
                {variant !== 'transparent' && (
                    <FabricBackground
                        active={effectiveActive}
                        orientation={isHorizontal ? 'horizontal' : 'vertical'}
                        surfaceColor={surfaceColor}
                        maxRadius={maxRadius}
                        flat={flat}
                        distortionFactor={distortionFactor}
                        disableHighlight={disableHighlight}
                        disableShadow={disableShadow}
                        shadowScale={shadowScale}
                    />
                )}
                <motion.div
                    style={{
                        position: 'relative',
                        zIndex: 2,
                        scaleX: contentScaleX,
                        scaleY: contentScaleY,
                        transformOrigin: "center center",
                        display: 'flex',
                        flexDirection: 'column',
                        width: '100%',
                        height: '100%',
                        minHeight: 0,
                        overflow: 'visible'
                    }}
                >
                    {children}
                </motion.div>
            </BaseComponent >
        );
    }
    return null;
});

export default CardAnimator;
