import React, { useState } from 'react';
import StyledCard from '../StyledCard/StyledCard';
import Button from '../Button/Button';
import { Download, Filter, MoreHorizontal } from 'lucide-react';
import Menu from '../Menu';
import { useColumnResize } from '../../hooks/useColumnResize';
import './FinancialStatementsTable.css';

/**
 * FinancialStatementsTable Component
 * 
 * Displays financial data (Income Statement, Balance Sheet, Cash Flow)
 * in a tabbed, interactive table format.
 */
const FinancialStatementsTable = ({
    title = "Financial Statements",
    data = {}, // Object containing { income: [], balance: [], cash: [] }
    className = "",
    variant = "default",
    ...props
}) => {
    const [activeTab, setActiveTab] = useState('income');

    const tabs = [
        { id: 'income', label: 'Income Statement' },
        { id: 'balance', label: 'Balance Sheet' },
        { id: 'cash', label: 'Cash Flow' }
    ];

    // Mock data with TTM and 5 years history
    const mockData = {
        income: [
            { id: 'rev', label: 'Total Revenue', values: [15500, 15000, 14200, 13500, 12800, 12000], type: 'section' },
            { id: 'cogs', label: 'Cost of Revenue', values: [8800, 8500, 8100, 7800, 7500, 7000], indent: 1 },
            { id: 'gp', label: 'Gross Profit', values: [6700, 6500, 6100, 5700, 5300, 5000], type: 'total' },
            { id: 'opex', label: 'Operating Expenses', values: [3300, 3200, 3100, 3000, 2900, 2800], type: 'section' },
            { id: 'rnd', label: 'Research & Development', values: [1250, 1200, 1150, 1100, 1050, 1000], indent: 1 },
            { id: 'sga', label: 'Selling, General & Admin', values: [2050, 2000, 1950, 1900, 1850, 1800], indent: 1 },
            { id: 'opinc', label: 'Operating Income', values: [3400, 3300, 3000, 2700, 2400, 2200], type: 'total' },
            { id: 'netinc', label: 'Net Income', values: [2900, 2800, 2550, 2300, 2100, 1900], type: 'total', highlight: true }
        ],
        balance: [
            { id: 'assets', label: 'Total Assets', values: [46000, 45000, 42000, 39000, 36000, 33000], type: 'section' },
            { id: 'cashAssets', label: 'Cash & Short Term Inv.', values: [13000, 12000, 10000, 8000, 7000, 6000], indent: 1 },
            { id: 'currAssets', label: 'Total Current Assets', values: [23000, 22000, 20000, 18000, 16000, 14000], indent: 1 },
            { id: 'liab', label: 'Total Liabilities', values: [21000, 20000, 19000, 18000, 17000, 16000], type: 'section' },
            { id: 'ltdebt', label: 'Long Term Debt', values: [8200, 8000, 7500, 7000, 6500, 6000], indent: 1 },
            { id: 'equity', label: 'Total Equity', values: [26000, 25000, 23000, 21000, 19000, 17000], type: 'total' }
        ],
        cash: [
            { id: 'ops', label: 'Cash from Operations', values: [5800, 5500, 5000, 4800, 4500, 4200], type: 'section' },
            { id: 'inv', label: 'Cash from Investing', values: [-1300, -1200, -1500, -2000, -1800, -1600], type: 'section' },
            { id: 'fin', label: 'Cash from Financing', values: [-900, -800, -500, -200, -100, 0], type: 'section' },
            { id: 'fcf', label: 'Free Cash Flow', values: [4500, 4300, 3500, 2800, 2700, 2600], type: 'total', highlight: true }
        ]
    };

    const currentData = data[activeTab] || mockData[activeTab] || [];

    // Columns: TTM first, then 5 years descending
    const columns = ['TTM', '2023', '2022', '2021', '2020', '2019'];

    // Initial widths
    const initialWidths = {
        'breakdown': 125, // First column
    };
    columns.forEach((col, i) => initialWidths[`col-${i}`] = 100);

    const { columnWidths, handleResizeStart, isResizing } = useColumnResize(initialWidths, 80);

    const formatCurrency = (val) => {
        if (typeof val !== 'number') return val;
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
    };

    return (
        <StyledCard
            title={title}
            className={`financial-table-card ${className}`}
            variant={variant}
            expanded={true}
            headerAlign="start"
            controls={
                <Menu
                    trigger={
                        <Button variant="icon">
                            <MoreHorizontal size={18} />
                        </Button>
                    }
                    orientation="horizontal"
                    placement="bottom-right"
                >
                    <Button onClick={() => console.log('Export')} title="Export CSV">
                        <Download size={16} />
                    </Button>
                    <Button onClick={() => console.log('Filter')} title="Filter View">
                        <Filter size={16} />
                    </Button>
                </Menu>
            }
            {...props}
        >
            <div className={`financial-table-wrapper ${isResizing ? 'resizing' : ''}`}>
                {/* Tabs */}
                <div className="fs-tabs">
                    {tabs.map((tab) => (
                        <Button
                            key={tab.id}
                            className={`fs-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                minWidth: 'fit-content',
                                padding: '0 1rem'
                            }}
                        >
                            {tab.label}
                        </Button>
                    ))}
                </div>

                {/* Table */}
                <div className="fs-table-container">
                    <table className="fs-table">
                        <thead>
                            <tr>
                                <th
                                    style={{
                                        width: columnWidths['breakdown'],
                                        minWidth: columnWidths['breakdown'],
                                        maxWidth: columnWidths['breakdown']
                                    }}
                                >
                                    Breakdown
                                    <div
                                        className="resize-handle"
                                        onMouseDown={(e) => handleResizeStart(e, 'breakdown')}
                                    />
                                </th>
                                {columns.map((col, i) => (
                                    <th
                                        key={i}
                                        style={{
                                            width: columnWidths[`col-${i}`],
                                            minWidth: columnWidths[`col-${i}`],
                                            maxWidth: columnWidths[`col-${i}`]
                                        }}
                                    >
                                        {col}
                                        <div
                                            className="resize-handle"
                                            onMouseDown={(e) => handleResizeStart(e, `col-${i}`)}
                                        />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {currentData.map((row, idx) => (
                                <tr
                                    key={row.id || idx}
                                    className={`fs-row ${row.type === 'total' ? 'total-row' : ''} ${row.type === 'section' ? 'section-header' : ''}`}
                                >
                                    <td
                                        className={`fs-cell-label ${row.indent ? `indent-${row.indent}` : ''}`}
                                        style={{
                                            width: columnWidths['breakdown'],
                                            minWidth: columnWidths['breakdown'],
                                            maxWidth: columnWidths['breakdown']
                                        }}
                                    >
                                        {row.label}
                                    </td>
                                    {row.values.map((val, vIdx) => (
                                        <td key={vIdx} className={val < 0 ? 'fs-val-negative' : ''}>
                                            {formatCurrency(val)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </StyledCard>
    );
};

export default FinancialStatementsTable;
