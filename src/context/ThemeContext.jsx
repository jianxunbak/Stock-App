import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { saveUserTheme, getUserTheme } from '../services/firestore';

const ThemeContext = createContext();

export const useTheme = () => {
    return useContext(ThemeContext);
};

export const ThemeProvider = ({ children }) => {
    const { currentUser } = useAuth();
    const [theme, setTheme] = useState(() => {
        const savedTheme = localStorage.getItem('theme');
        return savedTheme || 'dark'; // Default to dark
    });

    // Sync with Firestore when user logs in, force light mode on logout
    useEffect(() => {
        const syncTheme = async () => {
            if (currentUser) {
                const savedTheme = await getUserTheme(currentUser.uid);
                if (savedTheme) {
                    setTheme(savedTheme);
                } else {
                    // If no theme in Firestore, save current local theme
                    await saveUserTheme(currentUser.uid, theme);
                }
            } else {
                // Force light mode on logout
                setTheme('light');
            }
        };
        syncTheme();
    }, [currentUser]);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prevTheme) => {
            const newTheme = prevTheme === 'dark' ? 'light' : 'dark';
            if (currentUser) {
                saveUserTheme(currentUser.uid, newTheme);
            }
            return newTheme;
        });
    };

    const value = {
        theme,
        toggleTheme,
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};
