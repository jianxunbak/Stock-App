import React from 'react';
import './LoadingScreen.css';

const LoadingScreen = ({ message = "Loading Assets..." }) => {
    return (
        <div className="loading-screen" id="loading-screen">
            <div className="fabric-layers">
                <div className="fabric-layer layer-1"></div>
                <div className="fabric-layer layer-2"></div>
                <div className="fabric-layer layer-3"></div>
                <div className="fabric-layer layer-4"></div>
            </div>

            <div className="loading-content">
                <div className="loading-spinner-container">
                    <div className="loading-spinner"></div>
                </div>
                <h2 className="loading-text">{message}</h2>
            </div>

            {/* Decorative SVG Filter for extra softness */}
            <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                <filter id="soft-morph">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
                    <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
                    <feComposite in="SourceGraphic" in2="goo" operator="atop" />
                </filter>
            </svg>
        </div>
    );
};

export default LoadingScreen;
