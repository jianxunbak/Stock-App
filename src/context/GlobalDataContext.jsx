import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { fetchUserSettings, saveUserSettings } from '../services/api';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, getDoc } from 'firebase/firestore';

const GlobalDataContext = createContext();

const CACHE_KEYS = {
    SETTINGS: 'stock_app_settings',
    PORTFOLIOS: 'stock_app_portfolios'
};

export const GlobalDataProvider = ({ children }) => {
    const { currentUser } = useAuth();

    // State (Initialize synchronously from cache if possible)
    const [settings, setSettings] = useState(() => {
        const cached = localStorage.getItem(CACHE_KEYS.SETTINGS);
        return cached ? JSON.parse(cached) : {};
    });
    const [portfolioList, setPortfolioList] = useState(() => {
        const cached = localStorage.getItem(CACHE_KEYS.PORTFOLIOS);
        return cached ? JSON.parse(cached) : [];
    });
    const [loading, setLoading] = useState(() => {
        const hasSettings = localStorage.getItem(CACHE_KEYS.SETTINGS);
        const hasPortfolios = localStorage.getItem(CACHE_KEYS.PORTFOLIOS);
        return !(hasSettings || hasPortfolios);
    });
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);

    // Sync with refs
    const settingsRef = useRef(settings);
    useEffect(() => { settingsRef.current = settings; }, [settings]);

    const pricesFetchTimer = useRef(null);

    // Keep cache updated when state changes
    useEffect(() => {
        if (Object.keys(settings).length > 0) localStorage.setItem(CACHE_KEYS.SETTINGS, JSON.stringify(settings));
    }, [settings]);

    useEffect(() => {
        if (portfolioList.length > 0) localStorage.setItem(CACHE_KEYS.PORTFOLIOS, JSON.stringify(portfolioList));
    }, [portfolioList]);

    // 3. User Settings Loading from DB
    const loadSettings = useCallback(async () => {
        if (!currentUser?.uid) return;
        try {
            const data = await fetchUserSettings(currentUser.uid);
            if (data) {
                setSettings(prev => {
                    const next = { ...prev, ...data };
                    settingsRef.current = next;
                    return next;
                });
            }
        } catch (error) {
            console.error("Error loading settings in GlobalContext:", error);
        }
    }, [currentUser?.uid]);

    // 4. Firestore Real-time Portfolios
    useEffect(() => {
        if (!currentUser?.uid) {
            setPortfolioList([]);
            return;
        }

        const q = query(
            collection(db, 'users', currentUser.uid, 'test_portfolios')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setPortfolioList(list);
            setLoading(false);
            setInitialLoadComplete(true);
        }, (error) => {
            console.error("GlobalContext: Error fetching portfolio list:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser?.uid]);

    // Initial triggers
    useEffect(() => {
        if (currentUser?.uid) {
            loadSettings();
        }
    }, [currentUser?.uid, loadSettings]);

    // Expose update settings with optimistic UI and broadcast compatibility
    const updateGlobalSettings = async (newSettingsFragment) => {
        if (!currentUser?.uid) return;

        // 1. Optimistic Update
        const updatedSettings = { ...settings, ...newSettingsFragment };
        setSettings(updatedSettings);

        // 2. Broadcast for any legacy listeners
        window.dispatchEvent(new CustomEvent('user-settings-updated', {
            detail: { settings: updatedSettings, source: 'internal' }
        }));

        // 3. Save to Backend
        try {
            await saveUserSettings(currentUser.uid, updatedSettings);
        } catch (error) {
            console.error("GlobalContext: Failed to save settings:", error);
        }
    };

    const value = {
        settings,
        portfolioList,
        loading,
        initialLoadComplete,
        updateSettings: updateGlobalSettings,
        loadSettings
    };

    return (
        <GlobalDataContext.Provider value={value}>
            {children}
        </GlobalDataContext.Provider>
    );
};

export const useGlobalData = () => {
    const context = useContext(GlobalDataContext);
    if (!context) {
        throw new Error('useGlobalData must be used within a GlobalDataProvider');
    }
    return context;
};
