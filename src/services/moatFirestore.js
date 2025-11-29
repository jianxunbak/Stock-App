import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db, auth } from "../firebase";

// --- Public (AI) Analysis ---
// Stored in 'moat_analysis_public' collection
// Accessible by everyone, writable by authenticated users (when triggering AI)

export const savePublicMoatAnalysis = async (ticker, data) => {
    if (!ticker || !data) return;

    // Check if user is authenticated
    if (!auth.currentUser) {
        console.log("User not authenticated, skipping Firestore save for public moat analysis.");
        return;
    }

    try {
        const docRef = doc(db, "moat_analysis_public", ticker.toUpperCase());
        await setDoc(docRef, {
            ...data,
            lastUpdated: new Date().toISOString(),
            isAi: true // Flag to indicate this is an AI evaluation
        }, { merge: true });
        console.log(`Public AI moat analysis for ${ticker} saved.`);
    } catch (error) {
        console.error("Error saving public moat analysis:", error);
    }
};

export const getPublicMoatAnalysis = async (ticker) => {
    if (!ticker) return null;
    try {
        const docRef = doc(db, "moat_analysis_public", ticker.toUpperCase());
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
    } catch (error) {
        console.error("Error fetching public moat analysis:", error);
    }
    return null;
};

// --- Private (User) Analysis ---
// Stored in 'users/{userId}/moat_analysis' subcollection
// Accessible only by the specific user

export const savePrivateMoatAnalysis = async (userId, ticker, data) => {
    console.log(`[savePrivateMoatAnalysis] Attempting to save for User: ${userId}, Ticker: ${ticker}`);
    if (!userId || !ticker || !data) {
        console.error("[savePrivateMoatAnalysis] Missing required arguments:", { userId, ticker, data });
        return;
    }

    try {
        const docRef = doc(db, "users", userId, "moat_analysis", ticker.toUpperCase());
        console.log(`[savePrivateMoatAnalysis] DocRef path: users/${userId}/moat_analysis/${ticker.toUpperCase()}`);

        await setDoc(docRef, {
            ...data,
            lastUpdated: new Date().toISOString(),
            isAi: false // Flag to indicate this is a user evaluation
        }, { merge: true });
        console.log(`[savePrivateMoatAnalysis] SUCCESS: Private user moat analysis for ${ticker} saved.`);
    } catch (error) {
        console.error("[savePrivateMoatAnalysis] ERROR saving private moat analysis:", error);
        if (error.code === 'permission-denied') {
            console.error("[savePrivateMoatAnalysis] PERMISSION DENIED. Check Firestore Rules.");
        }
    }
};

export const getPrivateMoatAnalysis = async (userId, ticker) => {
    if (!userId || !ticker) return null;
    try {
        const docRef = doc(db, "users", userId, "moat_analysis", ticker.toUpperCase());
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
    } catch (error) {
        console.error("Error fetching private moat analysis:", error);
    }
    return null;
};

export const deletePrivateMoatAnalysis = async (userId, ticker) => {
    if (!userId || !ticker) return;
    try {
        const docRef = doc(db, "users", userId, "moat_analysis", ticker.toUpperCase());
        await deleteDoc(docRef);
        console.log(`Private moat analysis for ${ticker} deleted (reverted to public).`);
    } catch (error) {
        console.error("Error deleting private moat analysis:", error);
    }
};
