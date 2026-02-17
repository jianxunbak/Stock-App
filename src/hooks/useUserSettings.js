import { useState, useEffect, useCallback } from 'react';
import { fetchUserSettings, saveUserSettings } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const useUserSettings = () => {
    const { currentUser } = useAuth();
    // Initialize with {} so UI doesn't block. 
    // If we use null, !settings is true, causing "loading" props to be true in cards.
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);

    const loadSettings = useCallback(async () => {
        if (!currentUser?.uid) {
            setLoading(false);
            return;
        }
        try {
            const data = await fetchUserSettings(currentUser.uid);
            setSettings(data || {});
        } catch (error) {
            console.error("Error loading settings:", error);
        } finally {
            setLoading(false);
        }
    }, [currentUser?.uid]);

    useEffect(() => {
        loadSettings();

        // Listen for updates from other components
        const handleSettingsUpdate = (event) => {
            if (event.detail && event.detail.settings) {
                // Only update if it's different to avoid redundant renders of the same optimistic state
                const nextSettings = event.detail.settings;
                setSettings(prev => {
                    if (JSON.stringify(prev) === JSON.stringify(nextSettings)) return prev;
                    return nextSettings;
                });
            }
        };

        window.addEventListener('user-settings-updated', handleSettingsUpdate);

        return () => {
            window.removeEventListener('user-settings-updated', handleSettingsUpdate);
        };
    }, [loadSettings]);

    const updateSettings = async (newSettings) => {
        if (!currentUser?.uid) return;

        // Optimistic update
        const updated = { ...settings, ...newSettings };
        setSettings(updated);

        // Broadcast update immediately for other components (Optimistic)
        window.dispatchEvent(new CustomEvent('user-settings-updated', {
            detail: { settings: updated, source: 'internal' }
        }));

        try {
            // PHASE 2 FIX: Skip fetching latest. We trust the optimistic 'updated' state 
            // since we handle merges via the 'user-settings-updated' event system anyway.
            // This cuts out 1 network request and avoids "Save Storm" timeouts.
            await saveUserSettings(currentUser.uid, updated);
        } catch (error) {
            console.error("Error saving settings:", error);
            // Optional: Rollback logic could go here
        }
    };

    return { settings, loading, updateSettings, refreshSettings: loadSettings };
};
