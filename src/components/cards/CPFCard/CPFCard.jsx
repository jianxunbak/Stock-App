import React, { useState, useEffect, useMemo } from 'react';
import ExpandableCard from '../../ui/ExpandableCard/ExpandableCard';
import SummaryCardContent from '../../ui/SummaryCardContent/SummaryCardContent';
import Window from '../../ui/Window/Window';
import Button from '../../ui/Button/Button';
import DropdownButton from '../../ui/DropdownButton/DropdownButton';
import CustomDatePicker from '../../ui/CustomDatePicker/CustomDatePicker';
import BaseChart from '../../ui/BaseChart/BaseChart';
import {
    Info,
    Calculator,
    Lock,
    Settings,
    Landmark,
    ShieldCheck,
    TrendingUp,
    PieChart as PieChartIcon,
    Briefcase,
    Activity,
    Plus,
    Trash2,
    FolderPlus,
    ChevronDown,
    DollarSign,
    TrendingDown
} from 'lucide-react';

import {
    ResponsiveContainer,
    Tooltip,
    Cell,
    PieChart,
    Pie,
    AreaChart,
    Area,
    CartesianGrid,
    XAxis,
    YAxis
} from 'recharts';
import styles from './CPFCard.module.css';
import { formatLastUpdated } from '../../../utils/dateUtils';
import { calculateCPFProjection } from '../../../utils/cpfUtils';

