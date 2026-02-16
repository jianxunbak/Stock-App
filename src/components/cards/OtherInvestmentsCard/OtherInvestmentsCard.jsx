import React, { useState, useEffect, useMemo } from 'react';
import ExpandableCard from '../../ui/ExpandableCard/ExpandableCard';
import { Settings, Plus, Trash2, FolderPlus, ChevronDown, TrendingUp } from 'lucide-react';
import Button from '../../ui/Button';
import Window from '../../ui/Window/Window';
import DropdownButton from '../../ui/DropdownButton/DropdownButton';
import CustomDatePicker from '../../ui/CustomDatePicker/CustomDatePicker';
import BaseChart from '../../ui/BaseChart/BaseChart';
import styles from './OtherInvestmentsCard.module.css';
import { useUserSettings } from '../../../hooks/useUserSettings';

const getAge = (dob) => {
    if (!dob) return null;
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
};

const normalizeInvestments = (data) => {
    if (!data) return { items: [], groups: [] };

    // Support legacy array format
    const sourceData = Array.isArray(data) ? { items: data, groups: [] } : data;

    const processItem = (item) => ({
        ...item,
        investedAmount: Number(item.investedAmount || item.principal || 0),
        paymentAmount: Number(item.paymentAmount || 0),
        value: Number(item.value || 0),
        startDate: item.startDate || new Date().toISOString().split('T')[0],
        projectedGrowth: Number(item.projectedGrowth || 0),
        frequency: item.frequency || 'One-time'
    });

    return {
        items: (sourceData.items || []).map(processItem),
        groups: (sourceData.groups || []).map(group => ({
            ...group,
            items: (group.items || []).map(processItem)
        }))
    };
};

// Iterative TWR calculation (assuming constant return between cash flows)
const calculateTWR = (principal, payment, frequency, currentValue, startDate) => {
    if (principal <= 0 && payment <= 0) return 0;

    const start = new Date(startDate);
    const end = new Date();

    // Difference in months
    let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    // Add fraction of month
    const days = end.getDate() - start.getDate();
    months += days / 30;

    if (months <= 0.1) {
        // Simple ROI if less than 3 days
        const totalIn = principal + payment;
        return totalIn > 0 ? ((currentValue / totalIn) - 1) * 100 : 0;
    }

    // Determine total payments and effective monthly contribution
    let effectiveP = 0;
    let totalP = 0;
    if (frequency === 'Monthly') {
        effectiveP = payment;
        totalP = Math.floor(months) * payment;
    } else if (frequency === 'Quarterly') {
        effectiveP = payment / 3;
        totalP = Math.floor(months / 3) * payment;
    } else if (frequency === 'Yearly') {
        effectiveP = payment / 12;
        totalP = Math.floor(months / 12) * payment;
    }

    // Solve for r (monthly rate) using Newton-Raphson
    // V = C0(1+r)^n + P * ((1+r)^n - 1) / r
    const C0 = principal;
    const P = effectiveP;
    const n = months;
    const V = currentValue;

    let r = (V - (C0 + totalP)) / (n * C0 + (n * (n - 1) / 2) * P);
    if (isNaN(r) || !isFinite(r)) r = 0.01;

    for (let i = 0; i < 20; i++) {
        const pow = Math.pow(1 + r, n);
        const powMinus1 = pow - 1;

        let f, df;
        if (Math.abs(r) < 0.0001) {
            // Linear approximation for very small r
            f = C0 * (1 + n * r) + P * n * (1 + (n - 1) * r / 2) - V;
            df = n * C0 + P * n * (n - 1) / 2;
        } else {
            f = C0 * pow + P * powMinus1 / r - V;
            df = n * C0 * Math.pow(1 + r, n - 1) + P * (n * Math.pow(1 + r, n - 1) * r - powMinus1) / (r * r);
        }

        if (Math.abs(f) < 0.01) break;
        if (Math.abs(df) < 0.0000001) break;
        r = r - f / df;
    }

    // TWR is (1+r)^n - 1
    const twrResult = (Math.pow(1 + r, n) - 1) * 100;
    return isNaN(twrResult) ? 0 : twrResult;
};

