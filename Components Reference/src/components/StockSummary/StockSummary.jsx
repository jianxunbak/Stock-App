import React from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import './StockSummary.css';

const StockSummary = ({
    name,
    ticker,
    price,
    change,
    changePercent,
    score,
    chartData = []
}) => {
    const isPositive = change?.startsWith('+');

    // Health Ring Logic
    const getScoreColor = (s) => {
        if (s >= 80) return 'var(--neu-success)';
        if (s >= 60) return 'var(--neu-color-favorite)';
        return 'var(--neu-error)';
    };

    const strokeColor = getScoreColor(score);
    const radius = 15;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    const hasIdentity = ticker || name || price;
    const hasHealth = score !== undefined && score !== null;
    const hasChart = chartData && chartData.length > 0;

    return (
        <div className={`stock-summary-container ${!hasIdentity ? 'no-identity' : ''} ${!hasHealth ? 'no-health' : ''} ${!hasChart ? 'no-chart' : ''}`}>
            {/* Direct children for precise grid mapping */}

            {/* Main Info */}
            {hasIdentity && (
                <div className="summary-info">
                    {name && <div className="summary-name">{name.split(' ')[0]}</div>}
                    {ticker && <div className="summary-ticker">{ticker}</div>}
                    {price && <div className="summary-price">${price}</div>}
                </div>
            )}

            {/* Health Row */}
            {hasHealth && (
                <div className="summary-health">
                    <div className="summary-ring-wrapper">
                        <svg width="34" height="34" viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)' }}>
                            <circle cx="20" cy="20" r={radius} stroke="var(--neu-shadow-dark)" strokeWidth="3" fill="none" opacity="0.15" />
                            <circle
                                cx="20" cy="20" r={radius}
                                stroke={strokeColor}
                                strokeWidth="3"
                                fill="none"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                            />
                        </svg>
                        <span className="summary-score" style={{ color: strokeColor }}>{score}</span>
                    </div>
                </div>
            )}

            {/* Performance Chart */}
            {hasChart && (
                <div className="summary-chart">
                    <div className="summary-chart-inner">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={isPositive ? 'var(--neu-success)' : 'var(--neu-error)'} stopOpacity={0.2} />
                                        <stop offset="95%" stopColor={isPositive ? 'var(--neu-success)' : 'var(--neu-error)'} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area
                                    type="monotone"
                                    dataKey="price"
                                    stroke={isPositive ? 'var(--neu-success)' : 'var(--neu-error)'}
                                    strokeWidth={2}
                                    fill="url(#sparklineGradient)"
                                    dot={false}
                                    isAnimationActive={false}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockSummary;
