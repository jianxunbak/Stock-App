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
    onRefresh = null
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
    // Step 3: Compound Interest Foundation Logic + Ceilings + Dynamic Rates
    const calculationResult = useMemo(() => {
        return calculateCPFProjection({
            currentAge: age,
            dateOfBirth,
            monthlySalary,
            annualBonus,
            salaryGrowth,
            projectionYears,
            balances
        });
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
                onRefresh={onRefresh}
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
