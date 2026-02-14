import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { fetchStockData } from '../services/api';

const StockDataContext = createContext();

export const StockDataProvider = ({ children }) => {
    const [stockData, setStockData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isLoggedIn, setIsLoggedIn] = useState(true); // Mock login

    const stockDataRef = useRef(stockData);
    useEffect(() => {
        stockDataRef.current = stockData;
    }, [stockData]);

    const loadStockData = useCallback(async (ticker, forceRefresh = false) => {
        const currentTicker = stockDataRef.current?.overview?.symbol || stockDataRef.current?.symbol;
        const isSameTicker = currentTicker === ticker;

        // Skip if already loaded and not forcing refresh
        if (isSameTicker && !forceRefresh && stockDataRef.current) {
            return stockDataRef.current;
        }

        if (!isSameTicker || forceRefresh) {
            setLoading(true);
        }
        setError(null);
        try {
            const data = await fetchStockData(ticker, forceRefresh);
            // console.log("%c💎 Context: Final Stock Data to be used in UI:", "color: #ff00ff; font-weight: bold;", data);

            // Calculate Quant Moat Score (Mock logic for now)
            const moatScore = Math.floor(Math.random() * 6); // Mock logic moved here for simplicity
            const enrichedData = { ...data, moat: { ...data.moat, score: moatScore } };

            setStockData(enrichedData);
            return enrichedData;
        } catch (err) {
            console.error("Error loading stock data:", err);
            const errorMessage = err.response?.data?.detail || err.message || "An error occurred";
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return (
        <StockDataContext.Provider value={{ stockData, loading, error, loadStockData, isLoggedIn }}>
            {children}
        </StockDataContext.Provider>
    );
};

export const useStockData = () => useContext(StockDataContext);
