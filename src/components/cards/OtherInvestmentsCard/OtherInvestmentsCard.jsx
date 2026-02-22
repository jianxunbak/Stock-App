import React, { useState, useEffect, useMemo } from 'react';
import { calculateOtherInvestmentProjection } from '../../../utils/otherInvestmentUtils';
import ExpandableCard from '../../ui/ExpandableCard/ExpandableCard';
import SummaryCardContent from '../../ui/SummaryCardContent/SummaryCardContent';
import { Settings, Plus, Trash2, FolderPlus, ChevronDown, TrendingUp, TrendingDown, DollarSign, PieChart, Activity } from 'lucide-react';
import Button from '../../ui/Button';
import Window from '../../ui/Window/Window';
import DropdownButton from '../../ui/DropdownButton/DropdownButton';
import CustomDatePicker from '../../ui/CustomDatePicker/CustomDatePicker';
import BaseChart from '../../ui/BaseChart/BaseChart';
import styles from './OtherInvestmentsCard.module.css';
import { formatLastUpdated } from '../../../utils/dateUtils';

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

// Simple ROI Calculation: (Current Value - Total Invested) / Total Invested
const calculateSimpleROI = (principal, payment, frequency, currentValue, startDate) => {
    const start = new Date(startDate);
    const end = new Date();

    // Difference in months
    let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    // Add fraction of month
    const days = end.getDate() - start.getDate();
    months += days / 30;

    if (months < 0) months = 0;

    let totalContribution = 0;
    if (frequency === 'Monthly') {
        totalContribution = Math.floor(months) * payment;
    } else if (frequency === 'Quarterly') {
        totalContribution = Math.floor(months / 3) * payment;
    } else if (frequency === 'Yearly') {
        totalContribution = Math.floor(months / 12) * payment;
    }

    const totalInvested = principal + totalContribution;

    if (totalInvested <= 0) return 0;

    return ((currentValue - totalInvested) / totalInvested) * 100;
};

