import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Edit2, Check, X, AlertTriangle, ChevronDown, ChevronRight, Eye, Calendar, ChevronLeft, RefreshCw, Copy, Square, CheckSquare, CopyCheck, FileX, Menu, ChevronUp } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import styles from './PortfolioPage.module.css';
import { usePortfolio } from '../../hooks/usePortfolio';
import { fetchStockData, fetchCurrencyRate, calculatePortfolioTWR, analyzePortfolio, fetchUserSettings, saveUserSettings } from '../../services/api';

import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import Modal from '../ui/Modal';
import CascadingHeader from '../CascadingHeader';
import { TopNavLogo, TopNavActions } from '../ui/TopNav';
import FluidCard from '../ui/FluidCard';
import WatchlistModal from '../ui/WatchlistModal';
import UserProfileModal from '../ui/UserProfileModal';


// --- Constants ---
const CAT_TARGETS = {
    "Growth": { min: 30, max: 40 },
    "Core": { min: 20, max: 30 },
    "Compounder": { min: 20, max: 25 },
    "Defensive": { min: 15, max: 20 },
    "Speculative": { min: 0, max: 10 }
};

const SECTOR_LIMITS = {
    "Technology": 30, "Information Technology": 30,
    "Financial Services": 25, "Financials": 25,
    "Healthcare": 20, "Communication Services": 20, "Consumer Defensive": 20,
    "Consumer Non-Cyclical": 20, "default": 15
};

