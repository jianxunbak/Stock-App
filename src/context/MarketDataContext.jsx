import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { fetchCurrencyRate, fetchStockPricesBatch } from '../services/api';
import { useGlobalData } from './GlobalDataContext';

const MarketDataContext = createContext();

const CACHE_KEYS = {
    PRICES: 'stock_app_prices',
    RATES: 'stock_app_rates'
};

export const MarketDataProvider = ({ children }) => {
    const { currentUser } = useAuth();
    const { portfolioList } = useGlobalData();

    const [livePrices, setLivePrices] = useState({});
    const [currencyRates, setCurrencyRates] = useState({ USD: 1, SGD: 1.35 });
    const [pricesLoading, setPricesLoading] = useState(false);

    // 1. Load from Cache (Immediate)
    useEffect(() => {
        const cachedPrices = localStorage.getItem(CACHE_KEYS.PRICES);
        const cachedRates = localStorage.getItem(CACHE_KEYS.RATES);

        if (cachedPrices) setLivePrices(JSON.parse(cachedPrices));
        if (cachedRates) setCurrencyRates(JSON.parse(cachedRates));
    }, []);

    // 2. Persistence to Cache
    useEffect(() => {
        if (Object.keys(livePrices).length > 0) {
            localStorage.setItem(CACHE_KEYS.PRICES, JSON.stringify(livePrices));
        }
    }, [livePrices]);

    useEffect(() => {
        if (Object.keys(currencyRates).length > 0) {
            localStorage.setItem(CACHE_KEYS.RATES, JSON.stringify(currencyRates));
        }
    }, [currencyRates]);

    // 3. Fetch Currency Rates
    const updateCurrencyRates = useCallback(async (base, display) => {
        const currencies = new Set(['USD', 'SGD', base, display].filter(Boolean));
        const newRates = { ...currencyRates };
        let changed = false;

        for (const curr of currencies) {
            if (curr === 'USD') continue;
            try {
                const res = await fetchCurrencyRate(curr);
                const rate = typeof res === 'object' ? res.rate : res;
                if (rate && newRates[curr] !== rate) {
                    newRates[curr] = rate;
                    changed = true;
                }
            } catch (e) {
                console.warn(`Failed to fetch rate for ${curr}`);
            }
        }

        if (changed) setCurrencyRates(newRates);
    }, [currencyRates]);

    // 4. Fetch Stock Prices (Batch)
    const refreshStockPrices = useCallback(async (forcedTickers = null) => {
        let tickers = forcedTickers;

        if (!tickers) {
            const allTickers = new Set();
            portfolioList.forEach(p => {
                (p.portfolio || []).forEach(item => {
                    if (item.ticker) allTickers.add(item.ticker.trim().toUpperCase());
                });
            });
            tickers = Array.from(allTickers);
        }

        if (tickers.length === 0) return;

        setPricesLoading(true);
        try {
            const batchData = await fetchStockPricesBatch(tickers);
            const processedData = {};
            Object.entries(batchData).forEach(([ticker, data]) => {
                processedData[ticker] = {
                    price: data.price || data.overview?.price || 0,
                    beta: data.beta || data.overview?.beta || 1,
                    sector: data.sector || data.overview?.sector || 'Unknown',
                    growth: data.growth || (data.growthData?.revenueGrowth * 100) || 0,
                    pegRatio: data.pegRatio || data.overview?.pegRatio || 0,
                    totalCash: data.totalCash || data.valuation?.raw_assumptions?.cash_and_equivalents || 0,
                    totalDebt: data.totalDebt || data.valuation?.raw_assumptions?.total_debt || 0,
                    lastUpdated: new Date().toISOString()
                };
            });

            setLivePrices(prev => ({ ...prev, ...processedData }));
        } catch (err) {
            console.error("MarketContext: Error fetching stock prices:", err);
        } finally {
            setPricesLoading(false);
        }
    }, [portfolioList]);

    // Fetch initial currency rates on mount
    useEffect(() => {
        updateCurrencyRates('SGD', 'USD');
    }, []);

    // Automatically refresh prices when portfolios load or periodically
    useEffect(() => {
        if (portfolioList.length > 0) {
            refreshStockPrices();
            const interval = setInterval(() => {
                refreshStockPrices();
            }, 5 * 60 * 1000); // 5 minutes
            return () => clearInterval(interval);
        }
    }, [portfolioList.length]);

    const value = {
        livePrices,
        currencyRates,
        pricesLoading,
        refreshStockPrices,
        updateCurrencyRates
    };

    return (
        <MarketDataContext.Provider value={value}>
            {children}
        </MarketDataContext.Provider>
    );
};

export const useMarketData = () => {
    const context = useContext(MarketDataContext);
    if (!context) {
        throw new Error('useMarketData must be used within a MarketDataProvider');
    }
    return context;
};
