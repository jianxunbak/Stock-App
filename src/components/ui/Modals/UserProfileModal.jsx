import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { Settings, LogOut, User as UserIcon, X, Edit2, MoreVertical, Check, Camera, Cake } from 'lucide-react';
import Window from '../Window/Window';
import CustomDatePicker from '../CustomDatePicker/CustomDatePicker';
import Button from '../Button/Button';
import DropdownButton from '../DropdownButton/DropdownButton';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { fetchUserSettings, saveUserSettings } from '../../../services/api';
import styles from './UserProfileModal.module.css';

// Static configuration moved outside component to prevent re-creation on every render
const portfolioCards = [
    { key: 'summary', label: 'Summary' },
    { key: 'allocation', label: 'Allocation' },
    { key: 'ai', label: 'AI Insights' },
    { key: 'holdings', label: 'Holdings' }
];

const analysisCards = [
    { key: 'stockSummary', label: 'Stock Summary' },
    { key: 'financialAnalysis', label: 'Financial Analysis' },
    { key: 'profitability', label: 'Profitability' },
    { key: 'moat', label: 'Moat Evaluation' },
    { key: 'debt', label: 'Debt Analysis' },
    { key: 'valuation', label: 'Valuation' },
    { key: 'support', label: 'Support & Resistance' },
    { key: 'financials', label: 'Financial Statements' }
];

const wealthCards = [
    { key: 'wealthSummary', label: 'Wealth Summary' },
    { key: 'stocks', label: 'Stocks' },
    { key: 'cpf', label: 'CPF' },
    { key: 'savings', label: 'Savings' }
];