const OtherInvestmentsCard = ({
    isOpen = true,
    onToggle = null,
    onHide = null,
    className = ""
}) => {
    const { settings, updateSettings, loading: settingsLoading } = useUserSettings();
    const [structuredData, setStructuredData] = useState({ items: [], groups: [] });
    const [projectionYears, setProjectionYears] = useState(10);
    const [showEditor, setShowEditor] = useState(false);

    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        if (settings?.otherInvestments && !isInitialized) {
            setStructuredData(normalizeInvestments(settings.otherInvestments));
            if (settings.otherInvestments.projectionYears) {
                setProjectionYears(settings.otherInvestments.projectionYears);
            }
            setIsInitialized(true);
        }
    }, [settings, isInitialized]);

    useEffect(() => {
        if (settingsLoading) return;
        const timer = setTimeout(() => {
            const currentData = {
                ...structuredData,
                projectionYears
            };
            if (JSON.stringify(settings?.otherInvestments) !== JSON.stringify(currentData)) {
                updateSettings({
                    otherInvestments: {
                        ...(settings?.otherInvestments || {}),
                        ...currentData
                    }
                });
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [structuredData, projectionYears, settingsLoading, updateSettings, settings?.otherInvestments]);

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
        }).format(val);
    };

    const getItemMonthly = (item) => {
        const val = Number(item.paymentAmount || 0);
        if (item.frequency === 'Yearly') return val / 12;
        if (item.frequency === 'Quarterly') return val / 3;
        if (item.frequency === 'One-time') return 0;
        return val;
    };

    const totals = useMemo(() => {
        let totalAssetValue = 0;
        let totalMonthlyFlow = 0;
        let totalInvestedValue = 0;

        const processItem = (item) => {
            const v = Number(item.value || 0);
            const p = Number(item.investedAmount || 0);
            totalAssetValue += v;
            totalInvestedValue += p;
            totalMonthlyFlow += getItemMonthly(item);
        };

        structuredData.items.forEach(processItem);
        structuredData.groups.forEach(group => {
            (group.items || []).forEach(processItem);
        });

        // Portfolio-level ROI approximation
        const totalGrowth = totalInvestedValue > 0 ? ((totalAssetValue - totalInvestedValue) / totalInvestedValue) * 100 : 0;

        return { totalAssetValue, totalMonthlyFlow, totalGrowth };
    }, [structuredData]);

    const chartData = useMemo(() => {
        const allItems = [
            ...structuredData.items,
            ...structuredData.groups.flatMap(g => g.items || [])
        ];

        const data = [];
        const startYear = new Date().getFullYear();
        const currentAge = getAge(settings?.dateOfBirth);

        for (let y = 0; y <= projectionYears; y++) {
            const point = {
                date: currentAge !== null ? `Age ${currentAge + y}` : `Year ${y}`,
                year: startYear + y,
                age: currentAge !== null ? currentAge + y : null
            };
            let totalVal = 0;

            allItems.forEach(item => {
                const initialVal = Number(item.value || 0);
                const payment = Number(item.paymentAmount || 0);
                const growthRate = Number(item.projectedGrowth || 0) / 100;
                const freq = item.frequency === 'Monthly' ? 12 :
                    item.frequency === 'Quarterly' ? 4 :
                        item.frequency === 'Yearly' ? 1 : 0;

                let val = initialVal;
                if (y > 0) {
                    // Simple annual projection: (PrevVal * (1+growth)) + (Payments * freq)
                    // For more accuracy we could do period-by-period growth
                    for (let i = 0; i < y; i++) {
                        val = (val * (1 + growthRate)) + (payment * freq);
                    }
                }
                totalVal += val;
            });

            point.value = Math.round(totalVal);
            data.push(point);
        }
        return data;
    }, [structuredData, projectionYears]);

    const chartSeries = [
        { id: 'value', name: 'Projected Value', dataKey: 'value', color: 'var(--neu-success)' }
    ];

    const handleAddItem = (groupId = null) => {
        const newItem = {
            id: `item-${Date.now()}`,
            name: 'New Investment',
            value: 0,
            investedAmount: 0,
            paymentAmount: 0,
            startDate: new Date().toISOString().split('T')[0],
            projectedGrowth: 0,
            frequency: 'One-time'
        };

        if (groupId) {
            setStructuredData(prev => ({
                ...prev,
                groups: prev.groups.map(g =>
                    g.id === groupId ? { ...g, items: [...(g.items || []), newItem] } : g
                )
            }));
        } else {
            setStructuredData(prev => ({
                ...prev,
                items: [...prev.items, newItem]
            }));
        }
    };

    const handleAddGroup = () => {
        const newGroup = {
            id: `group-${Date.now()}`,
            name: 'New Group',
            items: []
        };
        setStructuredData(prev => ({
            ...prev,
            groups: [...prev.groups, newGroup]
        }));
    };

    const handleUpdateItem = (itemId, field, value, groupId = null) => {
        const val = (field === 'value' || field === 'investedAmount' || field === 'paymentAmount' || field === 'projectedGrowth')
            ? value // Allow string for typing decimals, consumers will use Number()
            : value;

        if (groupId) {
            setStructuredData(prev => ({
                ...prev,
                groups: prev.groups.map(g =>
                    g.id === groupId
                        ? { ...g, items: (g.items || []).map(i => i.id === itemId ? { ...i, [field]: val } : i) }
                        : g
                )
            }));
        } else {
            setStructuredData(prev => ({
                ...prev,
                items: (prev.items || []).map(i => i.id === itemId ? { ...i, [field]: val } : i)
            }));
        }
    };

    const handleUpdateGroup = (groupId, field, value) => {
        setStructuredData(prev => ({
            ...prev,
            groups: prev.groups.map(g => g.id === groupId ? { ...g, [field]: value } : g)
        }));
    };

    const handleRemoveItem = (itemId, groupId = null) => {
        if (groupId) {
            setStructuredData(prev => ({
                ...prev,
                groups: prev.groups.map(g =>
                    g.id === groupId ? { ...g, items: g.items.filter(i => i.id !== itemId) } : g
                )
            }));
        } else {
            setStructuredData(prev => ({
                ...prev,
                items: prev.items.filter(i => i.id !== itemId)
            }));
        }
    };

    const handleRemoveGroup = (groupId) => {
        setStructuredData(prev => ({
            ...prev,
            groups: prev.groups.filter(g => g.id !== groupId)
        }));
    };

    const header = (
        <div className="summary-info">
            <div className="summary-name">Other Investments</div>
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                rowGap: '0.25rem',
                columnGap: '1rem',
                width: '100%',
                fontSize: '0.8rem',
                alignItems: 'center'
            }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Value</span>
                <span style={{ color: 'var(--neu-success)', fontWeight: 600, textAlign: 'right' }}>
                    {formatCurrency(totals.totalAssetValue)}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Performance</span>
                    <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: totals.totalGrowth >= 0 ? 'var(--neu-success)' : 'var(--neu-danger)',
                        opacity: 0.8
                    }}>
                        ({totals.totalGrowth >= 0 ? '+' : ''}{totals.totalGrowth.toFixed(2)}%)
                    </span>
                </div>
                <span style={{ color: 'var(--neu-color-favorite)', fontWeight: 600, textAlign: 'right' }}>
                    {formatCurrency(totals.totalMonthlyFlow)}/mo
                </span>
            </div>
        </div>
    );

    const renderItemInput = (item, groupId = null) => {
        const twr = calculateTWR(item.investedAmount, item.paymentAmount, item.frequency, item.value, item.startDate);
        return (
            <div key={item.id} className={styles.detailedItem}>
                <div className={styles.detailedRow}>
                    <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>Investment Name</label>
                        <input
                            className={styles.input}
                            value={item.name}
                            onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value, groupId)}
                            placeholder="e.g. Real Estate"
                        />
                    </div>
                    <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>Payment Amount</label>
                        <div className={styles.valueWrapper}>
                            <input
                                type="number"
                                step="0.01"
                                className={styles.input}
                                value={item.paymentAmount}
                                onChange={(e) => handleUpdateItem(item.id, 'paymentAmount', e.target.value, groupId)}
                            />
                            {item.frequency !== 'Monthly' && item.frequency !== 'One-time' && (
                                <span className={styles.monthlyExtrapolation}>
                                    ≈ ${Math.round(getItemMonthly(item)).toLocaleString()}/mo
                                </span>
                            )}
                        </div>
                    </div>
                    <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>Payment Freq.</label>
                        <DropdownButton
                            label={item.frequency}
                            variant="ghost"
                            size="sm"
                            icon={<ChevronDown size={14} />}
                            closeOnSelect={true}
                            buttonStyle={{ fontSize: '0.8rem', width: '100%', justifyContent: 'space-between' }}
                            items={[
                                { label: 'One-time', onClick: () => handleUpdateItem(item.id, 'frequency', 'One-time', groupId) },
                                { label: 'Monthly', onClick: () => handleUpdateItem(item.id, 'frequency', 'Monthly', groupId) },
                                { label: 'Quarterly', onClick: () => handleUpdateItem(item.id, 'frequency', 'Quarterly', groupId) },
                                { label: 'Yearly', onClick: () => handleUpdateItem(item.id, 'frequency', 'Yearly', groupId) },
                            ]}
                        />
                    </div>
                    <Button variant="icon" size="sm" onClick={() => handleRemoveItem(item.id, groupId)}>
                        <Trash2 size={14} />
                    </Button>
                </div>

                <div className={styles.detailedSubRow}>
                    <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>Initial Principal</label>
                        <input
                            type="number"
                            step="0.01"
                            className={styles.input}
                            value={item.investedAmount}
                            onChange={(e) => handleUpdateItem(item.id, 'investedAmount', e.target.value, groupId)}
                        />
                    </div>
                    <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>Current Value</label>
                        <input
                            type="number"
                            step="0.01"
                            className={styles.input}
                            value={item.value}
                            onChange={(e) => handleUpdateItem(item.id, 'value', e.target.value, groupId)}
                        />
                    </div>
                    <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>Start Date</label>
                        <CustomDatePicker
                            value={item.startDate}
                            onChange={(date) => handleUpdateItem(item.id, 'startDate', date, groupId)}
                            triggerClassName={styles.input}
                        />
                    </div>
                    <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>Proj. Growth %</label>
                        <input
                            type="number"
                            step="0.01"
                            className={styles.input}
                            value={item.projectedGrowth}
                            onChange={(e) => handleUpdateItem(item.id, 'projectedGrowth', e.target.value, groupId)}
                            placeholder="Annual %"
                        />
                    </div>
                </div>
            </div>
        );
    };

    const menuItems = [
        {
            label: 'Edit Investments',
            indicatorNode: <Settings size={16} />,
            onClick: () => setShowEditor(true)
        }
    ];

    return (
        <ExpandableCard
            title="Other Investments"
            expanded={isOpen}
            onToggle={onToggle}
            onHide={onHide}
            collapsedWidth={220}
            collapsedHeight={220}
            headerContent={header}
            className={className}
            menuItems={menuItems}
        >
            <div className={styles.container}>
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <h4 className={styles.sectionTitle}>Projected Growth</h4>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Years:</span>
                            <input
                                type="number"
                                className={styles.input}
                                style={{ width: '60px', padding: '0.25rem 0.5rem', textAlign: 'center' }}
                                value={projectionYears}
                                onChange={(e) => setProjectionYears(e.target.value === '' ? '' : Number(e.target.value))}
                            />
                        </div>
                    </div>
                    <div className={styles.chartContainer} style={{ height: '220px', marginTop: '0.5rem' }}>
                        <BaseChart
                            data={chartData}
                            series={chartSeries}
                            height={220}
                            showGrid={true}
                            showXAxis={true}
                            showYAxis={true}
                            yAxisFormatter={(val) => {
                                if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
                                if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
                                return `$${val}`;
                            }}
                            tooltipValueFormatter={(val) => formatCurrency(val)}
                            tooltipLabelFormatter={(label, payload) => {
                                if (payload && payload.length > 0) {
                                    const item = payload[0].payload;
                                    return item.age ? `Age ${item.age} (${item.year})` : `Year ${item.year}`;
                                }
                                return label;
                            }}
                        />
                    </div>
                </div>

                <div className={styles.section}>
                    <h4 className={styles.sectionTitle}>Asset Breakdown</h4>
                    {structuredData.items.length === 0 && structuredData.groups.length === 0 ? (
                        <div className={styles.emptyState}>
                            No other investments added. Open the card menu to add assets.
                        </div>
                    ) : (
                        <>
                            {structuredData.groups.map(group => (
                                <div key={group.id} className={styles.cardGroup}>
                                    <div className={styles.cardGroupHeader}>
                                        <span className={styles.cardGroupTitle}>{group.name}</span>
                                    </div>
                                    <div className={styles.cardGroupItems}>
                                        {group.items.map(item => {
                                            const twr = calculateTWR(item.investedAmount, item.paymentAmount, item.frequency, item.value, item.startDate);
                                            return (
                                                <div key={item.id} className={styles.metricRow}>
                                                    <div className={styles.metricLabelGroup}>
                                                        <span className={styles.metricLabel}>{item.name}</span>
                                                        {item.frequency && item.frequency !== 'One-time' && (
                                                            <span className={styles.metricFreqTag}>{item.frequency}</span>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                        <span className={styles.metricValue}>{formatCurrency(item.value)}</span>
                                                        <span style={{
                                                            fontSize: '0.65rem',
                                                            color: twr >= 0 ? 'var(--neu-success)' : 'var(--neu-danger)',
                                                            fontWeight: 700,
                                                            opacity: 0.9
                                                        }}>
                                                            {twr >= 0 ? '+' : ''}{twr.toFixed(2)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                            {structuredData.items.map(item => {
                                const twr = calculateTWR(item.investedAmount, item.paymentAmount, item.frequency, item.value, item.startDate);
                                return (
                                    <div key={item.id} className={styles.metricRow}>
                                        <div className={styles.metricLabelGroup}>
                                            <span className={styles.metricLabel}>{item.name}</span>
                                            {item.frequency && item.frequency !== 'One-time' && (
                                                <span className={styles.metricFreqTag}>{item.frequency}</span>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                            <span className={styles.metricValue}>{formatCurrency(item.value)}</span>
                                            <span style={{
                                                fontSize: '0.65rem',
                                                color: twr >= 0 ? 'var(--neu-success)' : 'var(--neu-danger)',
                                                fontWeight: 700,
                                                opacity: 0.9
                                            }}>
                                                {twr >= 0 ? '+' : ''}{twr.toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>

                <Window
                    isOpen={showEditor}
                    onClose={() => setShowEditor(false)}
                    title="Edit Other Investments"
                    width="750px"
                    headerAlign="start"
                >
                    <section className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <h3 className={styles.sectionTitle}>Recurring Investments</h3>
                            <div className={styles.sectionActions}>
                                <Button onClick={handleAddGroup} variant="secondary" size="sm">
                                    <FolderPlus size={14} />
                                </Button>
                                <Button onClick={() => handleAddItem()} variant="secondary" size="sm">
                                    <Plus size={14} />
                                </Button>
                            </div>
                        </div>
                        <div className={styles.editorList}>
                            {structuredData.groups.map(group => (
                                <div key={group.id} className={styles.groupContainer}>
                                    <div className={styles.groupHeader}>
                                        <input
                                            className={styles.groupTitle}
                                            value={group.name}
                                            onChange={(e) => handleUpdateGroup(group.id, 'name', e.target.value)}
                                        />
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <Button variant="icon" size="sm" onClick={() => handleAddItem(group.id)}>
                                                <Plus size={14} />
                                            </Button>
                                            <Button variant="icon" size="sm" onClick={() => handleRemoveGroup(group.id)}>
                                                <Trash2 size={14} color="var(--neu-danger)" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className={styles.groupItems}>
                                        {(group.items || []).map(item => renderItemInput(item, group.id))}
                                    </div>
                                </div>
                            ))}

                            <div className={styles.standaloneItems}>
                                {structuredData.items.map(item => renderItemInput(item))}
                            </div>
                        </div>
                    </section>
                </Window>
            </div>
        </ExpandableCard>
    );
};

export default OtherInvestmentsCard;
