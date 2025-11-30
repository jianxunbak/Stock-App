import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, ExternalLink, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from './WatchlistModal.module.css';
import { fetchStockData } from '../../services/api';
import { useWatchlist } from '../../hooks/useWatchlist';

const WatchlistModal = ({ isOpen, onClose }) => {
    const { watchlist, removeFromWatchlist, updateWatchlistItem, setFullWatchlist } = useWatchlist();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const navigate = useNavigate();
    const hasRefreshedRef = useRef(false);

    // Reset ref when modal closes
    useEffect(() => {
        if (!isOpen) {
            hasRefreshedRef.current = false;
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

    const refreshWatchlist = async (currentList) => {
        if (!currentList || currentList.length === 0) return;
        setIsRefreshing(true);

        try {
            const updatedList = await Promise.all(currentList.map(async (item) => {
                try {
                    const data = await fetchStockData(item.ticker);
                    // Extract updated fields
                    const currentPrice = data.overview?.price || item.price;
                    const currency = data.overview?.currency || item.currency || 'USD';
                    const intrinsicValue = data.valuation?.intrinsicValue || item.intrinsicValue;

                    // Support/Signal Logic
                    let supportLevel = item.supportLevel;
                    let signal = item.signal;
                    if (data.support_resistance?.levels?.length > 0) {
                        const level = data.support_resistance.levels[0];
                        supportLevel = level.price;
                        if (currentPrice <= level.price) signal = "Buy";
                        else if (currentPrice >= level.price * 1.5) signal = "Sell";
                        else signal = "Hold";
                    }

                    return {
                        ...item,
                        price: currentPrice,
                        currency: currency,
                        intrinsicValue: intrinsicValue,
                        supportLevel: supportLevel,
                        signal: signal,
                        // Preserve existing notes
                        notes: item.notes || '',
                        lastUpdated: new Date().toISOString()
                    };
                } catch (e) {
                    console.error(`Failed to refresh ${item.ticker}`, e);
                    return item;
                }
            }));

            setFullWatchlist(updatedList);
        } catch (error) {
            console.error("Error refreshing watchlist:", error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleNoteChange = (ticker, newNote) => {
        updateWatchlistItem(ticker, { notes: newNote });
    };

    const handleNavigate = (ticker) => {
        navigate(`/analysis?ticker=${ticker}`);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <h2 className={styles.title}>My Watchlist</h2>
                        {isRefreshing && <RefreshCw size={16} className={styles.spin} />}
                    </div>
                    <button onClick={onClose} className={styles.closeButton}>
                        <X size={24} />
                    </button>
                </div>

                <div className={styles.content}>
                    {watchlist.length === 0 ? (
                        <p className={styles.emptyText}>Your watchlist is empty.</p>
                    ) : (
                        <div className={styles.list}>
                            {/* Header Row */}
                            <div className={styles.headerRow}>
                                <span>Ticker</span>
                                <span>Health</span>
                                <span>Ccy</span>
                                <span>Price</span>
                                <span>Signal</span>
                                <span>Intrinsic</span>
                                <span>Support</span>
                                <span>Notes</span>
                                <span>Updated</span>
                                <span className={styles.actionsHeader}>Actions</span>
                            </div>

                            {watchlist.map((item) => (
                                <div key={item.ticker} className={styles.row}>
                                    <div className={styles.tickerCol}>
                                        <span
                                            className={styles.tickerLink}
                                            onClick={() => handleNavigate(item.ticker)}
                                        >
                                            {item.ticker}
                                        </span>
                                    </div>

                                    <div className={styles.scoreCol}>
                                        <div className={styles.scoreBadge} style={{
                                            backgroundColor: item.score >= 70 ? 'rgba(16, 185, 129, 0.2)' :
                                                item.score >= 40 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                            color: item.score >= 70 ? '#10B981' :
                                                item.score >= 40 ? '#F59E0B' : '#EF4444'
                                        }}>
                                            {item.score}%
                                        </div>
                                    </div>

                                    <div className={styles.currencyCol}>
                                        {item.currency || 'USD'}
                                    </div>

                                    <div className={styles.priceCol}>
                                        {item.price?.toFixed(2)}
                                    </div>

                                    <div className={styles.signalCol}>
                                        <span className={`${styles.signalBadge} ${item.signal === 'Buy' ? styles.signalBuy :
                                            item.signal === 'Sell' ? styles.signalSell :
                                                styles.signalHold
                                            }`}>
                                            {item.signal || 'Hold'}
                                        </span>
                                    </div>

                                    <div className={styles.valCol}>
                                        {item.intrinsicValue ? item.intrinsicValue.toFixed(2) : 'N/A'}
                                    </div>

                                    <div className={styles.valCol}>
                                        {item.supportLevel ? `${item.supportLevel.toFixed(2)}` : 'N/A'}
                                    </div>

                                    <div className={styles.notesCol}>
                                        <input
                                            type="text"
                                            className={styles.notesInput}
                                            value={item.notes || ''}
                                            onChange={(e) => handleNoteChange(item.ticker, e.target.value)}
                                            placeholder="Add note..."
                                        />
                                    </div>

                                    <div className={styles.updatedCol}>
                                        {item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString() : '-'}
                                    </div>

                                    <div className={styles.actionsCol}>
                                        <button
                                            onClick={() => removeFromWatchlist(item.ticker)}
                                            className={`${styles.iconButton} ${styles.deleteButton}`}
                                            title="Remove"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WatchlistModal;