const UserProfileModal = memo(({ isOpen, onClose, user, onLogout }) => {
    const { theme, toggleTheme } = useTheme();
    const { updateUserProfile, uploadProfilePicture } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editPhotoURL, setEditPhotoURL] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewURL, setPreviewURL] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [editDateOfBirth, setEditDateOfBirth] = useState('');
    const fileInputRef = useRef(null);

    const calculateAge = (dob) => {
        if (!dob) return null;
        const birth = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    };

    const formatDateDisplay = (dob) => {
        if (!dob) return '';
        const date = new Date(dob);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    useEffect(() => {
        if (user) {
            setEditName(user.displayName || '');
            setEditPhotoURL(user.photoURL || '');
            setPreviewURL(user.photoURL || '');
            setEditDateOfBirth(dateOfBirth || '');
        }
    }, [user, isEditing, dateOfBirth]);

    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setPreviewURL(URL.createObjectURL(file));
        }
    };

    const handleSaveProfile = async () => {
        setIsSaving(true);
        try {
            let photoURL = editPhotoURL;

            if (selectedFile) {
                photoURL = await uploadProfilePicture(selectedFile);
            }

            await updateUserProfile(editName, photoURL);

            // Save DOB to settings
            setDateOfBirth(editDateOfBirth);
            if (user?.uid) {
                const newSettings = { ...settings, dateOfBirth: editDateOfBirth };
                setSettings(newSettings);
                await saveUserSettings(user.uid, newSettings);
            }

            setIsEditing(false);
            setSelectedFile(null);
        } catch (error) {
            console.error("Failed to update profile:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setSelectedFile(null);
        setPreviewURL(user?.photoURL || '');
    };
    const [settings, setSettings] = useState({
        cardVisibility: {
            portfolio: {
                summary: true,
                allocation: true,
                ai: true,
                holdings: true
            },
            analysis: {
                stockSummary: true,
                financialAnalysis: true,
                profitability: true,
                moat: true,
                debt: true,
                valuation: true,
                support: true,
                financials: true
            },
            wealth: {
                wealthSummary: true,
                stocks: true,
                cpf: true,
                savings: true
            }
        }
    });

    useEffect(() => {
        if (isOpen && user?.uid) {
            fetchUserSettings(user.uid).then(fetched => {
                if (fetched?.cardVisibility) {
                    setSettings(prev => ({
                        ...prev,
                        cardVisibility: {
                            portfolio: { ...prev.cardVisibility.portfolio, ...fetched.cardVisibility.portfolio },
                            analysis: { ...prev.cardVisibility.analysis, ...fetched.cardVisibility.analysis },
                            wealth: { ...prev.cardVisibility.wealth, ...fetched.cardVisibility.wealth }
                        }
                    }));
                }
                if (fetched?.dateOfBirth) {
                    setDateOfBirth(fetched.dateOfBirth);
                }
            });
        }
    }, [isOpen, user?.uid]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    const saveTimeoutRef = useRef(null);

    const handleToggleVisibility = (page, cardKey) => {
        // 1. Calculate new settings locally
        const newSettings = {
            ...settings,
            cardVisibility: {
                ...settings.cardVisibility,
                [page]: {
                    ...settings.cardVisibility[page],
                    [cardKey]: !settings.cardVisibility[page][cardKey]
                }
            }
        };

        // 2. Update local modal state immediately (Optimistic)
        setSettings(newSettings);

        // 3. Dispatch data-rich CustomEvent for background pages (Decoupled to allow modal to respond first)
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('user-settings-updated', {
                detail: { settings: newSettings }
            }));
        }, 150);

        // 4. Debounced Save to Backend (Prevents firing 5 requests if user clicks fast)
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        saveTimeoutRef.current = setTimeout(async () => {
            try {
                if (user?.uid) {
                    await saveUserSettings(user.uid, newSettings);
                    // No need to dispatch again as we already did it optimistically
                }
            } catch (error) {
                console.error("Failed to save settings:", error);
                // Revert logic could be added here if critical
            }
        }, 800); // 800ms debounce
    };

    if (!isOpen || !user) return null;

    const menuItems = useMemo(() => [
        {
            label: 'Adjust Profile',
            onClick: () => setIsEditing(true),
            indicatorNode: <Edit2 size={16} />
        },
        {
            label: 'Sign Out',
            onClick: onLogout,
            indicatorNode: <LogOut size={16} />
        }
    ], [onLogout]);

    return (
        <Window
            isOpen={isOpen}
            onClose={onClose}
            title="User Details"
            width="850px"
            height="85vh"
            headerAlign="start"
            hideCloseButton={false}
            contentClassName={styles.windowContentOverride}
            controls={
                <DropdownButton
                    items={menuItems}
                    variant="icon"
                    icon={<MoreVertical size={20} />}
                    align="right"
                />
            }
        >
            <div className={styles.profileGrid}>
                {/* Left Side: Profile Info */}
                <div className={styles.leftCol}>
                    <div className={styles.userProfileHeader}>
                        {isEditing ? (
                            <div className={styles.editProfileForm}>
                                <div className={styles.avatarContainer} style={{ position: 'relative', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
                                    {previewURL ? (
                                        <img
                                            src={previewURL}
                                            alt="Preview"
                                            className={styles.avatar}
                                            onError={(e) => { e.target.src = 'https://via.placeholder.com/150'; }}
                                        />
                                    ) : (
                                        <UserIcon size={40} />
                                    )}
                                    <div className={styles.avatarOverlay}>
                                        <Camera size={24} color="white" />
                                    </div>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                    />
                                </div>
                                <div className={styles.editInputs}>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        placeholder="Display Name"
                                        className={styles.profileInput}
                                    />
                                    <div className={styles.dobInputWrapper}>
                                        <Cake size={14} className={styles.dobIcon} />
                                        <CustomDatePicker
                                            value={editDateOfBirth}
                                            onChange={setEditDateOfBirth}
                                            isMobile={false}
                                            useModalOnDesktop={true}
                                            triggerClassName={styles.profileInput}
                                        />
                                    </div>
                                </div>
                                <div className={styles.editActions}>
                                    <Button
                                        variant="icon"
                                        onClick={handleSaveProfile}
                                        disabled={isSaving}
                                        style={{
                                            width: '36px',
                                            height: '36px',
                                            padding: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <Check size={18} color="#4ade80" />
                                    </Button>
                                    <Button
                                        variant="icon"
                                        onClick={handleCancel}
                                        disabled={isSaving}
                                        style={{
                                            width: '36px',
                                            height: '36px',
                                            padding: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <X size={18} color="#ef4444" />
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className={styles.avatarContainer}>
                                    {user.photoURL ? (
                                        <img
                                            src={user.photoURL}
                                            alt={user.displayName}
                                            className={styles.avatar}
                                        />
                                    ) : (
                                        <UserIcon size={40} />
                                    )}
                                </div>
                                <div className={styles.userInfo}>
                                    <h3>{user.displayName || 'User'}</h3>
                                    <p>{user.email}</p>
                                </div>
                                {dateOfBirth && (
                                    <div className={styles.dobDisplay}>
                                        <Cake size={14} className={styles.dobIcon} />
                                        <span className={styles.dobText}>
                                            {formatDateDisplay(dateOfBirth)}
                                        </span>
                                        <span className={styles.dobAge}>
                                            ({calculateAge(dateOfBirth)} years old)
                                        </span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Vertical Divider */}
                <div className={styles.divider} />

                {/* Right Side: Visibility Settings */}
                <div className={styles.rightCol}>
                    <div className={styles.sectionHeader}>
                        <h4 className={styles.sectionTitle}>
                            <Settings size={18} style={{ marginRight: '8px' }} />
                            Preferences
                        </h4>

                        <div className={styles.themeToggleWrapper}>
                            <span className={styles.preferenceLabel}>Theme Selection</span>
                            <div
                                className={`${styles.toggleRow} ${styles.themePreference}`}
                                onClick={toggleTheme}
                            >
                                <span className={styles.cardLabel}>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                                <div className={`${styles.customToggle} ${styles.themeToggle} ${theme === 'dark' ? styles.active : ''}`}>
                                    <div className={styles.toggleKnob} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.settingsScroll}>
                        <div className={styles.settingsGroup}>
                            <h5>Portfolio Page</h5>
                            <div className={styles.togglesGrid}>
                                {portfolioCards.map(card => (
                                    <div key={card.key} className={styles.toggleRow} onClick={() => handleToggleVisibility('portfolio', card.key)}>
                                        <span className={styles.cardLabel}>{card.label}</span>
                                        <div className={`${styles.customToggle} ${settings.cardVisibility.portfolio[card.key] ? styles.active : ''}`}>
                                            <div className={styles.toggleKnob} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={styles.settingsGroup} style={{ marginTop: '1.5rem' }}>
                            <h5>Analysis Page</h5>
                            <div className={styles.togglesGrid}>
                                {analysisCards.map(card => (
                                    <div key={card.key} className={styles.toggleRow} onClick={() => handleToggleVisibility('analysis', card.key)}>
                                        <span className={styles.cardLabel}>{card.label}</span>
                                        <div className={`${styles.customToggle} ${settings.cardVisibility.analysis[card.key] ? styles.active : ''}`}>
                                            <div className={styles.toggleKnob} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={styles.settingsGroup} style={{ marginTop: '1.5rem' }}>
                            <h5>Wealth Page</h5>
                            <div className={styles.togglesGrid}>
                                {wealthCards.map(card => (
                                    <div key={card.key} className={styles.toggleRow} onClick={() => handleToggleVisibility('wealth', card.key)}>
                                        <span className={styles.cardLabel}>{card.label}</span>
                                        <div className={`${styles.customToggle} ${settings.cardVisibility.wealth[card.key] ? styles.active : ''}`}>
                                            <div className={styles.toggleKnob} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Window>
    );
});

export default UserProfileModal;
