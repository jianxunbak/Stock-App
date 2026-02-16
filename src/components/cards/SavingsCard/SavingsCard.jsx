import React, { useState, useMemo, useEffect } from 'react';
import ExpandableCard from '../../ui/ExpandableCard/ExpandableCard';
import BaseChart from '../../ui/BaseChart/BaseChart';
import DropdownButton from '../../ui/DropdownButton/DropdownButton';
import SavingsEditorWindow from '../../ui/SavingsEditorWindow/SavingsEditorWindow';
import { Settings, TrendingUp, PieChart as PieChartIcon, ChevronDown, Layers } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import styles from './SavingsCard.module.css';
import { useUserSettings } from '../../../hooks/useUserSettings';

const SCENARIO_COLORS = [
    'var(--neu-success)',      // Green
    '#60a5fa',                 // Blue
    'var(--neu-color-favorite)', // Yellow/Gold
    '#f87171',                 // Red
    '#a78bfa',                 // Purple
];

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

const DEFAULT_EXPENSES = {
    bills: 500,
    investments: 500,
    insurances: 200,
    transport: 300,
    groceries: 400,
    shopping: 200,
    foodDrinks: 600,
    others: 300
};

const EXPENSE_COLORS = [
    '#60a5fa', '#a78bfa', '#f472b6', '#fb923c', '#fbbf24', '#2dd4bf', '#4ade80', '#94a3b8'
];

