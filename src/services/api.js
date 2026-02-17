import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Simple in-memory cache for the session
const stockCache = new Map();
// Track in-flight requests to deduplicate calls
const activeRequests = new Map();

// Debounce state for saveUserSettings
let saveTimeout = null;
let pendingSave = null;


export const fetchStockPricesBatch = async (tickers) => {
    if (!tickers || tickers.length === 0) return {};
    const start = Date.now();
    try {
        const response = await axios.post(`${API_URL}/stocks/batch-prices`, { tickers });
        const duration = Date.now() - start;
        if (duration > 500) {
            console.log(`%c🐢 Batch Fetch took ${duration}ms`, "color: #ffaa00; font-weight: bold;");
        } else {
            console.log(`%c🚀 Batch Fetch took ${duration}ms`, "color: #00ff00;");
        }
        return response.data;
    } catch (error) {
        console.error("Batch fetch failed:", error);
        return {}; // Return empty object on failure to avoid breaking UI
    }
};

export const fetchStockData = async (ticker) => {
    const cacheKey = `stock_${ticker}`;
    if (activeRequests.has(cacheKey)) return activeRequests.get(cacheKey);

    const promise = (async () => {
        try {
            const response = await axios.get(`${API_URL}/stock/${ticker}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching stock data for ${ticker}:`, error);
            throw error;
        } finally {
            activeRequests.delete(cacheKey);
        }
    })();

    activeRequests.set(cacheKey, promise);
    return promise;
};

export const fetchStockDataBatch = async (tickers) => {
    if (!tickers || tickers.length === 0) return {};
    const cacheKey = `batch_data_${tickers.sort().join(',')}`;
    if (activeRequests.has(cacheKey)) return activeRequests.get(cacheKey);

    const promise = (async () => {
        try {
            const response = await axios.post(`${API_URL}/stocks/batch-data`, { tickers });
            return response.data;
        } catch (error) {
            console.error("Batch stock data fetch failed:", error);
            return {};
        } finally {
            activeRequests.delete(cacheKey);
        }
    })();

    activeRequests.set(cacheKey, promise);
    return promise;
};

export const fetchChartData = async (ticker, timeframe) => {
    try {
        const response = await axios.get(`${API_URL}/chart/${ticker}/${timeframe}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching chart data:", error);
        throw error;
    }
};

export const fetchCurrencyRate = async (targetCurrency) => {
    const cacheKey = `rate_${targetCurrency}`;
    if (activeRequests.has(cacheKey)) return activeRequests.get(cacheKey);

    const promise = (async () => {
        try {
            const response = await axios.get(`${API_URL}/currency-rate`, {
                params: { target: targetCurrency }
            });
            return response.data;
        } catch (error) {
            console.error("Error fetching currency rate:", error);
            if (targetCurrency === 'SGD') return { rate: 1.35 };
            return { rate: 1 };
        } finally {
            activeRequests.delete(cacheKey);
        }
    })();

    activeRequests.set(cacheKey, promise);
    return promise;
};

export const calculatePortfolioTWR = async (portfolioItems, uid, comparisonTickers = []) => {
    try {
        const response = await axios.post(`${API_URL}/portfolio/twr`, {
            items: portfolioItems,
            uid,
            comparison_tickers: comparisonTickers
        });
        return response.data;
    } catch (error) {
        if (error.response) {
            console.error("Error calculating TWR:", error.response.status, error.response.data);
        } else {
            console.error("Error calculating TWR:", error.message);
        }
        return null;
    }
};

export const analyzePortfolio = async (portfolioItems, metrics, uid, forceRefresh = false, portfolioId = 'main') => {
    try {
        const response = await axios.post(`${API_URL}/portfolio/analyze`, { items: portfolioItems, metrics, uid, forceRefresh, portfolioId });
        return response.data;
    } catch (error) {
        console.error("Error analyzing portfolio:", error);
        throw error;
    }
};

export const fetchUserSettings = async (uid) => {
    if (!uid) return {};
    const cacheKey = `settings_${uid}`;
    if (activeRequests.has(cacheKey)) return activeRequests.get(cacheKey);

    const promise = (async () => {
        try {
            const response = await axios.get(`${API_URL}/settings/${uid}`, {
                timeout: 10000
            });
            return response.data;
        } catch (error) {
            console.error("Error fetching user settings:", error);
            return {};
        } finally {
            activeRequests.delete(cacheKey);
        }
    })();

    activeRequests.set(cacheKey, promise);
    return promise;
};

export const saveUserSettings = async (uid, settings) => {
    if (!uid) return;

    // Debounce saves across the entire app to prevent "Save Storms"
    return new Promise((resolve, reject) => {
        pendingSave = { uid, settings, resolve, reject };

        if (saveTimeout) clearTimeout(saveTimeout);

        saveTimeout = setTimeout(async () => {
            const current = pendingSave;
            if (!current) return;

            try {
                const response = await axios.post(`${API_URL}/settings/${current.uid}`, { settings: current.settings }, {
                    timeout: 30000
                });
                current.resolve(response.data);
            } catch (error) {
                console.error("Error saving user settings:", error);
                current.reject(error);
            } finally {
                saveTimeout = null;
                pendingSave = null;
            }
        }, 800); // 800ms debounce
    });
};
