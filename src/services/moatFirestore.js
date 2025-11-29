import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../firebase";

export const saveMoatAnalysis = async (ticker, data) => {
    if (!ticker || !data) return;

    // Check if user is authenticated
    if (!auth.currentUser) {
        console.log("User not authenticated, skipping Firestore save for moat analysis.");
        return;
    }

    try {
        // Store in a global 'moat_analysis' collection, keyed by ticker
        // This allows all users to share the same analysis cache
        const docRef = doc(db, "moat_analysis", ticker.toUpperCase());
        await setDoc(docRef, {
            ...data,
            lastUpdated: new Date().toISOString()
        }, { merge: true });
        console.log(`Moat analysis for ${ticker} saved to Firestore.`);
    } catch (error) {
        console.error("Error saving moat analysis:", error);
    }
};

export const getMoatAnalysis = async (ticker) => {
    if (!ticker) return null;
    try {
        const docRef = doc(db, "moat_analysis", ticker.toUpperCase());
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
    } catch (error) {
        console.error("Error fetching moat analysis:", error);
    }
    return null;
};
