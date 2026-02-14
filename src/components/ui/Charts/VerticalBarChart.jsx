import React, { useMemo } from 'react';
import {
    ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useTheme } from '../../../context/ThemeContext';

const CustomTooltip = ({ active, payload, label, currencySymbol, valueFormatter }) => {
    if (active && payload && payload.length) {
        return (
            <div className="custom-tooltip">
                <span className="tooltip-date">{label}</span>
                <div className="tooltip-items">
                    {payload.map((entry, index) => (
                        <div key={index} className="tooltip-item" style={{ color: entry.fill }}>
                            <span className="tooltip-name">{entry.name}:</span>
                            <span className="tooltip-value">
                                {valueFormatter(entry.value)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

const VerticalBarChart = ({
    data,
    series,
    currencySymbol = '$',
    height = 300,
    valueFormatter = (val) => val
}) => {
    const { theme } = useTheme();

    const chartColors = useMemo(() => {
        const isDark = theme === 'dark';
        return {
            grid: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
            text: isDark ? "#9CA3AF" : "#6b7280",
        };
    }, [theme]);

    const formattedData = useMemo(() => {
        return data.map(d => ({
            ...d,
            year: d.date ? d.date.split('-')[0] : ''
        }));
    }, [data]);

    if (!data || data.length === 0) {
        return <div style={{
            height,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            color: 'var(--text-tertiary)',
            fontSize: '0.9rem'
        }}>No data available</div>;
    }

    // Ultra-slim bar size to match reference look
    const barSize = 8;

    return (
        <div style={{ width: '100%', height: height, boxSizing: 'border-box' }}>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={formattedData} margin={{ top: 10, right: 0, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                    <XAxis
                        dataKey="year"
                        stroke={chartColors.text}
                        tick={{ fontSize: 10, fill: chartColors.text }}
                        axisLine={false}
                        tickLine={false}
                        tickMargin={10}
                    />
                    <YAxis
                        stroke={chartColors.text}
                        tick={false}
                        axisLine={false}
                        tickLine={false}
                        width={0}
                    />
                    <Tooltip
                        content={
                            <CustomTooltip
                                currencySymbol={currencySymbol}
                                valueFormatter={valueFormatter}
                            />
                        }
                        cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                    />
                    <Legend
                        wrapperStyle={{
                            paddingTop: '0px',
                            fontSize: '10px',
                            opacity: 0.8
                        }}
                        layout="horizontal"
                        align="left"
                        verticalAlign="bottom"
                        iconSize={8}
                    />
                    {series.map((s) => (
                        <Bar
                            key={s.dataKey}
                            dataKey={s.dataKey}
                            name={s.name}
                            fill={s.color}
                            barSize={barSize}
                            radius={[2, 2, 0, 0]}
                        />
                    ))}
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
};

export default VerticalBarChart;
