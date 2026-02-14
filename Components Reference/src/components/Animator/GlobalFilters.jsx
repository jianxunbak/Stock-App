import React, { useLayoutEffect, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext.jsx';

/**
 * GlobalFilters - The SVG Sync Engine
 * Renders the complex SVG filters once at the root level.
 * 
 * --- THE BRIDGE ---
 * Browsers do not support var() inside SVG attributes (stdDeviation, dx, dy).
 * This component reads the --neu-svg-* variables from design-tokens.css
 * and applies them as pure numbers via refs.
 * 
 * Update: Uses useLayoutEffect to prevent FOUC (Flash of Unstyled Content).
 */
const GlobalFilters = () => {
    const { theme } = useTheme();
    const blurDarkRef = useRef(null);
    const blurLightRef = useRef(null);
    const offsetDarkRef = useRef(null);
    const offsetLightRef = useRef(null);

    const blurDarkSubtleRef = useRef(null);
    const blurLightSubtleRef = useRef(null);
    const offsetDarkSubtleRef = useRef(null);
    const offsetLightSubtleRef = useRef(null);

    const inBevelShadowBlurRef = useRef(null);
    const inBevelHighlightBlurRef = useRef(null);
    const inBevelShadowOffsetRef = useRef(null);
    const inBevelHighlightOffsetRef = useRef(null);

    const inBevelShadowBlurSubtleRef = useRef(null);
    const inBevelHighlightBlurSubtleRef = useRef(null);
    const inBevelShadowOffsetSubtleRef = useRef(null);
    const inBevelHighlightOffsetSubtleRef = useRef(null);

    useLayoutEffect(() => {
        const rootStyle = window.getComputedStyle(document.documentElement);
        const getVal = (name) => rootStyle.getPropertyValue(name).trim();

        // Sync Standard Filter
        if (blurDarkRef.current) blurDarkRef.current.setAttribute('stdDeviation', getVal('--neu-svg-blur-dark'));
        if (blurLightRef.current) blurLightRef.current.setAttribute('stdDeviation', getVal('--neu-svg-blur-light'));
        if (offsetDarkRef.current) {
            offsetDarkRef.current.setAttribute('dx', getVal('--neu-svg-offset-dark'));
            offsetDarkRef.current.setAttribute('dy', getVal('--neu-svg-offset-dark'));
        }
        if (offsetLightRef.current) {
            offsetLightRef.current.setAttribute('dx', getVal('--neu-svg-offset-light'));
            offsetLightRef.current.setAttribute('dy', getVal('--neu-svg-offset-light'));
        }

        // Sync Subtle Filter (50% intensity)
        const dBlur = parseFloat(getVal('--neu-svg-blur-dark')) / 2;
        const lBlur = parseFloat(getVal('--neu-svg-blur-light')) / 2;
        const oDark = parseFloat(getVal('--neu-svg-offset-dark')) / 2;
        const oLight = parseFloat(getVal('--neu-svg-offset-light')) / 2;

        if (blurDarkSubtleRef.current) blurDarkSubtleRef.current.setAttribute('stdDeviation', dBlur);
        if (blurLightSubtleRef.current) blurLightSubtleRef.current.setAttribute('stdDeviation', lBlur);
        if (offsetDarkSubtleRef.current) {
            offsetDarkSubtleRef.current.setAttribute('dx', oDark);
            offsetDarkSubtleRef.current.setAttribute('dy', oDark);
        }
        if (offsetLightSubtleRef.current) {
            offsetLightSubtleRef.current.setAttribute('dx', oLight);
            offsetLightSubtleRef.current.setAttribute('dy', oLight);
        }

        // Bevels
        const bevelSize = parseFloat(getVal('--neu-svg-inner-bevel-size'));
        const bevelSizeSubtle = bevelSize / 2;

        if (inBevelShadowBlurRef.current) inBevelShadowBlurRef.current.setAttribute('stdDeviation', getVal('--neu-svg-inner-highlight-blur'));
        if (inBevelHighlightBlurRef.current) inBevelHighlightBlurRef.current.setAttribute('stdDeviation', getVal('--neu-svg-inner-shadow-blur'));
        if (inBevelShadowOffsetRef.current) {
            inBevelShadowOffsetRef.current.setAttribute('dx', bevelSize);
            inBevelShadowOffsetRef.current.setAttribute('dy', bevelSize);
        }
        if (inBevelHighlightOffsetRef.current) {
            inBevelHighlightOffsetRef.current.setAttribute('dx', `-${bevelSize}`);
            inBevelHighlightOffsetRef.current.setAttribute('dy', `-${bevelSize}`);
        }

        if (inBevelShadowBlurSubtleRef.current) inBevelShadowBlurSubtleRef.current.setAttribute('stdDeviation', Math.max(0.5, parseFloat(getVal('--neu-svg-inner-highlight-blur')) / 2));
        if (inBevelHighlightBlurSubtleRef.current) inBevelHighlightBlurSubtleRef.current.setAttribute('stdDeviation', Math.max(0.5, parseFloat(getVal('--neu-svg-inner-shadow-blur')) / 2));
        if (inBevelShadowOffsetSubtleRef.current) {
            inBevelShadowOffsetSubtleRef.current.setAttribute('dx', bevelSizeSubtle);
            inBevelShadowOffsetSubtleRef.current.setAttribute('dy', bevelSizeSubtle);
        }
        if (inBevelHighlightOffsetSubtleRef.current) {
            inBevelHighlightOffsetSubtleRef.current.setAttribute('dx', `-${bevelSizeSubtle}`);
            inBevelHighlightOffsetSubtleRef.current.setAttribute('dy', `-${bevelSizeSubtle}`);
        }
    }, [theme]);

    return (
        <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }} aria-hidden="true">
            <defs>
                {/* 
                  SAFARI-ROBUST FILTER 
                  Uses standard SVG primitives (fast) but creates strong Neumorphic depth.
                  Avoids CSS drop-shadow chains which can fail in Safari.
                */}
                <filter id="fabric-safari-optimized" x="-50%" y="-50%" width="200%" height="200%">
                    {/* 1. Dark Shadow (Bottom Right) */}
                    <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blurDark" />
                    <feOffset in="blurDark" dx="4" dy="4" result="offsetDark" />
                    <feFlood floodColor="var(--neu-shadow-dark)" floodOpacity="1" result="colorDark" />
                    <feComposite in="colorDark" in2="offsetDark" operator="in" result="shadowDark" />

                    {/* 2. Light Highlight (Top Left) */}
                    <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blurLight" />
                    <feOffset in="blurLight" dx="-4" dy="-4" result="offsetLight" />
                    <feFlood floodColor="var(--neu-shadow-light)" floodOpacity="1" result="colorLight" />
                    <feComposite in="colorLight" in2="offsetLight" operator="in" result="shadowLight" />

                </filter>

                {/* 
                  LIGHTWEIGHT BEVEL GRADIENT
                  Simulates 3D edge lighting (ridge) using a simple stroke gradient.
                  Zero GPU cost compared to filters.
                */}
                <linearGradient id="neumorphic-bevel-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--neu-shadow-light)" stopOpacity="0.9" />
                    <stop offset="30%" stopColor="var(--neu-bg)" stopOpacity="0" />
                    <stop offset="70%" stopColor="var(--neu-bg)" stopOpacity="0" />
                    <stop offset="100%" stopColor="var(--neu-shadow-dark)" stopOpacity="0.6" />
                </linearGradient>
            </defs>
        </svg>
    );
};

export default React.memo(GlobalFilters);
