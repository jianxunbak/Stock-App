/**
 * Firestore Quota Circuit Breaker Utility
 * 
 * Prevents "Quota Exceeded" errors from flooding the backend and console
 * by disabling Firestore writes for the remainder of the day once an 
 * error is detected.
 */

const STORAGE_KEY = 'firestore_quota_exceeded_v2';

export const isFirestoreQuotaExceeded = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return false;

        const { date, status } = JSON.parse(stored);
        const today = new Date().toISOString().split('T')[0];

        // Only enforce if the error happened today
        if (date === today && status === 'exceeded') {
            return true;
        }

        // Auto-reset if it's a new day
        if (date !== today) {
            localStorage.removeItem(STORAGE_KEY);
        }

        return false;
    } catch (e) {
        console.error("Error reading quota status:", e);
        return false;
    }
};

/**
 * Scans any input (string, object, error) for quota-related error markers.
 * If found, engages the circuit breaker.
 * @param {any} data - Data to scan
 * @returns {boolean} True if a quota error was found and marked
 */
export const checkAndMarkQuotaError = (data) => {
    if (!data) return false;

    const errorStrings = ['Quota exceeded', 'resource-exhausted', 'using maximum backoff delay'];
    const dataString = typeof data === 'string' ? data : JSON.stringify(data).toLowerCase();

    if (errorStrings.some(str => dataString.toLowerCase().includes(str))) {
        markFirestoreQuotaExceeded();
        return true;
    }
    return false;
};

export const markFirestoreQuotaExceeded = () => {
    try {
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            date: today,
            status: 'exceeded'
        }));
        console.warn("%c🚫 Firestore Quota Exceeded. Circuit breaker engaged for today.", "color: #ff4444; font-weight: bold;");
    } catch (e) {
        console.error("Error marking quota status:", e);
    }
};

/**
 * Executes a Firestore operation with circuit breaker protection.
 * @param {Function} operation - Async function returning a promise
 * @param {string} context - Log context (e.g., 'Save Watchlist')
 * @returns {Promise<any|null>}
 */
export const withFirestoreProtection = async (operation, context = 'Firestore Op') => {
    if (isFirestoreQuotaExceeded()) {
        // console.log(`%c🛡️ ${context}: Blocked by circuit breaker.`, "color: #888;");
        return null;
    }

    try {
        return await operation();
    } catch (err) {
        if (err.code === 'resource-exhausted' ||
            (err.message && err.message.includes('Quota exceeded'))) {
            markFirestoreQuotaExceeded();
            return null;
        }

        // Rethrow other errors to be handled by the caller
        throw err;
    }
};