const SavingsCard = ({
    isOpen = true,
    onToggle = null,
    onHide = null,
    className = ""
}) => {
    const { settings, updateSettings, loading: settingsLoading } = useUserSettings();

    const [scenarios, setScenarios] = useState([
        {
            id: 1,
            name: 'Plan A',
            monthlyPay: 5000,
            initialSavings: 10000,
            bankInterestRate: 2,
            years: 10,
            visible: true,
            color: SCENARIO_COLORS[0],
            expenses: { ...DEFAULT_EXPENSES }
        }
    ]);
    const [nextScenarioId, setNextScenarioId] = useState(2);
    const [activeScenarioId, setActiveScenarioId] = useState(1);
    const [projectionYears, setProjectionYears] = useState(10);
    const [showEditor, setShowEditor] = useState(false);

    // Load from settings
    const [isInitialized, setIsInitialized] = useState(false);

    // Load from settings (only once)
    useEffect(() => {
        if (settings?.savings && !isInitialized) {
            if (settings.savings.scenarios) setScenarios(settings.savings.scenarios);
            if (settings.savings.nextScenarioId) setNextScenarioId(settings.savings.nextScenarioId);
            if (settings.savings.activeScenarioId) setActiveScenarioId(settings.savings.activeScenarioId);
            if (settings.savings.projectionYears) setProjectionYears(settings.savings.projectionYears);
            setIsInitialized(true);
        }
    }, [settings, isInitialized]);

    // Save to settings (Debounced)
    useEffect(() => {
        if (settingsLoading) return;

        const timer = setTimeout(() => {
            // Only update if different from what's in settings to avoid loops
            const currentSavings = {
                scenarios,
                nextScenarioId,
                activeScenarioId,
                projectionYears
            };

            if (JSON.stringify(settings?.savings) !== JSON.stringify(currentSavings)) {
                updateSettings({
                    savings: {
                        ...(settings?.savings || {}),
                        ...currentSavings
                    }
                });
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(timer);
    }, [scenarios, nextScenarioId, activeScenarioId, projectionYears, settingsLoading, updateSettings, settings?.savings]);

    // Helpers
    const calculateMetrics = (scenario) => {
        let totalExpenses = 0;
        const monthlyPay = Number(scenario.monthlyPay || 0);

        const isStructured = scenario.expenses && typeof scenario.expenses === 'object' &&
            ('items' in scenario.expenses || 'groups' in scenario.expenses || 'linked' in scenario.expenses);

        if (isStructured) {
            const { items = [], groups = [], linked = [] } = scenario.expenses;

            const getItemMonthlyValue = (item) => {
                const val = Number(item.value || 0);
                if (item.frequency === 'Yearly') return val / 12;
                if (item.frequency === 'Quarterly') return val / 3;
                return val;
            };

            items.forEach(item => totalExpenses += getItemMonthlyValue(item));
            groups.forEach(g => (g.items || []).forEach(item => totalExpenses += getItemMonthlyValue(item)));
            linked.forEach(item => totalExpenses += getItemMonthlyValue(item));
        } else {
            // Fallback for legacy simple object
            totalExpenses = Object.values(scenario.expenses || {}).reduce((a, b) => a + Number(b || 0), 0);
        }

        // Get CPF from settings if available, otherwise fallback to 20%
        const cpfSettings = settings?.cpf;
        let cpf = monthlyPay * 0.2; // Fallback
        if (cpfSettings?.monthlySalary) {
            const salary = Number(cpfSettings.monthlySalary);
            const bonus = Number(cpfSettings.annualBonus || 0);
            const monthlyBonus = bonus / 12;
            // Simple approximation for the editor summary
            // In a real app we might want to use the actual calculated contribution from CPFCard logic
            cpf = (Math.min(salary, 8000) + Math.min(monthlyBonus, 8500 - Math.min(salary, 8000))) * 0.2;
        }

        const monthlySavings = monthlyPay - cpf - totalExpenses;
        return { totalExpenses, cpf, monthlySavings };
    };

    // Active Scenario Calculations (for Donut)
    const activeScenario = useMemo(() =>
        scenarios.find(s => s.id === activeScenarioId) || scenarios[0]
        , [scenarios, activeScenarioId]);

    const activeMetrics = useMemo(() => calculateMetrics(activeScenario), [activeScenario]);

    // Chart Data: Projected Savings for all visible scenarios
    const chartData = useMemo(() => {
        const visibleScenarios = scenarios.filter(s => s.visible);
        if (visibleScenarios.length === 0) return [];

        const maxYears = projectionYears;
        const data = [];

        // Track running balance for each scenario to handle compounding correctly
        const balances = {};
        visibleScenarios.forEach(s => {
            balances[s.id] = Number(s.initialSavings || 0);
        });

        const currentAge = getAge(settings?.dateOfBirth);
        for (let year = 0; year <= maxYears; year++) {
            const point = {
                date: currentAge !== null ? `Age ${currentAge + year}` : `Year ${year}`,
                year: new Date().getFullYear() + year,
                age: currentAge !== null ? currentAge + year : null
            };
            visibleScenarios.forEach(s => {
                if (year === 0) {
                    point[`savings_${s.id}`] = balances[s.id];
                } else {
                    const { monthlySavings } = calculateMetrics(s);
                    const annualSavings = monthlySavings * 12;
                    const interestRate = Number(s.bankInterestRate || 0) / 100;

                    // Annual compounding: (Balance * Interest) + Annual Savings
                    balances[s.id] = (balances[s.id] * (1 + interestRate)) + annualSavings;
                    point[`savings_${s.id}`] = Math.round(balances[s.id]);
                }
            });
            data.push(point);
        }
        return data;
    }, [scenarios, projectionYears]);

    const chartSeries = useMemo(() => {
        return scenarios.filter(s => s.visible).map(s => ({
            id: `savings_${s.id}`,
            name: s.name,
            dataKey: `savings_${s.id}`,
            color: s.color
        }));
    }, [scenarios]);

    // Donut Chart Data (for active scenario)
    const donutData = useMemo(() => {
        const flattenedExpenses = [];

        const isStructured = activeScenario.expenses && typeof activeScenario.expenses === 'object' &&
            ('items' in activeScenario.expenses || 'groups' in activeScenario.expenses || 'linked' in activeScenario.expenses);

        if (isStructured) {
            const { items = [], groups = [], linked = [] } = activeScenario.expenses;

            const getItemMonthlyValue = (item) => {
                const val = Number(item.value || 0);
                if (item.frequency === 'Yearly') return val / 12;
                if (item.frequency === 'Quarterly') return val / 3;
                return val;
            };

            items.forEach(item => flattenedExpenses.push({ name: item.name, value: getItemMonthlyValue(item), type: 'expense' }));
            groups.forEach(g => {
                const groupTotal = (g.items || []).reduce((sum, item) => sum + getItemMonthlyValue(item), 0);
                if (groupTotal > 0) {
                    flattenedExpenses.push({ name: g.name, value: groupTotal, type: 'expense' });
                }
            });
            linked.forEach(item => flattenedExpenses.push({ name: item.name, value: getItemMonthlyValue(item), type: 'linked' }));
        } else {
            Object.entries(activeScenario.expenses || {}).forEach(([name, value]) => {
                flattenedExpenses.push({
                    name: name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^[a-z]/, L => L.toUpperCase()),
                    value: Number(value),
                    type: 'expense'
                });
            });
        }

        return [
            ...flattenedExpenses,
            { name: 'CPF', value: activeMetrics.cpf, type: 'cpf' },
            { name: 'Savings', value: Math.max(0, activeMetrics.monthlySavings), type: 'savings' }
        ].filter(item => item.value > 0);
    }, [activeScenario, activeMetrics]);

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    };

    const savingsRate = ((activeMetrics.monthlySavings / (Number(activeScenario.monthlyPay) || 1)) * 100).toFixed(2);

    const header = (
        <div className="summary-info" style={{ padding: 0 }}>
            <div className="summary-name">Savings</div>

            <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: '0.5rem' }}>
                <div style={{ position: 'relative', width: '100px', height: '100px', flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={donutData}
                                innerRadius={32}
                                outerRadius={48}
                                paddingAngle={3}
                                dataKey="value"
                                stroke="none"
                                isAnimationActive={false}
                            >
                                {donutData.map((entry, index) => {
                                    let color;
                                    if (entry.type === 'savings') color = 'var(--neu-success)';
                                    else if (entry.type === 'cpf') color = 'var(--neu-color-favorite)';
                                    else color = EXPENSE_COLORS[index % EXPENSE_COLORS.length];
                                    return <Cell key={`cell-header-${index}`} fill={color} />;
                                })}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none'
                    }}>
                        <div style={{
                            fontSize: '1.2rem',
                            fontWeight: 800,
                            color: 'var(--text-primary)',
                            lineHeight: 1
                        }}>
                            {savingsRate}%
                        </div>
                        <div style={{
                            fontSize: '0.6rem',
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            marginTop: '2px',
                            letterSpacing: '0.05em'
                        }}>
                            Savings
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            let color;
            if (data.type === 'savings') color = 'var(--neu-success)';
            else if (data.type === 'cpf') color = 'var(--neu-color-favorite)';
            else {
                const index = donutData.findIndex(d => d.name === data.name);
                color = EXPENSE_COLORS[index % EXPENSE_COLORS.length];
            }

            return (
                <div className={styles.chartTooltip}>
                    <span className={styles.tooltipDate}>{data.type.charAt(0).toUpperCase() + data.type.slice(1)}</span>
                    <div className={styles.tooltipItems}>
                        <div className={styles.tooltipItem} style={{ color: color }}>
                            <span className={styles.tooltipName}>{data.name}:</span>
                            <span className={styles.tooltipValue}>
                                {formatCurrency(data.value)}
                                <span className={styles.tooltipPct} style={{ marginLeft: '4px', fontSize: '0.8rem', opacity: 0.8 }}>
                                    ({((data.value / activeScenario.monthlyPay) * 100).toFixed(2)}%)
                                </span>
                            </span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    // Scenario CRUD
    const addScenario = () => {
        const cpfSalary = settings?.cpf?.monthlySalary ? Number(settings.cpf.monthlySalary) : 5000;
        const newScenario = {
            id: nextScenarioId,
            name: `Plan ${String.fromCharCode(65 + scenarios.length)}`,
            monthlyPay: cpfSalary,
            initialSavings: 10000,
            bankInterestRate: 2,
            years: 10,
            visible: true,
            color: SCENARIO_COLORS[scenarios.length % SCENARIO_COLORS.length],
            expenses: { ...DEFAULT_EXPENSES }
        };
        setScenarios([...scenarios, newScenario]);
        setNextScenarioId(nextScenarioId + 1);
        setActiveScenarioId(newScenario.id);
    };

    const removeScenario = (id) => {
        if (scenarios.length <= 1) return;
        const newScenarios = scenarios.filter(s => s.id !== id);
        setScenarios(newScenarios);
        if (activeScenarioId === id) {
            setActiveScenarioId(newScenarios[0].id);
        }
    };

    const updateScenario = (id, field, value) => {
        setScenarios(scenarios.map(s =>
            s.id === id ? { ...s, [field]: value } : s
        ));
    };

    const updateExpenses = (scenarioId, expenses) => {
        setScenarios(scenarios.map(s =>
            s.id === scenarioId ? { ...s, expenses } : s
        ));
    };

    return (
        <>
            <ExpandableCard
                title="Savings and Expenses"
                expanded={isOpen}
                onToggle={onToggle}
                onHide={onHide}
                collapsedWidth={220}
                collapsedHeight={220}
                headerContent={header}
                className={className}
                controls={
                    scenarios.length > 1 && (
                        <DropdownButton
                            variant="icon"
                            icon={<Layers size={16} />}
                            align="right"
                            className={styles.scenarioDropdown}
                            items={scenarios.map(s => ({
                                label: s.name,
                                isActive: s.id === activeScenarioId,
                                onClick: () => setActiveScenarioId(s.id),
                                indicatorColor: s.color
                            }))}
                        />
                    )
                }
                menuItems={[
                    {
                        label: 'Manage Savings and Expenses',
                        indicatorNode: <Settings size={14} />,
                        onClick: () => setShowEditor(true)
                    }
                ]}
            >
                <div className={styles.container}>
                    <div className={styles.grid}>
                        <div className={styles.chartSection}>
                            <div className={styles.sectionHeader}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <h4 className={styles.sectionTitle}>Projected Savings</h4>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Years:</span>
                                    <input
                                        type="number"
                                        className={styles.input} // Ensure this class exists (same as OtherInvestmentsCard) or style inline
                                        style={{
                                            width: '60px',
                                            padding: '0.25rem 0.5rem',
                                            textAlign: 'center',
                                            background: 'var(--neu-bg)',
                                            border: 'none',
                                            borderRadius: '8px',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.85rem',
                                            boxShadow: 'inset 2px 2px 5px var(--neu-shadow-dark), inset -2px -2px 5px var(--neu-shadow-light)',
                                            outline: 'none'
                                        }}
                                        value={projectionYears}
                                        onChange={(e) => setProjectionYears(e.target.value === '' ? '' : Number(e.target.value))}
                                    />
                                </div>
                            </div>
                            <div className={styles.chartContainer}>
                                <BaseChart
                                    data={chartData}
                                    series={chartSeries}
                                    height={300}
                                    showGrid={true}
                                    showXAxis={true}
                                    xAxisFormatter={(val) => val}
                                    tooltipLabelFormatter={(label, payload) => {
                                        if (payload && payload.length > 0) {
                                            const item = payload[0].payload;
                                            return item.age ? `Age ${item.age} (${item.year})` : `Year ${item.year}`;
                                        }
                                        return label;
                                    }}
                                    showYAxis={true}
                                    yAxisFormatter={(val) => {
                                        if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
                                        if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
                                        return `$${val}`;
                                    }}
                                    tooltipValueFormatter={(val) => formatCurrency(val)}
                                />
                            </div>
                        </div>

                        <div className={styles.donutSection}>
                            <div className={styles.sectionHeader}>
                                <h4 className={styles.sectionTitle}>Allocation</h4>
                            </div>
                            <div className={styles.donutContainer}>
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie
                                            data={donutData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={90}
                                            paddingAngle={5}
                                            dataKey="value"
                                            isAnimationActive={false}
                                        >
                                            {donutData.map((entry, index) => {
                                                let color;
                                                if (entry.type === 'savings') color = 'var(--neu-success)';
                                                else if (entry.type === 'cpf') color = 'var(--neu-color-favorite)';
                                                else color = EXPENSE_COLORS[index % EXPENSE_COLORS.length];
                                                return <Cell key={`cell-${index}`} fill={color} stroke="none" />;
                                            })}
                                        </Pie>
                                        <Tooltip
                                            content={<CustomTooltip />}
                                            wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className={styles.donutCenterText}>
                                    <span className={styles.centerValue}>{((activeMetrics.monthlySavings / activeScenario.monthlyPay) * 100).toFixed(2)}%</span>
                                    <span className={styles.centerLabel}>Savings Rate</span>
                                </div>
                            </div>
                            <div className={styles.legendGrid}>
                                {donutData.map((entry, index) => {
                                    let color;
                                    if (entry.type === 'savings') color = 'var(--neu-success)';
                                    else if (entry.type === 'cpf') color = 'var(--neu-color-favorite)';
                                    else color = EXPENSE_COLORS[index % EXPENSE_COLORS.length];
                                    return (
                                        <div key={entry.name} className={styles.legendItem}>
                                            <div className={styles.legendDot} style={{ backgroundColor: color }} />
                                            <span className={styles.legendName}>{entry.name}</span>
                                            <span className={styles.legendValue}>{((entry.value / activeScenario.monthlyPay) * 100).toFixed(2)}%</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </ExpandableCard>

            <SavingsEditorWindow
                isOpen={showEditor}
                onClose={() => setShowEditor(false)}
                scenarios={scenarios}
                settings={settings}
                stocksCharts={settings?.stocks?.charts || []}
                onAddScenario={addScenario}
                onRemoveScenario={removeScenario}
                onUpdateScenario={updateScenario}
                onUpdateExpenses={updateExpenses}
            />
        </>
    );
};

export default SavingsCard;
