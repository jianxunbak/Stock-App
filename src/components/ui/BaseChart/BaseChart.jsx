import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronDown } from 'lucide-react';
import Button from '../Button/Button';
import DropdownButton from '../DropdownButton/DropdownButton';
import './BaseChart.css';

/**
 * BaseChart Component
 * A reusable chart component based on Recharts.
 *
 * @param {Array} data - Array of data objects for the chart.
 * @param {Array} series - Array of series to render: [{ id, name, dataKey, color }].
 * @param {string} currency - Currency symbol for formatting (default: '$').
 * @param {boolean} showGrid - Whether to show the grid (default: true).
 * @param {boolean} showXAxis - Whether to show the X axis (default: true).
 * @param {boolean} showYAxis - Whether to show the Y axis (default: true).
 * @param {function} tooltipFormatter - Optional custom tooltip formatter.
 */
const BaseChart = ({
    data = [],
    series = [],
    currency = '$',
    showGrid = true,
    showXAxis = true,
    showYAxis = true,
    // --- Props for Time Range ---
    activeTimeRange = 'YTD',
    onTimeRangeChange,
    xAxisFormatter,
    yAxisFormatter, // Optional custom Y-axis tick formatter
    tooltipValueFormatter, // Optional custom tooltip value formatter
    extraControls, // Optional extra controls to render in the header
    height = 300,
}) => {
    const timeRanges = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'All'];

    // --- Custom Tooltip ---
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="custom-tooltip">
                    <span className="tooltip-date">{label}</span>
                    <div className="tooltip-items">
                        {payload.map((entry, index) => (
                            <div key={index} className="tooltip-item" style={{ color: entry.color }}>
                                <span className="tooltip-name">{entry.name}:</span>
                                <span className="tooltip-value">
                                    {tooltipValueFormatter ? tooltipValueFormatter(entry.value) : `${currency}${Number(entry.value).toFixed(2)}`}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="base-chart-wrapper">
            {/* Time Range Selector (Integrated) & Extra Controls */}
            {onTimeRangeChange && (
                <div className="base-chart-controls">
                    <DropdownButton
                        label={activeTimeRange}
                        buttonStyle={{ width: '36px', height: '36px', padding: 0, fontSize: '0.75rem' }}
                        items={timeRanges.map(period => ({
                            label: period,
                            isActive: activeTimeRange === period,
                            onClick: () => onTimeRangeChange(period),
                        }))}
                        closeOnSelect={true}
                        align="left"
                    />
                    {extraControls}
                </div>
            )}

            <div className="base-chart-container" style={{ height }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        style={{ outline: 'none' }}
                        margin={{ top: 10, right: 0, left: -40, bottom: 0 }}
                    >
                        <defs>
                            {/* Create dynamic gradients for each series */}
                            {series.map((s) => (
                                <linearGradient key={s.id} id={`gradient-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={s.color} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                                </linearGradient>
                            ))}
                        </defs>
                        {showGrid && (
                            <CartesianGrid
                                vertical={false}
                                stroke="var(--neu-shadow-dark)"
                                strokeOpacity={0.1}
                                strokeDasharray="3 3"
                            />
                        )}
                        {showXAxis && (
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tickMargin={10}
                                minTickGap={30}
                                tickFormatter={xAxisFormatter}
                            />
                        )}
                        {showYAxis && (
                            <YAxis
                                domain={['auto', 'auto']}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'var(--neu-text-tertiary)', fontSize: 12, dx: -10 }}
                                width={50}
                                tickFormatter={yAxisFormatter || ((val) => `${val}`)}
                            />
                        )}
                        <Tooltip content={<CustomTooltip />} />

                        {series.map((s, index) => {
                            // We assume the first series or a series with id='main' is the primary one
                            const isMain = s.id === 'main' || index === 0;

                            return (
                                <Area
                                    key={s.id}
                                    type="monotone"
                                    dataKey={s.dataKey}
                                    name={s.name}
                                    stroke={s.color}
                                    strokeWidth={2}
                                    strokeDasharray={s.strokeDasharray || ""}
                                    fillOpacity={isMain ? 1 : 0}
                                    fill={isMain ? `url(#gradient-${s.id})` : "none"}
                                    connectNulls={true}
                                />
                            );
                        })}
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default BaseChart;
