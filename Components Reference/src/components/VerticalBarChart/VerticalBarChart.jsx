import React from 'react';
import StyledCard from '../StyledCard/StyledCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import './VerticalBarChart.css';

/**
 * VerticalBarChart Component
 * 
 * Displays a vertical bar chart inside a StyledCard.
 * 
 * @param {Array} data - Array of data objects
 * @param {string} title - Title of the chart
 * @param {string} xAxisKey - Key for X-axis labels
 * @param {string} dataKey - Key for the data values
 * @param {string} barColor - Color of the bars (optional, defaults to primary theme color)
 * @param {string} className - Additional CSS classes
 */
const VerticalBarChart = ({
    data = [],
    title = "Analysis",
    xAxisKey = "name",
    dataKey = "value",
    barColor = "var(--neu-color-favorite)",
    className = "",
    variant = "default",
    ...props
}) => {
    return (
        <StyledCard
            expanded={true}
            title={title}
            className={`vertical-bar-chart-card ${className}`}
            variant={variant}
            headerAlign="start"
            {...props}
        >
            <div className="vertical-bar-chart-container">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        style={{ outline: 'none' }}
                        margin={{
                            top: 20,
                            right: 20,
                            left: 0,
                            bottom: 5,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--neu-border-subtle)" opacity={0.5} />
                        <XAxis
                            dataKey={xAxisKey}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--neu-text-secondary)', fontSize: 12 }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--neu-text-secondary)', fontSize: 12 }}
                            width={40}
                        />
                        <Tooltip
                            cursor={{ fill: 'var(--neu-bg)', opacity: 0.1 }}
                            contentStyle={{
                                background: 'var(--neu-bg)',
                                border: 'none',
                                borderRadius: 'var(--neu-radius-sm)',
                                boxShadow: 'var(--neu-card-shadow)',
                                color: 'var(--neu-text-primary)'
                            }}
                            itemStyle={{ color: 'var(--neu-text-primary)' }}
                            labelStyle={{ color: 'var(--neu-text-secondary)', marginBottom: '0.25rem' }}
                        />
                        <Bar
                            dataKey={dataKey}
                            fill={barColor}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={30}
                            animationDuration={1500}
                        >
                            {/* Optional: Add custom cell coloring logic if needed, 
                                e.g. different colors for positive/negative values */}
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry[dataKey] >= 0 ? barColor : 'var(--neu-error)'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </StyledCard>
    );
};

export default VerticalBarChart;
