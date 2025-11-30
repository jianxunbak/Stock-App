import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { saveWatchlist, getWatchlist } from '../services/firestore';

export const useWatchlist = () => {
    const { currentUser } = useAuth();
    const [watchlist, setWatchlist] = useState([]);
    const [loading, setLoading] = useState(true);

    // Load watchlist on mount or user change
    useEffect(() => {
        const loadWatchlist = async () => {
            setLoading(true);
            let list = [];
            const local = JSON.parse(localStorage.getItem('watchlist') || '[]');

            // 1. Try to load from Firestore if logged in
            if (currentUser) {
                try {
                    const firestoreList = await getWatchlist(currentUser.uid);

                    if (firestoreList && firestoreList.length > 0) {
                        // Merge logic: Combine Firestore and Local, removing duplicates by ticker
                        const mergedMap = new Map();

                        // Add Firestore items first
                        firestoreList.forEach(item => mergedMap.set(item.ticker, item));

                        // Add Local items (if not present, or maybe overwrite if newer?)
                        // For now, let's just ensure local items are added if missing from Firestore
                        local.forEach(item => {
                            if (!mergedMap.has(item.ticker)) {
                                mergedMap.set(item.ticker, item);
                            }
                        });

                        list = Array.from(mergedMap.values());

                        // If the list changed (i.e., we added local items to Firestore list), save back to Firestore
                        if (list.length > firestoreList.length) {
                            await saveWatchlist(currentUser.uid, list);
                        }
                    } else {
                        // If Firestore empty, use local and sync up
                        if (local.length > 0) {
                            list = local;
                            await saveWatchlist(currentUser.uid, list);
                        }
                    }
                } catch (err) {
                    console.error("Failed to load watchlist from Firestore", err);
                    list = local;
                }
            } else {
                // 2. Fallback to localStorage
                list = local;
            }

            setWatchlist(list);
            localStorage.setItem('watchlist', JSON.stringify(list));
            setLoading(false);
        };

        loadWatchlist();

        // Listen for local storage changes (from other tabs/components)
        const handleStorageChange = () => {
            const list = JSON.parse(localStorage.getItem('watchlist') || '[]');
            setWatchlist(list);
        };

        // Custom event for same-tab updates
        window.addEventListener('watchlist-updated', handleStorageChange);

        return () => {
            window.removeEventListener('watchlist-updated', handleStorageChange);
        };
    }, [currentUser]);

    const updateList = useCallback(async (newList) => {
        setWatchlist(newList);
        localStorage.setItem('watchlist', JSON.stringify(newList));
        window.dispatchEvent(new Event('watchlist-updated'));

        console.log("Updating watchlist. Current User:", currentUser?.uid);
        if (currentUser) {
            await saveWatchlist(currentUser.uid, newList);
        } else {
            console.log("User not logged in, skipping Firestore save.");
        }
    }, [currentUser]);

    const addToWatchlist = useCallback((item) => {
        const currentList = JSON.parse(localStorage.getItem('watchlist') || '[]');
        if (currentList.some(i => i.ticker === item.ticker)) return;

        const newList = [...currentList, item];
        updateList(newList);
    }, [updateList]);

    const removeFromWatchlist = useCallback((ticker) => {
        const currentList = JSON.parse(localStorage.getItem('watchlist') || '[]');
        const newList = currentList.filter(item => item.ticker !== ticker);
        updateList(newList);
    }, [updateList]);

    const updateWatchlistItem = useCallback((ticker, updates) => {
        const currentList = JSON.parse(localStorage.getItem('watchlist') || '[]');
        const newList = currentList.map(item =>
            item.ticker === ticker ? { ...item, ...updates } : item
        );
        updateList(newList);
    }, [updateList]);

    const setFullWatchlist = useCallback((newList) => {
        updateList(newList);
    }, [updateList]);

    return {
        watchlist,
        loading,
        addToWatchlist,
        removeFromWatchlist,
        updateWatchlistItem,
        setFullWatchlist
    };
};
