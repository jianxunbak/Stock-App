import React, { useMemo } from 'react';
import ExpandableCard from '../../ui/ExpandableCard/ExpandableCard';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import {
    AlertTriangle, Cpu, Landmark, Activity, ShoppingBag, Zap,
    Building, Smartphone, Factory, Lightbulb, Box, TrendingUp,
    Target, BadgeDollarSign, Shield, Rocket, RefreshCw, PieChart as PieChartIcon
} from 'lucide-react';
import styles from './AllocationCard.module.css';

const CAT_TARGETS = {
    "Speculative": { min: 0, max: 10 },
    "Growth": { min: 30, max: 40 },
    "Core": { min: 20, max: 30 },
    "Compounder": { min: 20, max: 25 },
    "Defensive": { min: 15, max: 20 }
};

const SECTOR_LIMITS = {
    'Information Technology': 30,
    'Technology': 30,
    'Financials': 25,
    'Financial Services': 25,
    'Healthcare': 20,
    'Communication Services': 20,
    'Consumer Defensive': 20,
    'Non-Cyclical': 20
};

const getStatusColor = (name, pct, isSector = false) => {
    if (isSector) {
        const limit = SECTOR_LIMITS[name] || 15;
        if (pct > limit) return '#EF4444'; // Red: Too High
        return '#10B981'; // Green: Ideal
    }

    const target = CAT_TARGETS[name];
    if (!target) return '#9CA3AF'; // Gray: Uncategorized

    if (pct > target.max) return '#EF4444'; // Red: Too High
    if (pct < target.min) return '#F59E0B'; // Amber: Too Low
    return '#10B981'; // Green: Ideal
};

