import React, { useState, useMemo, useEffect } from 'react';
import ExpandableCard from '../../ui/ExpandableCard/ExpandableCard';
import DropdownButton from '../../ui/DropdownButton/DropdownButton';
import { Calendar, TrendingUp, Wallet, ArrowRight } from 'lucide-react';
import styles from './WealthSummaryCard.module.css';
import { useUserSettings } from '../../../hooks/useUserSettings';
import BaseChart from '../../ui/BaseChart/BaseChart';

const WealthSummaryCard = ({
    isOpen = true,
    onToggle = null,
    onHide = null,
    className = ""
}) => {
    const { settings, updateSettings, loading: settingsLoading } = useUserSettings();

    // Projection relative year (0 = current, 1 = in 1 year, etc.)
    const [projectedYear, setProjectedYear] = useState(0);

    // Local state for selected scenarios to allow immediate feedback
    const [savingsScenarioId, setSavingsScenarioId] = useState(null);
    const [stocksScenarioIds, setStocksScenarioIds] = useState({}); // { chartId: scenarioId }

    // Sync with settings
    useEffect(() => {
        if (settings?.savings?.activeScenarioId) {
            setSavingsScenarioId(settings.savings.activeScenarioId);
        }
        if (settings?.stocks?.activeScenarioIds) {
            setStocksScenarioIds(settings.stocks.activeScenarioIds);
        } else if (settings?.stocks?.charts) {
            const defaults = {};
            settings.stocks.charts.forEach(c => {
                if (c.scenarios?.length > 0) defaults[c.id] = c.scenarios[0].id;
            });
            setStocksScenarioIds(defaults);
        }
        if (settings?.wealth?.projectedYear !== undefined) {
            setProjectedYear(settings.wealth.projectedYear);
        }
    }, [settings]);

    const handleProjectedYearChange = (year) => {
        setProjectedYear(year);
        if (year !== '') {
            updateSettings({ wealth: { ...settings.wealth, projectedYear: year } });
        }
    };

    const handleSavingsScenarioChange = (id) => {
        setSavingsScenarioId(id);
        updateSettings({ savings: { ...settings.savings, activeScenarioId: id } });
    };

    const handleStocksScenarioChange = (chartId, scenarioId) => {
        const newIds = { ...stocksScenarioIds, [chartId]: scenarioId };
        setStocksScenarioIds(newIds);
        updateSettings({ stocks: { ...settings.stocks, activeScenarioIds: newIds } });
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
        }).format(val);
    };

    // --- Calculation Logic ---

    const currentYear = new Date().getFullYear();
    const targetYear = currentYear + projectedYear;

    const currentAge = useMemo(() => {
        if (!settings?.dateOfBirth) return null;
        const birth = new Date(settings.dateOfBirth);
        if (isNaN(birth.getTime())) return null;
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    }, [settings?.dateOfBirth]);

    const targetAge = currentAge !== null ? currentAge + projectedYear : null;

    // 1. Savings & CPF Projection
    const savingsAndCpf = useMemo(() => {
        const scenario = settings?.savings?.scenarios?.find(s => s.id === savingsScenarioId) || settings?.savings?.scenarios?.[0];
        if (!scenario) return { savings: 0, cpf: 0 };

        const monthlyPay = Number(scenario.monthlyPay || 0);

        // Helper to calculate structured expenses
        const calculateTotalExpenses = (expensesData) => {
            if (!expensesData) return 0;
            // If it's the old key-value format
            if (typeof expensesData === 'object' && !expensesData.items && !expensesData.groups) {
                return Object.values(expensesData).reduce((a, b) => a + Number(b || 0), 0);
            }

            // New structured format
            const { items = [], groups = [], linked = [] } = expensesData;
            const getItemMonthly = (item) => {
                const val = Number(item.value || 0);
                if (item.frequency === 'Yearly') return val / 12;
                if (item.frequency === 'Quarterly') return val / 3;
                return val;
            };

            let total = 0;
            items.forEach(i => total += getItemMonthly(i));
            groups.forEach(g => (g.items || []).forEach(i => total += getItemMonthly(i)));
            linked.forEach(i => total += getItemMonthly(i));
            return total;
        };

        const totalExpenses = calculateTotalExpenses(scenario.expenses);

        // CPF Data from CPF Card settings
        const cpfSalary = Number(settings?.cpf?.monthlySalary || monthlyPay);
        const annualBonus = Number(settings?.cpf?.annualBonus || 0);
        const owCeiling = 8000;
        const annualCeiling = 102000;

        // Calculate Monthly Cash Savings (Subtract only Employee portion 20%)
        const cpfContributionEmployee = Math.min(monthlyPay, owCeiling) * 0.2;
        const monthlySavings = monthlyPay - cpfContributionEmployee - totalExpenses;

        let savingsBalance = Number(scenario.initialSavings || 0);
        const bankInterestRate = Number(scenario.bankInterestRate || 0) / 100;

        // CPF Starting Point
        const initialCpf = Number(settings?.cpf?.balances?.oa || 0) +
            Number(settings?.cpf?.balances?.sa || 0) +
            Number(settings?.cpf?.balances?.ma || 0) +
            Number(settings?.cpf?.balances?.ra || 0);

        let cpfBalance = initialCpf;

        // Sync with CPF Card simulation baseline
        for (let y = 0; y <= projectedYear; y++) {
            if (y > 0) {
                // Cash Savings Growth (Interest first, then new savings)
                savingsBalance = (savingsBalance * (1 + bankInterestRate)) + (monthlySavings * 12);

                // CPF Growth (Employer + Employee = 37% for age <= 55)
                const ageAtYear = (currentAge || 30) + y - 1;
                let contributionRate = 0.37;
                if (ageAtYear > 55) contributionRate = 0.34;
                if (ageAtYear > 60) contributionRate = 0.25;
                if (ageAtYear > 65) contributionRate = 0.165;
                if (ageAtYear > 70) contributionRate = 0.125;

                const annualOW = Math.min(cpfSalary, owCeiling) * 12;
                const annualAW = Math.min(annualBonus, Math.max(0, annualCeiling - annualOW));
                const annualTotalContr = (annualOW + annualAW) * contributionRate;

                cpfBalance = (cpfBalance * 1.033) + annualTotalContr;
            }
        }

        return { savings: Math.round(savingsBalance), cpf: Math.round(cpfBalance) };
    }, [settings?.savings, settings?.cpf, settings?.dateOfBirth, savingsScenarioId, projectedYear, currentAge]);

    // 2. Stocks Projection
    const stocksValue = useMemo(() => {
        let total = 0;
        if (!settings?.stocks?.charts) return 0;

        settings.stocks.charts.forEach(chart => {
            const scenarioId = stocksScenarioIds[chart.id];
            const scenario = chart.scenarios?.find(s => s.id === scenarioId) || chart.scenarios?.[0];
            if (!scenario) return;

            const initialDeposit = Number(scenario.initialDeposit || 0);
            const contributionAmount = Number(scenario.contributionAmount || 0);
            const annualRate = Number(scenario.estimatedRate || 0) / 100;
            const periodsPerYear = scenario.contributionFrequency === 'monthly' ? 12 :
                scenario.contributionFrequency === 'quarterly' ? 4 : 1;
            const ratePerPeriod = annualRate / periodsPerYear;
            const totalPeriods = projectedYear * periodsPerYear;

            let val = initialDeposit;
            for (let p = 1; p <= totalPeriods; p++) {
                val = (val + contributionAmount) * (1 + ratePerPeriod);
            }
            total += val;
        });
        return total;
    }, [settings?.stocks, stocksScenarioIds, projectedYear]);

    // 3. Other Investments
    const otherInvestmentsValue = useMemo(() => {
        const otherData = settings?.otherInvestments || { items: [], groups: [] };
        const allItems = [
            ...(otherData.items || []),
            ...(otherData.groups || []).flatMap(g => g.items || [])
        ];

        return allItems.reduce((sum, item) => {
            const currentVal = Number(item.value || 0);
            const payment = Number(item.paymentAmount || 0);
            const frequency = item.frequency || 'One-time';

            if (frequency === 'One-time' || projectedYear === 0) return sum + currentVal;

            let annualContribution = 0;
            if (frequency === 'Monthly') annualContribution = payment * 12;
            else if (frequency === 'Quarterly') annualContribution = payment * 4;
            else if (frequency === 'Yearly') annualContribution = payment;

            return sum + currentVal + (annualContribution * projectedYear);
        }, 0);
    }, [settings?.otherInvestments, projectedYear]);

    const netWorth = stocksValue + savingsAndCpf.savings + savingsAndCpf.cpf + otherInvestmentsValue;

    // 4. Annual Net Worth Growth Projection (for Chart)
    const netWorthGrowthData = useMemo(() => {
        const data = [];
        const startYear = new Date().getFullYear();
        // Use the projectedYear state, fallback to 10 if it's 0 or undefined for chart visual
        const maxProjection = projectedYear > 0 ? projectedYear : 10;

        // Settings fallbacks
        const stocksInit = settings?.stocks?.charts || [];
        const otherData = settings?.otherInvestments || { items: [], groups: [] };
        const allOtherItems = [
            ...(otherData.items || []),
            ...(otherData.groups || []).flatMap(g => g.items || [])
        ];

        const savingsScenario = settings?.savings?.scenarios?.find(s => s.id === savingsScenarioId) || settings?.savings?.scenarios?.[0];

        // Even without savings plan, we can show a chart based on current balances
        const monthlyPay = Number(savingsScenario?.monthlyPay || 0);

        // Expense calculation helper
        const calculateTotalExpenses = (expensesData) => {
            if (!expensesData) return 0;
            if (typeof expensesData === 'object' && !expensesData.items && !expensesData.groups) {
                return Object.values(expensesData).reduce((a, b) => a + Number(b || 0), 0);
            }
            const { items = [], groups = [], linked = [] } = expensesData;
            const getItemMonthly = (item) => {
                const val = Number(item.value || 0);
                if (item.frequency === 'Yearly') return val / 12;
                if (item.frequency === 'Quarterly') return val / 3;
                return val;
            };
            let total = 0;
            items.forEach(i => total += getItemMonthly(i));
            groups.forEach(g => (g.items || []).forEach(i => total += getItemMonthly(i)));
            linked.forEach(i => total += getItemMonthly(i));
            return total;
        };

        const totalExpenses = calculateTotalExpenses(savingsScenario?.expenses);
        const cpfSalary = Number(settings?.cpf?.monthlySalary || monthlyPay);
        const annualBonus = Number(settings?.cpf?.annualBonus || 0);
        const owCeiling = 8000;
        const annualCeiling = 102000;
        const cpfContributionEmployee = Math.min(monthlyPay, owCeiling) * 0.2;
        const monthlySavings = monthlyPay - cpfContributionEmployee - totalExpenses;
        const bankInterestRate = Number(savingsScenario?.bankInterestRate || 0) / 100;

        // Current state tracking
        let runningSavings = Number(savingsScenario?.initialSavings || 0);
        let runningCpf = Number(settings?.cpf?.balances?.oa || 0) +
            Number(settings?.cpf?.balances?.sa || 0) +
            Number(settings?.cpf?.balances?.ma || 0) +
            Number(settings?.cpf?.balances?.ra || 0);

        // Stocks initial state
        const runningStocks = stocksInit.map(chart => {
            const scenarioId = stocksScenarioIds[chart.id];
            const scenario = chart.scenarios?.find(s => s.id === scenarioId) || chart.scenarios?.[0];
            return {
                id: chart.id,
                value: Number(scenario?.initialDeposit || 0),
                contribution: Number(scenario?.contributionAmount || 0),
                rate: Number(scenario?.estimatedRate || 0) / 100,
                freq: scenario?.contributionFrequency === 'monthly' ? 12 :
                    scenario?.contributionFrequency === 'quarterly' ? 4 : 1
            };
        });

        // Other investments initial state
        const otherInvBase = allOtherItems.reduce((sum, item) => sum + Number(item.value || 0), 0);
        const otherInvAnnualContrib = allOtherItems.reduce((sum, item) => {
            const p = Number(item.paymentAmount || 0);
            const f = item.frequency || 'One-time';
            if (f === 'Monthly') return sum + (p * 12);
            if (f === 'Quarterly') return sum + (p * 4);
            if (f === 'Yearly') return sum + p;
            return sum;
        }, 0);

        for (let y = 0; y <= maxProjection; y++) {
            const ageAtYear = (currentAge || 30) + y;
            const yearLabel = (currentAge !== null) ? `${ageAtYear}` : `${startYear + y}`;

            const totalStocksThisYear = runningStocks.reduce((sum, s) => sum + s.value, 0);
            const totalOtherInvThisYear = otherInvBase + (otherInvAnnualContrib * y);

            data.push({
                year: startYear + y,
                age: ageAtYear,
                date: yearLabel,
                netWorth: Math.round(totalStocksThisYear + runningSavings + runningCpf + totalOtherInvThisYear)
            });

            // Calculate NEXT year values
            runningSavings = (runningSavings * (1 + bankInterestRate)) + (monthlySavings * 12);

            let contributionRate = 0.37;
            if (ageAtYear > 55) contributionRate = 0.34;
            if (ageAtYear > 60) contributionRate = 0.25;
            if (ageAtYear > 65) contributionRate = 0.165;
            if (ageAtYear > 70) contributionRate = 0.125;

            const annualOW = Math.min(cpfSalary, owCeiling) * 12;
            const annualAW = Math.min(annualBonus, Math.max(0, annualCeiling - annualOW));
            const annualTotalContr = (annualOW + annualAW) * contributionRate;
            runningCpf = (runningCpf * 1.033) + annualTotalContr;

            runningStocks.forEach(s => {
                const ratePerPeriod = s.rate / s.freq;
                for (let p = 1; p <= s.freq; p++) {
                    s.value = (s.value + s.contribution) * (1 + ratePerPeriod);
                }
            });
        }
        return data;
    }, [settings, savingsScenarioId, stocksScenarioIds, currentAge, projectedYear, settings?.stocks, settings?.otherInvestments, settings?.cpf]);

    const netWorthSeries = [
        { id: 'netWorth', name: 'Net Worth', dataKey: 'netWorth', color: 'var(--neu-success)' }
    ];

    const header = (
        <div className="summary-info">
            <div className="summary-name">Estimated Net Worth</div>
            <div className={styles.headerMeta}>
                {targetYear} {targetAge !== null && `• Age ${targetAge}`}
            </div>
            <div className={styles.headerValueGroup}>
                <div className={styles.mainValue}>{formatCurrency(netWorth)}</div>
                <div className={styles.valueLabel}>Projected Portfolio</div>
            </div>
        </div>
    );

    return (
        <ExpandableCard
            title="Estimated Net Worth"
            expanded={isOpen}
            onToggle={onToggle}
            onHide={onHide}
            collapsedWidth={220}
            collapsedHeight={220}
            headerContent={header}
            className={className}
        >
            <div className={styles.container}>
                {/* Net Worth Growth Chart */}
                <div className={styles.chartSection}>
                    <div className={styles.sectionHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h4 className={styles.sectionTitle} style={{ margin: 0 }}>Estimated Net Worth ({currentAge !== null ? 'By Age' : 'By Year'})</h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Years:</span>
                            <input
                                type="number"
                                className={styles.input}
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
                                value={projectedYear}
                                onChange={(e) => {
                                    const val = e.target.value === '' ? '' : Number(e.target.value);
                                    setProjectedYear(val);
                                    if (val !== '') {
                                        handleProjectedYearChange(val);
                                    }
                                }}
                            />
                        </div>
                    </div>
                    <div className={styles.chartContainer}>
                        <BaseChart
                            data={netWorthGrowthData}
                            series={netWorthSeries}
                            height={250}
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

                {/* Active Plans (Controls Chart and Breakdown) */}
                <div className={styles.scenarioSection}>
                    <h4 className={styles.sectionTitle}>Active Plans</h4>
                    <div className={styles.planSelectors}>
                        {/* Savings Plan Selector */}
                        <div className={styles.selectorItem}>
                            <div className={styles.selectorLabel}>Savings:</div>
                            <DropdownButton
                                label={settings?.savings?.scenarios?.find(s => s.id === savingsScenarioId)?.name || 'Select Plan'}
                                items={settings?.savings?.scenarios?.map(s => ({
                                    label: s.name,
                                    isActive: s.id === savingsScenarioId,
                                    onClick: () => handleSavingsScenarioChange(s.id),
                                    indicatorColor: s.color
                                })) || []}
                                className={styles.fullWidthSelector}
                            />
                        </div>

                        {/* Stocks Plan Selectors (Per Chart) */}
                        {settings?.stocks?.charts?.map(chart => (
                            <div key={chart.id} className={styles.selectorItem}>
                                <div className={styles.selectorLabel}>Stocks:</div>
                                <DropdownButton
                                    label={chart.scenarios?.find(s => s.id === stocksScenarioIds[chart.id])?.name || 'Select Plan'}
                                    items={chart.scenarios?.map(s => ({
                                        label: s.name,
                                        isActive: s.id === stocksScenarioIds[chart.id],
                                        onClick: () => handleStocksScenarioChange(chart.id, s.id),
                                        indicatorColor: s.color
                                    })) || []}
                                    className={styles.fullWidthSelector}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Asset Breakdown Section (Detailed numbers for specific target year) */}
                <div className={styles.breakdownSection}>
                    <h4 className={styles.sectionTitle}>Asset Breakdown</h4>
                    <div className={styles.metricsContainer}>
                        <div className={styles.metricRow}>
                            <span className={styles.metricLabel}>Stocks</span>
                            <span className={styles.metricValue}>{formatCurrency(stocksValue)}</span>
                        </div>
                        <div className={styles.metricRow}>
                            <span className={styles.metricLabel}>Cash Savings</span>
                            <span className={styles.metricValue}>{formatCurrency(savingsAndCpf.savings)}</span>
                        </div>
                        <div className={styles.metricRow}>
                            <span className={styles.metricLabel}>CPF Estimate</span>
                            <span className={styles.metricValue}>{formatCurrency(savingsAndCpf.cpf)}</span>
                        </div>
                        <div className={styles.metricRow}>
                            <span className={styles.metricLabel}>Other Investments</span>
                            <span className={styles.metricValue}>{formatCurrency(otherInvestmentsValue)}</span>
                        </div>
                        <div className={`${styles.metricRow} ${styles.totalRow}`}>
                            <span className={styles.metricLabel}>Net Worth ({targetYear})</span>
                            <span className={styles.metricValue}>{formatCurrency(netWorth)}</span>
                        </div>
                    </div>

                    {/* Year Selection Slider (Controls numbers above) */}

                </div>



                <div className={styles.infoTip}>
                    <TrendingUp size={14} />
                    <span>Change plans or projection years to see the impact on your future net worth.</span>
                </div>
            </div>
        </ExpandableCard>
    );
};

export default WealthSummaryCard;
