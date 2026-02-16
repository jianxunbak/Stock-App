import { useState, useEffect, useCallback } from 'react';
import { fetchUserSettings, saveUserSettings } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const useUserSettings = () => {
    const { currentUser } = useAuth();
    const [settings, setSettings] = useState(null);
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
                setSettings(event.detail.settings);
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
            detail: { settings: updated }
        }));

        try {
            // Fetch latest to avoid overwriting concurrent changes if any (though unlikely for single user)
            const latest = await fetchUserSettings(currentUser.uid);
            const final = { ...latest, ...newSettings };
            await saveUserSettings(currentUser.uid, final);

            // Only broadcast again if the server response is different from our optimistic update
            if (JSON.stringify(final) !== JSON.stringify(updated)) {
                window.dispatchEvent(new CustomEvent('user-settings-updated', {
                    detail: { settings: final }
                }));
            }
        } catch (error) {
            console.error("Error saving settings:", error);
            // Rollback on error? Maybe not necessary for settings
        }
    };

    return { settings, loading, updateSettings, refreshSettings: loadSettings };
};
