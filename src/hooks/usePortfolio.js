import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, orderBy, setDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

// Helper to generate a unique ID
const generateId = () => Math.random().toString(36).substr(2, 9);

export const usePortfolio = (portfolioId) => {
    const [portfolio, setPortfolio] = useState([]);
    const [portfolioList, setPortfolioList] = useState([]);
    const [analysis, setAnalysis] = useState('');
    const [notes, setNotes] = useState('');
    const [comparisonStocks, setComparisonStocks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [listLoading, setListLoading] = useState(true);
    const { currentUser } = useAuth();

    // 2. Fetch Data for CURRENT Portfolio
    useEffect(() => {
        if (!currentUser || !portfolioId) {
            setPortfolio([]);
            setAnalysis('');
            setNotes('');
            setComparisonStocks([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        // Clear previous data while loading new portfolio to prevent stale data flash
        setPortfolio([]);
        setAnalysis('');
        setNotes('');
        setComparisonStocks([]);

        const docRef = doc(db, 'users', currentUser.uid, 'test_portfolios', portfolioId);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setAnalysis(data.analysis || '');
                setNotes(data.notes || '');
                setPortfolio(data.portfolio || []);
                setComparisonStocks(data.comparisonStocks || []);
            } else {
                setAnalysis('');
                setNotes('');
                setPortfolio([]);
                setComparisonStocks([]);
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching portfolio data:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser, portfolioId]);

    // ... (existing functions)

    const updateComparisonStocks = async (newStocks) => {
        if (!currentUser || !portfolioId) return;
        try {
            const docRef = doc(db, 'users', currentUser.uid, 'test_portfolios', portfolioId);
            await updateDoc(docRef, {
                comparisonStocks: newStocks,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error("Error updating comparison stocks:", error);
        }
    };


    // --- Migration Logic ---
    useEffect(() => {
        const migrateMainPortfolio = async () => {
            if (!currentUser) return;

            try {
                const userRef = doc(db, 'users', currentUser.uid);
                const userSnap = await getDoc(userRef);

                if (!userSnap.exists()) return;

                const userData = userSnap.data();
                const legacyPortfolio = userData.portfolio || [];

                // Only migrate if there's data and it hasn't been migrated yet
                if (legacyPortfolio.length > 0 && !userData.mainPortfolioMigrated) {
                    console.info("Starting migration of Main Portfolio to Multi-Portfolio system...");

                    // 1. Create the new portfolio document
                    const newPortRef = await addDoc(collection(db, 'users', currentUser.uid, 'test_portfolios'), {
                        name: "Main Portfolio",
                        type: "main",
                        portfolio: legacyPortfolio.map(item => ({
                            ...item,
                            id: item.id || generateId(),
                            createdAt: item.createdAt || new Date().toISOString()
                        })),
                        analysis: userData.analysis || '',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });

                    // 2. Mark as migrated (but keep old data for safety for now, or clear it if preferred)
                    // We'll just mark it so we don't migrate again.
                    await updateDoc(userRef, {
                        mainPortfolioMigrated: true,
                        // Optionally clear legacy data:
                        // portfolio: [], 
                        // analysis: ''
                    });

                    console.info(`Migration complete. Created new portfolio ID: ${newPortRef.id}`);
                }
            } catch (error) {
                console.error("Migration error:", error);
            }
        };

        migrateMainPortfolio();
    }, [currentUser]);

    // 1. Fetch List of Portfolios
    useEffect(() => {
        if (!currentUser) {
            setPortfolioList([]);
            setListLoading(false);
            return;
        }

        const q = query(
            collection(db, 'users', currentUser.uid, 'test_portfolios'),
            orderBy('name')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.name || doc.id,
                    ...data
                };
            });
            setPortfolioList(list);
            setListLoading(false);
        }, (error) => {
            console.error("Error fetching portfolio list:", error);
            setListLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);



    const addStockToPortfolio = async (targetId, item) => {
        if (!currentUser || !targetId) return;
        try {
            const userRef = doc(db, 'users', currentUser.uid);
            await setDoc(userRef, {
                lastActive: new Date().toISOString(),
                hasMultiPortfolios: true
            }, { merge: true });

            const portRef = doc(db, 'users', currentUser.uid, 'test_portfolios', targetId);
            const newItem = {
                ...item,
                id: generateId(),
                createdAt: new Date().toISOString()
            };

            await updateDoc(portRef, {
                portfolio: arrayUnion(newItem),
                updatedAt: new Date().toISOString()
            });

            console.info(`[FIRESTORE SUCCESS] Added ${item.ticker} to portfolio: ${targetId}`);
        } catch (error) {
            console.error("Error adding to portfolio:", error);
            throw error;
        }
    };

    const addToPortfolio = async (item) => {
        if (!portfolioId) return;
        await addStockToPortfolio(portfolioId, item);
    };

    const removeFromPortfolio = async (id) => {
        if (!currentUser || !portfolioId) return;
        try {
            const newList = portfolio.filter(item => item.id !== id);
            const docRef = doc(db, 'users', currentUser.uid, 'test_portfolios', portfolioId);
            await updateDoc(docRef, { portfolio: newList, updatedAt: new Date().toISOString() });
        } catch (error) {
            console.error("Error removing from portfolio:", error);
        }
    };

    const updatePortfolioItem = async (id, updates) => {
        if (!currentUser || !portfolioId) return;
        try {
            const newList = portfolio.map(item =>
                item.id === id ? { ...item, ...updates } : item
            );
            const docRef = doc(db, 'users', currentUser.uid, 'test_portfolios', portfolioId);
            await updateDoc(docRef, { portfolio: newList, updatedAt: new Date().toISOString() });
        } catch (error) {
            console.error("Error updating portfolio item:", error);
        }
    };

    const createPortfolio = async (name, type = 'test') => {
        if (!currentUser || !name) return null;
        try {
            const userRef = doc(db, 'users', currentUser.uid);
            await setDoc(userRef, { lastActive: new Date().toISOString() }, { merge: true });

            const newPortRef = await addDoc(collection(db, 'users', currentUser.uid, 'test_portfolios'), {
                name,
                type,
                portfolio: [],
                analysis: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            return newPortRef.id;
        } catch (error) {
            console.error("Error creating portfolio:", error);
            return null;
        }
    };

    const deletePortfolio = async (pId) => {
        if (!currentUser || !pId) return;
        try {
            await deleteDoc(doc(db, 'users', currentUser.uid, 'test_portfolios', pId));
        } catch (error) {
            console.error("Error deleting portfolio:", error);
        }
    };

    const clearAnalysis = async () => {
        if (!currentUser || !portfolioId) return;
        try {
            const docRef = doc(db, 'users', currentUser.uid, 'test_portfolios', portfolioId);
            await updateDoc(docRef, {
                analysis: '',
                analysis_timestamp: null
            });
        } catch (error) {
            console.error("Error clearing analysis:", error);
        }
    };

    const copyItemsFromPortfolio = async (targetPortfolioId, itemsToCopy) => {
        if (!currentUser || !targetPortfolioId || !itemsToCopy || itemsToCopy.length === 0) return;
        try {
            const newItems = itemsToCopy.map(item => ({
                ...item,
                id: generateId(),
                createdAt: new Date().toISOString()
            }));

            const targetPortRef = doc(db, 'users', currentUser.uid, 'test_portfolios', targetPortfolioId);
            const targetSnap = await getDoc(targetPortRef);
            const currentItems = targetSnap.exists() ? (targetSnap.data().portfolio || []) : [];

            await updateDoc(targetPortRef, {
                portfolio: [...currentItems, ...newItems],
                updatedAt: new Date().toISOString()
            });

            console.info(`[FIRESTORE SUCCESS] Copied ${newItems.length} items to portfolio ${targetPortfolioId}`);
        } catch (error) {
            console.error("Error copying items:", error);
        }
    };

    const renamePortfolio = async (pId, newName, newType) => {
        const idToRename = pId || portfolioId;
        if (!currentUser || !newName || !idToRename) return;
        try {
            const docRef = doc(db, 'users', currentUser.uid, 'test_portfolios', idToRename);
            const updates = {
                name: newName,
                updatedAt: new Date().toISOString()
            };
            if (newType) {
                updates.type = newType;
            }
            await updateDoc(docRef, updates);
        } catch (error) {
            console.error("Error renaming portfolio:", error);
            throw error;
        }
    };

    const clearPortfolio = async () => {
        if (!currentUser || !portfolioId) return;
        try {
            const docRef = doc(db, 'users', currentUser.uid, 'test_portfolios', portfolioId);
            await updateDoc(docRef, {
                portfolio: [],
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error("Error clearing portfolio:", error);
        }
    };

    const saveNotes = async (newNotes) => {
        if (!currentUser || !portfolioId) return;
        try {
            const docRef = doc(db, 'users', currentUser.uid, 'test_portfolios', portfolioId);
            await updateDoc(docRef, {
                notes: newNotes,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error("Error saving notes:", error);
        }
    };

    return {
        portfolio,
        portfolioList,
        analysis,
        notes,
        loading,
        listLoading,
        addToPortfolio,
        addStockToPortfolio,
        removeFromPortfolio,
        updatePortfolioItem,
        renamePortfolio,
        createPortfolio,
        deletePortfolio,
        clearAnalysis,
        copyItemsFromPortfolio,
        clearPortfolio,
        comparisonStocks,
        updateComparisonStocks,
        saveNotes
    };
};
