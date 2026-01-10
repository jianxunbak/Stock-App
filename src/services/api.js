import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const fetchStockData = async (ticker) => {
    try {
        console.log(`Starting fetch for ${ticker}...`);
        const response = await axios.get(`${API_URL}/stock/${ticker}`, {
            timeout: 60000 // 60 seconds timeout
        });
        console.log(`%c🚀 Fetch completed for ${ticker}`, "color: #00ff00; font-weight: bold;");
        console.log("%c📦 API Response Data:", "color: #00befa; font-weight: bold;", response.data);
        return response.data;
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            console.error("Fetch timed out for:", ticker);
            throw new Error("Validation taking too long. The server might be busy or the stock is complex to analyze.");
        }
        console.error("Error fetching stock data:", error);
        throw error;
    }
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

export const calculatePortfolioTWR = async (portfolioItems) => {
    try {
        const response = await axios.post(`${API_URL}/portfolio/twr`, portfolioItems);
        return response.data;
    } catch (error) {
        console.error("Error calculating TWR:", error);
        return null;
    }
};

export const analyzePortfolio = async (portfolioItems, metrics) => {
    try {
        const response = await axios.post(`${API_URL}/portfolio/analyze`, { items: portfolioItems, metrics });
        return response.data;
    } catch (error) {
        console.error("Error analyzing portfolio:", error);
        throw error;
    }
};
