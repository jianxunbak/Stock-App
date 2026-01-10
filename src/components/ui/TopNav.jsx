import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Star, Menu, X, LogOut, PieChart, TrendingUp, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import styles from './TopNav.module.css';

export const TopNavLogo = ({
    logoText = "Stock Analyser",
    customTitle = null
}) => {
    const navigate = useNavigate();
    return (
        <div className={styles.logoContainer} onClick={() => navigate('/')}>
            {customTitle ? (
                <h1 className={styles.titleText} style={{ display: 'block' }}>{customTitle}</h1>
            ) : (
                <>
                    <TrendingUp size={24} className={styles.titleIcon} />
                    <h1 className={styles.titleText}>{logoText}</h1>
                </>
            )}
        </div>
    );
};

export const TopNavActions = ({
    showSearch = true,
    showCurrency = true,
    showWatchlistBtn = true,
    showPortfolioBtn = true,
    showUserBtn = true,
    showLogoutBtn = true,
    showThemeToggle = true,

    // Values & Handlers
    searchTicker = '',
    setSearchTicker = () => { },
    handleSearch = () => { },
    currency = 'USD',
    setCurrency = () => { },
    setShowWatchlist = () => { },
    setShowProfileModal = () => { },
    handleLogout = () => { },
}) => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const navRef = useRef(null);

    // Click outside to close menu
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isMenuOpen && navRef.current && !navRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMenuOpen]);

    const handleMobileAction = (action) => {
        setIsMenuOpen(false);
        action();
    };

    return (
        <div className={styles.actionGroup} ref={navRef}>
            {showSearch && (
                <div className={styles.searchWrapper}>
                    <input
                        type="text"
                        placeholder="Search ticker..."
                        className={styles.searchInput}
                        value={searchTicker}
                        onChange={e => setSearchTicker(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch(e)}
                    />
                    <Search size={18} className={styles.searchIcon} onClick={handleSearch} />
                </div>
            )}

            {/* Desktop Actions */}
            <div className={styles.desktopActions}>
                {!currentUser && showThemeToggle && <ThemeToggle />}
                {currentUser && (
                    <>
                        {showCurrency && (
                            <CurrencySelector currency={currency} setCurrency={setCurrency} />
                        )}
                        {showWatchlistBtn && (
                            <button className={styles.watchlistButton} onClick={() => setShowWatchlist(true)} title="Watchlist">
                                <Star size={16} className={styles.starIcon} />
                            </button>
                        )}
                        {showPortfolioBtn && (
                            <button onClick={() => navigate('/portfolio')} className={styles.watchlistButton} title="Portfolio">
                                <PieChart size={16} className={styles.starIcon} />
                            </button>
                        )}
                        {showUserBtn && (
                            <button className={styles.userButton} onClick={() => setShowProfileModal(true)} title="User Profile">
                                {currentUser.photoURL ? (
                                    <img src={currentUser.photoURL} alt="User" className={styles.userAvatarSmall} referrerPolicy="no-referrer" />
                                ) : (
                                    <div className={styles.userAvatarPlaceholder}>{currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'}</div>
                                )}
                            </button>
                        )}
                        {showLogoutBtn && (
                            <button onClick={handleLogout} className={styles.watchlistButton} title="Log Out">
                                <LogOut size={16} className={styles.starIcon} />
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* Mobile Actions Button */}
            <button className={styles.menuButton} onClick={() => setIsMenuOpen(!isMenuOpen)}>
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Mobile Menu Dropdown */}
            {isMenuOpen && (
                <div className={styles.mobileMenu}>
                    {!currentUser && showThemeToggle && <ThemeToggle />}
                    {currentUser && (
                        <>
                            {showCurrency && (
                                <CurrencySelector
                                    currency={currency}
                                    setCurrency={(c) => handleMobileAction(() => setCurrency(c))}
                                    isMobile
                                />
                            )}
                            {showWatchlistBtn && (
                                <button className={styles.watchlistButton} onClick={() => handleMobileAction(() => setShowWatchlist(true))} title="Watchlist">
                                    <Star size={16} className={styles.starIcon} />
                                </button>
                            )}
                            {showPortfolioBtn && (
                                <button className={styles.watchlistButton} onClick={() => handleMobileAction(() => navigate('/portfolio'))} title="Portfolio">
                                    <PieChart size={16} className={styles.starIcon} />
                                </button>
                            )}
                            {showUserBtn && (
                                <button className={styles.userButton} onClick={() => handleMobileAction(() => setShowProfileModal(true))} title="Profile">
                                    {currentUser.photoURL ? (
                                        <img src={currentUser.photoURL} alt="User" className={styles.userAvatarSmall} referrerPolicy="no-referrer" />
                                    ) : (
                                        <div className={styles.userAvatarPlaceholder}>{currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'}</div>
                                    )}
                                </button>
                            )}
                            {showLogoutBtn && (
                                <button onClick={() => handleMobileAction(handleLogout)} className={styles.watchlistButton} title="Log Out">
                                    <LogOut size={16} className={styles.starIcon} />
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

const CurrencySelector = ({ currency, setCurrency, isMobile = false }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const currencies = ['USD', 'SGD'];

    return (
        <div
            className={`${styles.currencyContainer} ${isExpanded ? styles.expanded : ''}`}
            style={isMobile && isExpanded ? { width: '100%', maxWidth: '14rem' } : {}}
            onClick={() => setIsExpanded(!isExpanded)}
        >
            {!isExpanded ? (
                <span className={styles.currencyText}>{currency}</span>
            ) : (
                <div className={styles.currencyOptions}>
                    {currencies.map(c => (
                        <button
                            key={c}
                            className={`${styles.currencyOption} ${currency === c ? styles.activeCurrency : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                setCurrency(c);
                                setIsExpanded(false);
                            }}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const TopNav = (props) => {
    const navigate = useNavigate();
    return (
        <header className={styles.header}>
            <div className={styles.leftSection}>
                {props.showBackButton && (
                    <div onClick={() => navigate('/')} className={styles.backButton}>
                        <ArrowLeft size={20} />
                    </div>
                )}
                {props.showLogo && <TopNavLogo {...props} />}
            </div>
            <div className={styles.rightSection}>
                <TopNavActions {...props} />
            </div>
        </header>
    );
};

export default TopNav;