const OtherInvestmentsCard = ({
    isOpen = true,
    onToggle = null,
    onHide = null,
    className = "",
    baseCurrency = 'USD',
    baseCurrencySymbol = '$',
    displayCurrency = 'USD',
    displayCurrencySymbol = '$',
    baseToDisplayRate = 1,
    usdToDisplayRate = 1,
    settings = null,
    onUpdateSettings = null,
    loading = false,
    onRefresh = null,
    inflationRate = 0
}) => {
    // const { settings, updateSettings, loading: settingsLoading } = useUserSettings(); // Removed
    const [structuredData, setStructuredData] = useState({ items: [], groups: [] });
    const [projectionYears, setProjectionYears] = useState(10);
    const [showEditor, setShowEditor] = useState(false);

    const [isInitialized, setIsInitialized] = useState(false);

    const lastUpdatedAt = React.useRef(null);

    // Sync from props (Parent -> Child)
    useEffect(() => {
        if (!settings?.otherInvestments) return;

        const incomingData = normalizeInvestments(settings.otherInvestments);
        const incomingUpdatedAt = settings.otherInvestments.updatedAt;

        // Use timestamps (epoch 0 if missing/legacy)
        const currentRefTime = lastUpdatedAt.current ? new Date(lastUpdatedAt.current).getTime() : -1;
        const incomingTime = incomingUpdatedAt ? new Date(incomingUpdatedAt).getTime() : 0;

        // Accept update if:
        // 1. We haven't tracked anything yet (first load)
        // 2. Incoming data is strictly newer
        // 3. Or if not initialized yet, force sync
        if (currentRefTime === -1 || incomingTime > currentRefTime) {
            setStructuredData(incomingData);
            setProjectionYears(Number(settings.otherInvestments.projectionYears || 10));

            // If incoming has no timestamp, we default to 0 (Epoch) so internal updates (Now) supersede it.
            // If incoming has timestamp, we track it.
            lastUpdatedAt.current = incomingUpdatedAt || new Date(0).toISOString();
            setIsInitialized(true);
        } else if (!isInitialized) {
            // Fallback: If timestamps match (e.g. both 0) but we need to init
            setStructuredData(incomingData);
            setProjectionYears(Number(settings.otherInvestments.projectionYears || 10));
            lastUpdatedAt.current = new Date(0).toISOString();
            setIsInitialized(true);
        }
    }, [settings]);

    // Sync to parent (Child -> Parent)
    useEffect(() => {
        // Only save if initialized and user is settled (not loading)
        if (loading || !onUpdateSettings || !isInitialized) return;

        const timer = setTimeout(() => {
            const currentData = {
                ...structuredData,
                projectionYears
            };

            const { updatedAt, ...prevInvWithoutTime } = settings?.otherInvestments || {};

            // Normalize both sides for comparison to avoid infinite loops on format mismatches
            const paramsPrev = {
                ...normalizeInvestments(prevInvWithoutTime),
                projectionYears: Number(prevInvWithoutTime.projectionYears || 10)
            };

            const paramsCurr = {
                ...normalizeInvestments(currentData),
                projectionYears: Number(projectionYears || 10)
            };

            if (JSON.stringify(paramsPrev) !== JSON.stringify(paramsCurr)) {
                const newTimestamp = new Date().toISOString();
                lastUpdatedAt.current = newTimestamp; // Update ref first to prevent loopback overwrite

                onUpdateSettings({
                    otherInvestments: {
                        ...currentData,
                        updatedAt: newTimestamp
                    }
                });
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [structuredData, projectionYears, loading, onUpdateSettings, settings?.otherInvestments, isInitialized]);

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: displayCurrency,
            maximumFractionDigits: 0
        }).format(val * baseToDisplayRate).replace('SGD', 'S$');
    };


    const formatBaseCurrency = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: baseCurrency,
            maximumFractionDigits: 0
        }).format(val).replace('SGD', 'S$');
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
            const pay = Number(item.paymentAmount || 0);

            // Calculate total invested for this item including recurring payments
            const start = new Date(item.startDate);
            const end = new Date();
            let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
            months += (end.getDate() - start.getDate()) / 30;
            if (months < 0) months = 0;

            let contributions = 0;
            if (item.frequency === 'Monthly') contributions = Math.floor(months) * pay;
            else if (item.frequency === 'Quarterly') contributions = Math.floor(months / 3) * pay;
            else if (item.frequency === 'Yearly') contributions = Math.floor(months / 12) * pay;

            totalAssetValue += v;
            totalInvestedValue += (p + contributions);
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
        const projection = calculateOtherInvestmentProjection({
            data: structuredData,
            projectionYears,
            currentAge: getAge(settings?.dateOfBirth),
            startYear: new Date().getFullYear()
        });

        // Apply inflation adjustment
        if (inflationRate > 0) {
            projection.forEach((point, index) => {
                const discount = 1 / Math.pow(1 + (inflationRate / 100), index);
                point.value *= discount;
                point.invested *= discount;
            });
        }
        return projection;
    }, [structuredData, projectionYears, settings?.dateOfBirth, inflationRate]);

    const chartSeries = [
        { id: 'value', name: 'Projected Value', dataKey: 'value', color: 'var(--neu-success)' },
        { id: 'invested', name: 'Total Invested', dataKey: 'invested', color: 'var(--text-secondary)', strokeDasharray: '5 5' }
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

    const lastPoint = chartData[chartData.length - 1];
    const targetAge = lastPoint?.age || (getAge(settings?.dateOfBirth) + projectionYears);
    const projectedValue = lastPoint ? lastPoint.value : totals.totalAssetValue;

    const header = (
        <SummaryCardContent
            mainMetrics={[
                { label: 'Total', value: formatCurrency(totals.totalAssetValue), color: 'var(--neu-success)' },
                { label: `Projected (${targetAge})`, value: formatCurrency(projectedValue), color: 'var(--neu-brand)' }
            ]}


            gridMetrics={[
                ...structuredData.groups.slice(0, 3).map(g => ({
                    label: `${g.name}: ${formatCurrency(g.items.reduce((s, i) => s + Number(i.value || 0), 0))}`,
                    icon: <PieChart size={14} />,
                    color: 'var(--neu-color-favorite)'
                })),
                ...structuredData.items.slice(0, 3).map(i => ({
                    label: `${i.name}: ${formatCurrency(i.value)}`,
                    icon: <Activity size={14} />,
                    color: 'var(--neu-brand)'
                }))
            ].slice(0, 6)}
        />
    );


    const renderItemInput = (item, groupId = null) => {
        return (
            <div key={item.id} className={styles.detailedItem}>
                {/* ROW 1: Name & Delete */}
                <div className={styles.nameSection}>
                    <label className={styles.fieldLabel}>Investment Name</label>
                    <input
                        className={styles.input}
                        value={item.name}
                        onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value, groupId)}
                        placeholder="e.g. Real Estate"
                    />
                </div>
                <div className={styles.deleteAction}>
                    <Button variant="icon" size="sm" onClick={() => handleRemoveItem(item.id, groupId)}>
                        <Trash2 size={14} />
                    </Button>
                </div>

                {/* ROW 2: Principal & Date */}
                <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Initial Principal ({baseCurrencySymbol})</label>
                    <input
                        type="number"
                        step="0.01"
                        className={styles.input}
                        value={item.investedAmount}
                        onChange={(e) => handleUpdateItem(item.id, 'investedAmount', e.target.value, groupId)}
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

                {/* ROW 3: Amount & Freq */}
                <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Payment Amount ({baseCurrencySymbol})</label>
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
                                ≈ {baseCurrencySymbol}{Math.round(getItemMonthly(item)).toLocaleString()}/mo
                            </span>
                        )}
                    </div>
                </div>
                <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Payment Freq.</label>
                    <div className={styles.inputFreq}>
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
                </div>

                {/* ROW 4: Value & Growth */}
                <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Current Value ({baseCurrencySymbol})</label>
                    <input
                        type="number"
                        step="0.01"
                        className={styles.input}
                        value={item.value}
                        onChange={(e) => handleUpdateItem(item.id, 'value', e.target.value, groupId)}
                    />
                </div>
                <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Growth %</label>
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
            onRefresh={onRefresh}
            collapsedWidth={220}
            collapsedHeight={198}
            headerContent={header}
            loading={loading}
            className={className}
            menuItems={menuItems}
        >
            <div className={styles.container}>
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <h4 className={styles.sectionTitle}>
                                Projected Growth ({displayCurrency})
                                {inflationRate > 0 && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: 'var(--neu-brand)', fontWeight: 500 }}> (Real Value)</span>}
                            </h4>
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
                                const convertedVal = val * baseToDisplayRate;
                                if (convertedVal >= 1000000) return `${displayCurrencySymbol}${(convertedVal / 1000000).toFixed(1)}M`;
                                if (convertedVal >= 1000) return `${displayCurrencySymbol}${(convertedVal / 1000).toFixed(0)}k`;
                                return `${displayCurrencySymbol}${convertedVal.toFixed(0)}`;
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
                                            const roi = calculateSimpleROI(item.investedAmount, item.paymentAmount, item.frequency, item.value, item.startDate);
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
                                                            color: roi >= 0 ? 'var(--neu-success)' : 'var(--neu-danger)',
                                                            fontWeight: 700,
                                                            opacity: 0.9
                                                        }}>
                                                            {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                            {structuredData.items.map(item => {
                                const roi = calculateSimpleROI(item.investedAmount, item.paymentAmount, item.frequency, item.value, item.startDate);
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
                                                color: roi >= 0 ? 'var(--neu-success)' : 'var(--neu-danger)',
                                                fontWeight: 700,
                                                opacity: 0.9
                                            }}>
                                                {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
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