const CustomSelect = ({ value, onChange, options, style, onDelete, onEdit, placeholder, triggerClassName, useModalOnDesktop = false, containerStyle, isOpen: controlledIsOpen, onOpenChange }) => {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const containerRef = React.useRef(null);
    const menuRef = React.useRef(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

    const isControlled = controlledIsOpen !== undefined;
    const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

    const updateIsOpen = (val) => {
        if (isControlled) {
            if (onOpenChange) onOpenChange(val);
        } else {
            setInternalIsOpen(val);
        }
    };

    React.useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
            updateIsOpen(false);
        };
        const handleScroll = () => {
            // Only close if open and desktop (scrolling on mobile modal is fine)
            if (isOpen && !isMobile) updateIsOpen(false);
        };
        window.addEventListener('resize', handleResize);
        window.addEventListener('scroll', handleScroll, true);
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [isOpen]); // Depend on resolved isOpen

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            const clickedOutsideContainer = containerRef.current && !containerRef.current.contains(event.target);
            const clickedOutsideMenu = menuRef.current && !menuRef.current.contains(event.target);

            if (clickedOutsideContainer && clickedOutsideMenu) {
                updateIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggle = () => {
        if (!isOpen && containerRef.current && !useModalOnDesktop) {
            const rect = containerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
        updateIsOpen(!isOpen);
    };

    const menuContent = (
        <div
            className={styles.customSelectMenu}
            ref={menuRef}
            style={!isMobile && !useModalOnDesktop ? {
                position: 'absolute',
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                width: `${coords.width * 1.5}px`
            } : {}}
        >
            <div className={styles.customSelectOptionsList}>
                {options.map((opt, idx) => {
                    const isGroup = opt.isGroup;
                    if (isGroup) {
                        return (
                            <div key={`group-${idx}`} className={styles.customSelectGroupLabel}>
                                {opt.label}
                            </div>
                        );
                    }

                    const optValue = opt.value || opt;
                    const optLabel = opt.label || opt;
                    return (
                        <div
                            key={optValue}
                            className={`${styles.customSelectOption} ${value === optValue ? styles.selected : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange(optValue);
                                updateIsOpen(false);
                            }}
                        >
                            <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{optLabel}</div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                {onEdit && (
                                    <button
                                        type="button"
                                        className={styles.deleteOptionBtn}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEdit(optValue);
                                            updateIsOpen(false);
                                        }}
                                        title="Rename Portfolio"
                                    >
                                        <Edit2 size={12} />
                                    </button>
                                )}
                                {onDelete && optValue !== value && (
                                    <button
                                        type="button"
                                        className={styles.deleteOptionBtn}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(optValue);
                                        }}
                                        title="Delete Portfolio"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className={styles.customSelectContainer} ref={containerRef} style={containerStyle}>
            <div className={triggerClassName || styles.customSelectTrigger} onClick={handleToggle} style={style}>
                {options.find(opt => (opt.value || opt) === value)?.label || value || placeholder}
                {!triggerClassName && <ChevronDown size={16} color="var(--text-secondary)" />}
            </div>
            {isOpen && createPortal(
                (isMobile || useModalOnDesktop) ? (
                    <div
                        className={styles.mobileModalOverlay}
                        onClick={() => updateIsOpen(false)}
                    >
                        <div
                            className={styles.mobileModalContent}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {menuContent}
                        </div>
                    </div>
                ) : menuContent,
                document.body
            )}
        </div>
    );
};

const CustomDatePicker = ({ value, onChange, triggerClassName, isMobile, style }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = React.useRef(null);
    const [viewDate, setViewDate] = useState(new Date(value || new Date()));
    const [coords, setCoords] = useState({ top: 0, left: 0 });

    // Ensure valid date on open
    React.useEffect(() => {
        if (isOpen) {
            setViewDate(new Date(value || new Date()));
        }
    }, [isOpen, value]);

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                // Check if strict mobile overlay is present (handled by its own click listener usually)
                // usage of portal means this ref check might fail for the content, but works for the trigger.
                // For the content, we rely on the overlay click or content click propagation.
                // However, with Portal and coords, we need to be careful.
                // But for now, let's stick to the pattern:
                // If checking outside trigger AND outside portal content?
                // Actually, for the portal version, we usually use a transparent overlay or document click.
                // Let's use the transparent overlay method for desktop too, OR just document listener.
                // Actually, simple document listener works if we check if target is in portal.
                // But wait, checking if click is inside the PORTAL content is hard with just containerRef (which is the trigger).
                // So we need a ref for the popup too.
            }
        };
        // document.addEventListener('mousedown', handleClickOutside);
        // return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const popupRef = useRef(null);
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            const clickedOutsideContainer = containerRef.current && !containerRef.current.contains(event.target);
            const clickedOutsidePopup = popupRef.current && !popupRef.current.contains(event.target);

            if (isOpen && clickedOutsideContainer && clickedOutsidePopup) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);


    const daysInMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1).getDay();

    const handlePrevMonth = (e) => {
        e.stopPropagation();
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    };

    const handleNextMonth = (e) => {
        e.stopPropagation();
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    };

    const handleDayClick = (day) => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth() + 1;
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        onChange(dateStr);
        setIsOpen(false);
    };

    const handleToggle = () => {
        if (!isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            // Calculate available space
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceRight = window.innerWidth - rect.left;

            // Default to bottom-left aligned
            let top = rect.bottom + window.scrollY + 5;
            let left = rect.left + window.scrollX;

            // Flip to top if not enough space below (approx 350px needed)
            if (spaceBelow < 350 && rect.top > 350) {
                top = rect.top + window.scrollY - 360; // 350 height + 10 margin
            }

            // Shift left if not enough space on right (approx 350px width)
            if (spaceRight < 350) {
                left = window.innerWidth + window.scrollX - 370; // 350 width + 20 margin
            }

            setCoords({ top, left });
        }
        setIsOpen(!isOpen);
    };

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

    const totalDays = daysInMonth(viewDate);
    const startOffset = firstDayOfMonth(viewDate);

    const cells = [];
    for (let i = 0; i < startOffset; i++) {
        cells.push(<div key={`empty-${i}`} className={`${styles.dateCell} ${styles.empty}`}></div>);
    }
    for (let day = 1; day <= totalDays; day++) {
        const currentYear = viewDate.getFullYear();
        const currentMonth = viewDate.getMonth() + 1;
        const currentDateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isSelected = value === currentDateStr;
        cells.push(
            <div
                key={day}
                className={`${styles.dateCell} ${isSelected ? styles.selected : ''}`}
                onClick={(e) => {
                    e.stopPropagation();
                    handleDayClick(day);
                }}
            >
                {day}
            </div>
        );
    }

    const renderPopupContent = () => (
        <div
            className={styles.datePickerPopup}
            ref={popupRef}
            onClick={(e) => e.stopPropagation()}
            style={!isMobile ? {
                position: 'absolute',
                top: coords.top,
                left: coords.left,
                margin: 0,
                width: '320px',
                zIndex: 99999
            } : {}}
        >
            <div className={styles.dateHeader}>
                <button onClick={handlePrevMonth} className={styles.iconBtn}><ChevronLeft size={16} /></button>
                <span>{monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}</span>
                <button onClick={handleNextMonth} className={styles.iconBtn}><ChevronRight size={16} /></button>
            </div>
            <div className={styles.dateGrid}>
                {dayNames.map(d => <div key={d} className={styles.dayName}>{d}</div>)}
                {cells}
            </div>
        </div>
    );

    return (
        <div className={styles.datePickerContainer} ref={containerRef}>
            <div className={triggerClassName || styles.customSelectTrigger} onClick={handleToggle} style={style}>
                {value || 'Select Date'}
                {!triggerClassName && <Calendar size={16} color="var(--text-secondary)" />}
            </div>
            {isOpen && createPortal(
                isMobile ? (
                    <div
                        className={styles.mobileModalOverlay}
                        onClick={() => setIsOpen(false)}
                    >
                        <div
                            className={styles.mobileModalContent}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {renderPopupContent()}
                        </div>
                    </div>
                ) : (
                    renderPopupContent()
                ),
                document.body
            )}
        </div>
    );
};

const TypeSelector = ({ value, onChange, style }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    const menuRef = useRef(null);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
    const isMobile = window.innerWidth < 768;

    useEffect(() => {
        const handleClickOutside = (event) => {
            const clickedOutsideContainer = containerRef.current && !containerRef.current.contains(event.target);
            const clickedOutsideMenu = menuRef.current && !menuRef.current.contains(event.target);
            if (clickedOutsideContainer && clickedOutsideMenu) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggle = () => {
        if (!isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + window.scrollY,
                left: rect.left + rect.width / 2 + window.scrollX,
                width: rect.width
            });
        }
        setIsOpen(!isOpen);
    };

    const menuContent = (
        <div
            className={styles.typeSelectorMenu}
            ref={menuRef}
            style={{
                position: 'absolute',
                top: `${coords.top + 10}px`,
                left: `${coords.left}px`,
                transform: 'translateX(-50%)',
                zIndex: 9999
            }}
        >
            <div
                className={styles.typeOption}
                onClick={() => { onChange('main'); setIsOpen(false); }}
            >
                Main
            </div>
            <div
                className={styles.typeOption}
                onClick={() => { onChange('test'); setIsOpen(false); }}
            >
                Test
            </div>
        </div>
    );

    return (
        <div className={styles.typeSelectorContainer} ref={containerRef} style={style}>
            <div className={styles.portfolioTypeSmallSelect} onClick={handleToggle}>
                {value === 'main' ? 'Main' : 'Test'}
                <ChevronDown size={14} style={{ marginLeft: '4px', opacity: 0.7 }} />
            </div>
            {isOpen && createPortal(
                isMobile ? (
                    <div className={styles.mobileModalOverlay} onClick={() => setIsOpen(false)}>
                        <div className={styles.mobileModalContent} onClick={(e) => e.stopPropagation()}>
                            <div className={styles.typeSelectorMenu} style={{ position: 'relative', top: 'auto', left: 'auto', transform: 'none', width: '100%', marginBottom: 0 }}>
                                <div className={styles.typeOption} onClick={() => { onChange('main'); setIsOpen(false); }}>Main</div>
                                <div className={styles.typeOption} onClick={() => { onChange('test'); setIsOpen(false); }}>Test</div>
                            </div>
                        </div>
                    </div>
                ) : menuContent,
                document.body
            )}
        </div>
    );
};

const PortfolioPage = () => {
    const navigate = useNavigate();
    const { currentUser, logout } = useAuth();
    const { theme } = useTheme();
    // Mobile Menu State
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuOpenHoldings, setMenuOpenHoldings] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    // Mobile Title State (Breaks at 600px to match TopNav CSS)
    const [isMobileTitle, setIsMobileTitle] = useState(window.innerWidth < 600);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
            setIsMobileTitle(window.innerWidth < 600);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    // Test Portfolio Management
    const [currentPortfolioId, setCurrentPortfolioId] = useState(() => {
        return localStorage.getItem('selectedPortfolioId') || null;
    });

    // Save selection to localStorage
    useEffect(() => {
        if (currentPortfolioId) {
            localStorage.setItem('selectedPortfolioId', currentPortfolioId);
        }
    }, [currentPortfolioId]);
    const {
        portfolio,
        portfolioList,
        analysis,
        loading: portfolioLoading,
        addToPortfolio,
        removeFromPortfolio,
        updatePortfolioItem,
        renamePortfolio,
        createPortfolio,
        deletePortfolio,
        clearAnalysis,
        copyItemsFromPortfolio,
        clearPortfolio
    } = usePortfolio(currentPortfolioId);

    // Initial load: pick the first portfolio if nothing is selected or stored ID is invalid
    useEffect(() => {
        if (!portfolioLoading && portfolioList.length > 0) {
            const isValidStored = portfolioList.some(p => p.id === currentPortfolioId);
            if (!currentPortfolioId || !isValidStored) {
                setCurrentPortfolioId(portfolioList[0].id);
            }
        }
    }, [portfolioLoading, portfolioList, currentPortfolioId]);

    // New Creation State
    const [isCreating, setIsCreating] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [newPortfolioName, setNewPortfolioName] = useState('');
    const [newPortfolioType, setNewPortfolioType] = useState('test');
    const [renameValue, setRenameValue] = useState('');
    const [renamingId, setRenamingId] = useState(null);

    // Copy Modal State
    const [showCopyModal, setShowCopyModal] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);
    const [sourceItems, setSourceItems] = useState([]);
    const [isSourceLoading, setIsSourceLoading] = useState(false);
    const [copySourceId, setCopySourceId] = useState('main');
    const [selectedCopyItems, setSelectedCopyItems] = useState([]);

    // Delete Modal States (Stock & Clear All)
    const [showDeleteStockModal, setShowDeleteStockModal] = useState(false);
    const [stockToDelete, setStockToDelete] = useState(null);
    const [showClearPortfolioModal, setShowClearPortfolioModal] = useState(false);

    const handleClearAll = () => {
        if (!portfolio || portfolio.length === 0) return;
        setShowClearPortfolioModal(true);
    };

    const handleConfirmClearAll = async () => {
        await clearPortfolio();
        setShowClearPortfolioModal(false);
    };

    const handleDeleteStockClick = (item) => {
        setStockToDelete(item);
        setShowDeleteStockModal(true);
    };

    const handleConfirmDeleteStock = async () => {
        if (stockToDelete) {
            await removeFromPortfolio(stockToDelete.id);
            setStockToDelete(null);
            setShowDeleteStockModal(false);
        }
    };

    const handleCopyClick = async () => {
        setShowCopyModal(true);
        const otherPortfolios = portfolioList.filter(p => p.id !== currentPortfolioId);
        if (otherPortfolios.length > 0) {
            handleSourceChange(otherPortfolios[0].id);
        }
    };

    const handleSourceChange = async (sourceId) => {
        setCopySourceId(sourceId);
        setIsSourceLoading(true);
        setSelectedCopyItems([]);

        const selectedSource = portfolioList.find(p => p.id === sourceId);
        setSourceItems(selectedSource?.portfolio || []);
        setIsSourceLoading(false);
    };

    const handleCopySubmit = async () => {
        const itemsToCopy = sourceItems.filter(item => selectedCopyItems.includes(item.id));
        await copyItemsFromPortfolio(currentPortfolioId, itemsToCopy);
        setShowCopyModal(false);
    };


    const handleCreatePortfolio = async (name, type) => {
        const newId = await createPortfolio(name, type);
        if (newId) {
            setCurrentPortfolioId(newId);
        }
    };

    const handleRenamePortfolioSubmit = async (newName) => {
        const trimmedName = newName.trim();
        const idToRename = renamingId || currentPortfolioId;

        if (!trimmedName) {
            setIsRenaming(false);
            setRenamingId(null);
            return;
        }

        try {
            await renamePortfolio(idToRename, trimmedName, newPortfolioType);
            setIsRenaming(false);
            setRenamingId(null);
            setNewPortfolioType('test'); // Reset default
        } catch (error) {
            alert("Failed to rename portfolio. Please try again.");
        }
    };

    // Portfolio Selector State (Controlled)
    const [portfolioSelectorOpen, setPortfolioSelectorOpen] = useState(false);

    // Delete Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [portfolioToDelete, setPortfolioToDelete] = useState(null);
    const [shouldReopenSelector, setShouldReopenSelector] = useState(false);

    const handleDeletePortfolio = (id, fromDropdown = false) => {
        const portfolioName = portfolioList.find(p => p.id === id)?.name;
        setPortfolioToDelete({ id, name: portfolioName });
        setShouldReopenSelector(fromDropdown);
        setPortfolioSelectorOpen(false); // Close selector when opening modal
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async () => {
        if (!portfolioToDelete) return;
        await deletePortfolio(portfolioToDelete.id);
        if (currentPortfolioId === portfolioToDelete.id) {
            setCurrentPortfolioId(null);
        }
        setShowDeleteModal(false);
        setPortfolioToDelete(null);

        if (shouldReopenSelector) {
            setPortfolioSelectorOpen(true);
        }
        setShouldReopenSelector(false);
    };

    const [liveData, setLiveData] = useState({});
    const [isLoadingData, setIsLoadingData] = useState(false);

    // UI State
    const [currency, setCurrency] = useState('USD');
    const [hiddenColumns, setHiddenColumns] = useState([]);

    // Expanded Tickers for grouped view
    const [expandedTickers, setExpandedTickers] = useState({});

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showWatchlist, setShowWatchlist] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showColumnModal, setShowColumnModal] = useState(false);

    // Add Stock Form
    const [newTicker, setNewTicker] = useState('');
    const [newShares, setNewShares] = useState('');
    const [newCost, setNewCost] = useState('');
    const [newDate, setNewDate] = useState('');
    const [newCategory, setNewCategory] = useState('Core');
    const [addError, setAddError] = useState('');

    // Editing
    const [editingId, setEditingId] = useState(null);
    const [editValues, setEditValues] = useState({});

    // Search
    const [searchTicker, setSearchTicker] = useState('');

    // State for live currency rate
    const [conversionRate, setConversionRate] = useState(1);

    // State for TWR
    const [twrData, setTwrData] = useState(null);

    // Comparison State
    const [comparisonTicker, setComparisonTicker] = useState('');
    const [comparisonStocks, setComparisonStocks] = useState([]);
    const [error, setError] = useState(null);
    const [showErrorModal, setShowErrorModal] = useState(false);

    // AI Analysis State
    const [analyzing, setAnalyzing] = useState(false);

    // Reset analysis and TWR when portfolio changes
    const [userClearedAnalysis, setUserClearedAnalysis] = useState(false);

    useEffect(() => {
        // Clear local UI states when portfolio changes
        setUserClearedAnalysis(false);
        setTwrData(null);
        setComparisonStocks([]);
        setLiveData({}); // Clear old live data
        setIsLoadingData(false);
    }, [currentPortfolioId]);

    // Screen Size Logic
    const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < 1280);

    useEffect(() => {
        const handleResize = () => setIsSmallScreen(window.innerWidth < 1280);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const chartData = useMemo(() => twrData?.chart_data || [], [twrData]);


    // Fetch TWR
    useEffect(() => {
        if (portfolio && portfolio.length > 0) {
            // console.log("Raw API Portfolio:", portfolio);

            const normalizedItems = portfolio
                .map(item => {
                    // Fallback for date: purchaseDate -> date -> createdAt -> Today
                    let pDate = item.purchaseDate || item.date || item.createdAt || new Date().toISOString().split('T')[0];
                    // Ensure YYYY-MM-DD
                    if (pDate.includes('T')) pDate = pDate.split('T')[0];

                    return {
                        ...item,
                        totalCost: item.totalCost !== undefined ? Number(item.totalCost) : (item.cost !== undefined ? Number(item.cost) : 0),
                        purchaseDate: pDate // Backend expects this alias
                    };
                })
                .filter(item => item.totalCost > 0 && item.purchaseDate);

            // console.log("Normalized TWR Items:", normalizedItems);

            if (normalizedItems.length === 0) {
                console.warn("TWR: No valid items found after normalization (Check Total Cost > 0)");
                setTwrData(null);
                return;
            }

            calculatePortfolioTWR(normalizedItems, currentUser?.uid).then(data => {
                if (data) {
                    setTwrData(data);
                } else {
                    setTwrData(null);
                }
            });
        } else {
            setTwrData(null);
        }
    }, [portfolio, currentUser]);

    const currencySymbol = currency === 'EUR' ? '€' : (currency === 'GBP' ? '£' : (currency === 'SGD' ? 'S$' : '$'));

    // Fetch Currency Rate when currency changes
    useEffect(() => {
        const getRate = async () => {
            if (currency === 'USD') {
                setConversionRate(1);
                return;
            }
            try {
                const data = await fetchCurrencyRate(currency);
                if (data && data.rate) {
                    console.log(`Live Rate for ${currency}: ${data.rate}`);
                    setConversionRate(data.rate);
                }
            } catch (error) {
                console.error("Failed to fetch rate", error);
            }
        };

        getRate();
    }, [currency]);

    const currentRate = conversionRate; // Use state instead of hardcoded map

    const ALL_COLUMNS = [
        { key: 'ticker', label: 'Ticker' },
        { key: 'category', label: 'Category' },
        { key: 'sector', label: 'Sector' },
        { key: 'beta', label: 'Beta' },
        { key: 'initAmt', label: 'Cost Basis' },
        { key: 'invDate', label: 'Cost Basis Date' },
        { key: 'price', label: 'Price' },
        { key: 'position', label: 'Position' },
        { key: 'totalValue', label: 'Total Value' },
        { key: 'weight', label: 'Weight %' },
        { key: 'return', label: twrData ? 'Return % (TWR)' : 'Return %' },
        { key: 'growth', label: '5Y Growth' }
    ];

    // Track fetched tickers to avoid duplicate requests in strict mode or rapid re-renders
    const fetchedTickersRef = React.useRef(new Set());

    // Fetch Live Data
    const fetchAllData = useCallback(async (force = false) => {
        if (portfolio.length === 0) {
            setIsLoadingData(false);
            return;
        }

        const uniqueTickers = [...new Set(portfolio.map(i => i.ticker))];
        // If forcing, ignore what we have. If not, only fetch missing.
        const tickersToFetch = force
            ? uniqueTickers
            : uniqueTickers.filter(t => !liveData[t] && !fetchedTickersRef.current.has(t));

        if (tickersToFetch.length === 0) {
            if (isLoadingData && uniqueTickers.every(t => liveData[t])) setIsLoadingData(false);
            return;
        }

        if (!force && isLoadingData) return; // Don't run multiple non-forced loads

        setIsLoadingData(true);

        tickersToFetch.forEach(t => fetchedTickersRef.current.add(t));

        await Promise.all(tickersToFetch.map(async (ticker) => {
            try {
                // Pass 'force' to bypass the 1-minute caching if user clicked Refresh
                const data = await fetchStockData(ticker, force);
                const price = data.overview?.price || 0;
                const beta = data.overview?.beta || 1;
                const sector = data.overview?.sector || 'Unknown';

                // Re-calculate derived metrics
                let pegRatio = data.overview?.pegRatio;
                // Fallback calculation for PEG if missing
                if (!pegRatio) {
                    const pe = data.overview?.peRatio;
                    let g = 0;
                    if (data.valuation?.assumptions?.["Growth Rate (Yr 1-5)"]) {
                        g = parseFloat(data.valuation.assumptions["Growth Rate (Yr 1-5)"].replace('%', ''));
                    } else if (data.growth?.estimates) {
                        const est5y = data.growth.estimates.find(e => e.Period === 'Next 5 Years (per annum)' || e.period === 'Next 5 Years (per annum)');
                        if (est5y) g = parseFloat(String(est5y['Growth Estimates'] || est5y.stockTrend || '0').replace('%', ''));
                    }
                    if (pe && g > 0) pegRatio = pe / g;
                }

                const totalCash = data.balance_sheet?.totalCash || 0;
                const totalDebt = data.balance_sheet?.totalDebt || 0;

                let growth = 0;
                if (data.valuation?.assumptions?.["Growth Rate (Yr 1-5)"]) {
                    growth = parseFloat(data.valuation.assumptions["Growth Rate (Yr 1-5)"].replace('%', ''));
                } else {
                    const peRatio = data.overview?.peRatio;
                    let pePegGrowth = null;
                    if (peRatio && pegRatio) pePegGrowth = (peRatio / pegRatio);
                    let est1y = null;
                    if (data.growth?.estimates) {
                        const est = data.growth.estimates.find(e => e.period === '+1y');
                        if (est && est.stockTrend) est1y = parseFloat(est.stockTrend) * 100;
                    }
                    if (pePegGrowth !== null && est1y !== null) growth = Math.min(pePegGrowth, est1y);
                    else if (pePegGrowth !== null) growth = pePegGrowth;
                    else if (est1y !== null) growth = est1y;
                    else {
                        if (data.growth?.estimates) {
                            const est5y = data.growth.estimates.find(e => e.Period === 'Next 5 Years (per annum)' || e.period === 'Next 5 Years (per annum)');
                            if (est5y) growth = parseFloat(String(est5y['Growth Estimates'] || est5y.stockTrend || '0').replace('%', ''));
                        }
                    }
                }

                setLiveData(prev => ({
                    ...prev,
                    [ticker]: { price, beta, sector, growth, pegRatio, totalCash, totalDebt }
                }));

            } catch (e) {
                console.error(`Failed to fetch data for ${ticker}`, e);
                setLiveData(prev => ({
                    ...prev,
                    [ticker]: {
                        price: 0,
                        beta: 1,
                        sector: 'Error',
                        growth: 0
                    }
                }));
            }
        }));

        setIsLoadingData(false);
    }, [portfolio, liveData, isLoadingData]); // Added isLoadingData to dependencies

    // Initial Load
    useEffect(() => {
        fetchAllData(false);
    }, [fetchAllData]);

    // --- Processing & Grouping ---
    const { displayList, totalValue, totalCost, hhi, weightedBeta, weightedGrowth, weightedPeg, weightedLiquidity, totalPerformance, isTotalTWR, sectorData, categoryData, allocationAlerts, healthScore, healthCriteria, isCriticalRisk } = useMemo(() => {
        let tVal = 0;
        let tCost = 0;

        // 1. Process individual items first
        const items = portfolio.map(item => {
            const data = liveData[item.ticker] || { price: 0, beta: 1, sector: 'Unknown', growth: 0, pegRatio: 0, totalCash: 0, totalDebt: 0 };
            const currentPrice = (data.price || 0) * currentRate;
            const shares = parseFloat(item.shares) || 0;
            const totalPrincipal = (parseFloat(item.totalCost) || 0) * currentRate;
            const currentValue = currentPrice * shares;

            const performance = totalPrincipal > 0 ? ((currentValue - totalPrincipal) / totalPrincipal) * 100 : 0;

            return {
                ...item,
                ...data,
                price: currentPrice,
                currentValue,
                principal: totalPrincipal,
                performance
            };
        });

        // 2. Group by Ticker
        const groups = {};
        items.forEach(item => {
            if (!groups[item.ticker]) {
                groups[item.ticker] = {
                    ticker: item.ticker,
                    category: item.category, // Use first item's category or logic to mix? Usually same stock = same category
                    sector: item.sector,
                    beta: item.beta,
                    growth: item.growth,
                    pegRatio: item.pegRatio,
                    totalCash: item.totalCash,
                    totalDebt: item.totalDebt,
                    price: item.price,
                    shares: 0,
                    principal: 0,
                    currentValue: 0,
                    items: []
                };
            }
            const g = groups[item.ticker];
            g.items.push(item);
            g.shares += item.shares;
            g.principal += item.principal;
            g.currentValue += item.currentValue;
            // Update stats
            tVal += item.currentValue;
            tCost += item.principal;
        });

        // 3. Finalize Groups Stats
        let h = 0, wb = 0, wg = 0, wPeg = 0, wLiq = 0;
        const groupList = Object.values(groups).map(g => {
            // Priority: TWR > Simple Return
            let performance = g.principal > 0 ? ((g.currentValue - g.principal) / g.principal) * 100 : 0;
            let isTWR = false;

            if (twrData && twrData.tickers && twrData.tickers[g.ticker] !== undefined) {
                performance = twrData.tickers[g.ticker];
                isTWR = true;
            }

            const weight = tVal > 0 ? (g.currentValue / tVal) : 0;

            // Add to portfolio stats
            h += (weight * weight);
            wb += (g.beta * weight);
            wg += (g.growth * weight);

            // Weighted PEG
            const peg = g.pegRatio || 0;
            if (peg > 0) wPeg += (peg * weight);

            // Weighted Cash-to-Debt
            let liqRatio = 2.0; // Default if no debt (safe/high liquidity)
            if (g.totalDebt && g.totalDebt > 0) {
                liqRatio = g.totalCash / g.totalDebt;
            } else if (g.totalCash === 0 && g.totalDebt === 0) {
                liqRatio = 2.0;
            }
            wLiq += (liqRatio * weight);

            // Calculate weightPercent for each individual lot (sub-item)
            g.items.forEach(sub => {
                sub.weightPercent = tVal > 0 ? (sub.currentValue / tVal) * 100 : 0;
            });

            return {
                ...g,
                // Critical Fix: If it's a single item, we need the ID for editing to work correctly.
                // For groups, we give a distinct ID so it doesn't match 'null' (initial editingId)
                id: g.items.length === 1 ? g.items[0].id : `GROUP_${g.ticker}`,
                weight,
                weightPercent: weight * 100,
                performance,
                performanceLabel: isTWR ? 'TWR' : 'Return',
                purchaseDate: g.items.length > 1 ? 'Varies' : g.items[0].purchaseDate
            };
        });

        // Sort Groups
        groupList.sort((a, b) => a.ticker.localeCompare(b.ticker));
        const keys = groupList.map(g => g.ticker);

        // Final list for display (filtered by search)
        const filteredList = groupList.filter(g =>
            g.ticker.toLowerCase().includes(searchTicker.toLowerCase())
        );

        let tPerf = tCost > 0 ? ((tVal - tCost) / tCost) * 100 : 0;
        let isTotalTWR = false;
        if (twrData && twrData.total_twr !== undefined) {
            tPerf = twrData.total_twr;
            isTotalTWR = true;
        }

        const results = {
            displayList: filteredList,
            totalValue: tVal,
            totalCost: tCost,
            hhi: h,
            weightedBeta: wb,
            weightedGrowth: wg,
            weightedPeg: wPeg,
            weightedLiquidity: wLiq,
            totalPerformance: tPerf,
            isTotalTWR,
            sectorData: [],
            categoryData: [],
            allocationAlerts: [],

            healthScore: 100
        };

        if (tVal === 0) return results;

        // --- NEW HEALTH SCORING LOGIC (100 pts max) ---
        let totalScore = 0;
        const criteria = [];

        // Helper to add criteria
        const addCriteria = (name, points, maxPts, valueText) => {
            totalScore += points;
            criteria.push({
                name: name,
                status: points === maxPts ? "Pass" : (points > 0 ? "Warning" : "Fail"),
                value: `${points}/${maxPts} (${valueText})`
            });
        };

        // 1. HHI Concentration (15 pts)
        // <0.10 (15), 0.10-0.15 (7), >0.15 (0)
        let hhiPts = 0;
        let hhiTxt = "";
        if (h < 0.10) { hhiPts = 15; hhiTxt = "Elite"; }
        else if (h <= 0.15) { hhiPts = 7; hhiTxt = "Standard"; }
        else { hhiPts = 0; hhiTxt = "Risky"; }
        addCriteria("HHI Concentration", hhiPts, 15, hhiTxt);

        // 2. Category Allocation (35 pts)
        // Aggregating: Speculative (10), Growth (5), Core (5), Compounder (5), Defensive (5), Balance (5)
        let categoryPts = 0;
        const catDetails = [];

        // Speculative (10)
        // Speculative (10)
        // CAT_TARGETS defined globally
        const catMap = {};
        groupList.forEach(g => {
            let c = g.category || 'Core';
            if (c === 'Compounders') c = 'Compounder';
            catMap[c] = (catMap[c] || 0) + g.currentValue;
        });
        results.categoryData = Object.entries(catMap).map(([name, value]) => ({ name, value }));

        const getCatPct = (cat) => tVal > 0 ? (catMap[cat] || 0) / tVal * 100 : 0;

        const specPct = getCatPct('Speculative');
        let specPts = 10;
        if (specPct > 10) {
            const over = specPct - 10;
            const deduction = Math.ceil(over / 2) * 5;
            specPts = Math.max(0, 10 - deduction);
        }
        categoryPts += specPts;

        // Ranges (5 each)
        const checkRange = (cat, min, max) => {
            const pct = getCatPct(cat);
            const hit = pct >= min && pct <= max;
            const pts = hit ? 5 : 0;
            categoryPts += pts;
        };
        checkRange("Growth", 30, 40);
        checkRange("Core", 20, 30);
        checkRange("Compounder", 20, 25);
        checkRange("Defensive", 15, 20);

        // Balance Check (5)
        const balancePts = tVal > 0 ? 5 : 0;
        categoryPts += balancePts;

        addCriteria("Category Allocation", categoryPts, 35, categoryPts === 35 ? "Perfect" : `${categoryPts}/35`);

        // 3. Portfolio Beta (10 pts)
        // 0.8-1.2 (10), 0.7-1.3 (3)
        let betaPts = 0;
        if (wb >= 0.8 && wb <= 1.2) betaPts = 10;
        else if ((wb >= 0.7 && wb <= 1.3)) betaPts = 3;
        addCriteria("Portfolio Beta", betaPts, 10, wb.toFixed(2));

        // 4. Sector Allocation (10 pts) (Renamed from Sector Caps)
        // 10 pts if all valid, -2 per breach
        // 4. Sector Allocation (10 pts) (Renamed from Sector Caps)
        // 10 pts if all valid, -2 per breach
        // SECTOR_LIMITS defined globally
        const secMap = {};
        groupList.forEach(g => secMap[g.sector] = (secMap[g.sector] || 0) + g.currentValue);
        results.sectorData = Object.entries(secMap).map(([name, value]) => ({ name, value }));

        let breaches = 0;
        results.sectorData.forEach(s => {
            const pct = (s.value / tVal) * 100;
            const limit = SECTOR_LIMITS[s.name] || SECTOR_LIMITS.default;
            if (pct > limit) breaches++;
        });
        const sectorPts = Math.max(0, 10 - (breaches * 2));
        addCriteria("Sector Allocation", sectorPts, 10, breaches === 0 ? "Pass" : `${breaches} Breaches`);

        // 5. Portfolio Est. 5Y Growth (10 pts) (Renamed)
        // >10% (10), 7-10% (5)
        let growPts = 0;
        if (wg > 10) growPts = 10;
        else if (wg >= 7) growPts = 5;
        addCriteria("Portfolio Est. 5Y Growth", growPts, 10, `${wg.toFixed(1)}%`);

        // 6. Portfolio PEG Ratio (10 pts)
        // <1.5 (10), 1.5-2.0 (5), >2.0 (0)
        let pegPts = 0;
        if (wPeg < 1.5) pegPts = 10;
        else if (wPeg <= 2.0) pegPts = 5;
        addCriteria("Portfolio PEG Ratio", pegPts, 10, wPeg.toFixed(2));

        // 7. Portfolio Debt-to-Cash Ratio (10 pts)
        // >0.8 (10), 0.4-0.8 (5), <0.4 (0)
        let liqPts = 0;
        if (wLiq > 0.8) liqPts = 10;
        else if (wLiq >= 0.4) liqPts = 5;
        addCriteria("Portfolio Debt-to-Cash Ratio", liqPts, 10, wLiq.toFixed(2));

        results.healthScore = Math.round(totalScore);
        results.healthCriteria = criteria;
        results.allocationAlerts = [];
        results.isCriticalRisk = h > 0.15 || specPct > 15;

        return results;

    }, [portfolio, liveData, currentRate, searchTicker, twrData]);

    const handleAnalyzePortfolio = useCallback(async (force = false) => {
        console.log("Analyzing portfolio:", { count: portfolio.length, force, currentPortfolioId });
        if (portfolio.length === 0 || !currentPortfolioId) {
            console.log("Analysis skipped: portfolio empty or no ID", { count: portfolio.length, currentPortfolioId });
            return;
        }
        setAnalyzing(true);
        try {
            const metrics = {
                weightedBeta: weightedBeta.toFixed(2),
                weightedGrowth: weightedGrowth.toFixed(2),
                weightedPeg: weightedPeg.toFixed(2)
            };
            const result = await analyzePortfolio(portfolio, metrics, currentUser?.uid, force, currentPortfolioId);
            if (result && result.analysis) {
                // The hook will update the analysis state automatically via Firestore subscription
            }
        } catch (error) {
            console.error("Analysis fetch failed:", error);
        } finally {
            setAnalyzing(false);
        }
    }, [portfolio, weightedBeta, weightedGrowth, weightedPeg, currentUser, currentPortfolioId]);

    // Auto-fetch analysis if we have data but no analysis yet
    // REMOVED: User requested no auto-fetch of analysis when adding stocks or changing portfolios. Each portfolio should start empty until "Ask Gemini" is clicked.
    /*
    useEffect(() => {
        if (portfolio.length > 0 && !analysis && !analyzing && currentUser && !userClearedAnalysis) {
            handleAnalyzePortfolio();
        }
    }, [portfolio.length, analysis, analyzing, currentUser, handleAnalyzePortfolio, userClearedAnalysis]);
    */



    // --- Handlers ---
    const handleAddStock = () => {
        if (!currentPortfolioId) { setAddError("Please select or create a portfolio first"); return; }
        if (!newTicker || !newShares || !newCost) { setAddError("Please fill all required fields"); return; }
        const costInUSD = parseFloat(newCost) / currentRate;
        addToPortfolio({
            ticker: newTicker.toUpperCase(),
            shares: parseFloat(newShares),
            totalCost: costInUSD,
            purchaseDate: newDate,
            category: newCategory
        });
        setShowAddModal(false); setNewTicker(''); setNewShares(''); setNewCost(''); setNewDate(''); setAddError('');
    };

    const startEdit = (item) => {
        setEditingId(item.id);
        setEditValues({
            shares: item.shares,
            totalCost: item.principal,
            purchaseDate: item.purchaseDate,
            category: item.category
        });
    };

    const saveEdit = (id) => {
        const costUSD = parseFloat(editValues.totalCost) / currentRate;
        updatePortfolioItem(id, {
            shares: parseFloat(editValues.shares),
            totalCost: costUSD,
            purchaseDate: editValues.purchaseDate,
            category: editValues.category
        });
        setEditingId(null);
    };

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/');
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };

    const toggleExpand = (ticker) => {
        setExpandedTickers(prev => ({ ...prev, [ticker]: !prev[ticker] }));
    };

    const handleSearch = (e) => {
        if (e) e.preventDefault();
        const t = searchTicker.trim().toUpperCase();
        if (t) navigate(`/analysis?ticker=${t}`);
    };

    // Load User Settings (Hidden Columns)
    useEffect(() => {
        if (currentUser?.uid) {
            fetchUserSettings(currentUser.uid).then(settings => {
                if (settings && settings.hiddenColumns) {
                    setHiddenColumns(settings.hiddenColumns);
                }
            });
        }
    }, [currentUser]);

    const toggleColumn = (key) => {
        setHiddenColumns(prev => {
            const newState = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
            // Save to backend
            if (currentUser?.uid) {
                saveUserSettings(currentUser.uid, { hiddenColumns: newState });
            }
            return newState;
        });
    };

    const actionGroupContent = (
        <TopNavActions
            searchTicker={searchTicker}
            setSearchTicker={setSearchTicker}
            handleSearch={handleSearch}
            currency={currency}
            setCurrency={setCurrency}
            setShowWatchlist={setShowWatchlist}
            setShowProfileModal={setShowProfileModal}
            handleLogout={handleLogout}
        />
    );

    // Tracks ALL portfolio UI states: { [portfolioId]: { allocation: bool, ... } }
    const [portfolioUIStates, setPortfolioUIStates] = useState({});

    // The Active UI State (derived/synced)
    const [openCards, setOpenCards] = useState({
        allocation: true,
        ai: true,
        holdings: true,
        summary: true
    });

    // 1. Load All Preferences on User Change
    useEffect(() => {
        const loadPreferences = async () => {
            if (currentUser?.uid) {
                try {
                    const settings = await fetchUserSettings(currentUser.uid);
                    if (settings && settings.portfolioUIStates) {
                        setPortfolioUIStates(settings.portfolioUIStates);
                    }
                } catch (error) {
                    console.error("Failed to load user preferences:", error);
                }
            }
        };
        loadPreferences();
    }, [currentUser]);

    // 2. Sync Active State when Portfolio ID Changes OR Loaded Data Arrives
    useEffect(() => {
        if (currentPortfolioId) {
            const savedState = portfolioUIStates[currentPortfolioId];
            if (savedState) {
                setOpenCards(prev => {
                    // Optimization: Only update if different
                    if (JSON.stringify(prev) === JSON.stringify(savedState)) return prev;
                    return savedState;
                });
            } else {
                // Default state if no saved state for this specific portfolio
                setOpenCards({
                    allocation: true,
                    ai: true,
                    holdings: true,
                    summary: true
                });
            }
        }
    }, [currentPortfolioId, portfolioUIStates]);

    const toggleCard = (key) => {
        // 1. Calculate new single state
        const newCardsState = { ...openCards, [key]: !openCards[key] };

        // 2. Update Local Active State (Immediate UI Feedback)
        setOpenCards(newCardsState);

        // 3. Update Global Cache
        const newFullState = {
            ...portfolioUIStates,
            [currentPortfolioId]: newCardsState
        };
        setPortfolioUIStates(newFullState);

        // 4. Persist to DB (Fire & Forget)
        if (currentUser?.uid && currentPortfolioId) {
            saveUserSettings(currentUser.uid, { portfolioUIStates: newFullState }).catch(err =>
                console.error("Failed to save card preference:", err)
            );
        }
    };

    const logoContainerContent = (
        <TopNavLogo customTitle={isMobileTitle ? null : "My Portfolio"} />
    );

    const backButtonContent = (<div onClick={() => navigate('/')} className={styles.backButton}><ArrowLeft size={20} /></div>);
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];

    // Custom "Spider" Label
    const renderCustomLabel = (props) => {
        const { cx, cy, midAngle, innerRadius, outerRadius, percent, name } = props;
        if (percent < 0.02) return null; // Hide small slices

        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        // Points for the polyline
        const sin = Math.sin(-RADIAN * midAngle);
        const cos = Math.cos(-RADIAN * midAngle);
        const sx = cx + (outerRadius + 5) * cos;
        const sy = cy + (outerRadius + 5) * sin;
        const mx = cx + (outerRadius + 15) * cos;
        const my = cy + (outerRadius + 15) * sin;
        const ex = mx + (cos >= 0 ? 1 : -1) * 10;
        const ey = my;
        const textAnchor = cos >= 0 ? 'start' : 'end';

        return (
            <g>
                <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={props.fill} fill="none" />
                <circle cx={ex} cy={ey} r={2} fill={props.fill} stroke="none" />
                <text x={ex + (cos >= 0 ? 1 : -1) * 6} y={ey} textAnchor={textAnchor} fill="#999" fontSize={11}>
                    {`${name} (${(percent * 100).toFixed(1)}%)`}
                </text>
            </g>
        );
    };
    const betaStatus = ((b) => { if (b < 0.8) return { label: 'Defensive', color: '#10B981' }; if (b <= 1.2) return { label: 'Balanced', color: '#F59E0B' }; return { label: 'Aggressive', color: '#EF4444' }; })(weightedBeta);
    const healthStatus = ((s) => { if (s >= 80) return { label: 'Excellent', color: '#10B981' }; if (s >= 60) return { label: 'Good', color: '#F59E0B' }; return { label: 'Needs Attention', color: '#EF4444' }; })(healthScore);
    const growthStatus = ((g) => { if (g < 10) return { label: 'Low', color: '#EF4444' }; if (g <= 15) return { label: 'Healthy', color: '#F59E0B' }; return { label: 'Aggressive', color: '#10B981' }; })(weightedGrowth);

    const renderRow = (item, isSubItem = false) => {
        if (!item) return null;
        const isEditing = editingId === item.id;
        const isGroup = !isSubItem && item.items && item.items.length > 1;
        const isExpanded = expandedTickers[item.ticker];

        return (
            <React.Fragment key={isSubItem ? item.id : item.ticker}>
                <tr className={isSubItem ? styles.subRow : ''} style={isSubItem ? { background: 'rgba(255,255,255,0.02)' } : {}}>
                    {!hiddenColumns.includes('ticker') && (
                        <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                                {isGroup && (
                                    <button onClick={() => toggleExpand(item.ticker)} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: 0 }}>
                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </button>
                                )}
                                {isSubItem ? '' : <span className={styles.tickerApi} onClick={() => navigate(`/analysis?ticker=${item.ticker}`)}>{item.ticker}</span>}
                            </div>
                        </td>
                    )}

                    {!hiddenColumns.includes('category') && (
                        <td style={{ minWidth: '120px' }}>
                            {isEditing ? (
                                <CustomSelect
                                    value={editValues.category}
                                    onChange={(val) => setEditValues({ ...editValues, category: val })}
                                    options={['Core', 'Growth', 'Compounder', 'Defensive', 'Speculative']}
                                    triggerClassName={styles.editableDateTrigger}
                                    isMobile={isMobile}
                                    portalTarget={document.body}
                                    style={{ color: 'var(--text-primary)', WebkitTextFillColor: 'var(--text-primary)' }}
                                />
                            ) : <span className={styles.categoryBadge}>{item.category}</span>}
                        </td>
                    )}

                    {!hiddenColumns.includes('sector') && <td>{item.sector}</td>}
                    {!hiddenColumns.includes('beta') && <td>{(item.beta || 0).toFixed(2)}</td>}

                    {!hiddenColumns.includes('initAmt') && (
                        <td>
                            {isEditing ? (
                                <input type="number" className={styles.pInput} value={editValues.totalCost} onChange={(e) => setEditValues({ ...editValues, totalCost: e.target.value })} />
                            ) : `${currencySymbol}${item.principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </td>
                    )}

                    {!hiddenColumns.includes('invDate') && (
                        <td>
                            {isEditing ? (
                                <CustomDatePicker
                                    value={editValues.purchaseDate}
                                    onChange={(val) => setEditValues({ ...editValues, purchaseDate: val })}
                                    triggerClassName={styles.editableDateTrigger}
                                    isMobile={isMobile}
                                    style={{ color: 'var(--text-primary)', WebkitTextFillColor: 'var(--text-primary)' }}
                                />
                            ) : (item.purchaseDate || 'N/A')}
                        </td>
                    )}

                    {!hiddenColumns.includes('price') && <td className={styles.livePrice}>${(item.price || 0).toFixed(2)}</td>}

                    {!hiddenColumns.includes('position') && (
                        <td>
                            {isEditing ? (
                                <input type="number" className={styles.pInput} value={editValues.shares} onChange={(e) => setEditValues({ ...editValues, shares: e.target.value })} />
                            ) : item.shares}
                        </td>
                    )}

                    {!hiddenColumns.includes('totalValue') && <td className={styles.boldValue}>{currencySymbol}{item.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>}

                    {!hiddenColumns.includes('weight') && <td>{(item.weightPercent || 0).toFixed(2)}%</td>}

                    {!hiddenColumns.includes('return') && (
                        <td className={(item.performance || 0) >= 0 ? styles.pos : styles.neg}>
                            {(item.performance || 0) >= 0 ? '+' : ''}{(item.performance || 0).toFixed(2)}%
                        </td>
                    )}

                    {!hiddenColumns.includes('growth') && (
                        <td className={(item.growth || 0) > 0 ? styles.pos : ((item.growth || 0) < 0 ? styles.neg : '')}>
                            {(item.growth || 0) !== 0 ? `${(item.growth || 0) > 0 ? '+' : ''}${(item.growth || 0).toFixed(2)}%` : 'N/A'}
                        </td>
                    )}

                    <td className={styles.actions}>
                        {isSubItem || !isGroup ? (
                            isEditing ? (
                                <>
                                    <button onClick={() => saveEdit(item.id)} className={styles.iconBtn}><Check size={18} color="#10B981" /></button>
                                    <button onClick={() => setEditingId(null)} className={styles.iconBtn}><X size={18} color="#EF4444" /></button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => startEdit(item)} className={styles.iconBtn}><Edit2 size={18} /></button>
                                    <button onClick={() => handleDeleteStockClick(item)} className={styles.iconBtn}><Trash2 size={18} color="#EF4444" /></button>
                                </>
                            )
                        ) : null}
                    </td>
                </tr>
                {isExpanded && isGroup && item.items.map(sub => renderRow(sub, true))}
            </React.Fragment>
        );
    };

    const ChartLegend = () => (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10B981' }}></div>
                <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Ideal</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#F59E0B' }}></div>
                <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Too Low</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#EF4444' }}></div>
                <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Too High</span>
            </div>
        </div>
    );

    // Comparison Logic
    const handleAddComparison = async () => {
        if (!comparisonTicker) return;
        try {
            // 1. Get Portfolio Start Date from chartData
            if (!chartData || chartData.length === 0) {
                setError('No portfolio data available to compare against.');
                setShowErrorModal(true);
                return;
            }
            const startDateStr = chartData[0].date;
            const startDate = new Date(startDateStr);

            // 2. Fetch History for Ticker
            const apiUrl = import.meta.env.VITE_API_URL || '/api';
            const response = await fetch(`${apiUrl}/stock/history/${comparisonTicker}?period=max`);
            if (!response.ok) throw new Error('Failed to fetch stock history');
            const historyData = await response.json();

            if (!historyData || historyData.length === 0) {
                setError('No data found for this ticker.');
                setShowErrorModal(true);
                return;
            }

            // 3. Filter & Normalize
            // Filter data >= startDate
            const filtered = historyData.filter(item => new Date(item.date) >= startDate);

            if (filtered.length === 0) {
                setError('Insufficient history for this ticker to compare with portfolio.');
                setShowErrorModal(true);
                return;
            }

            const startPrice = filtered[0].close;

            // Format: { date: "YYYY-MM-DD", value: % return }
            // Alignment: We need to match dates with portfolio chartData if possible, 
            // or we just overlay them and Recharts handles it if XAxis is time-based.
            // Since chartData uses strings "YYYY-MM-DD", let's ensure formats match.

            const processedData = filtered.map(item => ({
                date: item.date, // Assumes "YYYY-MM-DD" from API
                value: ((item.close - startPrice) / startPrice) * 100
            }));

            // Assign color
            // Assign unique color
            const usedColors = new Set(comparisonStocks.map(s => s.color));
            const palette = [
                '#3B82F6', // Blue
                '#F59E0B', // Amber
                '#8B5CF6', // Violet
                '#EC4899', // Pink
                '#06B6D4', // Cyan
                '#F97316', // Orange
                '#6366F1', // Indigo
                '#14B8A6', // Teal
                '#D946EF', // Fuchsia
                '#84CC16', // Lime
                '#E11D48', // Rose
                '#A855F7', // Purple
                '#0EA5E9', // Sky
                '#F43F5E', // Red-Pink
                '#64748B', // Slate
                '#CA8A04', // Yellow-Dark
            ];

            let color = palette.find(c => !usedColors.has(c));

            // Fallback to random if palette exhausted
            if (!color) {
                color = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
            }

            setComparisonStocks([...comparisonStocks, { ticker: comparisonTicker.toUpperCase(), data: processedData, color }]);
            setComparisonTicker('');

        } catch (e) {
            console.error("Error adding comparison:", e);
            setError('Error adding stock. Please check the ticker.');
            setShowErrorModal(true);
        }
    };

    const removeComparison = (ticker) => {
        setComparisonStocks(comparisonStocks.filter(s => s.ticker !== ticker));
    };

    // Merge Data for Chart
    const mergedChartData = useMemo(() => {
        if (!chartData || chartData.length === 0) return [];

        let merged = chartData.map(d => ({ ...d })); // Deep copy items to avoid mutation issues if any

        comparisonStocks.forEach(stock => {
            // create map for O(1) lookup
            const stockMap = new Map(stock.data.map(i => [i.date, i.value]));

            merged.forEach(item => {
                const val = stockMap.get(item.date);
                if (val !== undefined) {
                    item[`val_${stock.ticker}`] = val;
                }
            });
        });

        return merged;
    }, [chartData, comparisonStocks]);


    const actionButtons = (
        isCreating || isRenaming ? (
            <>
                <TypeSelector
                    value={newPortfolioType}
                    onChange={setNewPortfolioType}
                />
                <button
                    className={styles.roundActionBtn}
                    onClick={() => {
                        if (isRenaming) {
                            handleRenamePortfolioSubmit(renameValue);
                        } else if (newPortfolioName.trim()) {
                            handleCreatePortfolio(newPortfolioName.trim(), newPortfolioType);
                            setIsCreating(false);
                            setNewPortfolioName('');
                            setNewPortfolioType('test');
                        }
                    }}
                    title="Save"
                >
                    <Check size={20} />
                </button>
                <button
                    className={styles.roundActionBtn}
                    onClick={() => {
                        setIsCreating(false);
                        setIsRenaming(false);
                        setNewPortfolioType('test');
                    }}
                    title="Cancel"
                >
                    <X size={20} />
                </button>
            </>
        ) : (
            <>
                <button
                    className={styles.roundActionBtn}
                    onClick={() => {
                        setNewPortfolioName('');
                        setIsCreating(true);
                    }}
                    title="New Portfolio"
                >
                    <Plus size={20} />
                </button>
                {portfolioList.length > 0 && (
                    <>
                        <button
                            className={styles.roundActionBtn}
                            onClick={() => {
                                const currentName = portfolioList.find(p => p.id === currentPortfolioId)?.name || '';
                                setRenameValue(currentName);
                                setRenamingId(currentPortfolioId);
                                setIsRenaming(true);
                            }}
                            title="Rename Portfolio"
                        >
                            <Edit2 size={18} />
                        </button>
                        <button
                            className={`${styles.roundActionBtn} ${styles.danger}`}
                            onClick={() => handleDeletePortfolio(currentPortfolioId, false)}
                            title="Delete Current Portfolio"
                        >
                            <Trash2 size={18} />
                        </button>
                    </>
                )}
            </>
        )
    );

    const titleSection = (
        portfolioList.length === 0 && !isCreating ? (
            <h1 className={styles.portfolioMainTitleTrigger} style={{ cursor: 'default' }}>
                Please add a new test Portfolio
            </h1>
        ) : isCreating || isRenaming ? (
            <input
                autoFocus
                type="text"
                className={styles.portfolioTitleInput}
                placeholder={isRenaming ? "Rename Portfolio..." : "Enter Portfolio Name..."}
                value={isRenaming ? renameValue : newPortfolioName}
                onChange={e => isRenaming ? setRenameValue(e.target.value) : setNewPortfolioName(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        if (isRenaming) {
                            handleRenamePortfolioSubmit(renameValue);
                        } else if (newPortfolioName.trim()) {
                            handleCreatePortfolio(newPortfolioName.trim(), newPortfolioType);
                            setIsCreating(false);
                            setNewPortfolioName('');
                            setNewPortfolioType('test');
                        }
                    }
                    if (e.key === 'Escape') {
                        setIsCreating(false);
                        setIsRenaming(false);
                    }
                }}
            />
        ) : (
            <CustomSelect
                value={currentPortfolioId}
                onChange={(val) => setCurrentPortfolioId(val)}
                options={[
                    { label: 'Main Portfolios', isGroup: true },
                    ...portfolioList.filter(p => (p.type || 'main') === 'main').map(p => ({ label: p.name, value: p.id })),
                    { label: 'Test Portfolios', isGroup: true },
                    ...portfolioList.filter(p => p.type === 'test').map(p => ({ label: p.name, value: p.id }))
                ]}
                placeholder="Select Portfolio"
                isOpen={portfolioSelectorOpen}
                onOpenChange={setPortfolioSelectorOpen}
                onEdit={(id) => {
                    const portfolioData = portfolioList.find(p => p.id === id);
                    if (portfolioData) {
                        setRenameValue(portfolioData.name || '');
                        setNewPortfolioType(portfolioData.type || 'test');
                        setRenamingId(id);
                        setIsRenaming(true);
                        // Rename logic might naturally close it because UI changes to input
                    }
                }}
                onDelete={(id) => handleDeletePortfolio(id, true)}
                triggerClassName={styles.portfolioMainTitleTrigger}
                containerStyle={{ width: 'fit-content' }}
                style={{ width: 'auto', minWidth: '150px' }}
            />
        )
    );

    return (
        <div className={styles.container}>
            <div style={{ position: 'absolute', top: '2rem', left: '2rem', zIndex: 60 }}>
                {logoContainerContent}
            </div>

            <CascadingHeader
                topRightContent={actionGroupContent}
                bottomLeftContent={backButtonContent}
                gap="40px"
            />
            <div style={{ marginTop: '2rem' }}></div>

            <div className={styles.pageGrid}>
                {/* Card 1: Summary + Health Breakdown */}
                <div className={styles.topCardContainer}>

                    <FluidCard>
                        <div className={styles.portfolioCard}>
                            {/* Header Row: Title/Selector + Actions */}
                            <div className={`${styles.headerRow} ${menuOpen && isMobile ? styles.expandedMenu : ''}`} style={{
                                marginBottom: (portfolioList.length === 0 && !isCreating) ? '0' : '1.5rem',
                                borderBottom: (portfolioList.length === 0 && !isCreating) ? 'none' : '1px solid rgba(255,255,255,0.05)',
                                paddingBottom: (portfolioList.length === 0 && !isCreating) ? '0' : '1rem',
                            }}>
                                {/* Mobile Menu Logic */}
                                {isMobile ? (
                                    menuOpen ? (
                                        /* EXPANDED MOBILE: Row 1 Actions, Row 2 Title */
                                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', gap: '0.75rem', flex: 1 }}>
                                                    {actionButtons}
                                                </div>
                                                {!isCreating && !isRenaming && (
                                                    <button className={styles.roundActionBtn} onClick={() => setMenuOpen(false)}>
                                                        <X size={20} />
                                                    </button>
                                                )}
                                            </div>
                                            <div className={styles.headerLeft}>
                                                {titleSection}
                                            </div>
                                        </div>
                                    ) : (
                                        /* COLLAPSED MOBILE: Title Left, Menu Button Right */
                                        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div className={styles.headerLeft}>
                                                {titleSection}
                                            </div>
                                            <button className={styles.roundActionBtn} onClick={() => setMenuOpen(true)}>
                                                <Menu size={20} />
                                            </button>
                                        </div>
                                    )
                                ) : (
                                    /* DESKTOP: Title Left, Actions Right */
                                    <>
                                        <div className={styles.headerLeft}>
                                            {titleSection}
                                        </div>
                                        <div className={styles.headerActions}>
                                            {actionButtons}
                                        </div>
                                    </>
                                )}
                            </div>


                            {portfolioList.length > 0 && (
                                <>
                                    {/* ... Summary Content ... */}
                                    <div className={styles.topZone}>
                                        {/* Left: Summary */}
                                        <div className={styles.detailsSection}>
                                            <div className={styles.priceContainer}>
                                                <p className={styles.price}>
                                                    {currencySymbol}{totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </p>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <p className={`${styles.change} ${(totalPerformance || 0) >= 0 ? styles.pos : styles.neg}`} style={{ marginBottom: 0 }}>
                                                        {(portfolio.length === 0) ? 'N/A' : (
                                                            <>
                                                                {(totalPerformance || 0) >= 0 ? '+' : ''}{(totalPerformance || 0).toFixed(2)}% {isTotalTWR ? 'All Time (TWR)' : 'All Time'}
                                                            </>
                                                        )}
                                                    </p>

                                                </div>
                                            </div>

                                            <div className={styles.badgesContainer}>
                                                <div className={styles.badge}>
                                                    <span className={styles.badgeLabel}>Invested:</span>
                                                    <span className={styles.badgeValue}>{currencySymbol}{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>
                                                <div className={styles.badge}>
                                                    <span className={styles.badgeLabel}>Beta:</span>
                                                    <span className={styles.badgeValue}>{(weightedBeta || 0).toFixed(2)}</span>
                                                </div>
                                                <div className={styles.badge}>
                                                    <span className={styles.badgeLabel}>Est. 5Y Growth:</span>
                                                    <span className={styles.badgeValue}>{(weightedGrowth || 0).toFixed(2)}%</span>
                                                </div>
                                                <div className={styles.badge}>
                                                    <span className={styles.badgeLabel}>HHI:</span>
                                                    <span className={styles.badgeValue}>{(hhi || 0).toFixed(2)}</span>
                                                </div>
                                                <div className={styles.badge}>
                                                    <span className={styles.badgeLabel}>PEG:</span>
                                                    <span className={styles.badgeValue}>{(weightedPeg || 0).toFixed(2)}</span>
                                                </div>
                                                <div className={styles.badge}>
                                                    <span className={styles.badgeLabel}>Cash/Debt:</span>
                                                    <span className={styles.badgeValue}>{(weightedLiquidity || 0).toFixed(2)}</span>
                                                </div>

                                            </div>
                                        </div >

                                        {/* Right: Health Score Breakdown */}
                                        < div className={styles.scoreSection} >
                                            <div className={styles.scoreHeader}>
                                                <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                        <h3 className={styles.scoreTitle}>Portfolio Health Score</h3>
                                                        <div
                                                            className={`${styles.totalScore} ${portfolio.length === 0 ? '' : (healthScore >= 85 ? styles.scoreGreen : (healthScore >= 70 ? styles.scoreYellow : styles.scoreRed))}`}
                                                            style={portfolio.length === 0 ? { color: 'var(--text-secondary)', borderColor: 'var(--text-secondary)' } : {}}
                                                        >
                                                            {portfolio.length === 0 ? 'N/A' : `${healthScore}/100`}
                                                        </div>
                                                    </div>
                                                    <div style={{
                                                        fontSize: '0.8rem',
                                                        lineHeight: '1.4',
                                                        fontStyle: 'italic',
                                                        color: portfolio.length === 0 ? 'var(--text-secondary)' : (healthScore >= 85 ? '#10B981' : (healthScore >= 70 ? '#F59E0B' : '#EF4444')),
                                                        display: 'flex',
                                                        gap: '0.5rem',
                                                        alignItems: 'start'
                                                    }}>
                                                        <div style={{ marginTop: '2px', flexShrink: 0 }}><AlertTriangle size={14} /></div>
                                                        <span>
                                                            {portfolio.length === 0
                                                                ? "There are currently no stocks in this test portfolio"
                                                                : (healthScore >= 85
                                                                    ? "Portfolio is Institutional Grade. You are diversified, balanced, and primed for growth."
                                                                    : (healthScore >= 70
                                                                        ? "Portfolio is Healthy and has Good structure, but may be slightly heavy in one sector or category."
                                                                        : "Portfolio is Risky and requires immediate rebalancing.")
                                                                )
                                                            }
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className={styles.criteriaList}>
                                                {healthCriteria?.map((c, idx) => (
                                                    <div key={idx} className={styles.criteriaItem}>
                                                        <span className={styles.criteriaName}>{c.name}</span>
                                                        <span className={`${styles.criteriaStatus} ${c.status === 'Pass' ? styles.pass : (c.status === 'Warning' ? styles.scoreYellow : styles.fail)}`} style={c.status === 'Warning' ? { color: '#F59E0B', background: 'rgba(245, 158, 11, 0.1)' } : {}}>
                                                            {c.value}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                            {/* <div className={styles.scrollIndicator}>
                                    <span className={styles.scrollText}>Scroll for details</span>
                                    <ChevronDown size={14} className={styles.scrollIcon} />
                                </div> */}

                                        </div >
                                    </div >

                                    {/* Performance Chart Area */}

                                    < div style={{ marginTop: '2.5rem' }}>
                                        <div style={{ marginBottom: '2rem' }}>
                                            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.02em', margin: 0 }}>Performance Since Inception (TWR)</h3>
                                        </div>

                                        {/* Comparison Controls - Hide if empty */}
                                        {
                                            portfolio.length > 0 ? (
                                                <>
                                                    <div style={{ marginBottom: '1rem' }}>
                                                        <div className={styles.comparisonControls}>
                                                            <input
                                                                type="text"
                                                                value={comparisonTicker}
                                                                onChange={(e) => setComparisonTicker(e.target.value.toUpperCase())}
                                                                placeholder="Compare vs..." // Changed placeholder
                                                                className={styles.tickerInput}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        handleAddComparison();
                                                                    }
                                                                }}
                                                            />
                                                            <button onClick={handleAddComparison} className={styles.addButton}>Add</button>
                                                        </div>
                                                        <div className={styles.activeComparisons}>
                                                            {comparisonStocks.map(stock => (
                                                                <div key={stock.ticker} className={styles.comparisonTag} style={{ borderColor: stock.color, color: stock.color }}>
                                                                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: stock.color }}></div>
                                                                    {stock.ticker}
                                                                    <button onClick={() => removeComparison(stock.ticker)} className={styles.removeButton}><X size={12} /></button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {isMounted && (
                                                        <ResponsiveContainer width="100%" height={400}>
                                                            <AreaChart data={mergedChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                                                <defs>
                                                                    {(() => {
                                                                        if (mergedChartData.length === 0) return null;

                                                                        // Calculate gradient offset
                                                                        const dataMax = Math.max(...mergedChartData.map((i) => i.value));
                                                                        const dataMin = Math.min(...mergedChartData.map((i) => i.value));

                                                                        let off = 0;
                                                                        if (dataMax <= 0) {
                                                                            off = 0;
                                                                        } else if (dataMin >= 0) {
                                                                            off = 1;
                                                                        } else {
                                                                            off = dataMax / (dataMax - dataMin);
                                                                        }

                                                                        return (
                                                                            <>
                                                                                <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                                                                                    <stop offset={off} stopColor="#10B981" stopOpacity={1} />
                                                                                    <stop offset={off} stopColor="#EF4444" stopOpacity={1} />
                                                                                </linearGradient>
                                                                                <linearGradient id="splitColorFill" x1="0" y1="0" x2="0" y2="1">
                                                                                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.4} />
                                                                                    <stop offset={off} stopColor="#10B981" stopOpacity={0.05} />
                                                                                    <stop offset={off} stopColor="#EF4444" stopOpacity={0.05} />
                                                                                    <stop offset="100%" stopColor="#EF4444" stopOpacity={0.4} />
                                                                                </linearGradient>
                                                                            </>
                                                                        );
                                                                    })()}
                                                                </defs>
                                                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} strokeOpacity={0.5} />
                                                                <XAxis
                                                                    dataKey="date"
                                                                    stroke="#9CA3AF"
                                                                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                                                                    tickFormatter={(str) => {
                                                                        if (!str) return '';
                                                                        const d = new Date(str);
                                                                        return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
                                                                    }}
                                                                    minTickGap={40}
                                                                    axisLine={false}
                                                                    tickLine={false}
                                                                    dy={10}
                                                                />
                                                                <YAxis
                                                                    stroke="#9CA3AF"
                                                                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                                                                    unit="%"
                                                                    domain={['auto', 'auto']}
                                                                    axisLine={false}
                                                                    tickLine={false}
                                                                    dx={-5}
                                                                />
                                                                <Tooltip
                                                                    wrapperStyle={{ outline: 'none', backgroundColor: 'transparent' }}
                                                                    content={({ active, payload, label }) => {
                                                                        if (active && payload && payload.length) {
                                                                            return (
                                                                                <div style={{
                                                                                    backgroundColor: theme === 'dark' ? 'rgba(20, 20, 20, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                                                                                    borderRadius: '15px',
                                                                                    backdropFilter: 'blur(15px) saturate(150%) brightness(1.2)',
                                                                                    WebkitBackdropFilter: 'blur(15px) saturate(150%) brightness(1.2)',
                                                                                    borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid rgb(255, 255, 255)',
                                                                                    borderLeft: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid rgb(255, 255, 255)',
                                                                                    borderRight: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.2)',
                                                                                    borderBottom: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.2)',
                                                                                    boxShadow: theme === 'dark'
                                                                                        ? '0 10px 20px rgba(0, 0, 0, 0.5), inset 2px 2px 3px rgba(255, 255, 255, 0.2), inset -1px -1px 3px rgba(0, 0, 0, 0.5)'
                                                                                        : '10px 10px 20px rgba(0, 0, 0, 0.2), -3px -3px 10px rgba(0, 0, 0, 0.1), inset 2px 2px 3px rgba(255, 255, 255, 0.2), inset -1px -1px 3px rgba(0, 0, 0, 0.5)',
                                                                                    color: theme === 'dark' ? "#fff" : "#111827",
                                                                                    fontSize: '12px',
                                                                                    padding: '8px 10px'
                                                                                }}>
                                                                                    <p style={{
                                                                                        margin: '0 0 5px 0',
                                                                                        padding: '0',
                                                                                        fontWeight: 'bold',
                                                                                        color: theme === 'dark' ? '#D1D5DB' : '#374151'
                                                                                    }}>
                                                                                        {new Date(label).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                                                    </p>
                                                                                    {payload.map((entry, index) => {
                                                                                        // Determine color for My Portfolio
                                                                                        let color = entry.color;
                                                                                        if (entry.name === "My Portfolio") {
                                                                                            color = entry.value >= 0 ? '#10B981' : '#EF4444';
                                                                                        }
                                                                                        return (
                                                                                            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                                                                                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color }}></div>
                                                                                                <span style={{ fontWeight: 500 }}>{entry.name}:</span>
                                                                                                <span style={{ fontWeight: 600, color: color }}>{entry.value.toFixed(2)}%</span>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            );
                                                                        }
                                                                        return null;
                                                                    }}
                                                                    cursor={{ stroke: '#4B5563', strokeDasharray: '4 4' }}
                                                                />
                                                                <Area
                                                                    name="My Portfolio"
                                                                    type="monotone"
                                                                    dataKey="value"
                                                                    stroke="url(#splitColor)"
                                                                    strokeWidth={1}
                                                                    fillOpacity={1}
                                                                    fill="url(#splitColorFill)"
                                                                    activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                                                                />

                                                                {comparisonStocks.map(stock => (
                                                                    <Area
                                                                        key={stock.ticker}
                                                                        name={stock.ticker}
                                                                        type="monotone"
                                                                        dataKey={`val_${stock.ticker}`}
                                                                        stroke={stock.color}
                                                                        strokeWidth={1}
                                                                        strokeDasharray="none"
                                                                        connectNulls={true}
                                                                        fill="none"
                                                                        fillOpacity={0}
                                                                        activeDot={{ r: 4, fill: stock.color, stroke: '#fff', strokeWidth: 1 }}
                                                                    />
                                                                ))}
                                                            </AreaChart>
                                                        </ResponsiveContainer>
                                                    )}
                                                </>
                                            ) : (
                                                <div style={{
                                                    fontSize: '0.9rem',
                                                    color: 'var(--text-secondary)',
                                                    fontStyle: 'italic',
                                                    marginTop: '0.5rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem'
                                                }}>
                                                    <AlertTriangle size={14} />
                                                    There are currently no stocks in this test portfolio
                                                </div>
                                            )
                                        }
                                    </div>
                                </>
                            )}
                        </div>
                    </FluidCard>

                </div>

                {
                    portfolioList.length > 0 && (
                        <>
                            {/* Card 2: Charts */}

                            <FluidCard>
                                <div className={styles.portfolioCard}>
                                    <div style={{ marginBottom: openCards.allocation ? '1.5rem' : '0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Portfolio Allocation</h2>
                                        <button
                                            className={styles.tableActionButton}
                                            onClick={() => toggleCard('allocation')}
                                            title={openCards.allocation ? "Collapse" : "Expand"}
                                        >
                                            {openCards.allocation ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                        </button>
                                    </div>
                                    {openCards.allocation && (
                                        <div className={styles.allocationGrid}>
                                            {portfolio.length === 0 ? (
                                                <div style={{
                                                    fontSize: '0.9rem',
                                                    color: 'var(--text-secondary)',
                                                    fontStyle: 'italic',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    gridColumn: '1 / -1',
                                                    padding: '0 0 1rem 0'
                                                }}>
                                                    <AlertTriangle size={14} />
                                                    There are currently no stocks in this test portfolio
                                                </div>
                                            ) : (
                                                <>
                                                    {/* Left Column: Category Allocation */}
                                                    <div className={styles.allocationColumn}>
                                                        <h3 className={styles.allocationTitle}>Category Allocation</h3>
                                                        {/* Chart & Legend */}
                                                        <div style={{ height: 300, position: 'relative', width: '100%', minWidth: 0, overflow: 'hidden' }}>
                                                            {isMounted && (
                                                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                                                                    <PieChart>
                                                                        <Pie
                                                                            data={categoryData}
                                                                            cx="50%"
                                                                            cy="50%"
                                                                            innerRadius={60}
                                                                            outerRadius={80}
                                                                            paddingAngle={5}
                                                                            dataKey="value"
                                                                        >
                                                                            {categoryData.map((entry, index) => { // Use categoryData here
                                                                                const pct = totalValue > 0 ? (entry.value / totalValue) * 100 : 0;
                                                                                // Determine limits based on Category
                                                                                let limit = 100; // Default
                                                                                if (entry.name === 'Growth') limit = CAT_TARGETS.Growth.max;
                                                                                else if (entry.name === 'Core') limit = CAT_TARGETS.Core.max;
                                                                                else if (entry.name === 'Compounder') limit = CAT_TARGETS.Compounder.max;
                                                                                else if (entry.name === 'Defensive') limit = CAT_TARGETS.Defensive.max;
                                                                                else if (entry.name === 'Speculative') limit = CAT_TARGETS.Speculative.max;

                                                                                // Color Logic
                                                                                let color = '#10B981'; // Green (Good)

                                                                                if (entry.name === 'Growth') {
                                                                                    if (pct < CAT_TARGETS.Growth.min) color = '#F59E0B'; // Too Low (Orange)
                                                                                    if (pct > CAT_TARGETS.Growth.max) color = '#EF4444'; // Too High (Red)
                                                                                } else if (entry.name === 'Core') {
                                                                                    if (pct < CAT_TARGETS.Core.min) color = '#EF4444'; // Too Low (Red - Core is key)
                                                                                    if (pct > CAT_TARGETS.Core.max) color = '#F59E0B'; // Too High (Orange)
                                                                                } else if (entry.name === 'Compounder') {
                                                                                    if (pct < CAT_TARGETS.Compounder.min) color = '#F59E0B'; // Too Low (Orange)
                                                                                    if (pct > CAT_TARGETS.Compounder.max) color = '#EF4444'; // Too High (Red)
                                                                                } else if (entry.name === 'Defensive') {
                                                                                    if (pct < CAT_TARGETS.Defensive.min) color = '#F59E0B'; // Too Low (Orange)
                                                                                    if (pct > CAT_TARGETS.Defensive.max) color = '#EF4444'; // Too High (Red)
                                                                                } else if (entry.name === 'Speculative') {
                                                                                    if (pct > CAT_TARGETS.Speculative.max) color = '#EF4444'; // Too High (Red)
                                                                                }

                                                                                return <Cell key={`cell-${index}`} fill={color} stroke="rgba(0,0,0,0)" />;
                                                                            })}
                                                                        </Pie>
                                                                        <Tooltip
                                                                            contentStyle={{
                                                                                backgroundColor: theme === 'dark' ? 'rgba(20, 20, 20, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                                                                                borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                                                                borderRadius: '8px',
                                                                                fontSize: '12px',
                                                                                padding: '8px 10px'
                                                                            }}
                                                                            itemStyle={{ margin: '0', padding: '0', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#111827' }}
                                                                            labelStyle={{
                                                                                margin: '0 0 3px 0',
                                                                                padding: '0',
                                                                                fontWeight: 'bold',
                                                                                color: theme === 'dark' ? '#D1D5DB' : '#374151'
                                                                            }}
                                                                            formatter={(value, name) => [`${currencySymbol}${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} (${(totalValue > 0 ? (value / totalValue) * 100 : 0).toFixed(1)}%)`, name]}
                                                                        />
                                                                    </PieChart>
                                                                </ResponsiveContainer>
                                                            )}
                                                        </div>
                                                        <ChartLegend />

                                                        {/* Footnote under chart */}
                                                        {/* Footnote under chart */}
                                                        <div className={styles.chartFootnote}>
                                                            <h5 style={{ margin: '0 0 0.25rem 0', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', textAlign: 'center' }}>Target Allocations</h5>
                                                            <div className={styles.footnoteList}>
                                                                {Object.entries(CAT_TARGETS).map(([key, val]) => (
                                                                    <div key={key} style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                                        {key}: <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{val.min}-{val.max}%</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* RIGHT COLUMN: List */}
                                                        <div className={styles.allocationList}>
                                                            {[...categoryData].sort((a, b) => b.value - a.value).map((entry, index) => { // Use categoryData here
                                                                const pct = totalValue > 0 ? (entry.value / totalValue) * 100 : 0;
                                                                let color = '#10B981';
                                                                // Simplified list color logic for consistency
                                                                if (entry.name === 'Growth') {
                                                                    if (pct < CAT_TARGETS.Growth.min) color = '#F59E0B';
                                                                    if (pct > CAT_TARGETS.Growth.max) color = '#EF4444';
                                                                } else if (entry.name === 'Core') {
                                                                    if (pct < CAT_TARGETS.Core.min) color = '#EF4444';
                                                                    if (pct > CAT_TARGETS.Core.max) color = '#F59E0B';
                                                                } else if (entry.name === 'Compounder') {
                                                                    if (pct < CAT_TARGETS.Compounder.min) color = '#F59E0B';
                                                                    if (pct > CAT_TARGETS.Compounder.max) color = '#EF4444';
                                                                } else if (entry.name === 'Defensive') {
                                                                    if (pct < CAT_TARGETS.Defensive.min) color = '#F59E0B';
                                                                    if (pct > CAT_TARGETS.Defensive.max) color = '#EF4444';
                                                                } else if (entry.name === 'Speculative') {
                                                                    if (pct > CAT_TARGETS.Speculative.max) color = '#EF4444';
                                                                }
                                                                return (
                                                                    <div key={index} className={styles.allocationItem}>
                                                                        <div className={styles.allocationNameGroup}>
                                                                            <div className={styles.allocationColorDot} style={{ backgroundColor: color }}></div>
                                                                            <span className={styles.allocationName}>{entry.name}</span>
                                                                        </div>
                                                                        <div className={styles.allocationStats}>
                                                                            <span className={styles.allocationAmount}>{currencySymbol}{entry.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                                                            <span className={styles.allocationPct}>{pct.toFixed(1)}%</span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Right Column: Sector Allocation */}
                                                    <div className={styles.allocationColumn}>
                                                        <h3 className={styles.allocationTitle}>Sector Allocation</h3>
                                                        <div style={{ height: 300, position: 'relative', width: '100%', minWidth: 0, overflow: 'hidden' }}>
                                                            {isMounted && (
                                                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                                                                    <PieChart>
                                                                        <Pie
                                                                            data={sectorData}
                                                                            cx="50%"
                                                                            cy="50%"
                                                                            innerRadius={60}
                                                                            outerRadius={80}
                                                                            paddingAngle={5}
                                                                            dataKey="value"
                                                                        >
                                                                            {sectorData.map((entry, index) => {
                                                                                const pct = totalValue > 0 ? (entry.value / totalValue) * 100 : 0;
                                                                                const limit = SECTOR_LIMITS[entry.name] || SECTOR_LIMITS.default;
                                                                                let color = '#10B981';
                                                                                if (pct > limit) {
                                                                                    if (pct <= limit + 2) color = '#F59E0B'; // Slight warning
                                                                                    else color = '#EF4444'; // Danger
                                                                                }
                                                                                return <Cell key={`cell-${index}`} fill={color} stroke="rgba(0,0,0,0)" />;
                                                                            })}
                                                                        </Pie>
                                                                        <Tooltip
                                                                            contentStyle={{
                                                                                backgroundColor: theme === 'dark' ? 'rgba(20, 20, 20, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                                                                                borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                                                                borderRadius: '8px',
                                                                                fontSize: '12px',
                                                                                padding: '8px 10px'
                                                                            }}
                                                                            itemStyle={{ margin: '0', padding: '0', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#111827' }}
                                                                            labelStyle={{
                                                                                margin: '0 0 3px 0',
                                                                                padding: '0',
                                                                                fontWeight: 'bold',
                                                                                color: theme === 'dark' ? '#D1D5DB' : '#374151'
                                                                            }}
                                                                            formatter={(value, name) => [`${currencySymbol}${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} (${(totalValue > 0 ? (value / totalValue) * 100 : 0).toFixed(1)}%)`, name]}
                                                                        />
                                                                    </PieChart>
                                                                </ResponsiveContainer>
                                                            )}
                                                        </div>
                                                        <ChartLegend />

                                                        {/* Footnote under chart */}
                                                        <div className={styles.chartFootnote}>
                                                            <h5 style={{ margin: '0 0 0.25rem 0', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', textAlign: 'center' }}>Sector Limits</h5>
                                                            <div className={styles.footnoteList}>
                                                                {Object.entries(SECTOR_LIMITS)
                                                                    .filter(([k]) => !['Information Technology', 'Financials', 'Consumer Non-Cyclical'].includes(k)) // Filter duplicates/legacy
                                                                    .map(([key, val]) => (
                                                                        <div key={key} style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                                            {key === 'default' ? 'Others' : key}: <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{val}%</span>
                                                                        </div>
                                                                    ))}
                                                            </div>
                                                        </div>
                                                        {/* RIGHT COLUMN: List */}
                                                        <div className={styles.allocationList}>
                                                            {[...sectorData].sort((a, b) => b.value - a.value).map((entry, index) => {
                                                                const pct = totalValue > 0 ? (entry.value / totalValue) * 100 : 0;
                                                                const limit = SECTOR_LIMITS[entry.name] || SECTOR_LIMITS.default;
                                                                let color = '#10B981';
                                                                if (pct > limit) {
                                                                    if (pct <= limit + 2) color = '#F59E0B';
                                                                    else color = '#EF4444';
                                                                }
                                                                return (
                                                                    <div key={index} className={styles.allocationItem}>
                                                                        <div className={styles.allocationNameGroup}>
                                                                            <div className={styles.allocationColorDot} style={{ backgroundColor: color }}></div>
                                                                            <span className={styles.allocationName}>{entry.name}</span>
                                                                        </div>
                                                                        <div className={styles.allocationStats}>
                                                                            <span className={styles.allocationAmount}>{currencySymbol}{entry.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                                                            <span className={styles.allocationPct}>{pct.toFixed(1)}%</span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </FluidCard>


                            {/* Card 2.5: AI Analysis */}

                            <FluidCard>
                                <div className={styles.portfolioCard}>
                                    <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>AI Portfolio Analysis</h2>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            {openCards.ai && (
                                                <>
                                                    {analysis && (
                                                        <button
                                                            className={styles.tableActionButton}
                                                            onClick={async () => {
                                                                await clearAnalysis();
                                                                setUserClearedAnalysis(true);
                                                            }}
                                                            title="Clear Analysis"
                                                            style={{ color: '#EF4444', borderColor: '#EF4444' }}
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    )}
                                                    <button
                                                        className={styles.tableActionButton}
                                                        onClick={() => handleAnalyzePortfolio(true)}
                                                        disabled={analyzing}
                                                        title="Ask Gemini"
                                                    >
                                                        {analyzing ? (
                                                            <div className={styles.spinner} style={{ width: 18, height: 18 }}></div>
                                                        ) : (
                                                            <div style={{ fontSize: 20 }}>✨</div>
                                                        )}
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                className={styles.tableActionButton}
                                                onClick={() => toggleCard('ai')}
                                                title={openCards.ai ? "Collapse" : "Expand"}
                                            >
                                                {openCards.ai ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                            </button>
                                        </div>
                                    </div>

                                    {openCards.ai && (
                                        <div style={{ display: 'contents' }}>
                                            {analysis && (
                                                <div className={styles.analysisContent} style={{
                                                    marginTop: '1rem',
                                                    padding: '1.5rem',
                                                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                                    borderRadius: '12px',
                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                    color: 'var(--text-primary)',
                                                    lineHeight: '1.6'
                                                }}>
                                                    {analysis.split('\n').map((line, index) => {
                                                        const cleanLine = line.trim();
                                                        if (!cleanLine) return <div key={index} style={{ height: '0.5rem' }} />;

                                                        // Helper to bold text inside ** **
                                                        const renderBold = (text) => {
                                                            const parts = text.split(/(\*\*.*?\*\*)/g);
                                                            return parts.map((part, i) => {
                                                                if (part.startsWith('**') && part.endsWith('**')) {
                                                                    return <strong key={i} style={{ color: '#60a5fa' }}>{part.slice(2, -2)}</strong>;
                                                                }
                                                                return part;
                                                            });
                                                        };

                                                        // Headers
                                                        if (cleanLine.match(/^\d+\.\s+\*\*/) || (cleanLine.startsWith('**') && cleanLine.endsWith(':'))) {
                                                            return (
                                                                <h4 key={index} style={{
                                                                    margin: '1rem 0 0.5rem 0',
                                                                    fontSize: '1.1rem',
                                                                    color: 'var(--text-primary)',
                                                                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                                                                    paddingBottom: '0.25rem'
                                                                }}>
                                                                    {renderBold(cleanLine.replace(/^\d+\.\s*/, '').replace(/:$/, ''))}
                                                                </h4>
                                                            );
                                                        }

                                                        // List Items
                                                        if (cleanLine.startsWith('- ') || cleanLine.startsWith('* ')) {
                                                            return (
                                                                <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem', paddingLeft: '0.5rem' }}>
                                                                    <span style={{ color: '#60a5fa' }}>•</span>
                                                                    <span style={{ color: 'var(--text-secondary)' }}>{renderBold(cleanLine.slice(2))}</span>
                                                                </div>
                                                            );
                                                        }

                                                        return <p key={index} style={{ margin: '0.25rem 0', color: 'var(--text-secondary)' }}>{renderBold(cleanLine)}</p>;
                                                    })}
                                                </div>
                                            )}
                                            {!analysis && !analyzing && (
                                                <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem', border: '1px dashed rgba(255, 255, 255, 0.2)', borderRadius: '12px' }}>
                                                    Get AI-powered insights and improvement suggestions for your portfolio.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </FluidCard>


                            {/* Card 3: Holdings Table */}

                            <FluidCard>
                                <div className={styles.portfolioCard}>
                                    <div className={styles.tableCard} style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <div className={styles.tableHeader} style={{ marginBottom: menuOpenHoldings && isMobile ? '0.5rem' : '0' }}>
                                                <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Holdings</h2>
                                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                    {/* Desktop Buttons */}
                                                    {!isMobile && openCards.holdings && (
                                                        <>
                                                            <button className={styles.tableActionButton} onClick={() => setShowColumnModal(true)} title="Show/Hide Columns"><Eye size={18} /> </button>
                                                            <button className={styles.tableActionButton} onClick={handleCopyClick} title="Copy from Main Portfolio"><RefreshCw size={18} /> </button>
                                                            <button className={styles.tableActionButton} onClick={handleClearAll} title="Clear All Holdings"><Trash2 size={18} /> </button>
                                                            <button className={styles.tableActionButton} onClick={() => setShowAddModal(true)} title="Add Stock"><Plus size={18} /> </button>
                                                        </>
                                                    )}

                                                    {/* Mobile Menu Toggle (Menu / X) */}
                                                    {isMobile && openCards.holdings && (
                                                        <button
                                                            className={styles.tableActionButton}
                                                            onClick={() => setMenuOpenHoldings(!menuOpenHoldings)}
                                                            title={menuOpenHoldings ? "Close Menu" : "Actions Menu"}
                                                        >
                                                            {menuOpenHoldings ? <X size={18} /> : <Menu size={18} />}
                                                        </button>
                                                    )}

                                                    {/* Collapse/Expand Toggle (Always Fixed) */}
                                                    <button
                                                        className={styles.tableActionButton}
                                                        onClick={() => toggleCard('holdings')}
                                                        title={openCards.holdings ? "Collapse" : "Expand"}
                                                    >
                                                        {openCards.holdings ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Mobile Expanded Menu Buttons (Second Row) */}
                                            {isMobile && menuOpenHoldings && openCards.holdings && (
                                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', animation: 'fadeIn 0.3s' }}>
                                                    <button className={styles.tableActionButton} onClick={() => setShowColumnModal(true)} title="Show/Hide Columns"><Eye size={18} /> </button>
                                                    <button className={styles.tableActionButton} onClick={handleCopyClick} title="Copy from Main Portfolio"><RefreshCw size={18} /> </button>
                                                    <button className={styles.tableActionButton} onClick={handleClearAll} title="Clear All Holdings"><Trash2 size={18} /> </button>
                                                    <button className={styles.tableActionButton} onClick={() => setShowAddModal(true)} title="Add Stock"><Plus size={18} /> </button>
                                                </div>
                                            )}
                                        </div>

                                        {openCards.holdings && (
                                            <div className={styles.tableScroll}>
                                                <table className={styles.table}>
                                                    <thead>
                                                        <tr>
                                                            {!hiddenColumns.includes('ticker') && <th>Ticker</th>}
                                                            {!hiddenColumns.includes('category') && <th>Category</th>}
                                                            {!hiddenColumns.includes('sector') && <th>Sector</th>}
                                                            {!hiddenColumns.includes('beta') && <th>Beta</th>}
                                                            {!hiddenColumns.includes('initAmt') && <th>Cost Basis ({currency})</th>}
                                                            {!hiddenColumns.includes('invDate') && <th>Cost Basis Date</th>}
                                                            {!hiddenColumns.includes('price') && <th>Price ({currency})</th>}
                                                            {!hiddenColumns.includes('position') && <th>Position</th>}
                                                            {!hiddenColumns.includes('totalValue') && <th>Total Value ({currency})</th>}
                                                            {!hiddenColumns.includes('weight') && <th>Weight %</th>}
                                                            {!hiddenColumns.includes('return') && <th>Return %</th>}
                                                            {!hiddenColumns.includes('growth') && <th>5Y Growth</th>}
                                                            <th>Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {displayList && displayList.map(item => renderRow(item))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </FluidCard>

                        </>
                    )
                }
            </div >

            {
                showWatchlist && (
                    <WatchlistModal
                        isOpen={showWatchlist}
                        onClose={() => setShowWatchlist(false)}
                        currency={currency}
                        currencySymbol={currencySymbol}
                        currentRate={currentRate}
                    />
                )
            }
            {showProfileModal && currentUser && <UserProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} user={currentUser} />}
            <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Stock to Portfolio"
                message={
                    <div className={styles.addForm}>
                        <div className={styles.formGroup}><label>Ticker</label><input type="text" placeholder="e.g. NVDA" value={newTicker} onChange={e => setNewTicker(e.target.value)} /></div>
                        <div className={styles.formGroup}><label>Shares</label><input type="number" placeholder="e.g. 10" value={newShares} onChange={e => setNewShares(e.target.value)} /></div>
                        <div className={styles.formGroup}><label>Cost Basis ({currency})</label><input type="number" placeholder="Total amount invested" value={newCost} onChange={e => setNewCost(e.target.value)} /></div>
                        <div className={styles.formGroup}><label>Cost Basis Date</label><CustomDatePicker value={newDate} onChange={setNewDate} isMobile={isMobile} /></div>
                        <div className={styles.formGroup}><label>Category</label><CustomSelect value={newCategory} onChange={setNewCategory} options={['Core', 'Growth', 'Compounder', 'Defensive', 'Speculative']} useModalOnDesktop={true} /></div>
                        {addError && <p className={styles.error}>{addError}</p>}
                    </div>
                }
                footer={
                    <div className={styles.modalFooter} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%' }}>
                        <button className={styles.secondaryButton} onClick={() => setShowAddModal(false)} style={{ width: '100%' }}>Close</button>
                        <button className={styles.submitBtn} onClick={handleAddStock} style={{ marginTop: 0, width: '100%' }}>Add Position</button>
                    </div>
                }
            />
            <Modal isOpen={showColumnModal} onClose={() => setShowColumnModal(false)} title="Toggle Columns"
                message={
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                        {ALL_COLUMNS.map(col => (
                            <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                                <input type="checkbox" checked={!hiddenColumns.includes(col.key)} onChange={() => toggleColumn(col.key)} style={{ width: '1.2rem', height: '1.2rem' }} /> {col.label}
                            </label>
                        ))}
                    </div>
                }
            />

            {/* Copy Modal */}
            <Modal isOpen={showCopyModal} onClose={() => setShowCopyModal(false)}
                title={`Copy Stocks to ${portfolioList.find(p => p.id === currentPortfolioId)?.name}`}
                message={
                    <div className={styles.copyModalContainer} style={{ paddingRight: '0.5rem' }}>
                        <style>
                            {`
                                /* Custom Checkbox Styling High Contrast */
                                .custom-checkbox-container {
                                    display: flex;
                                    align-items: center;
                                    cursor: pointer;
                                    position: relative;
                                }
                                .custom-checkbox {
                                    width: 1.2rem;
                                    height: 1.2rem;
                                    cursor: pointer;
                                    appearance: none;
                                    background-color: transparent;
                                    border: 2px solid var(--text-primary); /* High contrast border (white/black) */
                                    border-radius: 4px;
                                    display: grid;
                                    place-content: center;
                                    transition: all 0.2s;
                                }
                                .custom-checkbox::before {
                                    content: "";
                                    width: 0.65em;
                                    height: 0.65em;
                                    transform: scale(0);
                                    transition: 120ms transform ease-in-out;
                                    box-shadow: inset 1em 1em var(--bg-primary); /* Dark Checkmark */
                                    transform-origin: center;
                                    clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
                                }
                                .custom-checkbox:checked::before {
                                    transform: scale(1);
                                }
                                .custom-checkbox:checked {
                                    border-color: var(--text-primary);
                                    background-color: var(--text-primary); /* White/High Contrast Background */
                                }
                                .icon-btn {
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    background: transparent;
                                    border-top: 1px solid rgba(255, 255, 255, 0.4);
                                    border-left: 1px solid rgba(255, 255, 255, 0.4);
                                    border-right: 1px solid rgba(255, 255, 255, 0.1);
                                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                                    border-radius: 50%;
                                    color: var(--text-secondary);
                                    cursor: pointer;
                                    transition: all 0.3s ease;
                                    backdrop-filter: blur(1px) saturate(150%) brightness(1);
                                    -webkit-backdrop-filter: blur(1px) saturate(150%) brightness(1);
                                    box-shadow: 0 5px 10px rgba(0, 0, 0, 0.2), inset 5px 3.5px 5px rgba(255, 255, 255, 0.2), inset -2px -2px 5px rgba(0, 0, 0, 0.2);
                                    height: 2.8rem;
                                    width: 2.8rem;
                                    padding: 0;
                                }
                                .icon-btn:hover {
                                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.144), rgba(255, 255, 255, 0.1));
                                    transform: scale(1.1);
                                    border-radius: 18px;
                                    box-shadow: 0 6px 12px rgba(96, 165, 250, 0.5), inset 0 2px 4px rgba(96, 165, 250, 0.5);
                                    border: none;
                                    color: var(--text-primary);
                                }
                            `}
                        </style>
                        {/* Source Selector */}
                        <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Source Portfolio:</label>
                            <CustomSelect
                                value={copySourceId}
                                onChange={handleSourceChange}
                                options={[
                                    { label: 'Main Portfolio', value: 'main' },
                                    ...portfolioList.filter(p => p.id !== currentPortfolioId).map(p => ({
                                        label: p.name,
                                        value: p.id
                                    }))
                                ]}
                                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                            />
                        </div>

                        {isSourceLoading ? (
                            <div className={styles.spinner} style={{ margin: '2rem auto' }} />
                        ) : sourceItems.length === 0 ? (
                            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', margin: '2rem 0' }}>
                                No items found in {copySourceId === 'main' ? 'Main Portfolio' : 'selected portfolio'}.
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {/* Controls aligned with checkbox */}
                                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', paddingLeft: '1rem', paddingBottom: '0.2rem', paddingTop: '0.2rem' }}>
                                    <button className="icon-btn" onClick={() => setSelectedCopyItems(sourceItems.map(i => i.id))} title="Select All">
                                        <CopyCheck size={16} />
                                    </button>
                                    <button className="icon-btn" onClick={() => setSelectedCopyItems([])} title="Deselect All">
                                        <div style={{ position: 'relative', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Copy size={16} />
                                            <div style={{
                                                position: 'absolute',
                                                bottom: 0,
                                                right: 0,
                                                backgroundColor: 'var(--bg-primary)',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: '12px',
                                                height: '12px',
                                            }}>
                                                <X size={10} strokeWidth={3} />
                                            </div>
                                        </div>
                                    </button>
                                </div>

                                <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '0.2rem' }}>
                                    {sourceItems.map(item => (
                                        <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.2s', marginBottom: '0.5rem' }}
                                            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                                            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
                                        >
                                            <div className="custom-checkbox-container">
                                                <input
                                                    type="checkbox"
                                                    className="custom-checkbox"
                                                    checked={selectedCopyItems.includes(item.id)}
                                                    onChange={() => {
                                                        if (selectedCopyItems.includes(item.id)) {
                                                            setSelectedCopyItems(prev => prev.filter(id => id !== item.id));
                                                        } else {
                                                            setSelectedCopyItems(prev => [...prev, item.id]);
                                                        }
                                                    }}
                                                />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{item.ticker}</div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.shares} shares • {item.category}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                }
                footer={
                    <div className={styles.modalFooter} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%' }}>
                        <button className={styles.secondaryButton} onClick={() => setShowCopyModal(false)} style={{ width: '100%' }}>Cancel</button>
                        <button className={styles.submitBtn} onClick={handleCopySubmit} style={{ marginTop: 0, width: '100%' }} disabled={selectedCopyItems.length === 0}>
                            Copy {selectedCopyItems.length} Items
                        </button>
                    </div>
                }
            />



            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={showDeleteModal}
                onClose={() => {
                    setShowDeleteModal(false);
                    if (shouldReopenSelector) setPortfolioSelectorOpen(true);
                    setShouldReopenSelector(false); // Reset
                }}
                title="Delete Portfolio"
                content={
                    <div style={{ padding: '1rem', color: 'var(--text-primary)' }}>
                        <p>Are you sure you want to delete the portfolio <strong>{portfolioToDelete?.name || 'Unknown'}</strong>?</p>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                            This action cannot be undone. All holdings in this portfolio will be permanently removed.
                        </p>
                    </div>
                }
                footer={
                    <div className={styles.modalFooter} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%' }}>
                        <button
                            className={styles.secondaryButton}
                            onClick={() => {
                                setShowDeleteModal(false);
                                if (shouldReopenSelector) setPortfolioSelectorOpen(true);
                                setShouldReopenSelector(false); // Reset
                            }}
                            style={{ width: '100%' }}
                        >
                            Cancel
                        </button>
                        <button
                            className={styles.submitBtn}
                            onClick={handleConfirmDelete}
                            style={{
                                marginTop: 0,
                                width: '100%',
                                background: '#EF4444',
                                borderColor: '#DC2626'
                            }}
                        >
                            Delete Portfolio
                        </button>
                    </div>
                }
            />

            {/* Delete Stock Modal */}
            <Modal
                isOpen={showDeleteStockModal}
                onClose={() => setShowDeleteStockModal(false)}
                title="Delete Stock"
                content={
                    <div style={{ padding: '1rem', color: 'var(--text-primary)' }}>
                        <p>Are you sure you want to remove <strong>{stockToDelete?.ticker}</strong> from your portfolio?</p>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                            This will also remove any manual edits made to this holding.
                        </p>
                    </div>
                }
                footer={
                    <div className={styles.modalFooter} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%' }}>
                        <button className={styles.secondaryButton} onClick={() => setShowDeleteStockModal(false)} style={{ width: '100%' }}>Cancel</button>
                        <button
                            className={styles.submitBtn}
                            onClick={handleConfirmDeleteStock}
                            style={{
                                marginTop: 0,
                                width: '100%',
                                background: '#EF4444',
                                borderColor: '#DC2626'
                            }}
                        >
                            Delete Stock
                        </button>
                    </div>
                }
            />

            {/* Clear Portfolio Modal */}
            <Modal
                isOpen={showClearPortfolioModal}
                onClose={() => setShowClearPortfolioModal(false)}
                title="Clear Portfolio"
                content={
                    <div style={{ padding: '1rem', color: 'var(--text-primary)' }}>
                        <p>Are you sure you want to clear <strong>ALL</strong> holdings from this portfolio?</p>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                            This action cannot be undone. All stocks and data in this portfolio will be permanently deleted.
                        </p>
                    </div>
                }
                footer={
                    <div className={styles.modalFooter} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%' }}>
                        <button className={styles.secondaryButton} onClick={() => setShowClearPortfolioModal(false)} style={{ width: '100%' }}>Cancel</button>
                        <button
                            className={styles.submitBtn}
                            onClick={handleConfirmClearAll}
                            style={{
                                marginTop: 0,
                                width: '100%',
                                background: '#EF4444',
                                borderColor: '#DC2626'
                            }}
                        >
                            Clear All
                        </button>
                    </div>
                }
            />

            {
                (portfolioLoading || (isLoadingData && portfolio.length > 0 && Object.keys(liveData).length < portfolio.length)) && (
                    <div className={styles.loadingOverlay}>
                        <div className={styles.spinner}></div>
                        <div className={styles.loadingText}>Loading Portfolio Data...</div>
                    </div>
                )
            }
        </div >
    );
};

export default PortfolioPage;
