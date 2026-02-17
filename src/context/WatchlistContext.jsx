import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { saveWatchlist, getWatchlist } from '../services/firestore';
import { withFirestoreProtection } from '../utils/firestoreUtils';

export const WatchlistContext = createContext();

export const WatchlistProvider = ({ children }) => {
    const { currentUser } = useAuth();
    const [watchlist, setWatchlist] = useState([]);
    const [loading, setLoading] = useState(true);
    const initialLoadDone = useRef(false);

    // 1. Initial Load
    useEffect(() => {
        const loadInitial = async () => {
            setLoading(true);
            const local = JSON.parse(localStorage.getItem('watchlist') || '[]');
            let list = local;

            if (currentUser) {
                try {
                    const firestoreList = await withFirestoreProtection(
                        () => getWatchlist(currentUser.uid),
                        'Load Watchlist'
                    );

                    if (firestoreList && firestoreList.length > 0) {
                        list = firestoreList;
                    } else if (local.length > 0) {
                        // Sync local to Firestore if Firestore is empty
                        await withFirestoreProtection(
                            () => saveWatchlist(currentUser.uid, local),
                            'Sync Local Watchlist'
                        );
                    }
                } catch (err) {
                    console.error("WatchlistContext: Load failed", err);
                }
            }

            setWatchlist(list);
            localStorage.setItem('watchlist', JSON.stringify(list));
            setLoading(false);
            initialLoadDone.current = true;
        };

        loadInitial();
    }, [currentUser]);

    // 2. Centralized Persistence Side Effect
    // This is the ONLY place that writes to storage, preventing loops!
    const lastSavedRef = useRef(null);

    useEffect(() => {
        if (!initialLoadDone.current) return;

        const listString = JSON.stringify(watchlist);
        if (listString === lastSavedRef.current) return;

        // Update LocalStorage (Always works)
        localStorage.setItem('watchlist', listString);
        lastSavedRef.current = listString;

        // Update Firestore (Guarded by Circuit Breaker)
        if (currentUser) {
            withFirestoreProtection(
                () => saveWatchlist(currentUser.uid, watchlist),
                'Save Watchlist'
            ).catch(err => {
                console.error("WatchlistContext: Save failed", err);
            });
        }
    }, [watchlist, currentUser]);

    // 3. Actions
    const addToWatchlist = useCallback((item) => {
        setWatchlist(prev => {
            if (prev.some(i => i.ticker === item.ticker)) return prev;
            return [...prev, item];
        });
    }, []);

    const removeFromWatchlist = useCallback((ticker) => {
        setWatchlist(prev => prev.filter(item => item.ticker !== ticker));
    }, []);

    const updateWatchlistItem = useCallback((ticker, updates) => {
        setWatchlist(prev => prev.map(item =>
            item.ticker === ticker ? { ...item, ...updates } : item
        ));
    }, []);

    const setFullWatchlist = useCallback((newListOrFn) => {
        setWatchlist(newListOrFn);
    }, []);

    const value = {
        watchlist,
        loading,
        addToWatchlist,
        removeFromWatchlist,
        updateWatchlistItem,
        setFullWatchlist
    };

    return (
        <WatchlistContext.Provider value={value}>
            {children}
        </WatchlistContext.Provider>
    );
};

export const useWatchlistContext = () => {
    const context = useContext(WatchlistContext);
    if (!context) {
        throw new Error('useWatchlistContext must be used within a WatchlistProvider');
    }
    return context;
};
