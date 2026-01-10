import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { savePortfolio, getPortfolio } from '../services/firestore';

// Helper to generate a unique ID
const generateId = () => Math.random().toString(36).substr(2, 9);

export const usePortfolio = () => {
    const { currentUser } = useAuth();
    const [portfolio, setPortfolio] = useState([]);
    const [loading, setLoading] = useState(true);

    // Load portfolio on mount or user change
    useEffect(() => {
        const loadPortfolio = async () => {
            setLoading(true);
            let list = [];
            const local = JSON.parse(localStorage.getItem('portfolio') || '[]');

            // 1. Try to load from Firestore if logged in
            if (currentUser) {
                try {
                    const firestoreList = await getPortfolio(currentUser.uid);

                    if (firestoreList && firestoreList.length > 0) {
                        // MERGING LOGIC:
                        // Firestore is source of truth.
                        // However, if we added ID recently, old local data might not have it.
                        // We will migrate old data formats (keyed by ticker only) to new format (with ID).

                        let migratedFirestore = firestoreList.map(item => ({
                            ...item,
                            id: item.id || generateId()
                        }));

                        list = migratedFirestore;

                        // If we needed to merge "unsaved" local changes, it gets tricky with duplicate tickers allowed.
                        // For simplicity, we prioritize Firestore if it exists.
                        // If Firestore is empty but local has data, we sync local to Firestore.
                    } else {
                        if (local.length > 0) {
                            // Migration for existing local data: add IDs if missing
                            list = local.map(item => ({
                                ...item,
                                id: item.id || generateId()
                            }));
                            await savePortfolio(currentUser.uid, list);
                        }
                    }
                } catch (err) {
                    console.error("Failed to load portfolio from Firestore", err);
                    list = local.map(item => ({ ...item, id: item.id || generateId() }));
                }
            } else {
                list = local.map(item => ({ ...item, id: item.id || generateId() }));
            }

            setPortfolio(list);
            localStorage.setItem('portfolio', JSON.stringify(list));
            setLoading(false);
        };

        loadPortfolio();

        const handleStorageChange = () => {
            const list = JSON.parse(localStorage.getItem('portfolio') || '[]');
            setPortfolio(list);
        };

        window.addEventListener('portfolio-updated', handleStorageChange);

        return () => {
            window.removeEventListener('portfolio-updated', handleStorageChange);
        };
    }, [currentUser]);

    const updateList = useCallback(async (newList) => {
        setPortfolio(newList);
        localStorage.setItem('portfolio', JSON.stringify(newList));
        window.dispatchEvent(new Event('portfolio-updated'));

        if (currentUser) {
            await savePortfolio(currentUser.uid, newList);
        }
    }, [currentUser]);

    const addToPortfolio = useCallback((item) => {
        const currentList = JSON.parse(localStorage.getItem('portfolio') || '[]');

        // Always add as new item with unique ID, allowing duplicates
        const newItem = { ...item, id: generateId() };
        const newList = [...currentList, newItem];

        updateList(newList);
    }, [updateList]);

    const removeFromPortfolio = useCallback((id) => {
        const currentList = JSON.parse(localStorage.getItem('portfolio') || '[]');
        // Remove by ID now
        const newList = currentList.filter(item => item.id !== id);
        updateList(newList);
    }, [updateList]);

    const updatePortfolioItem = useCallback((id, updates) => {
        const currentList = JSON.parse(localStorage.getItem('portfolio') || '[]');
        // Update by ID
        const newList = currentList.map(item =>
            item.id === id ? { ...item, ...updates } : item
        );
        updateList(newList);
    }, [updateList]);

    return {
        portfolio,
        loading,
        addToPortfolio,
        removeFromPortfolio,
        updatePortfolioItem
    };
};