const AllocationCard = ({
    portfolioList,
    portfolioLength,
    openCards,
    toggleCard,
    categoryData,
    sectorData,
    totalValue,
    currencySymbol,
    isMounted,
    onRefresh,
    onHide
}) => {
    if (!portfolioList || portfolioList.length === 0) return null;

    const getIconForName = (name) => {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('tech')) return <Cpu size={16} />;
        if (lowerName.includes('finance') || lowerName.includes('bank')) return <Landmark size={16} />;
        if (lowerName.includes('health') || lowerName.includes('med')) return <Activity size={16} />;
        if (lowerName.includes('consum') || lowerName.includes('retail')) return <ShoppingBag size={16} />;
        if (lowerName.includes('energy') || lowerName.includes('oil')) return <Zap size={16} />;
        if (lowerName.includes('real estate') || lowerName.includes('reit')) return <Building size={16} />;
        if (lowerName.includes('comm') || lowerName.includes('media')) return <Smartphone size={16} />;
        if (lowerName.includes('industr')) return <Factory size={16} />;
        if (lowerName.includes('utilit')) return <Lightbulb size={16} />;
        if (lowerName.includes('material')) return <Box size={16} />;

        // Categories
        if (lowerName.includes('growth')) return <TrendingUp size={16} />;
        if (lowerName.includes('core')) return <Target size={16} />;
        if (lowerName.includes('dividend') || lowerName.includes('yield')) return <BadgeDollarSign size={16} />;
        if (lowerName.includes('safe') || lowerName.includes('defens')) return <Shield size={16} />;
        if (lowerName.includes('speculat')) return <Rocket size={16} />;
        if (lowerName.includes('compound')) return <RefreshCw size={16} />;

        return <PieChartIcon size={16} />;
    };

    const renderChartSection = (title, data, isSector) => {
        const sortedData = [...data].sort((a, b) => b.value - a.value);

        const CustomTooltip = ({ active, payload }) => {
            if (active && payload && payload.length) {
                const { name, value } = payload[0].payload;
                const pct = totalValue > 0 ? (value / totalValue) * 100 : 0;
                const color = getStatusColor(name, pct, isSector);

                return (
                    <div className={styles.chartTooltip}>
                        <div className={styles.tooltipHeader}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color, marginRight: '0.5rem' }} />
                            {name}
                        </div>
                        <div className={styles.tooltipItems}>
                            <div className={styles.tooltipItem}>
                                <span className={styles.tooltipLabel}>Value:</span>
                                <span className={styles.tooltipValue}>
                                    {currencySymbol}{value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </span>
                            </div>
                            <div className={styles.tooltipItem}>
                                <span className={styles.tooltipLabel}>Weight:</span>
                                <span className={styles.tooltipValue}>
                                    {pct.toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    </div>
                );
            }
            return null;
        };

        return (
            <div className={styles.allocationColumn}>
                <h3 className={styles.allocationTitle}>{title}</h3>
                <div className={styles.allocationContent}>
                    {/* Donut Chart */}
                    <div className={styles.donutChartContainer}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={110}
                                    outerRadius={140}
                                    paddingAngle={5}
                                    dataKey="value"
                                    animationBegin={0}
                                    animationDuration={1500}
                                >
                                    {data.map((entry, index) => {
                                        const pct = totalValue > 0 ? (entry.value / totalValue) * 100 : 0;
                                        const color = getStatusColor(entry.name, pct, isSector);
                                        return <Cell key={`cell-${index}`} fill={color} stroke="none" />;
                                    })}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 1001, outline: 'none' }} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className={styles.chartCenterText}>
                            <span className={styles.centerValue}>{currencySymbol}{(totalValue / 1000).toFixed(1)}k</span>
                            <span className={styles.centerLabel}>Total Value</span>
                        </div>
                    </div>

                    {/* Breakdown List */}
                    <div className={styles.allocationList}>
                        {sortedData.map((entry, index) => {
                            const pct = totalValue > 0 ? (entry.value / totalValue) * 100 : 0;
                            const color = getStatusColor(entry.name, pct, isSector);

                            let targetStr = "";
                            if (isSector) {
                                const limit = SECTOR_LIMITS[entry.name] || 15;
                                targetStr = `Max ${limit}%`;
                            } else {
                                const target = CAT_TARGETS[entry.name];
                                if (target) targetStr = `${target.min}-${target.max}%`;
                            }

                            return (
                                <div key={index} className={styles.allocationRow}>
                                    <div className={styles.assetInfo}>
                                        <div className={styles.assetIcon} style={{ background: color }}>
                                            {getIconForName(entry.name)}
                                        </div>
                                        <div>
                                            <span className={styles.assetName}>{entry.name}</span>
                                            {targetStr && <span className={styles.targetText}>{targetStr}</span>}
                                        </div>
                                    </div>
                                    <div className={styles.assetValue}>
                                        {currencySymbol}{entry.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </div>
                                    <div className={styles.assetPct} style={{ color: color }}>
                                        {pct.toFixed(1)}%
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    const menuItems = [
        {
            label: 'Refresh Data',
            onClick: () => onRefresh && onRefresh(),
            indicatorNode: <RefreshCw size={14} />
        }
    ];

    const summaryCharts = (
        <div className={styles.summaryContainer}>
            <div className={styles.summaryHeaderTitle}>Allocation</div>
            <div className={styles.summaryChartsRow}>
                {/* Category Summary */}
                <div className={styles.summaryChart}>
                    <div className={styles.summaryLabel}>Category</div>
                    <div style={{ width: 80, height: 80 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={25}
                                    outerRadius={40}
                                    paddingAngle={2}
                                    dataKey="value"
                                    isAnimationActive={false}
                                >
                                    {categoryData.map((entry, index) => {
                                        const pct = totalValue > 0 ? (entry.value / totalValue) * 100 : 0;
                                        const color = getStatusColor(entry.name, pct, false);
                                        return <Cell key={`cell-${index}`} fill={color} stroke="none" />;
                                    })}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Sector Summary */}
                <div className={styles.summaryChart}>
                    <div className={styles.summaryLabel}>Sector</div>
                    <div style={{ width: 80, height: 80 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={sectorData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={25}
                                    outerRadius={40}
                                    paddingAngle={2}
                                    dataKey="value"
                                    isAnimationActive={false}
                                >
                                    {sectorData.map((entry, index) => {
                                        const pct = totalValue > 0 ? (entry.value / totalValue) * 100 : 0;
                                        const color = getStatusColor(entry.name, pct, true);
                                        return <Cell key={`cell-${index}`} fill={color} stroke="none" />;
                                    })}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <ExpandableCard
            title="Allocation"
            expanded={openCards.allocation}
            defaultExpanded={openCards.allocation}
            onToggle={() => toggleCard('allocation')}
            onHide={onHide}
            menuItems={menuItems}
            headerContent={summaryCharts}
        >
            <div className={styles.allocationGrid}>
                {portfolioLength === 0 ? (
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', padding: '1rem', fontStyle: 'italic', display: 'flex', gap: '0.5rem' }}>
                        <AlertTriangle size={14} /> There are currently no stocks in this portfolio.
                    </div>
                ) : (
                    <>
                        {renderChartSection("Category Allocation", categoryData, false)}
                        {renderChartSection("Sector Allocation", sectorData, true)}
                    </>
                )}
            </div>

            {/* Minimal Legend */}
            {portfolioLength > 0 && (
                <div className={styles.legendContainer}>
                    <div className={styles.legendItem}>
                        <div className={styles.legendDot} style={{ backgroundColor: '#10B981' }} />
                        <span>On Target / Ideal</span>
                    </div>
                    <div className={styles.legendItem}>
                        <div className={styles.legendDot} style={{ backgroundColor: '#F59E0B' }} />
                        <span>Underweight</span>
                    </div>
                    <div className={styles.legendItem}>
                        <div className={styles.legendDot} style={{ backgroundColor: '#EF4444' }} />
                        <span>Overweight</span>
                    </div>
                </div>
            )}
        </ExpandableCard>
    );
};

export default AllocationCard;
