import React, { useState, useMemo, useEffect } from 'react';
import ExpandableCard from '../../ui/ExpandableCard/ExpandableCard';
import DropdownButton from '../../ui/DropdownButton/DropdownButton';
import { Calendar, TrendingUp, Wallet, ArrowRight } from 'lucide-react';
import styles from './WealthSummaryCard.module.css';
import BaseChart from '../../ui/BaseChart/BaseChart';
import { formatLastUpdated } from '../../../utils/dateUtils';

const WealthSummaryCard = ({
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
    sgdToDisplayRate = 1,
    settings = null,
    onUpdateSettings = null,
    loading = false
}) => {
    // const { settings, updateSettings, loading: settingsLoading } = useUserSettings(); // Removed
    const settingsLoading = loading; // Alias for compatibility with existing code below if any

    // Projection relative year (0 = current, 1 = in 1 year, etc.)
    const [projectedYear, setProjectedYear] = useState(0);

    // Local state for selected scenarios to allow immediate feedback
    const [savingsScenarioId, setSavingsScenarioId] = useState(null);
    const [stocksScenarioIds, setStocksScenarioIds] = useState({}); // { chartId: scenarioId }

    // To track what we've already synced from global settings
    const [lastSyncedSettings, setLastSyncedSettings] = useState(null);

    // Sync with settings
    useEffect(() => {
        if (!settings) return;

        // 1. Savings Scenario Sync
        const incomingSavingsId = settings?.savings?.activeScenarioId;
        const lastSavingsId = lastSyncedSettings?.savings?.activeScenarioId;
        if (incomingSavingsId && incomingSavingsId !== lastSavingsId) {
            setSavingsScenarioId(incomingSavingsId);
        }

        // 2. Stocks Scenario Sync
        const incomingStocksIds = settings?.stocks?.activeScenarioIds;
        const lastStocksIds = lastSyncedSettings?.stocks?.activeScenarioIds;
        if (incomingStocksIds && JSON.stringify(incomingStocksIds) !== JSON.stringify(lastStocksIds)) {
            setStocksScenarioIds(incomingStocksIds);
        } else if (!incomingStocksIds && settings?.stocks?.charts && !lastSyncedSettings) {
            // Default initialization if no active ids yet
            const defaults = {};
            settings.stocks.charts.forEach(c => {
                if (c.scenarios?.length > 0) defaults[c.id] = c.scenarios[0].id;
            });
            setStocksScenarioIds(defaults);
        }

        // 3. Projected Year Sync
        const incomingYear = settings?.wealth?.projectedYear;
        const lastYear = lastSyncedSettings?.wealth?.projectedYear;
        if (incomingYear !== undefined && incomingYear !== lastYear) {
            setProjectedYear(incomingYear);
        }

        setLastSyncedSettings(settings);
    }, [settings, lastSyncedSettings]);

    const handleProjectedYearChange = (year) => {
        setProjectedYear(year);
        // Note: We no longer sync this back to the database as per user request
    };

    const handleSavingsScenarioChange = (id) => {
        setSavingsScenarioId(id);
        // Note: We no longer sync this back to the database as per user request
    };

    const handleStocksScenarioChange = (chartId, scenarioId) => {
        const newIds = { ...stocksScenarioIds, [chartId]: scenarioId };
        setStocksScenarioIds(newIds);
        // Note: We no longer sync this back to the database as per user request
    };

    const overallLastUpdated = useMemo(() => {
        const dates = [
            settings?.stocks?.updatedAt,
            settings?.savings?.updatedAt,
            settings?.cpf?.updatedAt,
            settings?.otherInvestments?.updatedAt
        ].filter(Boolean).map(d => new Date(d));

        if (dates.length === 0) return null;
        return new Date(Math.max(...dates)).toISOString();
    }, [settings]);

    const formatCurrency = (val, isFromUsd = false, isFromSgd = false) => {
        let rate = baseToDisplayRate;
        if (isFromUsd) rate = usdToDisplayRate;
        else if (isFromSgd) rate = sgdToDisplayRate;

        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: displayCurrency,
            maximumFractionDigits: 0
        }).format(val * rate);
    };

    const formatBaseCurrency = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: baseCurrency,
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

    const usdToBase = baseToDisplayRate !== 0 ? usdToDisplayRate / baseToDisplayRate : 1;
    const sgdToBase = baseToDisplayRate !== 0 ? sgdToDisplayRate / baseToDisplayRate : 1;

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
                // Apply annual expense growth
                const expenseGrowthRate = Number(scenario.annualExpenseGrowth || 0) / 100;
                const grownExpenses = totalExpenses * Math.pow(1 + expenseGrowthRate, y);
                const yearMonthlySavings = monthlyPay - cpfContributionEmployee - grownExpenses;

                savingsBalance = (savingsBalance * (1 + bankInterestRate)) + (yearMonthlySavings * 12);

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
            // Standard APR Compounding Logic (Nominal Rate)
            // Matches StocksCard.jsx and standard financial calculators
            const annualRate = Number(scenario.estimatedRate || 0) / 100;
            const freq = scenario.contributionFrequency === 'monthly' ? 12 :
                scenario.contributionFrequency === 'quarterly' ? 4 : 1;

            const ratePerPeriod = annualRate / freq;

            let val = initialDeposit;

            // Safeguard: Limit projection to 100 years
            const maxLoop = Math.min(Math.max(0, projectedYear), 100);

            // We calculate period-by-period for accuracy with the StocksCard approach
            // But since WealthSummaryCard loops by YEAR, we can optimize or nest loops.
            // To be purely consistent with StocksCard (which loops by year then by period), we do this:

            for (let y = 1; y <= maxLoop; y++) {
                // Compound for 'freq' periods in this year
                for (let period = 1; period <= freq; period++) {
                    // Add contribution at start or end? 
                    // StocksCard adds contribution THEN compounds: 
                    // totalValue = (totalValue + contributionAmount) * (1 + ratePerPeriod);
                    // This implies contributions happen at the START of each period (or end of previous).
                    // Let's match StocksCard logic EXACTLY.
                    val = (val + contributionAmount) * (1 + ratePerPeriod);
                }
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

    const netWorth = (stocksValue * usdToBase) + savingsAndCpf.savings + (savingsAndCpf.cpf * sgdToBase) + otherInvestmentsValue;

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
        // const monthlySavings = monthlyPay - cpfContributionEmployee - totalExpenses; // Moved to loop
        const bankInterestRate = Number(savingsScenario?.bankInterestRate || 0) / 100;
        const expenseGrowthRate = Number(savingsScenario?.annualExpenseGrowth || 0) / 100;

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

        for (let y = 0; y <= Math.min(maxProjection, 100); y++) {
            const ageAtYear = (currentAge || 30) + y;
            const yearLabel = (currentAge !== null) ? `${ageAtYear}` : `${startYear + y}`;

            const totalStocksThisYear = runningStocks.reduce((sum, s) => sum + s.value, 0);
            const totalOtherInvThisYear = otherInvBase + (otherInvAnnualContrib * y);

            data.push({
                year: startYear + y,
                age: ageAtYear,
                date: yearLabel,
                stocks: Math.round(totalStocksThisYear * usdToBase),
                cpf: Math.round(runningCpf * sgdToBase),
                savings: Math.round(runningSavings),
                other: Math.round(totalOtherInvThisYear),
                netWorth: Math.round(
                    (totalStocksThisYear * usdToBase) +
                    runningSavings +
                    (runningCpf * sgdToBase) +
                    totalOtherInvThisYear
                )
            });

            // Calculate NEXT year values
            const grownExpenses = totalExpenses * Math.pow(1 + expenseGrowthRate, y + 1); // Next year's expenses
            const nextYearMonthlySavings = monthlyPay - cpfContributionEmployee - grownExpenses;

            runningSavings = (runningSavings * (1 + bankInterestRate)) + (nextYearMonthlySavings * 12);

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
                // Standard APR Compounding for Chart (Nested Loop for precision)
                const ratePerPeriod = s.rate / s.freq;

                for (let period = 1; period <= s.freq; period++) {
                    s.value = (s.value + s.contribution) * (1 + ratePerPeriod);
                }
            });
        }
        return data;
    }, [settings, savingsScenarioId, stocksScenarioIds, currentAge, projectedYear, settings?.stocks, settings?.otherInvestments, settings?.cpf]);

    const netWorthSeries = [
        { id: 'netWorth', name: 'Net Worth', dataKey: 'netWorth', color: 'var(--neu-success)' },
        { id: 'stocks', name: 'Stocks', dataKey: 'stocks', color: '#3b82f6', strokeDasharray: '4 4' },
        { id: 'savings', name: 'Savings', dataKey: 'savings', color: '#10b981', strokeDasharray: '4 4' },
        { id: 'cpf', name: 'CPF Estimate', dataKey: 'cpf', color: '#f59e0b', strokeDasharray: '4 4' },
        { id: 'other', name: 'Other Inv.', dataKey: 'other', color: '#8b5cf6', strokeDasharray: '4 4' }
    ];

    const header = (
        <div className="summary-info">
            <div className="summary-name">Estimated Net Worth</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--neu-text-tertiary)', marginTop: '-2px', marginBottom: '8px' }}>
                Last updated: {formatLastUpdated(overallLastUpdated)}
            </div>
            <div className={styles.headerMeta}>
                {targetYear} {targetAge !== null && `• Age ${targetAge}`}
            </div>
            <div className={styles.headerValueGroup}>
                <div className={styles.mainValue}>{formatCurrency(netWorth)}</div>
                <div className={styles.valueLabel}>Projected Net Worth</div>
            </div>
        </div>
    );

    return (
        <ExpandableCard
            title="Estimated Net Worth"
            subtitle={`Last updated: ${formatLastUpdated(overallLastUpdated)}`}
            expanded={isOpen}
            onToggle={onToggle}
            onHide={onHide}
            collapsedWidth={220}
            collapsedHeight={220}
            headerContent={header}
            // Only show full loading state if we have NO settings at all. 
            // Otherwise, let the user see the cached/stale data while we update in background.
            loading={!settings && loading}
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
                                className={styles.input}
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
                                // Charts usually use base values, we convert to display
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

                {/* Active Plans (Controls Chart and Breakdown) */}
                <div className={styles.scenarioSection}>
                    <h4 className={styles.sectionTitle}>Active Plans</h4>
                    <div className={styles.planSelectors}>
                        {/* Savings Plan Selector */}
                        <div className={styles.selectorItem}>
                            <div className={styles.selectorLabel}>{settings?.savings?.name || 'Savings'}:</div>
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
                                <div className={styles.selectorLabel}>{chart.name || 'Stocks'}:</div>
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
                            <span className={styles.metricValue}>{formatCurrency(stocksValue, true)}</span>
                        </div>
                        <div className={styles.metricRow}>
                            <span className={styles.metricLabel}>Cash Savings</span>
                            <span className={styles.metricValue}>{formatCurrency(savingsAndCpf.savings)}</span>
                        </div>
                        <div className={styles.metricRow}>
                            <span className={styles.metricLabel}>CPF Estimate</span>
                            <span className={styles.metricValue}>{formatCurrency(savingsAndCpf.cpf, false, true)}</span>
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
