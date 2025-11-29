import React, { createContext, useContext, useState, useCallback } from 'react';

const LiquidGlassContext = createContext(null);

export const useLiquidGlass = () => {
    const context = useContext(LiquidGlassContext);
    if (!context) {
        throw new Error('useLiquidGlass must be used within a LiquidGlassProvider');
    }
    return context;
};

export const LiquidGlassProvider = ({ children }) => {
    const [views, setViews] = useState([]);

    const registerView = useCallback((id, ref, SceneComponent) => {
        setViews((prev) => {
            // Check if already registered to avoid duplicates
            if (prev.find(v => v.id === id)) return prev;
            return [...prev, { id, ref, SceneComponent }];
        });
    }, []);

    const unregisterView = useCallback((id) => {
        setViews((prev) => prev.filter((v) => v.id !== id));
    }, []);

    return (
        <LiquidGlassContext.Provider value={{ views, registerView, unregisterView }}>
            {children}
        </LiquidGlassContext.Provider>
    );
};
