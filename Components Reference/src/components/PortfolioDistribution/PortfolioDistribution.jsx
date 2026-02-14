import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieChartIcon, ArrowUpRight, ArrowDownRight, Layers } from 'lucide-react';
import StyledCard from '../StyledCard/StyledCard';
import './PortfolioDistribution.css';

const DEFAULT_COLORS = [
    '#6366f1', // Indigo
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#f97316', // Orange
];

const PortfolioDistribution = ({
    data = [],
    title = "Portfolio Distribution",
    centerLabel = "Total Value",
    currency = "$"
}) => {
    // Calculate total value for the center of the donut
    const totalValue = useMemo(() =>
        data.reduce((sum, item) => sum + item.value, 0),
        [data]
    );

    // Format currency
    const formatValue = (val) => `${currency}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Custom Tooltip for the Pie Chart
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const { name, value, percent } = payload[0].payload;
            return (
                <div className="chart-tooltip">
                    <span className="tooltip-name">{name}</span>
                    <span className="tooltip-value">
                        {formatValue(value)} ({(percent * 100).toFixed(1)}%)
                    </span>
                </div>
            );
        }
        return null;
    };

    return (
        <StyledCard title={title} className="portfolio-distribution-card">
            <div className="portfolio-distribution-content">

                {/* Top Section: Chart and Legend */}
                <div className="chart-section">
                    <div className="donut-chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                    animationBegin={0}
                                    animationDuration={1500}
                                >
                                    {data.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                                            stroke="none"
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    content={<CustomTooltip />}
                                    wrapperStyle={{ zIndex: 1001 }}
                                />
                            </PieChart>
                        </ResponsiveContainer>

                        <div className="chart-center-text">
                            <span className="center-value">{formatValue(totalValue)}</span>
                            <span className="center-label">{centerLabel}</span>
                        </div>
                    </div>

                    <div className="legend-container">
                        {data.slice(0, 6).map((item, index) => (
                            <div key={item.name} className="legend-item">
                                <div
                                    className="legend-color"
                                    style={{ background: item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length] }}
                                />
                                <span>{item.name}</span>
                                <span className="legend-percentage">
                                    {((item.value / totalValue) * 100).toFixed(1)}%
                                </span>
                            </div>
                        ))}
                        {data.length > 6 && (
                            <div className="legend-item" style={{ fontStyle: 'italic', opacity: 0.7 }}>
                                <span>+ {data.length - 6} more assets</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Section: Breakdown List */}
                <div className="breakdown-section">
                    <h3 className="breakdown-title">
                        <Layers size={18} />
                        Asset Breakdown
                    </h3>
                    <div className="breakdown-list">
                        {data.map((item, index) => (
                            <div key={item.ticker || item.name} className="breakdown-row">
                                <div className="asset-info">
                                    <div
                                        className="asset-icon"
                                        style={{ background: item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length] }}
                                    >
                                        {item.ticker ? item.ticker.substring(0, 2) : item.name.substring(0, 2)}
                                    </div>
                                    <div className="asset-names">
                                        <span className="asset-ticker">{item.ticker || item.name}</span>
                                        <span className="asset-name">{item.name}</span>
                                    </div>
                                </div>

                                <div className="asset-value">
                                    {formatValue(item.value)}
                                </div>

                                <div className="asset-allocation">
                                    {((item.value / totalValue) * 100).toFixed(1)}%
                                </div>

                                <div className={`asset-change ${item.change >= 0 ? 'positive' : 'negative'}`}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }}>
                                        {item.change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                        {Math.abs(item.change).toFixed(2)}%
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </StyledCard>
    );
};

export default PortfolioDistribution;
