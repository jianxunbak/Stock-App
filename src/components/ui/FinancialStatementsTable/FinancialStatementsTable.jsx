import React, { useState, useMemo } from 'react';
import { MoreVertical, Landmark, Calculator, Activity, Calendar, Clock, ChevronUp, ChevronDown, GripVertical, Maximize, Eye, Check } from 'lucide-react';
import Window from '../Window/Window';
import Button from '../Button/Button';
import Menu from '../Menu/Menu';
import ExpandableCard from '../ExpandableCard/ExpandableCard';
import DropdownButton from '../DropdownButton/DropdownButton';
import { useStockData } from '../../../hooks/useStockData';
import { useColumnResize } from '../../../hooks/useColumnResize';
import './FinancialStatementsTable.css';

/**
 * FinancialStatementsTable Component
 * 
 * A reusable component for displaying Income Statement, Balance Sheet, and Cash Flow.
 * Features:
 * - Tabbed navigation via DropdownButton with icons
 * - Column resizing and sticky first column
 * - Millions/Billions currency formatting
 * - Integration with ExpandableCard and Menu controls
 */
const FinancialStatementsTable = ({
    title = "Financial Statements",
    className = "",
    currencySymbol = '$',
    currentRate = 1,
    isOpen = true,
    onToggle = null,
    onHide = null,
    stackControls = false,
    loading: parentLoading = false,
    ...props
}) => {

    const { stockData, loading, loadStockData } = useStockData();
    const [activeTab, setActiveTab] = useState('income_statement');
    const [showToggleModal, setShowToggleModal] = useState(false);
    const [hiddenColumns, setHiddenColumns] = useState([]); // indices of columns to hide
    const [hiddenRows, setHiddenRows] = useState([]); // metric names to hide

    const tabs = [
        { id: 'income_statement', label: 'Income Statement', icon: <Landmark size={16} /> },
        { id: 'balance_sheet', label: 'Balance Sheet', icon: <Calculator size={16} /> },
        { id: 'cash_flow', label: 'Cash Flow', icon: <Activity size={16} /> },
    ];

    const financials = stockData?.financials || {};
    const currentFinancialData = financials[activeTab] || { dates: [], metrics: [] };
    const columns = currentFinancialData.dates || [];

    const rows = useMemo(() => {
        const metrics = (currentFinancialData.metrics || []).map((metric, idx) => ({
            id: `metric-${idx}`,
            label: metric.name,
            values: metric.values.map(val => typeof val === 'number' ? val * currentRate : val),
            type: metric.name.toLowerCase().includes('total') || metric.name.toLowerCase().includes('net') ? 'total' : 'default'
        }));

        // Filter out hidden rows
        return metrics.filter(row => !hiddenRows.includes(row.label));
    }, [currentFinancialData, currentRate, hiddenRows]);

    // Derived columns (filtered)
    const filteredColumns = useMemo(() => {
        return columns.map((col, idx) => ({ label: col, originalIndex: idx }))
            .filter(col => !hiddenColumns.includes(col.originalIndex));
    }, [columns, hiddenColumns]);

    // Column Resizing logic
    const initialWidths = useMemo(() => {
        const widths = { 'breakdown': 180 };
        columns.forEach((col, i) => widths[`col-${i}`] = 120);
        return widths;
    }, [columns]);

    const { columnWidths, handleResizeStart, isResizing, setColumnWidths } = useColumnResize(initialWidths, 10);

    const handleResetWidths = () => {
        setColumnWidths(initialWidths);
    };

    // Sorting State
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedRows = useMemo(() => {
        let sortableItems = [...rows];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                let aValue, bValue;

                if (sortConfig.key === 'breakdown') {
                    aValue = a.label;
                    bValue = b.label;
                } else {
                    const colIndex = parseInt(sortConfig.key.split('-')[1]);
                    // Map visual column index back to original array if needed, 
                    // but here sortConfig.key is already `col-${originalIndex}` from the header render
                    aValue = a.values[colIndex];
                    bValue = b.values[colIndex];
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
    }, [rows, sortConfig]);

    const formatCurrency = (val) => {
        if (typeof val !== 'number') return val;
        const absVal = Math.abs(val);
        if (absVal >= 1e9) return `${currencySymbol}${(val / 1e9).toFixed(2)}B`;
        if (absVal >= 1e6) return `${currencySymbol}${(val / 1e6).toFixed(2)}M`;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
        }).format(val).replace('$', currencySymbol);
    };

    const isLoading = parentLoading || loading;

    if (!stockData || !stockData.financials) {
        return (
            <ExpandableCard
                title={title}
                defaultExpanded={isOpen}
                onToggle={onToggle}
                onHide={onHide}
                loading={isLoading}
                className={`fs-table-card ${className}`}
                {...props}
            />
        );
    }

    // Header Content (Summary View)
    const income = financials.income_statement || { dates: [], metrics: [] };
    const revenueMetric = income.metrics?.find(m => m.name.toLowerCase().includes('revenue'));
    const latestRevenue = revenueMetric?.values?.[0];
    const latestDate = income.dates?.[0];

    const header = (
        <div className="summary-info">
            <div className="summary-name">Financials</div>
            <div className="summary-change" style={{ color: 'var(--neu-text-tertiary)', marginTop: '0.5rem' }}>
                Open to view more details
            </div>
        </div>
    );

    const isETF = stockData?.overview?.is_etf || stockData?.overview?.quoteType === 'ETF';
    const activeTabObj = tabs.find(t => t.id === activeTab);

    const menuItems = [
        { label: 'Toggle Visibility', onClick: () => setShowToggleModal(true), indicatorNode: <Eye size={14} /> },
        { label: 'Reset Column Sizes', onClick: handleResetWidths, indicatorNode: <Maximize size={14} /> },
    ];

    // Combined controls to go into ExpandableCard's right-aligned control group
    const combinedControls = (
        <DropdownButton
            icon={activeTabObj?.icon}
            variant="icon"
            align="right"
            closeOnSelect={true}
            buttonStyle={{
                borderRadius: 'var(--neu-radius-sm)',
                background: 'var(--neu-bg)',
                boxShadow: 'var(--neu-card-shadow)',
                width: '32px',
                height: '32px'
            }}
            items={tabs.map(tab => ({
                label: tab.label,
                isActive: activeTab === tab.id,
                indicatorNode: tab.icon,
                onClick: () => setActiveTab(tab.id)
            }))}
        />
    );

    return (
        <>
            <ExpandableCard
                title={title}
                defaultExpanded={isOpen}
                onToggle={onToggle}
                collapsedWidth={220}
                collapsedHeight={220}
                loading={isLoading}
                headerContent={header}
                className={`fs-table-card ${className}`}
                controls={isOpen ? combinedControls : null}
                menuItems={menuItems}
                stackControls={stackControls}
                onRefresh={() => stockData?.overview?.symbol && loadStockData(stockData.overview.symbol, true)}
                onHide={onHide}
                {...props}
            >
                <div className="fs-table-body-content">
                    {/* Title removed as it's now handled by the ExpandableCard wrapper */}


                    {isETF ? (
                        <div className="fs-etf-message">
                            Financial statements are not available for ETFs.
                        </div>
                    ) : (
                        <div className={`fs-table-wrapper ${isResizing ? 'resizing' : ''}`}>
                            <div className="fs-table-scroll-container">
                                <table className="fs-table-element">
                                    <thead>
                                        <tr>
                                            <th className="fs-th" style={{ width: columnWidths['breakdown'] }} onClick={() => handleSort('breakdown')}>
                                                <div className="watchlist-th-content">
                                                    <span className="watchlist-th-label">Breakdown</span>
                                                    {sortConfig.key === 'breakdown' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                                </div>
                                                <div
                                                    className="resize-handle"
                                                    onMouseDown={(e) => handleResizeStart(e, 'breakdown')}
                                                    onTouchStart={(e) => handleResizeStart(e, 'breakdown')}
                                                >
                                                    <GripVertical size={12} />
                                                </div>
                                            </th>
                                            {filteredColumns.map((col) => (
                                                <th key={col.originalIndex} className="fs-th" style={{ width: columnWidths[`col-${col.originalIndex}`] }} onClick={() => handleSort(`col-${col.originalIndex}`)}>
                                                    <div className="watchlist-th-content">
                                                        <span className="watchlist-th-label">{col.label}</span>
                                                        {sortConfig.key === `col-${col.originalIndex}` && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                                    </div>
                                                    <div
                                                        className="resize-handle"
                                                        onMouseDown={(e) => handleResizeStart(e, `col-${col.originalIndex}`)}
                                                        onTouchStart={(e) => handleResizeStart(e, `col-${col.originalIndex}`)}
                                                    >
                                                        <GripVertical size={12} />
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedRows.map((row) => (
                                            <tr key={row.id} className={`fs-tr ${row.type === 'total' ? 'fs-row-total' : ''}`}>
                                                <td className="fs-td fs-td-sticky" style={{ width: columnWidths['breakdown'] }}>
                                                    <div className="watchlist-th-label" title={row.label}>{row.label}</div>
                                                </td>
                                                {filteredColumns.map((col) => {
                                                    const val = row.values[col.originalIndex];
                                                    return (
                                                        <td key={col.originalIndex} className={`fs-td ${val < 0 ? 'fs-val-negative' : ''}`} style={{ width: columnWidths[`col-${col.originalIndex}`] }}>
                                                            {formatCurrency(val)}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </ExpandableCard>

            {showToggleModal && (
                <Window
                    isOpen={showToggleModal}
                    onClose={() => setShowToggleModal(false)}
                    title="Table Visibility"
                    width="600px"
                    height="80vh"
                    headerAlign="start"
                >
                    <div className="visibility-modal-content">
                        <div className="visibility-section">
                            <h4 className="visibility-section-title">Show/Hide Years</h4>
                            <div className="visibility-list">
                                {columns.map((col, idx) => {
                                    const isActive = !hiddenColumns.includes(idx);
                                    return (
                                        <div
                                            key={idx}
                                            className={`visibility-item ${isActive ? 'active' : ''}`}
                                            onClick={() => {
                                                if (isActive) {
                                                    setHiddenColumns([...hiddenColumns, idx]);
                                                } else {
                                                    setHiddenColumns(hiddenColumns.filter(c => c !== idx));
                                                }
                                            }}
                                        >
                                            <div className="visibility-check">
                                                {isActive && <Check size={14} />}
                                            </div>
                                            <span className="visibility-label">{col}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="visibility-section" style={{ marginTop: '2rem' }}>
                            <h4 className="visibility-section-title">Show/Hide Metrics</h4>
                            <div className="visibility-list">
                                {(currentFinancialData.metrics || []).map((metric) => {
                                    const isActive = !hiddenRows.includes(metric.name);
                                    return (
                                        <div
                                            key={metric.name}
                                            className={`visibility-item ${isActive ? 'active' : ''}`}
                                            onClick={() => {
                                                if (isActive) {
                                                    setHiddenRows([...hiddenRows, metric.name]);
                                                } else {
                                                    setHiddenRows(hiddenRows.filter(r => r !== metric.name));
                                                }
                                            }}
                                        >
                                            <div className="visibility-check">
                                                {isActive && <Check size={14} />}
                                            </div>
                                            <span className="visibility-label">{metric.name}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </Window>
            )}
        </>
    );
};

export default FinancialStatementsTable;
