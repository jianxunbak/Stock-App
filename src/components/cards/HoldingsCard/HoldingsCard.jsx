import React, { useState, useMemo, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import ExpandableCard from '../../ui/ExpandableCard/ExpandableCard';
import Button from '../../ui/Button';
import CustomSelect from '../../ui/CustomSelect/CustomSelect';
import CustomDatePicker from '../../ui/CustomDatePicker/CustomDatePicker';
import Window from '../../ui/Window/Window';
import { Eye, RefreshCw, Trash2, Plus, ChevronDown, ChevronRight, Edit2, Check, X, GripVertical, ChevronUp, Maximize } from 'lucide-react';
import { useColumnResize } from '../../../hooks/useColumnResize';
import styles from './HoldingsCard.module.css';

const HoldingsCard = ({
    portfolioList,
    displayList,
    openCards,
    toggleCard,
    hiddenColumns,
    currency,
    currencySymbol,
    currentRate,
    isMobile,
    menuOpenHoldings,
    setMenuOpenHoldings,
    onAdd,
    onCopy,
    onClear,
    onColumnToggle,
    updatePortfolioItem,
    removeFromPortfolio,
    totalValue = 0,
    totalPerformance = 0,
    dayChange = 0,
    dayChangePercent = 0,
    isTestPortfolio = false,
    onHide,
    loading = false
}) => {

    const navigate = useNavigate();
    const [expandedTickers, setExpandedTickers] = useState({});

    // Column Resizing
    const initialWidths = {
        'ticker': 120,
        'category': 120,
        'sector': 150,
        'beta': 80,
        'initAmt': 120,
        'invDate': 140,
        'price': 100,
        'position': 100,
        'totalValue': 140,
        'weight': 100,
        'return': 100,
        'growth': 100,
        'actions': 80
    };

    const { columnWidths, handleResizeStart, isResizing, setColumnWidths } = useColumnResize(initialWidths, 10);

    const handleResetWidths = () => {
        setColumnWidths(initialWidths);
    };

    // Menu Items
    const menuItems = [
        { label: 'Add Stock', onClick: onAdd, icon: <Plus size={16} /> },
        { label: 'Copy Holdings', onClick: onCopy, icon: <RefreshCw size={16} /> },
        { label: 'Clear Holdings', onClick: onClear, icon: <Trash2 size={16} /> },
        { label: 'Toggle Columns', onClick: onColumnToggle, icon: <Eye size={16} /> },
        { label: 'Reset Column Sizes', onClick: handleResetWidths, icon: <Maximize size={16} /> }
    ];

    // Summary Header - simplified to just count
    const header = (
        <div className={styles.summaryInfo}>
            <div className={styles.summaryName}>Holdings</div>
            <div className={styles.summaryCount}>
                {displayList?.length || 0} Stocks
            </div>
        </div>
    );



    // Editing State
    const [editingId, setEditingId] = useState(null);
    const [editValues, setEditValues] = useState({});

    // Sorting State
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedList = useMemo(() => {
        if (!displayList) return [];
        let sortableItems = [...displayList];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                // Handle nested properties or specific keys if needed
                if (sortConfig.key === 'totalValue') aValue = a.currentValue;
                if (sortConfig.key === 'totalValue') bValue = b.currentValue;

                if (sortConfig.key === 'return') aValue = a.performance;
                if (sortConfig.key === 'return') bValue = b.performance;

                if (sortConfig.key === 'initAmt') aValue = a.principal;
                if (sortConfig.key === 'initAmt') bValue = b.principal;

                if (sortConfig.key === 'invDate') aValue = new Date(a.purchaseDate);
                if (sortConfig.key === 'invDate') bValue = new Date(b.purchaseDate);

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [displayList, sortConfig]);



    const toggleExpand = (ticker) => {
        setExpandedTickers(prev => ({ ...prev, [ticker]: !prev[ticker] }));
    };

    // Delete Stock State
    const [showDeleteStockModal, setShowDeleteStockModal] = useState(false);
    const [stockToDelete, setStockToDelete] = useState(null);

    const startEdit = (item) => {
        setEditingId(item.id);
        // Ensure values are strings/numbers as expected for inputs
        setEditValues({
            shares: item.shares,
            totalCost: item.principal / currentRate,
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

    if (!portfolioList || portfolioList.length === 0) {
        if (loading) {
            // ExpandableCard handles loading
        } else {
            return null;
        }
    }

    // Automatically hide cost basis columns for test portfolios
    const effectiveHiddenColumns = isTestPortfolio
        ? [...new Set([...hiddenColumns, 'initAmt', 'invDate'])]
        : hiddenColumns;

    const renderRow = (item, isSubItem = false) => {
        if (!item) return null;

        // If it's a top-level group with only one item, treat it as that item
        // This ensures we have a valid ID for editing and correct date/cost data
        const isSingleGroup = !isSubItem && item.items && item.items.length === 1;
        const displayItem = isSingleGroup ? item.items[0] : item;

        const isEditing = editingId === displayItem.id;
        const isGroup = !isSubItem && item.items && item.items.length > 1;
        const isExpanded = expandedTickers[item.ticker];

        return (
            <Fragment key={isSubItem ? displayItem.id : item.ticker}>
                <tr className={isSubItem ? styles.subRow : ''} style={isSubItem ? { background: 'rgba(255,255,255,0.02)' } : {}}>
                    {!effectiveHiddenColumns.includes('ticker') && (
                        <td style={{ width: columnWidths['ticker'] }}>
                            <div className={styles.tickerCell}>
                                {isGroup ? (
                                    <button onClick={() => toggleExpand(item.ticker)} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </button>
                                ) : (
                                    /* Placeholder to align with arrow */
                                    <div className={styles.iconPlaceholder} />
                                )}
                                {isSubItem ? '' : <span className={styles.tickerApi} onClick={() => navigate(`/analysis?ticker=${item.ticker}`)}>{item.ticker}</span>}
                            </div>
                        </td>
                    )}
                    {/* ... (rest of columns remain similar, use item properties) ... */}
                    {!effectiveHiddenColumns.includes('category') && (
                        <td style={{ width: columnWidths['category'] }}>
                            {isEditing ? (
                                <CustomSelect
                                    value={editValues.category}
                                    onChange={(val) => setEditValues({ ...editValues, category: val })}
                                    options={['Core', 'Growth', 'Compounder', 'Defensive', 'Speculative']}
                                    triggerClassName={styles.editableSelectTrigger}
                                    isMobile={false}
                                    useModalOnDesktop={true}
                                    style={{ color: 'var(--text-primary)', WebkitTextFillColor: 'var(--text-primary)' }}
                                    containerStyle={{ minWidth: 0 }}
                                    distortionFactor={0.5}
                                    contentDistortionScale={0.5}
                                />
                            ) : <span className={styles.categoryBadge}>{displayItem.category}</span>}
                        </td>
                    )}

                    {!effectiveHiddenColumns.includes('sector') && <td style={{ width: columnWidths['sector'] }}>{displayItem.sector}</td>}
                    {!effectiveHiddenColumns.includes('beta') && <td className={styles.mono} style={{ width: columnWidths['beta'] }}>{(displayItem.beta || 0).toFixed(2)}</td>}

                    {!effectiveHiddenColumns.includes('initAmt') && (
                        <td className={styles.mono} style={{ width: columnWidths['initAmt'] }}>
                            {isEditing ? (
                                <input type="number" className={styles.pInput} value={editValues.totalCost} onChange={(e) => setEditValues({ ...editValues, totalCost: e.target.value })} />
                            ) : `${currencySymbol}${displayItem.principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </td>
                    )}

                    {!effectiveHiddenColumns.includes('invDate') && (
                        <td className={styles.mono} style={{ width: columnWidths['invDate'] }}>
                            {isEditing ? (
                                <CustomDatePicker
                                    value={editValues.purchaseDate}
                                    onChange={(val) => setEditValues({ ...editValues, purchaseDate: val })}
                                    triggerClassName={styles.editableDateTrigger}
                                    isMobile={false}
                                    useModalOnDesktop={true}
                                    style={{ color: 'var(--text-primary)', WebkitTextFillColor: 'var(--text-primary)', background: 'transparent', borderRadius: '1.5rem' }}
                                    containerStyle={{ minWidth: 0 }}
                                    distortionFactor={0.5}
                                    contentDistortionScale={0.5}
                                />
                            ) : (() => {
                                if (displayItem.items && displayItem.items.length > 0) {
                                    const dates = [...new Set(displayItem.items.map(i => i.purchaseDate).filter(Boolean))];
                                    return dates.length > 1 ? 'Varies' : (dates[0] || 'N/A');
                                }
                                return displayItem.purchaseDate || 'N/A';
                            })()}
                        </td>
                    )}

                    {!effectiveHiddenColumns.includes('price') && <td className={`${styles.livePrice} ${styles.mono}`} style={{ width: columnWidths['price'] }}>${(displayItem.price || 0).toFixed(2)}</td>}

                    {!effectiveHiddenColumns.includes('position') && (
                        <td className={styles.mono} style={{ width: columnWidths['position'] }}>
                            {isEditing ? (
                                <input type="number" className={styles.pInput} value={editValues.shares} onChange={(e) => setEditValues({ ...editValues, shares: e.target.value })} />
                            ) : displayItem.shares}
                        </td>
                    )}

                    {!effectiveHiddenColumns.includes('totalValue') && <td className={`${styles.boldValue} ${styles.mono}`} style={{ width: columnWidths['totalValue'] }}>{currencySymbol}{displayItem.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>}

                    {!effectiveHiddenColumns.includes('weight') && <td className={styles.mono} style={{ width: columnWidths['weight'] }}>{(displayItem.weightPercent || 0).toFixed(2)}%</td>}

                    {!effectiveHiddenColumns.includes('return') && (
                        <td className={`${(displayItem.performance || 0) >= 0 ? styles.pos : styles.neg} ${styles.mono}`} style={{ width: columnWidths['return'] }}>
                            {(displayItem.performance || 0) >= 0 ? '+' : ''}{(displayItem.performance || 0).toFixed(2)}%
                        </td>
                    )}

                    {!effectiveHiddenColumns.includes('growth') && (
                        <td className={`${(displayItem.growth || 0) > 0 ? styles.pos : ((displayItem.growth || 0) < 0 ? styles.neg : '')} ${styles.mono}`} style={{ width: columnWidths['growth'] }}>
                            {(displayItem.growth || 0) !== 0 ? `${(displayItem.growth || 0) > 0 ? '+' : ''}${(displayItem.growth || 0).toFixed(2)}%` : 'N/A'}
                        </td>
                    )}

                    <td className={styles.actions} style={{ width: columnWidths['actions'] }}>
                        <div className={styles.actionsContent}>
                            {isSubItem || !isGroup ? (
                                isEditing ? (
                                    <>
                                        <button onClick={() => saveEdit(displayItem.id)} className={styles.iconBtn}><Check size={18} color="#10B981" /></button>
                                        <button onClick={() => setEditingId(null)} className={styles.iconBtn}><X size={18} color="#EF4444" /></button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => startEdit(displayItem)} className={styles.iconBtn}><Edit2 size={18} /></button>
                                        <button onClick={() => handleDeleteStockClick(displayItem)} className={styles.iconBtn}><Trash2 size={18} color="#EF4444" /></button>
                                    </>
                                )
                            ) : null}
                        </div>
                    </td>
                </tr>
                {isExpanded && isGroup && item.items.map(sub => renderRow(sub, true))}
            </Fragment>
        );
    };

    return (
        <>
            <ExpandableCard
                title="Holdings"
                expanded={openCards.holdings}
                defaultExpanded={openCards.holdings}
                onToggle={() => toggleCard('holdings')}
                onHide={onHide}
                loading={loading}
                headerContent={header}
                className={styles.card}
                menuItems={menuItems}

            >
                <div className={styles.tableScroll}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                {!effectiveHiddenColumns.includes('ticker') && (
                                    <th style={{ width: columnWidths['ticker'] }} onClick={() => handleSort('ticker')}>
                                        <div className="watchlist-th-content">
                                            <span className="watchlist-th-label">Ticker</span>
                                            {sortConfig.key === 'ticker' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                        </div>
                                        <div
                                            className="resize-handle"
                                            onMouseDown={(e) => handleResizeStart(e, 'ticker')}
                                            onTouchStart={(e) => handleResizeStart(e, 'ticker')}
                                        >
                                            <GripVertical size={12} />
                                        </div>
                                    </th>
                                )}
                                {!effectiveHiddenColumns.includes('category') && (
                                    <th style={{ width: columnWidths['category'] }} onClick={() => handleSort('category')}>
                                        <div className="watchlist-th-content">
                                            <span className="watchlist-th-label">Category</span>
                                            {sortConfig.key === 'category' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                        </div>
                                        <div
                                            className="resize-handle"
                                            onMouseDown={(e) => handleResizeStart(e, 'category')}
                                            onTouchStart={(e) => handleResizeStart(e, 'category')}
                                        >
                                            <GripVertical size={12} />
                                        </div>
                                    </th>
                                )}
                                {!effectiveHiddenColumns.includes('sector') && (
                                    <th style={{ width: columnWidths['sector'] }} onClick={() => handleSort('sector')}>
                                        <div className="watchlist-th-content">
                                            <span className="watchlist-th-label">Sector</span>
                                            {sortConfig.key === 'sector' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                        </div>
                                        <div
                                            className="resize-handle"
                                            onMouseDown={(e) => handleResizeStart(e, 'sector')}
                                            onTouchStart={(e) => handleResizeStart(e, 'sector')}
                                        >
                                            <GripVertical size={12} />
                                        </div>
                                    </th>
                                )}
                                {!effectiveHiddenColumns.includes('beta') && (
                                    <th style={{ width: columnWidths['beta'] }} onClick={() => handleSort('beta')}>
                                        <div className="watchlist-th-content">
                                            <span className="watchlist-th-label">Beta</span>
                                            {sortConfig.key === 'beta' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                        </div>
                                        <div
                                            className="resize-handle"
                                            onMouseDown={(e) => handleResizeStart(e, 'beta')}
                                            onTouchStart={(e) => handleResizeStart(e, 'beta')}
                                        >
                                            <GripVertical size={12} />
                                        </div>
                                    </th>
                                )}
                                {!effectiveHiddenColumns.includes('initAmt') && (
                                    <th style={{ width: columnWidths['initAmt'] }} onClick={() => handleSort('initAmt')}>
                                        <div className="watchlist-th-content">
                                            <span className="watchlist-th-label">Cost Basis ({currency})</span>
                                            {sortConfig.key === 'initAmt' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                        </div>
                                        <div
                                            className="resize-handle"
                                            onMouseDown={(e) => handleResizeStart(e, 'initAmt')}
                                            onTouchStart={(e) => handleResizeStart(e, 'initAmt')}
                                        >
                                            <GripVertical size={12} />
                                        </div>
                                    </th>
                                )}
                                {!effectiveHiddenColumns.includes('invDate') && (
                                    <th style={{ width: columnWidths['invDate'] }} onClick={() => handleSort('invDate')}>
                                        <div className="watchlist-th-content">
                                            <span className="watchlist-th-label">Cost Basis Date</span>
                                            {sortConfig.key === 'invDate' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                        </div>
                                        <div
                                            className="resize-handle"
                                            onMouseDown={(e) => handleResizeStart(e, 'invDate')}
                                            onTouchStart={(e) => handleResizeStart(e, 'invDate')}
                                        >
                                            <GripVertical size={12} />
                                        </div>
                                    </th>
                                )}
                                {!effectiveHiddenColumns.includes('price') && (
                                    <th style={{ width: columnWidths['price'] }} onClick={() => handleSort('price')}>
                                        <div className="watchlist-th-content">
                                            <span className="watchlist-th-label">Price ({currency})</span>
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
                                {!effectiveHiddenColumns.includes('position') && (
                                    <th style={{ width: columnWidths['position'] }} onClick={() => handleSort('shares')}>
                                        <div className="watchlist-th-content">
                                            <span className="watchlist-th-label">Position</span>
                                            {sortConfig.key === 'shares' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                        </div>
                                        <div
                                            className="resize-handle"
                                            onMouseDown={(e) => handleResizeStart(e, 'position')}
                                            onTouchStart={(e) => handleResizeStart(e, 'position')}
                                        >
                                            <GripVertical size={12} />
                                        </div>
                                    </th>
                                )}
                                {!effectiveHiddenColumns.includes('totalValue') && (
                                    <th style={{ width: columnWidths['totalValue'] }} onClick={() => handleSort('totalValue')}>
                                        <div className="watchlist-th-content">
                                            <span className="watchlist-th-label">Total Value ({currency})</span>
                                            {sortConfig.key === 'totalValue' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                        </div>
                                        <div
                                            className="resize-handle"
                                            onMouseDown={(e) => handleResizeStart(e, 'totalValue')}
                                            onTouchStart={(e) => handleResizeStart(e, 'totalValue')}
                                        >
                                            <GripVertical size={12} />
                                        </div>
                                    </th>
                                )}
                                {!effectiveHiddenColumns.includes('weight') && (
                                    <th style={{ width: columnWidths['weight'] }} onClick={() => handleSort('weightPercent')}>
                                        <div className="watchlist-th-content">
                                            <span className="watchlist-th-label">Weight %</span>
                                            {sortConfig.key === 'weightPercent' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                        </div>
                                        <div
                                            className="resize-handle"
                                            onMouseDown={(e) => handleResizeStart(e, 'weight')}
                                            onTouchStart={(e) => handleResizeStart(e, 'weight')}
                                        >
                                            <GripVertical size={12} />
                                        </div>
                                    </th>
                                )}
                                {!effectiveHiddenColumns.includes('return') && (
                                    <th style={{ width: columnWidths['return'] }} onClick={() => handleSort('return')}>
                                        <div className="watchlist-th-content">
                                            <span className="watchlist-th-label">Return %</span>
                                            {sortConfig.key === 'return' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                        </div>
                                        <div
                                            className="resize-handle"
                                            onMouseDown={(e) => handleResizeStart(e, 'return')}
                                            onTouchStart={(e) => handleResizeStart(e, 'return')}
                                        >
                                            <GripVertical size={12} />
                                        </div>
                                    </th>
                                )}
                                {!effectiveHiddenColumns.includes('growth') && (
                                    <th style={{ width: columnWidths['growth'] }} onClick={() => handleSort('growth')}>
                                        <div className="watchlist-th-content">
                                            <span className="watchlist-th-label">5Y Growth</span>
                                            {sortConfig.key === 'growth' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                        </div>
                                        <div
                                            className="resize-handle"
                                            onMouseDown={(e) => handleResizeStart(e, 'growth')}
                                            onTouchStart={(e) => handleResizeStart(e, 'growth')}
                                        >
                                            <GripVertical size={12} />
                                        </div>
                                    </th>
                                )}
                                <th style={{ width: columnWidths['actions'] }}>
                                    <div className="watchlist-th-content">
                                        <span className="watchlist-th-label">Actions</span>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedList && sortedList.map(item => renderRow(item))}
                        </tbody>
                    </table>
                </div>
            </ExpandableCard >

            {showDeleteStockModal && (
                <Window
                    isOpen={showDeleteStockModal}
                    onClose={() => setShowDeleteStockModal(false)}
                    title="Delete Stock"
                    width="400px"
                    height="auto"
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ color: 'var(--neu-text-primary)' }}>
                            <p style={{ lineHeight: '1.5' }}>Are you sure you want to remove <strong>{stockToDelete?.ticker}</strong> from your portfolio?</p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--neu-text-tertiary)', marginTop: '0.5rem' }}>
                                This will also remove any manual edits made to this holding.
                            </p>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <Button onClick={() => setShowDeleteStockModal(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleConfirmDeleteStock} style={{ color: 'var(--neu-danger)' }}>
                                Delete Stock
                            </Button>
                        </div>
                    </div>
                </Window>
            )}
        </>
    );
};

export default HoldingsCard;
