import React, { useState, useMemo } from 'react';
import { MoreVertical, Landmark, Calculator, Activity, Calendar, Clock, ChevronUp, ChevronDown, GripVertical, Maximize } from 'lucide-react';
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
    stackControls = false,
    ...props
}) => {
    const { stockData, loading, loadStockData } = useStockData();
    const [activeTab, setActiveTab] = useState('income_statement');

    const tabs = [
        { id: 'income_statement', label: 'Income Statement', icon: <Landmark size={16} /> },
        { id: 'balance_sheet', label: 'Balance Sheet', icon: <Calculator size={16} /> },
        { id: 'cash_flow', label: 'Cash Flow', icon: <Activity size={16} /> },
    ];

    const financials = stockData?.financials || {};
    const currentFinancialData = financials[activeTab] || { dates: [], metrics: [] };
    const columns = currentFinancialData.dates || [];

    const rows = useMemo(() => {
        return (currentFinancialData.metrics || []).map((metric, idx) => ({
            id: `metric-${idx}`,
            label: metric.name,
            values: metric.values.map(val => typeof val === 'number' ? val * currentRate : val),
            type: metric.name.toLowerCase().includes('total') || metric.name.toLowerCase().includes('net') ? 'total' : 'default'
        }));
    }, [currentFinancialData, currentRate]);

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

    if (loading && !stockData) return <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
    if (!stockData || !stockData.financials) return null;

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
        <ExpandableCard
            title={title}
            defaultExpanded={isOpen}
            onToggle={onToggle}
            collapsedWidth={220}
            collapsedHeight={220}
            headerContent={header}
            className={`fs-table-card ${className}`}
            controls={isOpen ? combinedControls : null}
            menuItems={menuItems}
            stackControls={stackControls}
            onRefresh={() => stockData?.overview?.symbol && loadStockData(stockData.overview.symbol, true)}
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
                                            <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'breakdown')}>
                                                <GripVertical size={12} />
                                            </div>
                                        </th>
                                        {columns.map((col, i) => (
                                            <th key={i} className="fs-th" style={{ width: columnWidths[`col-${i}`] }} onClick={() => handleSort(`col-${i}`)}>
                                                <div className="watchlist-th-content">
                                                    <span className="watchlist-th-label">{col}</span>
                                                    {sortConfig.key === `col-${i}` && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                                </div>
                                                <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, `col-${i}`)}>
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
                                            {row.values.map((val, vIdx) => (
                                                <td key={vIdx} className={`fs-td ${val < 0 ? 'fs-val-negative' : ''}`} style={{ width: columnWidths[`col-${vIdx}`] }}>
                                                    {formatCurrency(val)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </ExpandableCard>
    );
};

export default FinancialStatementsTable;
