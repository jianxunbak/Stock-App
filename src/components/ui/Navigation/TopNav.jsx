import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, LogOut, PieChart, TrendingUp, ArrowLeft, FlaskConical, MoreVertical, X, Check, Wallet } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import Window from '../Window/Window';
import Button from '../Button/Button';
import SearchBar from '../SearchBar/SearchBar';
import Menu from '../Menu/Menu';
import LogoutConfirmationModal from '../Modals/LogoutConfirmationModal';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import styles from './TopNav.module.css';

export const TopNavLogo = ({
    logoText = "Stock Analyser",
    customTitle = null
}) => {
    const navigate = useNavigate();
    return (
        <div className={styles.logoContainer} onClick={() => navigate('/')} style={{ pointerEvents: 'auto' }}>
            {customTitle ? (
                <h1 className={styles.titleText} style={{ display: 'block' }}>{customTitle}</h1>
            ) : (
                <>
                    <TrendingUp size={24} className={styles.titleIcon} />
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
    showWealthBtn = true,
    showUserBtn = true,
    showLogoutBtn = true,
    showThemeToggle = true,
    alwaysOpenSearch = false,

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
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    return (
        <div className={styles.actionGroup}>
            {showSearch && (
                <SearchBar
                    placeholder="Search ticker..."
                    alwaysOpen={alwaysOpenSearch}
                    onEnter={(val) => {
                        setSearchTicker(val);
                        handleSearch(val);
                    }}
                />
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
                            <Button variant="icon" className={styles.navActionButton} onClick={() => setShowWatchlist(true)} title="Watchlist">
                                <Star size={16} className={styles.starIcon} />
                            </Button>
                        )}
                        {showPortfolioBtn && (
                            <Button variant="icon" className={styles.navActionButton} onClick={() => navigate('/portfolio')} title="Portfolio">
                                <PieChart size={16} className={styles.starIcon} />
                            </Button>
                        )}
                        {showWealthBtn && (
                            <Button variant="icon" className={styles.navActionButton} onClick={() => navigate('/wealth')} title="Wealth">
                                <Wallet size={16} className={styles.starIcon} />
                            </Button>
                        )}

                        {showUserBtn && (
                            <Button variant="icon" className={styles.navActionButton} onClick={() => setShowProfileModal(true)} title="User Profile">
                                {currentUser.photoURL ? (
                                    <img src={currentUser.photoURL} alt="User" className={styles.userAvatarSmall} referrerPolicy="no-referrer" />
                                ) : (
                                    <div className={styles.userAvatarPlaceholder}>{currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'}</div>
                                )}
                            </Button>
                        )}
                        {showLogoutBtn && (
                            <Button variant="icon" className={styles.navActionButton} onClick={() => setShowLogoutConfirm(true)} title="Log Out">
                                <LogOut size={16} className={styles.starIcon} />
                            </Button>
                        )}
                    </>
                )}
            </div>

            {/* Mobile Actions Menu */}
            <div className={styles.mobileActions}>
                <Menu
                    placement="bottom-right"
                    distortionFactor={0.6}
                    contentDistortionScale={1.5}
                    trigger={
                        <Button variant="icon" className={styles.menuButton}>
                            <MoreVertical size={24} />
                        </Button>
                    }
                >
                    {!currentUser && showThemeToggle && <ThemeToggle />}
                    {currentUser && showCurrency && (
                        <CurrencySelector
                            currency={currency}
                            setCurrency={setCurrency}
                            isMobile
                        />
                    )}
                    {currentUser && showWatchlistBtn && (
                        <Button variant="icon" onClick={() => setShowWatchlist(true)} title="Watchlist">
                            <Star size={16} />
                        </Button>
                    )}
                    {currentUser && showPortfolioBtn && (
                        <Button variant="icon" onClick={() => navigate('/portfolio')} title="Portfolio">
                            <PieChart size={16} />
                        </Button>
                    )}
                    {currentUser && showWealthBtn && (
                        <Button variant="icon" onClick={() => navigate('/wealth')} title="Wealth">
                            <Wallet size={16} />
                        </Button>
                    )}
                    {currentUser && showUserBtn && (
                        <Button variant="icon" onClick={() => setShowProfileModal(true)} title="Profile">
                            {currentUser.photoURL ? (
                                <img src={currentUser.photoURL} alt="User" className={styles.userAvatarSmall} />
                            ) : (
                                <div className={styles.userAvatarPlaceholder}>{currentUser.displayName?.charAt(0).toUpperCase() || 'U'}</div>
                            )}
                        </Button>
                    )}
                    {currentUser && showLogoutBtn && (
                        <Button variant="icon" onClick={() => setShowLogoutConfirm(true)} title="Log Out">
                            <LogOut size={16} />
                        </Button>
                    )}
                </Menu>
            </div>

            {/* Logout Confirmation Window */}
            <LogoutConfirmationModal
                isOpen={showLogoutConfirm}
                onClose={() => setShowLogoutConfirm(false)}
                onConfirm={() => {
                    setShowLogoutConfirm(false);
                    handleLogout();
                }}
            />
        </div>
    );
};

const CurrencyOption = ({ label, isActive, onClick }) => {
    const [isPressed, setIsPressed] = useState(false);

    return (
        <button
            className={`${styles.currencyOption} ${isActive ? styles.activeCurrency : ''} ${isPressed ? styles.pressedCurrency : ''}`}
            onMouseDown={() => setIsPressed(true)}
            onMouseUp={() => setIsPressed(false)}
            onMouseLeave={() => setIsPressed(false)}
            onTouchStart={() => setIsPressed(true)}
            onTouchEnd={() => setIsPressed(false)}
            onClick={onClick}
        >
            {label}
        </button>
    );
};

const CurrencySelector = ({ currency, setCurrency, isMobile = false }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showContent, setShowContent] = useState(false);
    const containerRef = useRef(null);
    const currencies = ['USD', 'SGD'];
    const triggerControls = useAnimation();
    const prevExpanded = useRef(isExpanded);

    useEffect(() => {
        if (prevExpanded.current !== isExpanded) {
            triggerControls.start("bounce");
        }
        prevExpanded.current = isExpanded;
    }, [isExpanded, triggerControls]);

    useEffect(() => {
        if (isExpanded) {
            const timer = setTimeout(() => setShowContent(true), 150);
            return () => clearTimeout(timer);
        } else {
            setShowContent(false);
        }
    }, [isExpanded]);

    // Handle click outside to close
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsExpanded(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const expandedWidth = isMobile ? '10rem' : '5.8rem';
    const collapsedWidth = '2.22rem';

    return (
        <motion.div
            ref={containerRef}
            // animate={triggerControls}
            variants={{
                bounce: {
                    scaleX: [1, 1.12, 0.92, 1.04, 1],
                    scaleY: [1, 0.92, 1.08, 0.96, 1],
                    transition: {
                        duration: 0.5,
                        ease: "easeOut"
                    }
                }
            }}
            className={`${styles.currencyContainer} ${isExpanded ? styles.expanded : ''} ${isMobile && isExpanded ? styles.mobileExpanded : ''}`}
            initial={false}
            animate={{
                width: isMobile ? collapsedWidth : (isExpanded ? expandedWidth : collapsedWidth),
                height: isMobile && isExpanded ? '4.8rem' : collapsedWidth,
                scaleX: isExpanded ? 1.02 : 1,
                scaleY: isExpanded ? 0.99 : 1,
            }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
            <AnimatePresence mode="wait">
                {!isExpanded ? (
                    <motion.div
                        key="button"
                        className={styles.animationWrapper}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                    >
                        <Button
                            variant="icon"
                            className={styles.currencyButton}
                            onClick={() => setIsExpanded(true)}
                        >
                            <span className={styles.currencyText}>{currency}</span>
                        </Button>
                    </motion.div>
                ) : (
                    <motion.div
                        key="options"
                        className={`${styles.currencyOptions} ${isMobile ? styles.mobileOptions : ''}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                    >
                        {showContent && currencies.map(c => (
                            <CurrencyOption
                                key={c}
                                label={c}
                                isActive={currency === c}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrency(c);
                                }}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
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
