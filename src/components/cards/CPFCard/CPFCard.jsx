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
import { useUserSettings } from '../../../hooks/useUserSettings';
import { formatLastUpdated } from '../../../utils/dateUtils';

const CPFCard = ({
    isOpen = true,
    onToggle = null,
    onHide = null,
    className = "",
    dateOfBirth = null
}) => {
    const { settings, updateSettings, loading: settingsLoading } = useUserSettings();

    // Default states
    const [age, setAge] = useState(30);
    const [monthlySalary, setMonthlySalary] = useState(6000);
    const [annualBonus, setAnnualBonus] = useState(12000);
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
            if (settings.cpf.projectionYears !== undefined) setProjectionYears(settings.cpf.projectionYears);
            if (settings.cpf.balances) setBalances(settings.cpf.balances);
            setIsInitialized(true);
        }
    }, [settings, isInitialized]);

    // Save to user settings (Debounced)
    useEffect(() => {
        if (settingsLoading) return;
        const timer = setTimeout(() => {
            const currentData = {
                monthlySalary,
                annualBonus,
                projectionYears,
                balances
            };
            // Only update if data changed to avoid infinite loop
            const { updatedAt: prevTime, ...prevCpfWithoutTime } = settings?.cpf || {};
            if (JSON.stringify(prevCpfWithoutTime) !== JSON.stringify(currentData)) {
                updateSettings({
                    cpf: {
                        ...currentData,
                        updatedAt: new Date().toISOString()
                    }
                });
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [monthlySalary, annualBonus, projectionYears, balances, settingsLoading, updateSettings, settings?.cpf]);

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
            // For 2026 simulation, use age in 2026
            const ageIn2026 = calculatedAge + (2026 - today.getFullYear());
            setAge(ageIn2026 > 0 ? ageIn2026 : 30);
        }
    }, [dateOfBirth]);

    // CPF 2026 Logic Helpers
    const CEILINGS = {
        OW: 8000,
        ANNUAL: 102000,
        FRS: 213000 // Estimated FRS for 2026
    };

    const getContributionRates = (currentAge) => {
        if (currentAge <= 55) return { employer: 0.17, employee: 0.20, total: 0.37 };
        if (currentAge <= 60) return { employer: 0.16, employee: 0.18, total: 0.34 };
        if (currentAge <= 65) return { employer: 0.125, employee: 0.125, total: 0.25 };
        if (currentAge <= 70) return { employer: 0.09, employee: 0.075, total: 0.165 };
        return { employer: 0.075, employee: 0.05, total: 0.125 };
    };

    const getAllocationRatios = (currentAge) => {
        if (currentAge <= 35) return { oa: 0.6217, sa: 0.1621, ma: 0.2162 };
        if (currentAge <= 45) return { oa: 0.5677, sa: 0.1891, ma: 0.2432 };
        if (currentAge <= 50) return { oa: 0.5136, sa: 0.2162, ma: 0.2702 };
        if (currentAge <= 55) return { oa: 0.4055, sa: 0.3108, ma: 0.2837 };
        return { oa: 0.4055, ra: 0.3108, ma: 0.2837 }; // 55+ logic uses RA
    };

    const calculationResult = useMemo(() => {
        let currentOA = Number(balances.oa || 0);
        let currentSA = age >= 55 ? 0 : Number(balances.sa || 0);
        let currentMA = Number(balances.ma || 0);
        let currentRA = age >= 55 ? (Number(balances.ra || 0) + Number(balances.sa || 0)) : 0;

        let projection = [];
        let yearlyInterest = { oa: 0, sa: 0, ma: 0, ra: 0 };

        // Project for specified years or until age 100
        const currentYear = 2026;
        const maxYears = Math.min(projectionYears, 100 - age);

        for (let year = 0; year <= maxYears; year++) {
            const currentAge = age + year;
            const rates = getContributionRates(currentAge);
            const allocation = getAllocationRatios(currentAge);

            let yearOAInterest = 0;
            let yearSAInterest = 0;
            let yearMAInterest = 0;
            let yearRAInterest = 0;

            // Monthly simulation within the year
            for (let month = 0; month < 12; month++) {
                // 1. Interest accrual
                const monthlyIntOA = currentOA * (0.025 / 12);
                const monthlyIntSA = currentSA * (0.04 / 12);
                const monthlyIntMA = currentMA * (0.04 / 12);
                const monthlyIntRA = currentRA * (0.04 / 12);

                yearOAInterest += monthlyIntOA;
                yearSAInterest += monthlyIntSA;
                yearMAInterest += monthlyIntMA;
                yearRAInterest += monthlyIntRA;

                // Extra Interest
                if (currentAge < 55) {
                    const eligibleOA = Math.min(currentOA, 20000);
                    const remaining60k = Math.max(0, 60000 - eligibleOA);
                    const eligibleOthers = Math.min(currentSA + currentMA, remaining60k);
                    yearSAInterest += (eligibleOA + eligibleOthers) * (0.01 / 12);
                } else {
                    const eligibleOA = Math.min(currentOA, 20000);
                    const totalRA_MA = currentRA + currentMA;
                    let rem3 = 30000;
                    let extra = 0;
                    const tOA = Math.min(eligibleOA, rem3);
                    extra += tOA * (0.02 / 12);
                    rem3 -= tOA;
                    const tOthers = Math.min(totalRA_MA, rem3);
                    extra += tOthers * (0.02 / 12);
                    rem3 -= tOthers;
                    let n3 = 30000;
                    const tOA2 = Math.min(Math.max(0, eligibleOA - tOA), n3);
                    extra += tOA2 * (0.01 / 12);
                    n3 -= tOA2;
                    const tOthers2 = Math.min(Math.max(0, totalRA_MA - tOthers), n3);
                    extra += tOthers2 * (0.01 / 12);
                    yearRAInterest += extra;
                }

                // 2. Contributions
                const isBonusMonth = month === 11;
                const owSubject = Math.min(Number(monthlySalary || 0), CEILINGS.OW);
                const totalOWForYear = owSubject * (month + 1);
                const awSubject = isBonusMonth ? Math.max(0, Math.min(Number(annualBonus || 0), CEILINGS.ANNUAL - totalOWForYear)) : 0;
                const totalSubject = owSubject + awSubject;

                const totalContr = Math.round(totalSubject * rates.total);

                const iOA_base = Math.round(totalContr * allocation.oa);
                const iMA = Math.round(totalContr * allocation.ma);
                const iOthers = totalContr - iOA_base - iMA;

                let iOA = iOA_base;
                let iSA = 0;
                let iRA = 0;

                if (currentAge < 55) {
                    iSA = iOthers;
                } else {
                    if (currentRA < CEILINGS.FRS) {
                        const room = CEILINGS.FRS - currentRA;
                        const toRA = Math.min(iOthers, room);
                        iRA = toRA;
                        iOA += (iOthers - toRA);
                    } else {
                        iOA += iOthers;
                    }
                }

                currentOA += iOA;
                currentSA += iSA;
                currentMA += iMA;
                currentRA += iRA;
            }

            // Credit interest at year end
            currentOA += yearOAInterest;
            currentSA += yearSAInterest;
            currentMA += yearMAInterest;
            currentRA += yearRAInterest;

            if (year === 0) {
                yearlyInterest = {
                    oa: yearOAInterest,
                    sa: yearSAInterest,
                    ma: yearMAInterest,
                    ra: yearRAInterest,
                    total: yearOAInterest + yearSAInterest + yearMAInterest + yearRAInterest
                };
            }

            projection.push({
                year: currentYear + year,
                age: currentAge,
                oa: Math.round(currentOA),
                sa_ra: Math.round(currentSA + currentRA),
                ma: Math.round(currentMA),
                total: Math.round(currentOA + currentSA + currentMA + currentRA)
            });
        }

        return {
            projection,
            yearlyInterest,
            finalBalances: {
                oa: projection[0].oa,
                sa: age < 55 ? projection[0].sa_ra : 0,
                ma: projection[0].ma,
                ra: age >= 55 ? projection[0].sa_ra : 0
            }
        };
    }, [age, monthlySalary, annualBonus, projectionYears, balances]);

    const formatCurrency = (val) => new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', maximumFractionDigits: 0 }).format(val);

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

    const startBalance = Number(balances.oa || 0) + Number(balances.sa || 0) + Number(balances.ma || 0) + Number(balances.ra || 0);

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
                    <span className={styles.headerValueSuccess}>{formatCurrency(startBalance)}</span>
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
        { name: age < 55 ? 'SA' : 'RA', value: Math.round(calculationResult.finalBalances.sa || calculationResult.finalBalances.ra), color: '#f59e0b' },
        { name: 'MA', value: Math.round(calculationResult.finalBalances.ma), color: '#10b981' },
    ];

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
                loading={settingsLoading}
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
                                        <div className={styles.chartOverlay}>
                                            <span className={styles.overlayLabel}>Balance</span>
                                            <span className={styles.overlayValue}>{formatCurrency(calculationResult.projection[0]?.total || 0)}</span>
                                        </div>
                                    </div>

                                    <div className={styles.statsPanel}>
                                        <div className={styles.statLine}>
                                            <div className={styles.statDot} style={{ background: '#3b82f6' }} />
                                            <span className={styles.statLabel}>OA Balance</span>
                                            <span className={styles.statValue}>{formatCurrency(calculationResult.finalBalances.oa)}</span>
                                        </div>
                                        <div className={styles.statLine}>
                                            <div className={styles.statDot} style={{ background: '#f59e0b' }} />
                                            <span className={styles.statLabel}>{age < 55 ? 'SA Balance' : 'RA Balance'}</span>
                                            <span className={styles.statValue}>{formatCurrency(calculationResult.finalBalances.sa || calculationResult.finalBalances.ra)}</span>
                                        </div>
                                        <div className={styles.statLine}>
                                            <div className={styles.statDot} style={{ background: '#10b981' }} />
                                            <span className={styles.statLabel}>MA Balance</span>
                                            <span className={styles.statValue}>{formatCurrency(calculationResult.finalBalances.ma)}</span>
                                        </div>
                                        <div className={styles.divider} />
                                        <div className={styles.statLine}>
                                            <span className={styles.statLabelEmphasized}>Yearly Interest</span>
                                            <span className={styles.statValueSuccess}>+{formatCurrency(calculationResult.yearlyInterest.total)}</span>
                                        </div>
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
                            <label className={styles.label}>Monthly Salary (OW)</label>
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
                            <label className={styles.label}>Annual Bonus (AW)</label>
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

                        <div className={styles.sectionDivider} />
                        <h4 className={styles.subTitle}>Starting Balances (Jan 2026)</h4>

                        <div className={styles.inputGridMini}>
                            <div className={styles.inputGroupMini}>
                                <label className={styles.label}>OA ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className={styles.neuInput}
                                    value={balances.oa}
                                    onChange={(e) => setBalances({ ...balances, oa: e.target.value })}
                                />
                            </div>
                            <div className={styles.inputGroupMini}>
                                <label className={styles.label}>{age < 55 ? 'SA' : 'RA'} ($)</label>
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
                                <label className={styles.label}>MA ($)</label>
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
                        <h4 className={styles.refTitle}>Allocation Ratios</h4>
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
                            <div className={styles.refAllocRow}><span>55+</span> <span>40.55%</span> <span>31.08%(RA)</span> <span>28.37%</span></div>
                        </div>
                    </section>

                    <section className={styles.refSection}>
                        <h4 className={styles.refTitle}>Interest Rates (Projected 2026)</h4>
                        <div className={styles.refGrid}>
                            <div className={styles.refRow}><span>Ordinary Account (OA)</span> <strong>2.5% p.a.</strong></div>
                            <div className={styles.refRow}><span>SA / MA / RA</span> <strong>4.0% p.a.</strong></div>
                        </div>
                        <div className={styles.refNote}>
                            <Info size={14} />
                            <p>Extra interest: +1% on first $60k (capped $20k OA) for &lt; 55. Tiered extra interest for 55+.</p>
                        </div>
                    </section>
                </div>
            </Window >
        </>
    );
};

export default CPFCard;
