import { useGlobalData } from '../context/GlobalDataContext';

export const useUserSettings = () => {
    const { settings, loading, updateSettings, loadSettings } = useGlobalData();

    return {
        settings,
        loading,
        updateSettings,
        refreshSettings: loadSettings
    };
};
