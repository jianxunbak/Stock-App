import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

// --- Theme Operations ---

export const saveUserTheme = async (userId, theme) => {
    if (!userId) return;
    try {
        const userRef = doc(db, "users", userId);
        // Use setDoc with merge: true to create if doesn't exist or update if it does
        await setDoc(userRef, { theme }, { merge: true });
    } catch (error) {
        console.error("Error saving theme to Firestore:", error);
    }
};

export const getUserTheme = async (userId) => {
    if (!userId) return null;
    try {
        const userRef = doc(db, "users", userId);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            return docSnap.data().theme;
        }
    } catch (error) {
        console.error("Error fetching theme from Firestore:", error);
    }
    return null;
};

// --- Watchlist Operations ---

export const saveWatchlist = async (userId, watchlist) => {
    // console.log("Attempting to save watchlist to Firestore...", { userId, itemCount: watchlist?.length });
    if (!userId) {
        console.warn("saveWatchlist called without userId");
        return;
    }
    try {
        const userRef = doc(db, "users", userId);
        await setDoc(userRef, { watchlist }, { merge: true });
        console.log("Watchlist saved successfully to Firestore!");
    } catch (error) {
        console.error("Error saving watchlist to Firestore:", error);
    }
};

export const getWatchlist = async (userId) => {
    if (!userId) return [];
    try {
        const userRef = doc(db, "users", userId);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            return docSnap.data().watchlist || [];
        }
    } catch (error) {
        console.error("Error fetching watchlist from Firestore:", error);
    }
    return [];
};
// --- Portfolio Operations ---

export const savePortfolio = async (userId, portfolio) => {
    if (!userId) return;
    try {
        const userRef = doc(db, "users", userId);
        await setDoc(userRef, { portfolio }, { merge: true });
    } catch (error) {
        console.error("Error saving portfolio to Firestore:", error);
    }
};

export const getPortfolio = async (userId) => {
    if (!userId) return [];
    try {
        const userRef = doc(db, "users", userId);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            return docSnap.data().portfolio || [];
        }
    } catch (error) {
        console.error("Error fetching portfolio from Firestore:", error);
    }
    return [];
};
