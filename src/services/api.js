import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Simple in-memory cache for the session
const stockCache = new Map();
// Track in-flight requests to deduplicate calls
const activeRequests = new Map();

export const fetchStockData = async (ticker, forceRefresh = false) => {
    // 1. Check Frontend Cache (Fastest: 0ms)
    if (!forceRefresh && stockCache.has(ticker)) {
        const cached = stockCache.get(ticker);
        // Valid for 1 minute in memory to ensure "Hero -> Portfolio" transition is instant
        if (Date.now() - cached.timestamp < 1 * 60 * 1000) {
            console.log(`%c⚡ Local Cache Hit for ${ticker}`, "color: #ff00ff;");
            return cached.data;
        }
    }

    // 2. Check Active Requests (Deduplication)
    if (activeRequests.has(ticker)) {
        console.log(`%c🔗 Reusing in-flight request for ${ticker}`, "color: #ffaa00; font-style: italic;");
        return activeRequests.get(ticker);
    }

    // 3. Perform Fetch
    const fetchPromise = (async () => {
        try {
            console.log(`Starting fetch for ${ticker}...`);
            const response = await axios.get(`${API_URL}/stock/${ticker}`, {
                timeout: 60000 // 60 seconds timeout
            });

            // Save to Frontend Cache
            stockCache.set(ticker, {
                timestamp: Date.now(),
                data: response.data
            });

            const source = response.data._source || 'UNKNOWN';
            if (source === 'FIREBASE') {
                console.log(`%c🌐 [SOURCE: BACKEND -> FIREBASE] Data for ${ticker} retrieved from Firestore Cache`, "color: #00befa; font-weight: bold;");
            } else if (source === 'YFINANCE') {
                console.log(`%c🌐 [SOURCE: BACKEND -> YFINANCE] Data for ${ticker} fetched fresh from API`, "color: #f59e0b; font-weight: bold;");
            } else {
                console.log(`%c🚀 Fetch completed for ${ticker}`, "color: #00ff00; font-weight: bold;");
            }
            return response.data;
        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                console.error("Fetch timed out for:", ticker);
                throw new Error("Validation taking too long. The server might be busy or the stock is complex to analyze.");
            }
            console.error("Error fetching stock data:", error);
            throw error;
        } finally {
            // Remove from active requests when done (success or fail)
            activeRequests.delete(ticker);
        }
    })();

    activeRequests.set(ticker, fetchPromise);
    return fetchPromise;
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
    try {
        // Changed to GET request to match backend
        const response = await axios.get(`${API_URL}/currency-rate`, {
            params: { target: targetCurrency }
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching currency rate:", error);
        // Return fallback to avoid breaking UI (using previous hardcodes as safety net)
        if (targetCurrency === 'SGD') return { rate: 1.35 };
        return { rate: 1 };
    }
};

export const calculatePortfolioTWR = async (portfolioItems, uid) => {
    try {
        const response = await axios.post(`${API_URL}/portfolio/twr`, { items: portfolioItems, uid });
        return response.data;
    } catch (error) {
        console.error("Error calculating TWR:", error);
        return null;
    }
};

export const analyzePortfolio = async (portfolioItems, metrics, uid) => {
    try {
        const response = await axios.post(`${API_URL}/portfolio/analyze`, { items: portfolioItems, metrics, uid });
        return response.data;
    } catch (error) {
        console.error("Error analyzing portfolio:", error);
        throw error;
    }
};