const CPFCard = ({
    isOpen = true,
    onToggle = null,
    onHide = null,
    className = "",
    dateOfBirth = null,
    baseCurrency = 'USD',
    baseCurrencySymbol = '$',
    displayCurrency = 'USD',
    displayCurrencySymbol = '$',
    baseToDisplayRate = 1,
    usdToDisplayRate = 1,
    sgdToDisplayRate = 1,
    settings = null,
    onUpdateSettings = null,
    loading = false,
    onRefresh = null,
    inflationRate = 0
}) => {

    // Default states
    const [age, setAge] = useState(30);
    const [monthlySalary, setMonthlySalary] = useState(6000);
    const [annualBonus, setAnnualBonus] = useState(12000);
    const [salaryGrowth, setSalaryGrowth] = useState(0); // New State: Annual Growth %
    const [projectionYears, setProjectionYears] = useState(30);
    const [balances, setBalances] = useState({
        oa: 50000,
        sa: 30000,
        ma: 20000,
        ra: 0
    });
    const [cpfisData, setCpfisData] = useState({ items: [], groups: [] });

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isReferenceOpen, setIsReferenceOpen] = useState(false);

    // Sync from user settings
    const [isInitialized, setIsInitialized] = useState(false);

    // Sync from user settings (only once)
    useEffect(() => {
        if (!isInitialized && !loading && settings) {
            if (settings.cpf) {
                if (settings.cpf.monthlySalary !== undefined) setMonthlySalary(settings.cpf.monthlySalary);
                if (settings.cpf.annualBonus !== undefined) setAnnualBonus(settings.cpf.annualBonus);
                if (settings.cpf.salaryGrowth !== undefined) setSalaryGrowth(settings.cpf.salaryGrowth);
                if (settings.cpf.projectionYears !== undefined) setProjectionYears(settings.cpf.projectionYears);
                if (settings.cpf.balances) setBalances(settings.cpf.balances);
                if (settings.cpf.cpfisData) setCpfisData(settings.cpf.cpfisData);
            }
            setIsInitialized(true);
        }
    }, [settings, isInitialized, loading]);

    useEffect(() => {
        if (loading || !onUpdateSettings) return;
        const timer = setTimeout(() => {
            const currentData = {
                monthlySalary,
                annualBonus,
                salaryGrowth,
                projectionYears,
                balances,
                cpfisData
            };
            // Only update if data changed to avoid infinite loop
            const { updatedAt: prevTime, ...prevCpfWithoutTime } = settings?.cpf || {};
            if (JSON.stringify(prevCpfWithoutTime) !== JSON.stringify(currentData) && isInitialized) {
                onUpdateSettings({
                    cpf: {
                        ...currentData,
                        updatedAt: new Date().toISOString()
                    }
                });
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [monthlySalary, annualBonus, salaryGrowth, projectionYears, balances, cpfisData, loading, onUpdateSettings, settings?.cpf, isInitialized]);

    // Calculate age from DOB if available
    useEffect(() => {
        if (dateOfBirth) {
            const birth = new Date(dateOfBirth);
            const today = new Date();
            let calculatedAge = today.getFullYear() - birth.getFullYear();
            const monthDiff = today.getMonth() - birth.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                calculatedAge--;
            }
            // Base simulation on actual attained age today
            setAge(calculatedAge > 0 ? calculatedAge : 30);
        }
    }, [dateOfBirth]);
    // Step 3: Compound Interest Foundation Logic + Ceilings + Dynamic Rates
    const calculationResult = useMemo(() => {
        const result = calculateCPFProjection({
            currentAge: age,
            dateOfBirth,
            monthlySalary,
            annualBonus,
            salaryGrowth,
            projectionYears,
            balances,
            cpfisData
        });

        // Apply inflation adjustment to projection data
        if (inflationRate > 0) {
            result.projection = result.projection.map((point, index) => {
                const discount = 1 / Math.pow(1 + (inflationRate / 100), index);
                return {
                    ...point,
                    oa: point.oa * discount,
                    sa_ra: point.sa_ra * discount,
                    ma: point.ma * discount,
                    total: point.total * discount
                };
            });

            // Adjust final balances
            const finalDiscount = 1 / Math.pow(1 + (inflationRate / 100), projectionYears);
            result.finalBalances.oa *= finalDiscount;
            result.finalBalances.sa *= finalDiscount;
            result.finalBalances.ma *= finalDiscount;
            result.finalBalances.ra *= finalDiscount;

            // Adjust at55 snapshot if reached
            if (result.at55.ageReached) {
                const yearsTo55 = Math.max(0, 55 - age);
                const discount55 = 1 / Math.pow(1 + (inflationRate / 100), yearsTo55);
                result.at55.withdrawable *= discount55;
                result.at55.ra *= discount55;
                result.at55.target *= discount55;
            }
        }

        return result;
    }, [age, monthlySalary, annualBonus, salaryGrowth, projectionYears, balances, dateOfBirth, inflationRate, cpfisData]);

    // Display values with currency conversion (SGD -> Display)
    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: displayCurrency,
            maximumFractionDigits: 0
        }).format(val * sgdToDisplayRate).replace('SGD', 'S$');
    };


    const formatSGD = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'SGD',
            maximumFractionDigits: 0
        }).format(val).replace('SGD', 'S$');
    };

    // --- CPFIS CRUD ---
    const handleAddCpfisItem = (groupId = null) => {
        const newItem = {
            id: `cpfis-${Date.now()}`,
            name: 'New Investment',
            value: 0, // Current Value
            investedAmount: 0, // Initial Principal
            paymentAmount: 0,
            startDate: new Date().toISOString().split('T')[0],
            projectedGrowth: 4,
            frequency: 'One-time'
        };

        setCpfisData(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }));
    };

    const handleUpdateCpfisItem = (itemId, field, value) => {
        setCpfisData(prev => ({
            ...prev,
            items: prev.items.map(i => i.id === itemId ? { ...i, [field]: value } : i)
        }));
    };

    const handleRemoveCpfisItem = (itemId) => {
        setCpfisData(prev => ({
            ...prev,
            items: prev.items.filter(i => i.id !== itemId)
        }));
    };

    const getItemMonthly = (item) => {
        const val = Number(item.paymentAmount || 0);
        if (item.frequency === 'Yearly') return val / 12;
        if (item.frequency === 'Quarterly') return val / 3;
        if (item.frequency === 'One-time') return 0;
        return val;
    };

    const renderCisItem = (item) => {
        return (
            <div key={item.id} className={styles.detailedItem}>
                {/* ROW 1: Name & Delete */}
                <div className={styles.nameSection}>
                    <label className={styles.fieldLabel}>Investment Name</label>
                    <input
                        className={styles.input}
                        value={item.name}
                        onChange={(e) => handleUpdateCpfisItem(item.id, 'name', e.target.value)}
                        placeholder="e.g. Unit Trust"
                    />
                </div>
                <div className={styles.deleteAction}>
                    <Button variant="icon" size="sm" onClick={() => handleRemoveCpfisItem(item.id)}>
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
                        onChange={(e) => handleUpdateCpfisItem(item.id, 'investedAmount', e.target.value)}
                    />
                </div>
                <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Start Date</label>
                    <CustomDatePicker
                        value={item.startDate}
                        onChange={(date) => handleUpdateCpfisItem(item.id, 'startDate', date)}
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
                            onChange={(e) => handleUpdateCpfisItem(item.id, 'paymentAmount', e.target.value)}
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
                    <DropdownButton
                        label={item.frequency}
                        variant="ghost"
                        size="sm"
                        icon={<ChevronDown size={14} />}
                        closeOnSelect={true}
                        buttonStyle={{ fontSize: '0.8rem', width: '100%', justifyContent: 'space-between' }}
                        items={[
                            { label: 'One-time', onClick: () => handleUpdateCpfisItem(item.id, 'frequency', 'One-time') },
                            { label: 'Monthly', onClick: () => handleUpdateCpfisItem(item.id, 'frequency', 'Monthly') },
                            { label: 'Quarterly', onClick: () => handleUpdateCpfisItem(item.id, 'frequency', 'Quarterly') },
                            { label: 'Yearly', onClick: () => handleUpdateCpfisItem(item.id, 'frequency', 'Yearly') },
                        ]}
                    />
                </div>

                {/* ROW 4: Value & Growth */}
                <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Current Value ({baseCurrencySymbol})</label>
                    <input
                        type="number"
                        step="0.01"
                        className={styles.input}
                        value={item.value}
                        onChange={(e) => handleUpdateCpfisItem(item.id, 'value', e.target.value)}
                    />
                </div>
                <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Growth %</label>
                    <input
                        type="number"
                        step="0.01"
                        className={styles.input}
                        value={item.projectedGrowth}
                        onChange={(e) => handleUpdateCpfisItem(item.id, 'projectedGrowth', e.target.value)}
                        placeholder="Annual %"
                    />
                </div>
            </div>
        );
    };

    const handleInputChange = (setter) => (e) => {
        const val = e.target.value;
        if (val === '') {
            setter('');
        } else {
            // Use the raw string value for the setter to allow typing decimal points
            // Recharts and calculations will handle the conversion via Number()
            setter(val);
        }
    };

    const startBalance = {
        oa: Number(balances.oa || 0),
        sa: Number(balances.sa || 0),
        ma: Number(balances.ma || 0),
        ra: Number(balances.ra || 0)
    };

    const currentCpfisTotal = useMemo(() => {
        return [
            ...(cpfisData.items || []),
            ...(cpfisData.groups || []).flatMap(g => g.items || [])
        ].reduce((sum, item) => sum + Number(item.value || 0), 0);
    }, [cpfisData]);
    const finalProjectedData = calculationResult.projection[calculationResult.projection.length - 1];
    const finalProjectedTotal = finalProjectedData ? finalProjectedData.total : 0;

    const targetAge = finalProjectedData ? finalProjectedData.age : (age + projectionYears);

    const header = (
        <SummaryCardContent
            mainMetrics={[
                { label: 'Current Assets', value: formatCurrency(startBalance.oa + startBalance.sa + startBalance.ma + startBalance.ra + currentCpfisTotal), color: 'var(--neu-success)' },
                { label: `Projected @ ${targetAge}`, value: formatCurrency(finalProjectedTotal), color: 'var(--neu-brand)' }
            ]}


            gridMetrics={[
                { label: `OA Cash: ${formatCurrency(startBalance.oa)}`, icon: <Briefcase size={14} />, color: '#3b82f6' },
                { label: `CPFIS: ${formatCurrency(currentCpfisTotal)}`, icon: <Activity size={14} />, color: '#f43f5e' },
                { label: `SA: ${formatCurrency(startBalance.sa)}`, icon: <ShieldCheck size={14} />, color: '#f59e0b' },
                { label: `MA: ${formatCurrency(startBalance.ma)}`, icon: <Activity size={14} />, color: '#10b981' },
                { label: `Interest: +${formatCurrency(calculationResult.yearlyInterest.total)}/yr`, icon: <TrendingUp size={14} />, color: 'var(--neu-success)' }
            ]}

        />
    );


    const pieData = [
        { name: 'OA', value: Math.round(calculationResult.finalBalances.oa), color: '#3b82f6' },
        { name: 'SA', value: Math.round(calculationResult.finalBalances.sa), color: '#f59e0b' },
        { name: 'RA', value: Math.round(calculationResult.finalBalances.ra), color: '#8b5cf6' },
        { name: 'MA', value: Math.round(calculationResult.finalBalances.ma), color: '#10b981' },
        { name: 'CPFIS', value: Math.round(calculationResult.finalBalances.cpfis), color: '#f43f5e' },
    ].filter(item => item.value > 0);

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            // Check if we have projection data (year property)
            const item = payload[0].payload;
            let displayLabel = label;

            if (item && item.year !== undefined) {
                // Projection Area Chart
                if (item.age !== undefined) {
                    displayLabel = `Age ${item.age} (${item.year})`;
                } else {
                    displayLabel = `Year ${item.year}`;
                }
            } else {
                // Pie Chart or fallback
                const isAge = dateOfBirth != null;
                const isPie = !label && label !== 0; // Check specifically for Pie Chart absence of label
                displayLabel = isPie
                    ? (payload[0].name || "Account")
                    : `${isAge ? "Age " : "Year "}${label}`;
            }

            return (
                <div className={styles.chartTooltip}>
                    <p className={styles.tooltipLabel} style={{ fontWeight: 400 }}>{displayLabel}</p>
                    <div className={styles.tooltipItems}>
                        {payload.map((p, i) => (
                            <div key={i} className={styles.tooltipItem} style={{ color: p.color || p.payload.fill || p.payload.color }}>
                                <span className={styles.tooltipName}>{p.name}:</span>
                                <span className={styles.tooltipValue}>{formatCurrency(p.value)}</span>
                            </div>
                        ))}
                        <div className={styles.divider} style={{ margin: '0.5rem 0' }} />
                        <div className={styles.tooltipItem} style={{ color: 'var(--neu-text-primary)' }}>
                            <span className={styles.tooltipName} style={{ fontWeight: 700 }}>Total:</span>
                            <span className={styles.tooltipValue} style={{ fontWeight: 700 }}>
                                {formatCurrency(payload.reduce((sum, p) => sum + Number(p.value || 0), 0))}
                            </span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    const menuItems = [
        {
            label: 'Calculator Settings',
            indicatorNode: <Calculator size={16} />,
            onClick: () => setIsSettingsOpen(true)
        },
        {
            label: 'CPF Rates & Allocations',
            indicatorNode: <Info size={16} />,
            onClick: () => setIsReferenceOpen(true)
        }
    ];

    return (
        <>
            <ExpandableCard
                title="CPF"
                expanded={isOpen}
                onToggle={onToggle}
                onHide={onHide}
                onRefresh={onRefresh}
                collapsedWidth={220}
                collapsedHeight={198}
                headerContent={header}
                loading={loading}
                className={`${styles.card} ${className}`}
                menuItems={menuItems}

            >
                <div className={styles.container}>
                    <div className={styles.content}>
                        <div className={styles.summaryFullLayout}>
                            <div className={styles.projectionSection}>
                                <div className={styles.sectionHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h4 className={styles.sectionHeaderTitle} style={{ margin: 0 }}>
                                        Projected CPF Growth ({dateOfBirth ? 'By Age' : 'By Year'})
                                        {inflationRate > 0 && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: 'var(--neu-brand)', fontWeight: 500 }}> (Real Value)</span>}
                                    </h4>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Years:</span>
                                        <input
                                            type="number"
                                            className={styles.neuInput}
                                            style={{
                                                width: '60px',
                                                padding: '0.25rem 0.5rem',
                                                textAlign: 'center',
                                                fontSize: '0.85rem',
                                                fontWeight: 500
                                            }}
                                            value={projectionYears}
                                            onChange={handleInputChange(setProjectionYears)}
                                        />
                                    </div>
                                </div>
                                <div className={styles.projectionChartContainer}>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <AreaChart data={calculationResult.projection}>
                                            <defs>
                                                <linearGradient id="colorOAL" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorSAL" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorMAL" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorCPFISL" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                            <XAxis
                                                dataKey={dateOfBirth ? "age" : "year"}
                                                stroke="var(--neu-text-secondary)"
                                                fontSize={10}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <YAxis hide domain={['auto', 'auto']} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Area name="OA" type="monotone" dataKey="oa" stackId="1" stroke="#3b82f6" fillOpacity={1} fill="url(#colorOAL)" isAnimationActive={false} />
                                            <Area name="CPFIS" type="monotone" dataKey="cpfis" stackId="1" stroke="#f43f5e" fillOpacity={1} fill="url(#colorCPFISL)" isAnimationActive={false} />
                                            <Area name={age < 55 ? "SA" : "RA"} type="monotone" dataKey="sa_ra" stackId="1" stroke="#f59e0b" fillOpacity={1} fill="url(#colorSAL)" isAnimationActive={false} />
                                            <Area name="MA" type="monotone" dataKey="ma" stackId="1" stroke="#10b981" fillOpacity={1} fill="url(#colorMAL)" isAnimationActive={false} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className={styles.summarySection}>
                                <h4 className={styles.sectionHeaderTitle}>CPF Summary</h4>

                                <div className={styles.summaryTopRow}>
                                    <div className={styles.chartContainer}>
                                        <div className={styles.chartOverlay}>
                                            <span className={styles.overlayLabel}>Total Projected ({targetAge})</span>
                                            <span className={styles.overlayValue}>{formatCurrency(finalProjectedTotal)}</span>
                                        </div>

                                        <ResponsiveContainer width="100%" height={180}>
                                            <PieChart>
                                                <Pie
                                                    data={pieData}
                                                    innerRadius={50}
                                                    outerRadius={70}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                    isAnimationActive={false}
                                                >
                                                    {pieData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    content={<CustomTooltip />}
                                                    position={{ y: 0 }}
                                                    wrapperStyle={{ left: '50%', transform: 'translateX(-50%)', transition: 'none' }}
                                                    allowEscapeViewBox={{ x: true, y: true }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>

                                    <div className={styles.statsPanel}>
                                        <div className={styles.statLine}>
                                            <div className={styles.statDot} style={{ background: '#3b82f6' }} />
                                            <span className={styles.statLabel}>Projected OA Cash</span>
                                            <span className={styles.statValue}>{formatCurrency(calculationResult.finalBalances.oa)}</span>
                                        </div>
                                        <div className={styles.statLine}>
                                            <div className={styles.statDot} style={{ background: '#f43f5e' }} />
                                            <span className={styles.statLabel}>Projected CPFIS</span>
                                            <span className={styles.statValue}>{formatCurrency(calculationResult.finalBalances.cpfis)}</span>
                                        </div>
                                        <div className={styles.statLine}>
                                            <div className={styles.statDot} style={{ background: '#f59e0b' }} />
                                            <span className={styles.statLabel}>Projected SA</span>
                                            <span className={styles.statValue}>{formatCurrency(calculationResult.finalBalances.sa)}</span>
                                        </div>
                                        <div className={styles.statLine}>
                                            <div className={styles.statDot} style={{ background: '#8b5cf6' }} />
                                            <span className={styles.statLabel}>Projected RA</span>
                                            <span className={styles.statValue}>{formatCurrency(calculationResult.finalBalances.ra)}</span>
                                        </div>
                                        <div className={styles.statLine}>
                                            <div className={styles.statDot} style={{ background: '#10b981' }} />
                                            <span className={styles.statLabel}>Projected MA</span>
                                            <span className={styles.statValue}>{formatCurrency(calculationResult.finalBalances.ma)}</span>
                                        </div>
                                        <div className={styles.divider} />
                                        <div className={styles.statLine}>
                                            <span className={styles.statLabelEmphasized}>Total Projected ({targetAge})</span>
                                            <span className={styles.statValueHighlight}>{formatCurrency(finalProjectedTotal)}</span>
                                        </div>



                                        {calculationResult.at55.ageReached && (
                                            <>
                                                <div className={styles.divider} />
                                                <div className={styles.statLine}>
                                                    <span className={styles.statLabelEmphasized}>Simulation at Age 55</span>
                                                </div>
                                                <div className={styles.statLine}>
                                                    <span className={styles.statLabel}>Target (ERS 2025)</span>
                                                    <span className={styles.statValueSecondary}>{formatCurrency(calculationResult.at55.target)}</span>
                                                </div>
                                                <div className={styles.statLine}>
                                                    <span className={styles.statLabel}>Locked RA (Funded)</span>
                                                    <span className={styles.statValueSecondary}>{formatCurrency(calculationResult.at55.ra)}</span>
                                                </div>
                                                <div className={styles.statLine}>
                                                    <span className={styles.statLabel}>Withdrawable (OA+Excess)</span>
                                                    <span className={styles.statValueHighlight}>{formatCurrency(calculationResult.at55.withdrawable)}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </ExpandableCard>

            {/* Calculator Settings Window */}
            <Window
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                title="CPF Calculator Settings"
                width="700px"
                height="85vh"
                headerAlign="start"
            >
                <div className={styles.windowContainer}>
                    <div className={styles.settingsGrid}>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Target Age (2026)</label>
                            {dateOfBirth ? (
                                <div className={styles.lockedInput}>
                                    <Lock size={14} className={styles.lockIcon} />
                                    <span>{age} years old (Derived from Profile)</span>
                                </div>
                            ) : (
                                <div className={styles.inputWrapper}>
                                    <input
                                        type="number"
                                        className={styles.neuInput}
                                        value={age}
                                        onChange={handleInputChange(setAge)}
                                    />
                                </div>
                            )}
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>Monthly Salary (S$)</label>
                            <div className={styles.inputWrapper}>
                                <input
                                    type="number"
                                    step="0.01"
                                    className={styles.neuInput}
                                    value={monthlySalary}
                                    onChange={handleInputChange(setMonthlySalary)}
                                />
                            </div>
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>Annual Bonus (S$)</label>
                            <div className={styles.inputWrapper}>
                                <input
                                    type="number"
                                    step="0.01"
                                    className={styles.neuInput}
                                    value={annualBonus}
                                    onChange={handleInputChange(setAnnualBonus)}
                                />
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>Annual Salary Growth (%)</label>
                            <div className={styles.inputWrapper}>
                                <input
                                    type="number"
                                    step="0.1"
                                    className={styles.neuInput}
                                    value={salaryGrowth}
                                    onChange={handleInputChange(setSalaryGrowth)}
                                />
                            </div>
                        </div>

                        <div className={styles.sectionDivider} />
                        <h4 className={styles.subTitle}>Starting Balances (Jan 2026)</h4>

                        <div className={styles.inputGridMini}>
                            <div className={styles.inputGroupMini}>
                                <label className={styles.label}>OA Total (S$)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className={styles.neuInput}
                                    value={balances.oa}
                                    onChange={(e) => setBalances({ ...balances, oa: e.target.value })}
                                />
                            </div>
                            <div className={styles.inputGroupMini}>
                                <label className={styles.label}>{age < 55 ? 'SA' : 'RA'} (S$)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className={styles.neuInput}
                                    value={age < 55 ? balances.sa : balances.ra}
                                    onChange={(e) => setBalances({
                                        ...balances,
                                        [age < 55 ? 'sa' : 'ra']: e.target.value
                                    })}
                                />
                            </div>
                            <div className={styles.inputGroupMini}>
                                <label className={styles.label}>MA (S$)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className={styles.neuInput}
                                    value={balances.ma}
                                    onChange={(e) => setBalances({ ...balances, ma: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className={styles.sectionDivider} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h4 className={styles.subTitle}>CPFIS Investments</h4>
                            <Button variant="secondary" size="sm" onClick={() => handleAddCpfisItem()}>
                                <Plus size={14} style={{ marginRight: '4px' }} />
                            </Button>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '-0.5rem' }}>
                            Investments will be deducted from OA Cash monthly. Interest is only earned on the remaining OA Cash.
                        </p>

                        <div className={styles.cpfisList}>
                            {cpfisData.items.map(renderCisItem)}
                            {cpfisData.items.length === 0 && (
                                <div className={styles.emptyCpfis}>
                                    No CPFIS investments added.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Window >

            {/* Reference Data Modal */}
            < Window
                isOpen={isReferenceOpen}
                onClose={() => setIsReferenceOpen(false)}
                title="CPF 2026 Rates & Allocations"
                width="600px"
                height="80vh"
            >
                <div className={styles.referenceContainer}>
                    <section className={styles.refSection}>
                        <h4 className={styles.refTitle}>2026 Contribution Rates</h4>
                        <p className={styles.refSub}>Private Sector / Non-Pensionable (Employer + Employee)</p>
                        <div className={styles.refGrid}>
                            <div className={styles.refRow}><span>&le; 55 years</span> <div className={styles.refValueGroup}><strong>37%</strong> <small>(17% / 20%)</small></div></div>
                            <div className={styles.refRow}><span>55 - 60 years</span> <div className={styles.refValueGroup}><strong>34%</strong> <small>(16% / 18%)</small></div></div>
                            <div className={styles.refRow}><span>60 - 65 years</span> <div className={styles.refValueGroup}><strong>25%</strong> <small>(12.5% / 12.5%)</small></div></div>
                            <div className={styles.refRow}><span>65 - 70 years</span> <div className={styles.refValueGroup}><strong>16.5%</strong> <small>(9% / 7.5%)</small></div></div>
                            <div className={styles.refRow}><span>&gt; 70 years</span> <div className={styles.refValueGroup}><strong>12.5%</strong> <small>(7.5% / 5%)</small></div></div>
                        </div>
                    </section>

                    <section className={styles.refSection}>
                        <h4 className={styles.refTitle}>Allocation Ratios (2026 Framework)</h4>
                        <div className={styles.refAllocGrid}>
                            <div className={styles.refAllocHeader}>
                                <span>Age</span>
                                <span>OA</span>
                                <span>SA/RA</span>
                                <span>MA</span>
                            </div>
                            <div className={styles.refAllocRow}><span>&le; 35</span> <span>62.17%</span> <span>16.21%</span> <span>21.62%</span></div>
                            <div className={styles.refAllocRow}><span>35 - 45</span> <span>56.77%</span> <span>18.91%</span> <span>24.32%</span></div>
                            <div className={styles.refAllocRow}><span>45 - 50</span> <span>51.36%</span> <span>21.62%</span> <span>27.02%</span></div>
                            <div className={styles.refAllocRow}><span>50 - 55</span> <span>40.55%</span> <span>31.08%</span> <span>28.37%</span></div>
                            <div className={styles.refAllocRow}><span>55+ (SA Closed)</span> <span>Overflows</span> <span>To RA</span> <span>28.37%</span></div>
                        </div>
                    </section>

                    <section className={styles.refSection}>
                        <h4 className={styles.refTitle}>Interest Rates & Hierarchy</h4>
                        <div className={styles.refGrid}>
                            <div className={styles.refRow}><span>Ordinary Account (OA)</span> <strong>2.5% p.a.</strong></div>
                            <div className={styles.refRow}><span>SA / MA / RA</span> <strong>4.0% p.a.</strong></div>
                        </div>
                        <div className={styles.refNote}>
                            <p><strong>Extra Interest Hierarchy:</strong> MA &gt; SA/RA &gt; OA. The first $60k of combined balances (capped $20k OA) earns +1%. For age 55+, the first $30k earns +2%.</p>
                        </div>
                    </section>

                    <section className={styles.refSection}>
                        <h4 className={styles.refTitle}>Mandatory 2026 Rules</h4>
                        <ul className={styles.refList}>
                            <li><strong>Monthly Salary Ceiling:</strong> $8,000.</li>
                            <li><strong>AW (Bonus) Ceiling:</strong> $102,000 - Total Ordinary Wages (Capped).</li>
                            <li><strong>Basic Healthcare Sum (BHS):</strong> $79,000 (Grows 3% p.a.).</li>
                            <li><strong>Retirement Account (ERS):</strong> Enhanced Retirement Sum (4x BRS) target at age 55. ($426k in 2026, grows 3.5% p.a.).</li>
                            <li><strong>SA Closure at 55:</strong> SA merged into RA/OA. Subsequent MA overflows go to RA/OA based on ERS cap.</li>
                        </ul>
                    </section>
                </div>
            </Window >
        </>
    );
};

export default CPFCard;
