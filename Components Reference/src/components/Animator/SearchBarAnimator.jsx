import { motion, useMotionValue, useTransform, animate as runAnimation } from 'framer-motion';
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';

// --- Variants Merged from variants.js ---

// 6. Search Bar Container Variants (The "Expanding Shell")
const searchBarVariants = {
    collapsed: {
        width: "2rem",
        padding: "0.5rem",
        gap: "0rem",
        scaleX: 1,
        scaleY: 1,
        filter: "blur(0px) brightness(1)",
    },
    expanded: {
        width: "15rem",
        padding: "0.5rem 1.5rem",
        gap: "1rem",
        // Adding the Button-like distortion to the expanded state
        scaleX: 1.02,
        scaleY: 0.99,
        filter: "blur(0px) brightness(1.02)",
    }
};

// 7. Search Bar Content Variants (The "Slide Reveal")
const revealVariants = {
    collapsed: {
        flex: 0,
        width: 0,
        opacity: 0,
        scaleX: 0.8,
        scaleY: 1.1,
    },
    expanded: {
        flex: 1,
        width: "auto",
        opacity: 1,
        scaleX: 1,
        scaleY: 1,
    }
};

// 8. Search Content Variants (Horizontal Elasticity)
const searchContentVariants = {
    initial: {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        filter: "blur(0px) brightness(1)",
        opacity: 1
    },
    active: {
        x: -3, // Subtle left shift to build tension
        y: 1,  // Slight drop to match neomorphic depth
        scaleX: 1.15, // Unified distortion
        scaleY: 0.98,
        filter: "blur(0.3px) brightness(1.05)",
        opacity: 1
    }
};

// --- Helper Hook: Horizontal Fabric Path ---
function useFabricPathHorizontal(width, height, distortion) {
    return useTransform([width, height, distortion], ([w, h, d]) => {
        if (w <= 0 || h <= 0) return "";

        // INSET: 1px inset to ensure the 1px stroke is never clipped by parent
        const offset = 1;
        const sw = Math.max(0, w - (offset * 2));
        const sh = Math.max(0, h - (offset * 2));

        // Match --neu-radius-sm (0.75rem = 12px)
        const r = Math.min(12, sw / 2, sh / 2);

        const extraWidth = Math.max(0, sw - sh);
        // Linear dampener is fine for this case
        const dampener = Math.min(1, extraWidth / 60);
        const safeD = d * dampener;

        // POLARITY FIX: 
        // d > 0: Concave (Pinch In) -> Top moves down (+y), Bottom moves up (-y)
        // d < 0: Convex (Bulge Out) -> Top moves up (-y), Bottom moves down (+y)
        const topY = offset + safeD;
        const bottomY = h - offset - safeD;

        const midX = w / 2;
        const xLeft = w * 0.25;
        const xRight = w * 0.75;

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

// --- Fabric Background (Horizontal Only) ---
const FabricBackground = ({ active, isStrokeOnly = false }) => {
    const containerRef = useRef(null);
    const lastActive = useRef(active);
    const [isReady, setIsReady] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    const width = useMotionValue(0);
    const height = useMotionValue(0);
    const distortion = useMotionValue(0);

    const pathD = useFabricPathHorizontal(width, height, distortion);

    useLayoutEffect(() => {
        if (!containerRef.current) return;
        const updateSize = () => {
            const rect = containerRef.current.getBoundingClientRect();
            width.set(rect.width);
            height.set(rect.height);
            if (rect.width > 0) setIsReady(true);
        };
        updateSize();
        const observer = new ResizeObserver(updateSize);
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [width, height]);

    useEffect(() => {
        if (active === lastActive.current) return;
        const duration = 0.6;
        setIsAnimating(true);

        if (active) {
            runAnimation(distortion, [0, 6, 0], { duration, times: [0, 0.4, 1], ease: "easeInOut" });
        } else {
            runAnimation(distortion, [0, -6, 0], { duration, times: [0, 0.4, 1], ease: "easeInOut" });
        }

        const timer = setTimeout(() => {
            setIsAnimating(false);
            lastActive.current = active;
        }, duration * 1000);
        return () => clearTimeout(timer);
    }, [active, distortion]);

    const showSVG = isReady; // For the SearchBar, we always use the SVG for the border consistency

    return (
        <div
            ref={containerRef}
            style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%',
                zIndex: 0,
                pointerEvents: 'none',
                opacity: isReady ? 1 : 0,
                overflow: 'visible',
                background: 'transparent',
                boxShadow: 'none',
                border: 'none'
            }}
        >
            <svg
                style={{ width: '100%', height: '100%', overflow: 'visible', display: 'block' }}
            >
                <motion.path
                    d={pathD}
                    fill={isStrokeOnly ? "none" : "var(--search-bar-bg, var(--neu-bg))"}
                    stroke={isStrokeOnly ? "var(--neu-border-subtle)" : "none"}
                    strokeWidth="1"
                    strokeLinejoin="round"
                    style={{
                        padding: 0,
                        vectorEffect: 'non-scaling-stroke',
                        filter: 'none'
                    }}
                />
            </svg>
        </div>
    );
};

const SearchBarAnimator = ({
    type = 'fabricSearchBar',
    active = false,
    children,
    as,
    className = '',
    ...props
}) => {
    if (type === 'fabricSearchBar') {
        const BaseComponent = motion[as || 'div'];

        return (
            <BaseComponent
                className={className}
                style={{
                    position: 'relative',
                    height: '2rem',
                    zIndex: 1,
                    overflow: 'visible',
                    boxShadow: 'none',
                    background: 'transparent',
                    borderRadius: '0',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    ...props.style
                }}
                {...props}
            >
                <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
                    <div className="fabric-bg-layer" style={{ position: 'absolute', width: '100%', height: '100%' }}>
                        <FabricBackground active={active} />
                    </div>

                    <motion.div
                        style={{
                            position: 'relative',
                            zIndex: 1,
                            width: '100%',
                            height: '100%',
                            padding: props.style?.padding ?? '0',
                            boxSizing: 'border-box',
                            display: 'flex',
                            alignItems: 'center',
                            overflow: 'hidden',
                            borderRadius: 'inherit'
                        }}
                    >
                        {children}
                    </motion.div>

                    {/* Stroke Layer on Top */}
                    <div className="fabric-stroke-layer" style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}>
                        <FabricBackground active={active} isStrokeOnly={true} />
                    </div>
                </div>
            </BaseComponent >
        );
    }

    // ... keep the rest of the component (searchContent, reveal) the same ...
    // Copy/paste the rest of your original component here
    // 2. Search Content (Inner Wrapper)
    if (type === 'searchContent') {
        return (
            <motion.div
                initial="initial"
                animate={active ? "active" : "initial"}
                variants={searchContentVariants}
                className={className}
                {...props}
            >
                {children}
            </motion.div>
        );
    }

    // 3. Reveal (Text Area Reveal)
    if (type === 'reveal') {
        return (
            <motion.div
                layout
                variants={revealVariants}
                animate={active ? "expanded" : "collapsed"}
                initial="collapsed"
                className={className}
                style={props.style}
                {...props}
            >
                {children}
            </motion.div>
        );
    }

    return null;
};

export default SearchBarAnimator;
