import React, { useState, useEffect, useMemo } from 'react';
import ExpandableCard from '../../ui/ExpandableCard/ExpandableCard';
import Window from '../../ui/Window/Window';
import Button from '../../ui/Button/Button';
import {
    Info,
    Calculator,
    Lock,
    Settings,
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
    loading = false
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

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isReferenceOpen, setIsReferenceOpen] = useState(false);

    // Sync from user settings
    const [isInitialized, setIsInitialized] = useState(false);

    // Sync from user settings (only once)
    useEffect(() => {
        if (settings?.cpf && !isInitialized) {
            if (settings.cpf.monthlySalary !== undefined) setMonthlySalary(settings.cpf.monthlySalary);
            if (settings.cpf.annualBonus !== undefined) setAnnualBonus(settings.cpf.annualBonus);
            if (settings.cpf.salaryGrowth !== undefined) setSalaryGrowth(settings.cpf.salaryGrowth);
            if (settings.cpf.projectionYears !== undefined) setProjectionYears(settings.cpf.projectionYears);
            if (settings.cpf.balances) setBalances(settings.cpf.balances);
            setIsInitialized(true);
        }
    }, [settings, isInitialized]);

    useEffect(() => {
        if (loading || !onUpdateSettings) return;
        const timer = setTimeout(() => {
            const currentData = {
                monthlySalary,
                annualBonus,
                salaryGrowth,
                projectionYears,
                balances
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
    }, [monthlySalary, annualBonus, salaryGrowth, projectionYears, balances, loading, onUpdateSettings, settings?.cpf, isInitialized]);

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

    // --- CPF 2026+ Base Logic Helpers (Step 3: Dynamic Allocation) ---
    const YEAR_CONFIGS = {
        2026: { owCeiling: 8000, annualLimit: 102000 },
    };

    const getYearlyConfig = (year) => {
        return YEAR_CONFIGS[2026];
    };

    // Helper to get exact OA/SA/MA rates based on age
    const getSpecificRates = (age) => {
        // <= 35 (Standard 2026: 23, 6, 8 => Total 37%) 
        if (age <= 35) return { oa: 0.2300, sa: 0.0600, ma: 0.0800, total: 0.3700 };

        // 35-45 (User Rule: 21.01, 6.99, 9.0 => Total 37%)
        if (age <= 45) return { oa: 0.2101, sa: 0.0699, ma: 0.0900, total: 0.3700 };

        // 45-50 (User Rule: 19.01, 7.99, 10.0 => Total 37%)
        if (age <= 50) return { oa: 0.1901, sa: 0.0799, ma: 0.1000, total: 0.3700 };

        // 50-55 (User Rule: 15.01, 11.49, 10.5 => Total 37%)
        if (age <= 55) return { oa: 0.1501, sa: 0.1149, ma: 0.1050, total: 0.3700 };

        // > 55 (Standard tapering - approximate based on 2026)
        if (age <= 60) return { oa: 0.1150, sa: 0.1100, ma: 0.1000, total: 0.3250 };
        if (age <= 65) return { oa: 0.0450, sa: 0.0950, ma: 0.1100, total: 0.2500 };
        if (age <= 70) return { oa: 0.0200, sa: 0.0600, ma: 0.0850, total: 0.1650 };
        return { oa: 0.0100, sa: 0.0100, ma: 0.1050, total: 0.1250 };
    };

    // Step 3: Compound Interest Foundation Logic + Ceilings + Dynamic Rates
    const calculationResult = useMemo(() => {
        const startYear = 2026;
        let currentAge = age;
        const birthMonthIndex = dateOfBirth ? new Date(dateOfBirth).getMonth() : 0;

        let at55Snapshot = { withdrawable: 0, ra: 0, target: 0, ageReached: false };

        let bal = {
            oa: Number(balances.oa || 0),
            sa: Number(balances.sa || 0),
            ma: Number(balances.ma || 0),
            ra: Number(balances.ra || 0)
        };

        const currentTotal = bal.oa + bal.sa + bal.ma + bal.ra;

        let projection = [];
        let yearlyInterest = { total: 0, breakdown: { oa: 0, sa: 0, ma: 0, ra: 0 } };

        projection.push({
            year: startYear,
            age: currentAge,
            oa: bal.oa,
            sa_ra: bal.sa + bal.ra,
            ma: bal.ma,
            total: currentTotal
        });

        const maxYears = Math.min(projectionYears, 100 - age);

        for (let y = 0; y < maxYears; y++) {
            const year = startYear + y + 1;
            const config = getYearlyConfig(year);
            const annualWageCeiling = config.annualLimit || 102000;

            let pendingInterest = { oa: 0, sa: 0, ma: 0, ra: 0 };

            // Step 2: Annual Ceiling Counter (resets every year)
            let totalWagesYearToDate = 0;

            for (let m = 0; m < 12; m++) {
                const isPostBday = m > birthMonthIndex;
                const lookupAge = isPostBday ? currentAge + 1 : currentAge;

                // Step 3: Get specific rates for this age
                const rates = getSpecificRates(lookupAge);

                // Apply Salary Growth Logic
                // We use the base monthlySalary and annualBonus, compounded by salaryGrowth for the current year (y)
                const growthFactor = Math.pow(1 + (Number(salaryGrowth) / 100), y);
                const currentMonthlySalary = Number(monthlySalary || 0) * growthFactor;
                const currentAnnualBonus = Number(annualBonus || 0) * growthFactor;

                const sNum = currentMonthlySalary;

                // Rule 1: Monthly Wage Ceiling (OW)
                const ow = Math.min(sNum, config.owCeiling);

                const isBonus = m === 11;
                const bNum = currentAnnualBonus;
                const aw = isBonus ? bNum : 0;

                const potentialSubject = ow + aw;

                // Rule 2: Annual Ceiling Logic
                const remainingQuota = Math.max(0, annualWageCeiling - totalWagesYearToDate);
                const actualSubject = Math.min(potentialSubject, remainingQuota);

                // Update counter
                totalWagesYearToDate += actualSubject;

                // Step 3: Direct Percentage Calculation
                const contribOA = actualSubject * rates.oa;
                const contribSA = actualSubject * rates.sa;
                const contribMA = actualSubject * rates.ma;

                bal.oa += contribOA;
                bal.sa += contribSA;
                bal.ma += contribMA;

                // --- Step 5: MediSave Overflow Check (Monthly) ---
                // BHS Limit: $79,000 in 2026, +3% yearly
                // FRS Limit: ~$213,000 in 2026 (Half of ERS), +3% yearly
                const currentBHS = 79000 * Math.pow(1.03, year - 2026);
                const currentFRS = 213000 * Math.pow(1.03, year - 2026);

                const handleOverflow = () => {
                    if (bal.ma > currentBHS) {
                        const excessMA = bal.ma - currentBHS;
                        bal.ma = currentBHS;

                        // Overflow to SA (or RA if age >= 55)
                        if (currentAge < 55) {
                            // Check FRS limit for SA
                            if (bal.sa + excessMA > currentFRS) {
                                // Fill SA to FRS
                                const spaceInSA = Math.max(0, currentFRS - bal.sa);
                                bal.sa += spaceInSA;
                                const remainingExcess = excessMA - spaceInSA;
                                // Remainder to OA
                                bal.oa += remainingExcess;
                            } else {
                                bal.sa += excessMA;
                            }
                        } else {
                            // For Age >= 55, overflow to RA (up to ERS) then OA
                            const currentERS = 426000 * Math.pow(1.03, year - 2026);
                            if (bal.ra + excessMA > currentERS) {
                                const spaceInRA = Math.max(0, currentERS - bal.ra);
                                bal.ra += spaceInRA;
                                const remainingExcess = excessMA - spaceInRA;
                                bal.oa += remainingExcess;
                            } else {
                                bal.ra += excessMA;
                            }
                        }
                    }
                };

                handleOverflow(); // Apply immediate BHS overflow check

                pendingInterest.oa += bal.oa * (0.025 / 12);
                pendingInterest.sa += bal.sa * (0.04 / 12);
                pendingInterest.ma += bal.ma * (0.04 / 12);
                pendingInterest.ra += bal.ra * (0.04 / 12);

                // --- Step 4: Extra 1% Interest Hierarchy ---
                // Cap: $60k combined. OA portion capped at $20k.
                let extraBase = 60000;
                let extraInterest = 0;

                // 1. MA (First priority)
                const maQualify = Math.min(bal.ma, extraBase);
                extraBase -= maQualify;
                extraInterest += maQualify * (0.01 / 12);

                // 2. SA / RA (Second priority) -> uses remaining cap
                const saRaBal = (currentAge < 55) ? bal.sa : bal.ra;
                const saQualify = Math.min(saRaBal, extraBase);
                extraBase -= saQualify;
                extraInterest += saQualify * (0.01 / 12);

                // 3. OA (Third priority) -> capped at remaining base AND $20k
                const oaCap = 20000;
                const oaQualify = Math.min(bal.oa, extraBase, oaCap);
                // extraBase -= oaQualify; // Not needed anymore for calculation
                extraInterest += oaQualify * (0.01 / 12);

                // Credit Extra Interest to SA (or RA if age >= 55) (User Rule: Credit to SA)
                if (currentAge < 55) {
                    pendingInterest.sa += extraInterest;
                } else {
                    pendingInterest.ra += extraInterest;
                }

                // --- Step 6: Age 55 Retirement Transition (Birthday Month) ---
                if (lookupAge === 55 && m === birthMonthIndex) {
                    // 1. Calculate Retirement Sums (Base 2026, +3.5% growth)
                    const yearsFrom2026 = year - 2026;
                    const projectedBRS = 110200 * Math.pow(1.035, yearsFrom2026);
                    const projectedFRS = 220400 * Math.pow(1.035, yearsFrom2026);
                    const projectedERS = 440800 * Math.pow(1.035, yearsFrom2026);

                    // 2. Cascading RA Fill Logic
                    // 2a. Transfer 1: SA -> RA (up to FRS)
                    const spaceInRA = Math.max(0, projectedFRS - bal.ra);
                    const fromSA = Math.min(bal.sa, spaceInRA);
                    bal.ra += fromSA;
                    bal.sa -= fromSA;

                    // 2b. Transfer 2: OA -> RA (if RA < FRS)
                    const remainingSpaceInRA = Math.max(0, projectedFRS - bal.ra);
                    const fromOA = Math.min(bal.oa, remainingSpaceInRA);
                    bal.ra += fromOA;
                    bal.oa -= fromOA;

                    // 3. SA Closure & Sweep (Remaining SA to OA)
                    if (bal.sa > 0) {
                        bal.oa += bal.sa;
                        bal.sa = 0;
                    }

                    // Capture snapshot at 55
                    at55Snapshot = {
                        withdrawable: bal.oa,
                        ra: bal.ra,
                        target: projectedFRS,
                        ageReached: true
                    };
                }

                // --- Step 6b: Future SA Contributions Redirect (Age >= 55) ---
                // "All future working contributions... redirected to RA... or OA".
                const isAfter55 = (currentAge > 55) || (currentAge === 55 && m > birthMonthIndex);
                if (isAfter55 && bal.sa > 0) {
                    const amount = bal.sa;
                    bal.sa = 0;

                    const currentERS = 440800 * Math.pow(1.035, year - 2026);
                    const spaceInRA = Math.max(0, currentERS - bal.ra);
                    const toRA = Math.min(amount, spaceInRA);
                    bal.ra += toRA;

                    const toOA = amount - toRA;
                    bal.oa += toOA;
                }
            }

            bal.oa += pendingInterest.oa;
            bal.sa += pendingInterest.sa;
            bal.ma += pendingInterest.ma;
            bal.ra += pendingInterest.ra;

            // Re-apply overflow check after year-end interest
            const currentBHS_YE = 79000 * Math.pow(1.03, year - 2026);
            const currentFRS_YE = 213000 * Math.pow(1.03, year - 2026);

            if (bal.ma > currentBHS_YE) {
                const excessMA = bal.ma - currentBHS_YE;
                bal.ma = currentBHS_YE;

                if (currentAge < 55) {
                    if (bal.sa + excessMA > currentFRS_YE) {
                        const spaceInSA = Math.max(0, currentFRS_YE - bal.sa);
                        bal.sa += spaceInSA;
                        const remaining = excessMA - spaceInSA;
                        bal.oa += remaining;
                    } else {
                        bal.sa += excessMA;
                    }
                } else {
                    const currentERS_YE = 426000 * Math.pow(1.03, year - 2026);
                    if (bal.ra + excessMA > currentERS_YE) {
                        const spaceInRA = Math.max(0, currentERS_YE - bal.ra);
                        bal.ra += spaceInRA;
                        const remaining = excessMA - spaceInRA;
                        bal.oa += remaining;
                    } else {
                        bal.ra += excessMA;
                    }
                }
            }

            currentAge++;

            projection.push({
                year: year,
                age: currentAge,
                oa: bal.oa,
                sa_ra: bal.sa + bal.ra,
                ma: bal.ma,
                total: bal.oa + bal.sa + bal.ma + bal.ra
            });

            if (y === 0) {
                yearlyInterest = {
                    total: pendingInterest.oa + pendingInterest.sa + pendingInterest.ma + pendingInterest.ra,
                    breakdown: { ...pendingInterest }
                };
            }
        }

        return {
            projection,
            yearlyInterest,
            finalBalances: {
                oa: bal.oa,
                sa: bal.sa,
                ma: bal.ma,
                ra: bal.ra
            },
            at55: at55Snapshot
        };
    }, [age, monthlySalary, annualBonus, salaryGrowth, projectionYears, balances, dateOfBirth]);

    // Display values with currency conversion (SGD -> Display)
    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: displayCurrency,
            maximumFractionDigits: 0
        }).format(val * sgdToDisplayRate);
    };

    const formatSGD = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'SGD',
            maximumFractionDigits: 0
        }).format(val);
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
    const finalProjectedData = calculationResult.projection[calculationResult.projection.length - 1];
    const finalProjectedTotal = finalProjectedData ? finalProjectedData.total : 0;

    const header = (
        <div className="summary-info">
            <div className="summary-name">CPF Calculator 2026</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--neu-text-tertiary)', marginTop: '-2px', marginBottom: '8px' }}>
                Last updated: {formatLastUpdated(settings?.cpf?.updatedAt)}
            </div>
            <div className={styles.headerGrid} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div className={styles.headerItem} style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span className={styles.headerLabel}>Current Total</span>
                    <span className={styles.headerValueSuccess}>{formatCurrency(startBalance.oa + startBalance.sa + startBalance.ma + startBalance.ra)}</span>
                </div>
                <div className={styles.headerItem} style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span className={styles.headerLabel}>Projected Total</span>
                    <span className={styles.headerValueSecondary}>{formatCurrency(finalProjectedTotal)}</span>
                </div>
            </div>
        </div>
    );

    const pieData = [
        { name: 'OA', value: Math.round(calculationResult.finalBalances.oa), color: '#3b82f6' },
        { name: 'SA', value: Math.round(calculationResult.finalBalances.sa), color: '#f59e0b' },
        { name: 'RA', value: Math.round(calculationResult.finalBalances.ra), color: '#8b5cf6' }, // Purple for RA
        { name: 'MA', value: Math.round(calculationResult.finalBalances.ma), color: '#10b981' },
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
                subtitle={`Last updated: ${formatLastUpdated(settings?.cpf?.updatedAt)}`}
                expanded={isOpen}
                onToggle={onToggle}
                onHide={onHide}
                collapsedWidth={220}
                collapsedHeight={220}
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
                                    <h4 className={styles.sectionHeaderTitle} style={{ margin: 0 }}>Projected CPF Growth ({dateOfBirth ? 'By Age' : 'By Year'})</h4>
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
                                            <Area name={age < 55 ? "SA" : "RA"} type="monotone" dataKey="sa_ra" stackId="1" stroke="#f59e0b" fillOpacity={1} fill="url(#colorSAL)" isAnimationActive={false} />
                                            <Area name="MA" type="monotone" dataKey="ma" stackId="1" stroke="#10b981" fillOpacity={1} fill="url(#colorMAL)" isAnimationActive={false} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className={styles.summarySection}>
                                <h4 className={styles.sectionHeaderTitle}>Account Distribution & Interest (2026)</h4>
                                <div className={styles.summaryTopRow}>
                                    <div className={styles.chartContainer}>
                                        <div className={styles.chartOverlay}>
                                            <span className={styles.overlayLabel}>Projected Total</span>
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
                                                <Tooltip content={<CustomTooltip />} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>

                                    <div className={styles.statsPanel}>
                                        <div className={styles.statLine}>
                                            <div className={styles.statDot} style={{ background: '#3b82f6' }} />
                                            <span className={styles.statLabel}>Projected OA</span>
                                            <span className={styles.statValue}>{formatCurrency(calculationResult.finalBalances.oa)}</span>
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
                                            <span className={styles.statLabelEmphasized}>Yearly Interest</span>
                                            <span className={styles.statValueSuccess}>+{formatCurrency(calculationResult.yearlyInterest.total)}</span>
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
                width="500px"
                height="auto"
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
                                <label className={styles.label}>OA (S$)</label>
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
