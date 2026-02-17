import React, { useState, useEffect, useRef } from 'react';
import { Trash2, RefreshCw, AlertTriangle, Eye, Check, GripVertical, ChevronUp, ChevronDown, MoreVertical, Maximize, X, Plus } from 'lucide-react';
import InlineSpinner from '../InlineSpinner/InlineSpinner';
import DropdownButton from '../DropdownButton/DropdownButton';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchStockData } from '../../../services/api';
import { useWatchlist } from '../../../hooks/useWatchlist';
import { useColumnResize } from '../../../hooks/useColumnResize';
import Window from '../Window/Window';
import Button from '../Button/Button';
import Modal from './Modal';
import styles from './WatchlistModal.module.css';

const WATCHLIST_COLUMNS = [
    { key: 'instrument', label: 'Instrument' },
    { key: 'health', label: 'Health' },
    { key: 'currency', label: 'Currency' },
    { key: 'price', label: 'Price' },
    { key: 'signal', label: 'Signal' },
    { key: 'intrinsic', label: 'Intrinsic Value' },
    { key: 'support', label: 'Support Level' },
    { key: 'notes', label: 'Notes' },
    { key: 'actions', label: 'Actions' }
];

const WatchlistModal = ({ isOpen, onClose, currency = 'USD', currencySymbol = '$', currentRate = 1 }) => {
    const { watchlist, removeFromWatchlist, updateWatchlistItem, setFullWatchlist } = useWatchlist();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [loadingTickers, setLoadingTickers] = useState(new Set());
    const [tickerToDelete, setTickerToDelete] = useState(null);
    const [hiddenColumns, setHiddenColumns] = useState([]);
    const [showColumnModal, setShowColumnModal] = useState(false);
    const navigate = useNavigate();
    const hasRefreshedRef = useRef(false);

    // Initial widths for resizable columns
    const initialWidths = {
        'instrument': 250,
        'health': 80,
        'currency': 80,
        'price': 100,
        'signal': 100,
        'intrinsic': 100,
        'support': 100,
        'notes': 150,
        'actions': 80
    };

    const { columnWidths, handleResizeStart, isResizing, setColumnWidths } = useColumnResize(initialWidths, 10);

    const handleResetWidths = () => {
        setColumnWidths(initialWidths);
    };

    // Sorting State
    const [sortConfig, setSortConfig] = useState({ key: 'instrument', direction: 'asc' });

    const handleSort = (key) => {
        if (key === 'actions') return;
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedWatchlist = React.useMemo(() => {
        let sortableItems = [...watchlist];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                let aValue, bValue;

                switch (sortConfig.key) {
                    case 'instrument':
                        aValue = a.ticker || '';
                        bValue = b.ticker || '';
                        break;
                    case 'health':
                        aValue = a.score || 0;
                        bValue = b.score || 0;
                        break;
                    case 'price':
                        aValue = a.price || 0;
                        bValue = b.price || 0;
                        break;
                    case 'intrinsic':
                        aValue = a.intrinsicValue || 0;
                        bValue = b.intrinsicValue || 0;
                        break;
                    case 'support':
                        aValue = a.supportLevel || 0;
                        bValue = b.supportLevel || 0;
                        break;
                    case 'signal':
                        aValue = a.signal || '';
                        bValue = b.signal || '';
                        break;
                    case 'currency':
                        aValue = a.currency || '';
                        bValue = b.currency || '';
                        break;
                    case 'notes':
                        aValue = a.notes || '';
                        bValue = b.notes || '';
                        break;
                    default:
                        aValue = a[sortConfig.key] || '';
                        bValue = b[sortConfig.key] || '';
                }

                if (typeof aValue === 'string') {
                    const cmp = aValue.localeCompare(bValue);
                    return sortConfig.direction === 'asc' ? cmp : -cmp;
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [watchlist, sortConfig]);

    // Reset ref when modal closes
    useEffect(() => {
        if (!isOpen) {
            hasRefreshedRef.current = false;
            setTickerToDelete(null);
        }
    }, [isOpen]);

    // Auto-refresh when opening
    useEffect(() => {
        if (isOpen && watchlist.length > 0 && !hasRefreshedRef.current) {
            refreshWatchlist(watchlist);
            hasRefreshedRef.current = true;
        }
    }, [isOpen, watchlist]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (tickerToDelete) setTickerToDelete(null);
                else onClose();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose, tickerToDelete]);

    const refreshWatchlist = async (currentList) => {
        if (!currentList || currentList.length === 0) return;
        setIsRefreshing(true);
        setLoadingTickers(new Set(currentList.map(item => item.ticker)));

        try {
            const updatedItemsMap = new Map();
            await Promise.all(currentList.map(async (item) => {
                try {
                    const data = await fetchStockData(item.ticker);
                    const name = data.overview?.name || item.name;
                    const currentPrice = data.overview?.price || item.price;
                    const currency = data.overview?.currency || item.currency || 'USD';
                    const intrinsicValue = data.valuation?.intrinsicValue || item.intrinsicValue;

                    let supportLevel = item.supportLevel;
                    let signal = item.signal;
                    if (data.support_resistance?.levels?.length > 0) {
                        const level = data.support_resistance.levels[0];
                        supportLevel = level.price;
                        if (currentPrice <= level.price) signal = "Buy";
                        else if (currentPrice >= level.price * 1.5) signal = "Sell";
                        else signal = "Hold";
                    }

                    updatedItemsMap.set(item.ticker, {
                        ...item,
                        name: name,
                        price: currentPrice,
                        currency: currency,
                        intrinsicValue: intrinsicValue,
                        supportLevel: supportLevel,
                        signal: signal,
                        notes: item.notes || '',
                        lastUpdated: new Date().toISOString()
                    });
                } catch (e) {
                    updatedItemsMap.set(item.ticker, item);
                } finally {
                    setLoadingTickers(prev => {
                        const next = new Set(prev);
                        next.delete(item.ticker);
                        return next;
                    });
                }
            }));

            // Merge updates into the LATEST watchlist state to avoid race conditions
            setFullWatchlist(prevList =>
                prevList.map(item => {
                    const freshData = updatedItemsMap.get(item.ticker);
                    return freshData ? { ...item, ...freshData } : item;
                })
            );
        } catch (error) {
            console.error("Error refreshing watchlist:", error);
        } finally {
            setIsRefreshing(false);
            setLoadingTickers(new Set());
        }
    };

    const handleNoteChange = (ticker, newNote) => {
        updateWatchlistItem(ticker, { notes: newNote });
    };

    const handleNavigate = (ticker) => {
        navigate(`/analysis?ticker=${ticker}`);
        onClose();
    };

    const confirmDelete = () => {
        if (tickerToDelete) {
            removeFromWatchlist(tickerToDelete);
            setTickerToDelete(null);
        }
    };

    const toggleColumn = (key) => {
        setHiddenColumns(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    if (!isOpen) return null;

    // Calculate latest update date
    const latestUpdate = watchlist.reduce((latest, item) => {
        if (!item.lastUpdated) return latest;
        const current = new Date(item.lastUpdated);
        return !latest || current > latest ? current : latest;
    }, null);

    const formattedDate = latestUpdate ? latestUpdate.toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : 'Just now';

    const modalTitle = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                Watchlist
                {isRefreshing && <RefreshCw size={14} className="spin" style={{ animation: 'spin 2s linear infinite' }} />}
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--neu-text-tertiary)', fontWeight: 'normal', textAlign: 'left', paddingBottom: '0.5rem' }}>
                Updated on {formattedDate}
            </span>
        </div>
    );

    const [showAddStockModal, setShowAddStockModal] = useState(false);
    const [newTicker, setNewTicker] = useState('');
    const [newNote, setNewNote] = useState('');
    const [addError, setAddError] = useState('');

    const handleAddStock = () => {
        if (!newTicker.trim()) {
            setAddError('Please enter a ticker symbol');
            return;
        }

        const ticker = newTicker.trim().toUpperCase();

        // Basic check if already exists
        if (watchlist.some(item => item.ticker === ticker)) {
            setAddError('Stock already in watchlist');
            return;
        }

        addToWatchlist({
            ticker: ticker,
            notes: newNote,
            lastUpdated: new Date().toISOString()
        });

        // Reset and close
        setNewTicker('');
        setNewNote('');
        setAddError('');
        setShowAddStockModal(false);
    };

    return (
        <Window
            isOpen={isOpen}
            onClose={onClose}
            title={modalTitle}
            width="950px"
            headerVerticalAlign="flex-start"
            controls={
                <DropdownButton
                    items={[
                        {
                            label: 'Add Stock',
                            onClick: () => setShowAddStockModal(true),
                            icon: <Plus size={14} />
                        },
                        {
                            label: 'Refresh Watchlist',
                            onClick: () => refreshWatchlist(watchlist),
                            icon: <RefreshCw size={14} className={isRefreshing ? styles.spin : ''} />,
                            disabled: isRefreshing
                        },
                        {
                            label: 'Reset Columns',
                            onClick: handleResetWidths,
                            icon: <Maximize size={14} />
                        },
                        {
                            label: 'Toggle Columns',
                            onClick: () => setShowColumnModal(true),
                            icon: <Eye size={14} />
                        }
                    ]}
                    variant="icon"
                    icon={<MoreVertical size={18} />}
                    align="right"
                />
            }
        >
            <div className={`watchlist-table-wrapper ${isResizing ? 'resizing' : ''}`} style={{ position: 'relative' }}>
                {/* Delete Confirmation Overlay */}
                <AnimatePresence>
                    {tickerToDelete && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                position: 'absolute',
                                top: 0, left: 0, right: 0, bottom: 0,
                                background: 'rgba(235, 236, 240, 0.8)',
                                backdropFilter: 'blur(4px)',
                                zIndex: 10,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 'var(--neu-radius-lg)'
                            }}
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 10 }}
                                animate={{ scale: 1, y: 0 }}
                                style={{
                                    background: 'var(--neu-bg)',
                                    padding: '1.5rem',
                                    borderRadius: 'var(--neu-radius-md)',
                                    boxShadow: 'var(--neu-card-shadow)',
                                    textAlign: 'center',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    minWidth: '280px'
                                }}
                            >
                                <AlertTriangle color="#F59E0B" size={32} />
                                <div style={{ color: 'var(--neu-text-primary)', fontWeight: '600' }}>
                                    Remove {tickerToDelete}?
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', width: '100%', justifyContent: 'center' }}>
                                    <Button onClick={() => setTickerToDelete(null)} style={{ flex: 1 }}>Cancel</Button>
                                    <Button onClick={confirmDelete} style={{ flex: 1, color: 'var(--neu-danger)' }}>Delete</Button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {watchlist.length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'var(--neu-text-secondary)', padding: '2rem' }}>
                        Your watchlist is empty.
                    </p>
                ) : (
                    <div className="watchlist-table-scroll">
                        <table className="watchlist-table">
                            <thead>
                                <tr>
                                    {!hiddenColumns.includes('instrument') && (
                                        <th style={{ width: columnWidths['instrument'] }} onClick={() => handleSort('instrument')}>
                                            <div className="watchlist-th-content">
                                                <span className="watchlist-th-label">Instrument</span>
                                                {sortConfig.key === 'instrument' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                            </div>
                                            <div
                                                className="resize-handle"
                                                onMouseDown={(e) => handleResizeStart(e, 'instrument')}
                                                onTouchStart={(e) => handleResizeStart(e, 'instrument')}
                                            >
                                                <GripVertical size={12} />
                                            </div>
                                        </th>
                                    )}
                                    {!hiddenColumns.includes('health') && (
                                        <th style={{ width: columnWidths['health'] }} onClick={() => handleSort('health')}>
                                            <div className="watchlist-th-content">
                                                <span className="watchlist-th-label">Health</span>
                                                {sortConfig.key === 'health' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                            </div>
                                            <div
                                                className="resize-handle"
                                                onMouseDown={(e) => handleResizeStart(e, 'health')}
                                                onTouchStart={(e) => handleResizeStart(e, 'health')}
                                            >
                                                <GripVertical size={12} />
                                            </div>
                                        </th>
                                    )}
                                    {!hiddenColumns.includes('currency') && (
                                        <th style={{ width: columnWidths['currency'] }} onClick={() => handleSort('currency')}>
                                            <div className="watchlist-th-content">
                                                <span className="watchlist-th-label">Currency</span>
                                                {sortConfig.key === 'currency' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                            </div>
                                            <div
                                                className="resize-handle"
                                                onMouseDown={(e) => handleResizeStart(e, 'currency')}
                                                onTouchStart={(e) => handleResizeStart(e, 'currency')}
                                            >
                                                <GripVertical size={12} />
                                            </div>
                                        </th>
                                    )}
                                    {!hiddenColumns.includes('price') && (
                                        <th style={{ width: columnWidths['price'] }} onClick={() => handleSort('price')}>
                                            <div className="watchlist-th-content">
                                                <span className="watchlist-th-label">Price</span>
                                                {sortConfig.key === 'price' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                            </div>
                                            <div
                                                className="resize-handle"
                                                onMouseDown={(e) => handleResizeStart(e, 'price')}
                                                onTouchStart={(e) => handleResizeStart(e, 'price')}
                                            >
                                                <GripVertical size={12} />
                                            </div>
                                        </th>
                                    )}
                                    {!hiddenColumns.includes('signal') && (
                                        <th style={{ width: columnWidths['signal'] }} onClick={() => handleSort('signal')}>
                                            <div className="watchlist-th-content">
                                                <span className="watchlist-th-label">Signal</span>
                                                {sortConfig.key === 'signal' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                            </div>
                                            <div
                                                className="resize-handle"
                                                onMouseDown={(e) => handleResizeStart(e, 'signal')}
                                                onTouchStart={(e) => handleResizeStart(e, 'signal')}
                                            >
                                                <GripVertical size={12} />
                                            </div>
                                        </th>
                                    )}
                                    {!hiddenColumns.includes('intrinsic') && (
                                        <th style={{ width: columnWidths['intrinsic'] }} onClick={() => handleSort('intrinsic')}>
                                            <div className="watchlist-th-content">
                                                <span className="watchlist-th-label">Intrinsic</span>
                                                {sortConfig.key === 'intrinsic' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                            </div>
                                            <div
                                                className="resize-handle"
                                                onMouseDown={(e) => handleResizeStart(e, 'intrinsic')}
                                                onTouchStart={(e) => handleResizeStart(e, 'intrinsic')}
                                            >
                                                <GripVertical size={12} />
                                            </div>
                                        </th>
                                    )}
                                    {!hiddenColumns.includes('support') && (
                                        <th style={{ width: columnWidths['support'] }} onClick={() => handleSort('support')}>
                                            <div className="watchlist-th-content">
                                                <span className="watchlist-th-label">Support</span>
                                                {sortConfig.key === 'support' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                            </div>
                                            <div
                                                className="resize-handle"
                                                onMouseDown={(e) => handleResizeStart(e, 'support')}
                                                onTouchStart={(e) => handleResizeStart(e, 'support')}
                                            >
                                                <GripVertical size={12} />
                                            </div>
                                        </th>
                                    )}
                                    {!hiddenColumns.includes('notes') && (
                                        <th style={{ width: columnWidths['notes'] }} onClick={() => handleSort('notes')}>
                                            <div className="watchlist-th-content">
                                                <span className="watchlist-th-label">Notes</span>
                                                {sortConfig.key === 'notes' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                            </div>
                                            <div
                                                className="resize-handle"
                                                onMouseDown={(e) => handleResizeStart(e, 'notes')}
                                                onTouchStart={(e) => handleResizeStart(e, 'notes')}
                                            >
                                                <GripVertical size={12} />
                                            </div>
                                        </th>
                                    )}
                                    {!hiddenColumns.includes('actions') && (
                                        <th style={{ width: columnWidths['actions'] }}>
                                            <div className="watchlist-th-content">
                                                <span className="watchlist-th-label">Actions</span>
                                            </div>
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedWatchlist.map((item) => (
                                    <tr key={item.ticker}>
                                        {!hiddenColumns.includes('instrument') && (
                                            <td
                                                style={{ cursor: 'pointer', width: columnWidths['instrument'] }}
                                                onClick={() => handleNavigate(item.ticker)}
                                            >
                                                <div className="watchlist-instrument-cell">
                                                    {loadingTickers.has(item.ticker) ? (
                                                        <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '0.75rem' }}>
                                                            <InlineSpinner size="16px" color="var(--neu-brand)" />
                                                        </div>
                                                    ) : (
                                                        <div className="watchlist-icon-placeholder" />
                                                    )}
                                                    <div className="watchlist-instrument-info">
                                                        <div className="watchlist-ticker" style={{ textAlign: 'left' }}>{item.ticker}</div>
                                                        <div className="watchlist-company" style={{ fontSize: '0.8rem', color: 'var(--neu-text-secondary)', whiteSpace: 'normal', textAlign: 'left' }}>{item.name || item.ticker}</div>
                                                    </div>
                                                </div>
                                            </td>
                                        )}
                                        {!hiddenColumns.includes('health') && (
                                            <td style={{ width: columnWidths['health'] }}>
                                                <span style={{
                                                    fontWeight: '700',
                                                    color: item.score >= 70 ? 'var(--neu-success)' :
                                                        item.score >= 40 ? '#F59E0B' : 'var(--neu-danger)'
                                                }}>
                                                    {item.score || '-'}
                                                </span>
                                            </td>
                                        )}
                                        {!hiddenColumns.includes('currency') && (
                                            <td style={{ color: 'var(--neu-text-tertiary)', fontSize: '0.75rem', width: columnWidths['currency'] }}>{item.currency || currency}</td>
                                        )}
                                        {!hiddenColumns.includes('price') && (
                                            <td style={{ fontWeight: '700', color: 'var(--neu-text-primary)', width: columnWidths['price'] }}>
                                                {currencySymbol}{(item.price * currentRate)?.toFixed(2)}
                                            </td>
                                        )}
                                        {!hiddenColumns.includes('signal') && (
                                            <td style={{ width: columnWidths['signal'] }}>
                                                <span className={`watchlist-signal ${(item.signal || 'Hold').toLowerCase()}`}>
                                                    {(item.signal || 'Hold').toUpperCase()}
                                                </span>
                                            </td>
                                        )}
                                        {!hiddenColumns.includes('intrinsic') && (
                                            <td style={{ width: columnWidths['intrinsic'] }}>{item.intrinsicValue ? `${currencySymbol}${(item.intrinsicValue * currentRate).toFixed(2)}` : '-'}</td>
                                        )}
                                        {!hiddenColumns.includes('support') && (
                                            <td style={{ width: columnWidths['support'] }}>{item.supportLevel ? `${currencySymbol}${(item.supportLevel * currentRate).toFixed(2)}` : '-'}</td>
                                        )}
                                        {!hiddenColumns.includes('notes') && (
                                            <td style={{ width: columnWidths['notes'] }}>
                                                <input
                                                    type="text"
                                                    className="watchlist-notes-input"
                                                    value={item.notes || ''}
                                                    onChange={(e) => handleNoteChange(item.ticker, e.target.value)}
                                                    placeholder="Add note..."
                                                />
                                            </td>
                                        )}
                                        {!hiddenColumns.includes('actions') && (
                                            <td style={{ width: columnWidths['actions'] }}>
                                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                    <Button
                                                        variant="icon"
                                                        onClick={() => setTickerToDelete(item.ticker)}
                                                        title="Remove"
                                                    >
                                                        <Trash2 size={18} />
                                                    </Button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <Window
                isOpen={showColumnModal}
                onClose={() => setShowColumnModal(false)}
                title="Toggle Columns"
                width="300px"
                height="auto"
                hideCloseButton={true}
                headerAlign="start"
            >
                <div className={styles.columnToggleGrid}>
                    {WATCHLIST_COLUMNS.map(col => {
                        const isActive = !hiddenColumns.includes(col.key);
                        return (
                            <div
                                key={col.key}
                                className={`${styles.columnToggleItem} ${isActive ? styles.active : ''}`}
                                onClick={() => toggleColumn(col.key)}
                            >
                                <div className={styles.columnToggleCheck}>
                                    {isActive && <Check size={14} />}
                                </div>
                                <span className={styles.columnToggleLabel}>{col.label}</span>
                            </div>
                        );
                    })}
                </div>
            </Window>

            {/* Add Stock to Watchlist Modal */}
            <Window
                isOpen={showAddStockModal}
                onClose={() => setShowAddStockModal(false)}
                title="Add to Watchlist"
                width="400px"
                height="auto"
                headerAlign="start"
                hideCloseButton={true}
                controls={
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Button
                            variant="icon"
                            onClick={() => setShowAddStockModal(false)}
                            title="Cancel"
                            style={{ color: 'var(--neu-text-secondary)' }}
                        >
                            <X size={20} />
                        </Button>
                        <Button
                            variant="icon"
                            onClick={handleAddStock}
                            title="Add"
                            style={{ color: 'var(--neu-brand)' }}
                        >
                            <Check size={20} />
                        </Button>
                    </div>
                }
            >
                <div className={styles.addForm}>
                    <div className={styles.formGroup}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--neu-text-tertiary)', fontWeight: 600 }}>Ticker</label>
                        <input
                            type="text"
                            value={newTicker}
                            onChange={e => setNewTicker(e.target.value)}
                            placeholder="e.g. MSFT"
                            autoFocus
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--neu-text-tertiary)', fontWeight: 600 }}>Notes (Optional)</label>
                        <input
                            type="text"
                            value={newNote}
                            onChange={e => setNewNote(e.target.value)}
                            placeholder="Target price, thesis, etc."
                        />
                    </div>
                    {addError && <p className={styles.error}>{addError}</p>}
                </div>
            </Window>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </Window >
    );
};

export default WatchlistModal;
