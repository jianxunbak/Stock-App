import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider, storage } from '../firebase';
import { signInWithPopup, signOut, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import LoadingScreen from '../components/ui/LoadingScreen/LoadingScreen';

const AuthContext = createContext();

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const login = () => {
        return signInWithPopup(auth, googleProvider);
    };

    const logout = () => {
        return signOut(auth);
    };

    const updateUserProfile = async (displayName, photoURL) => {
        if (!auth.currentUser) throw new Error("No user logged in");

        await updateProfile(auth.currentUser, {
            displayName,
            photoURL
        });

        // Manually update local state to reflect changes immediately
        setCurrentUser(prev => ({
            ...prev,
            displayName,
            photoURL
        }));
    };

    const uploadProfilePicture = async (file) => {
        if (!auth.currentUser) throw new Error("No user logged in");

        const storageRef = ref(storage, `profile_pictures/${auth.currentUser.uid}`);
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);
        return downloadURL;
    };

    // useEffect(() => {
    //     const unsubscribe = onAuthStateChanged(auth, (user) => {
    //         setCurrentUser(user);
    //         setLoading(false);
    //     });

    //     return unsubscribe;
    // }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // --- SECURITY CHECK START ---

                // 1. Get the list from Vercel/Environment
                // Format expected: "john@gmail.com,jane@gmail.com"
                const allowedString = import.meta.env.VITE_FIREBASE_EMAIL || "";

                // 2. Clean the list: split by comma, remove spaces, make lowercase
                const allowedList = allowedString
                    .split(',')
                    .map(email => email.trim().toLowerCase());

                // 3. Clean the user's email
                const userEmail = user.email ? user.email.toLowerCase() : "";

                // console.log("Auth: Checking security for user:", userEmail);
                // console.log("Auth: Allowed list:", allowedList);

                // 4. The Decision Logic
                if (allowedList.includes(userEmail)) {
                    // console.log("Auth: Access granted for", userEmail);
                    setCurrentUser(user);
                } else {
                    console.warn(`Unauthorized login attempt by: ${userEmail}`);
                    alert("Access Denied: You are not authorized to use this app.");
                    await signOut(auth);
                    setCurrentUser(null);
                }
                // --- SECURITY CHECK END ---
            } else {
                // User is logged out
                setCurrentUser(null);
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value = {
        currentUser,
        login,
        logout,
        updateUserProfile,
        uploadProfilePicture,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {loading ? <LoadingScreen fullScreen={true} /> : children}
        </AuthContext.Provider>
    );
};
