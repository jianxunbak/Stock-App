import React, { useState, useMemo, useEffect } from 'react';
import ExpandableCard from '../../ui/ExpandableCard/ExpandableCard';
import SummaryCardContent from '../../ui/SummaryCardContent/SummaryCardContent';
import DropdownButton from '../../ui/DropdownButton/DropdownButton';
import { Calendar, TrendingUp, Wallet, ArrowRight, PieChart, Briefcase, Landmark, ShieldCheck, Activity } from 'lucide-react';
import styles from './WealthSummaryCard.module.css';
import BaseChart from '../../ui/BaseChart/BaseChart';
import { formatLastUpdated } from '../../../utils/dateUtils';
import { calculateCPFProjection } from '../../../utils/cpfUtils';
import { calculateStockProjection } from '../../../utils/stockUtils';
import { calculateOtherInvestmentProjection } from '../../../utils/otherInvestmentUtils';

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
    loading = false,
    currentPortfolioValueUSD = null,
    onRefresh = null
}) => {
    // const { settings, updateSettings, loading: settingsLoading } = useUserSettings(); // Removed
    const settingsLoading = loading; // Alias for compatibility with existing code below if any

    const [projectedYear, setProjectedYear] = useState(0);
    const [inflationRate, setInflationRate] = useState(0);

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
                if (c.scenarios?.length > 0) {
                    const firstVisible = c.scenarios.find(s => s.visible) || c.scenarios[0];
                    defaults[c.id] = firstVisible.id;
                }
            });
            setStocksScenarioIds(defaults);
        }

        // 3. Projected Year Sync
        const incomingYear = settings?.wealth?.projectedYear;
        const lastYear = lastSyncedSettings?.wealth?.projectedYear;
        if (incomingYear !== undefined && incomingYear !== lastYear) {
            setProjectedYear(incomingYear);
        }

        // 4. Inflation Rate Sync
        const incomingInflation = settings?.wealth?.inflationRate;
        const lastInflation = lastSyncedSettings?.wealth?.inflationRate;
        if (incomingInflation !== undefined && incomingInflation !== lastInflation) {
            setInflationRate(incomingInflation);
        }

        setLastSyncedSettings(settings);
    }, [settings, lastSyncedSettings]);

    const handleProjectedYearChange = (year) => {
        setProjectedYear(year);
        // Sync back to database
        if (onUpdateSettings) {
            onUpdateSettings({
                wealth: {
                    ...settings?.wealth,
                    projectedYear: year
                }
            });
        }
    };

    const handleInflationRateChange = (rate) => {
        const numRate = rate === '' ? '' : Number(rate);
        setInflationRate(numRate);
        if (onUpdateSettings && numRate !== '') {
            onUpdateSettings({
                wealth: {
                    ...settings?.wealth,
                    inflationRate: numRate
                }
            });
        }
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
        }).format(val * rate).replace('SGD', 'S$');
    };


    const formatBaseCurrency = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: baseCurrency,
            maximumFractionDigits: 0
        }).format(val).replace('SGD', 'S$');
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
        const cpfSalary = Number(settings?.cpf?.monthlySalary || 0); // Removed || monthlyPay fallback
        const annualBonus = Number(settings?.cpf?.annualBonus || 0);
        const owCeiling = 8000;

        // Calculate Monthly Cash Savings
        // We only deduct CPF if it is LINKED (in which case it is in totalExpenses).
        // If unlinked, we assume user wants to simulate 0 CPF deduction.
        const cpfContributionEmployee = 0;
        const monthlySavings = monthlyPay - cpfContributionEmployee - totalExpenses;

        let savingsBalance = Number(scenario.initialSavings || 0);
        const bankInterestRate = Number(scenario.bankInterestRate || 0) / 100;

        // CPF Starting Point


        // ... Savings Calculation Loop ...
        // We still need to loop for Savings calculation as it depends on expense growth/interest
        for (let y = 0; y <= projectedYear; y++) {
            if (y > 0) {
                // Cash Savings Growth (Interest first, then new savings)
                const expenseGrowthRate = Number(scenario.annualExpenseGrowth || 0) / 100;
                const grownExpenses = totalExpenses * Math.pow(1 + expenseGrowthRate, y);
                const yearMonthlySavings = monthlyPay - cpfContributionEmployee - grownExpenses;

                savingsBalance = (savingsBalance * (1 + bankInterestRate)) + (yearMonthlySavings * 12);
            }
        }

        // CPF Calculation using shared utility
        // This ensures "Net Worth card only retrieves information from the CPF card" logic
        const cpfProjection = calculateCPFProjection({
            currentAge: currentAge || 30,
            dateOfBirth: settings?.dateOfBirth,
            monthlySalary: Number(settings?.cpf?.monthlySalary || 0),
            annualBonus: Number(settings?.cpf?.annualBonus || 0),
            salaryGrowth: Number(settings?.cpf?.salaryGrowth || 0),
            projectionYears: projectedYear,
            balances: settings?.cpf?.balances || {},
            cpfisData: settings?.cpf?.cpfisData || { items: [], groups: [] }
        });

        // Get the value at the target year
        const targetCpfData = cpfProjection.projection[projectedYear] || cpfProjection.projection[cpfProjection.projection.length - 1];
        const cpfBalance = targetCpfData ? targetCpfData.total : 0;

        return { savings: Math.round(savingsBalance), cpf: Math.round(cpfBalance) };
    }, [settings?.savings, settings?.cpf, settings?.dateOfBirth, savingsScenarioId, projectedYear, currentAge]);

    // 2. Stocks Projection
    const stocksValue = useMemo(() => {
        // DEBUG LOGS
        // console.log("DEBUG: WealthSummaryCard stocksValue calc. Year:", projectedYear, "CurrentVal:", currentPortfolioValueUSD);

        if (!settings?.stocks?.charts) return 0;

        const activeStockCharts = settings.stocks.charts.map(chart => {
            const selectedScenarioId = stocksScenarioIds[chart.id];
            const scenarios = chart.scenarios || [];
            const targetScenario = selectedScenarioId
                ? scenarios.find(s => s.id === selectedScenarioId)
                : (scenarios.find(s => s.visible) || scenarios[0]);

            return {
                ...chart,
                // Respect explicit chart visibility from settings
                visible: chart.visible !== false,
                scenarios: scenarios.map(s => ({
                    ...s,
                    // Visible only if it matches our target scenario for the consolidated view
                    visible: targetScenario ? s.id === targetScenario.id : false
                }))
            };
        });

        const projection = calculateStockProjection({
            charts: activeStockCharts,
            projectionYears: Math.min(Math.max(0, projectedYear), 100),
            currentAge: currentAge || 30,
            startYear: new Date().getFullYear()
        });

        const targetData = projection[projectedYear] || projection[projection.length - 1];
        return targetData ? targetData.totalValue : 0;
    }, [settings?.stocks, stocksScenarioIds, projectedYear, currentAge, currentPortfolioValueUSD, usdToBase]);

    // 3. Other Investments
    const otherInvestmentsValue = useMemo(() => {
        const otherData = settings?.otherInvestments || { items: [], groups: [] };

        // If current year, return exact sum of current values to avoid any projection artifacts
        if (projectedYear === 0) {
            const allItems = [
                ...(otherData.items || []),
                ...(otherData.groups || []).flatMap(g => g.items || [])
            ];
            return allItems.reduce((acc, item) => acc + Number(item.value || 0), 0);
        }

        const projection = calculateOtherInvestmentProjection({
            data: otherData,
            projectionYears: Math.min(Math.max(0, projectedYear), 100),
            currentAge: currentAge || 30,
            startYear: new Date().getFullYear()
        });

        // Get value at target year
        const targetData = projection[projectedYear] || projection[projection.length - 1];
        return targetData ? targetData.value : 0;
    }, [settings?.otherInvestments, projectedYear, currentAge]);

    // --- Apply Inflation Adjustment ---
    const inflationDiscountFactor = useMemo(() => {
        if (projectedYear === 0 || !inflationRate) return 1;
        return 1 / Math.pow(1 + (Number(inflationRate) / 100), projectedYear);
    }, [inflationRate, projectedYear]);

    const netWorth = (stocksValue + savingsAndCpf.savings + (savingsAndCpf.cpf * sgdToBase) + otherInvestmentsValue) * inflationDiscountFactor;
    const adjustedStocksValue = stocksValue * inflationDiscountFactor;
    const adjustedSavings = savingsAndCpf.savings * inflationDiscountFactor;
    const adjustedCpf = (savingsAndCpf.cpf * sgdToBase) * inflationDiscountFactor;
    const adjustedOther = otherInvestmentsValue * inflationDiscountFactor;

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

        // --- Restored Savings Variables ---
        const cpfSalary = Number(settings?.cpf?.monthlySalary || 0); // Removed || monthlyPay fallback
        // Calculate net monthly savings for projection
        // If CPF is linked, it's in totalExpenses. If not, it's 0.
        const cpfContributionEmployee = 0;
        const bankInterestRate = Number(savingsScenario?.bankInterestRate || 0) / 100;
        const expenseGrowthRate = Number(savingsScenario?.annualExpenseGrowth || 0) / 100;
        let runningSavings = Number(savingsScenario?.initialSavings || 0);
        // ----------------------------------

        // Generate CPF Projection Array first
        const cpfProjectionObj = calculateCPFProjection({
            currentAge: currentAge || 30,
            dateOfBirth: settings?.dateOfBirth,
            monthlySalary: cpfSalary,
            annualBonus: Number(settings?.cpf?.annualBonus || 0),
            salaryGrowth: Number(settings?.cpf?.salaryGrowth || 0),
            projectionYears: Math.min(maxProjection, 100),
            balances: settings?.cpf?.balances || {},
            cpfisData: settings?.cpf?.cpfisData || { items: [], groups: [] }
        });
        const cpfProjection = cpfProjectionObj.projection;

        // Generate Stock Projection
        // Filter charts to only include the specific scenario selected in the UI for each chart
        const activeStockCharts = stocksInit.map(chart => {
            const selectedScenarioId = stocksScenarioIds[chart.id];
            const scenarios = chart.scenarios || [];

            const targetScenario = selectedScenarioId
                ? scenarios.find(s => s.id === selectedScenarioId)
                : (scenarios.find(s => s.visible) || scenarios[0]);

            return {
                ...chart,
                // Respect explicit chart visibility from settings
                visible: chart.visible !== false,
                scenarios: scenarios.map(s => ({
                    ...s,
                    // Visible only if it matches our target scenario
                    visible: targetScenario ? s.id === targetScenario.id : false
                }))
            };
        });

        // Calculate stocks (Returns array of { totalValue, totalInvested, ... })
        const stockProjection = calculateStockProjection({
            charts: activeStockCharts,
            projectionYears: Math.min(maxProjection, 100),
            currentAge: currentAge || 30,
            startYear
        });

        // Other investments initial state
        // Other investments projection
        const otherInvProjection = calculateOtherInvestmentProjection({
            data: settings?.otherInvestments || { items: [], groups: [] },
            projectionYears: Math.min(maxProjection, 100),
            currentAge: currentAge || 30,
            startYear
        });

        for (let y = 0; y <= Math.min(maxProjection, 100); y++) {
            const ageAtYear = (currentAge || 30) + y;
            const yearLabel = (currentAge !== null) ? `Age ${ageAtYear} (${startYear + y})` : `Year ${startYear + y}`;

            // Stocks
            // Safety check: use last value if y exceeds projection
            const stockData = stockProjection[y] || stockProjection[stockProjection.length - 1];
            // Stocks are already in Base Currency. DO NOT convert with usdToBase.

            let totalStocksThisYear = stockData ? stockData.totalValue : 0;

            const otherInvData = otherInvProjection[y] || otherInvProjection[otherInvProjection.length - 1];
            const totalOtherInvThisYear = otherInvData ? otherInvData.value : 0;

            // Fetch CPF from projection array
            // Safety check: if y exceeds projection length, use last value
            const cpfData = cpfProjection[y] || cpfProjection[cpfProjection.length - 1];
            const currentCpfVal = cpfData ? cpfData.total : 0;

            // Apply Inflation to Chart Data
            const inflationAtY = (projectedYear === 0 || !inflationRate) ? 1 : 1 / Math.pow(1 + (Number(inflationRate) / 100), y);

            const adjStocks = Math.round(totalStocksThisYear * inflationAtY);
            const adjCpf = Math.round(currentCpfVal * sgdToBase * inflationAtY);
            const adjSavings = Math.round(runningSavings * inflationAtY);
            const adjOther = Math.round(totalOtherInvThisYear * inflationAtY);

            data.push({
                year: startYear + y,
                age: ageAtYear,
                date: yearLabel,
                stocks: adjStocks,
                cpf: adjCpf,
                savings: adjSavings,
                other: adjOther,
                netWorth: Math.round(adjStocks + adjSavings + adjCpf + adjOther)
            });

            // Calculate NEXT year values for Savings (Nominal)
            const grownExpenses = totalExpenses * Math.pow(1 + expenseGrowthRate, y + 1);
            const nextYearMonthlySavings = monthlyPay - cpfContributionEmployee - grownExpenses;

            runningSavings = (runningSavings * (1 + bankInterestRate)) + (nextYearMonthlySavings * 12);
        }
        return data;
    }, [settings, savingsScenarioId, stocksScenarioIds, currentAge, projectedYear, inflationRate, settings?.stocks, settings?.otherInvestments, settings?.cpf, currentPortfolioValueUSD, usdToBase, sgdToBase]);

    const netWorthSeries = [
        { id: 'netWorth', name: 'Net Worth', dataKey: 'netWorth', color: 'var(--neu-success)' },
        { id: 'stocks', name: 'Stocks', dataKey: 'stocks', color: '#3b82f6', strokeDasharray: '4 4' },
        { id: 'savings', name: 'Savings', dataKey: 'savings', color: '#10b981', strokeDasharray: '4 4' },
        { id: 'cpf', name: 'CPF Estimate', dataKey: 'cpf', color: '#f59e0b', strokeDasharray: '4 4' },
        { id: 'other', name: 'Other Inv.', dataKey: 'other', color: '#8b5cf6', strokeDasharray: '4 4' }
    ];

    const yearControl = (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--neu-text-secondary)', fontWeight: 500 }}>Years:</span>
                <input
                    type="number"
                    style={{
                        width: '50px',
                        padding: '0.25rem 0.4rem',
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
                    onClick={(e) => e.stopPropagation()}
                />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--neu-text-secondary)', fontWeight: 500 }}>Inflation:</span>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                        type="number"
                        step="0.1"
                        style={{
                            width: '65px',
                            padding: '0.25rem 1.25rem 0.25rem 0.4rem',
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
                        value={inflationRate}
                        onChange={(e) => handleInflationRateChange(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                    />
                    <span style={{ position: 'absolute', right: '6px', fontSize: '0.7rem', color: 'var(--neu-text-tertiary)', pointerEvents: 'none' }}>%</span>
                </div>
            </div>
        </div>
    );

    const header = (
        <div className="stock-summary-container stacked" style={{ height: '100%', width: '100%' }}>
            <div className="stock-info-column">

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--neu-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Net Worth ({targetAge || targetYear})
                    </div>
                    <div className="summary-price" style={{ color: 'var(--neu-success)' }}>

                        {formatCurrency(netWorth)}
                    </div>
                </div>

                <div className="summary-key-stats" style={{ marginTop: '0.15rem', gap: '0.25rem 0.5rem' }}>
                    <div className="stat-item">
                        <span className="stat-label">Stocks</span>
                        <span className="stat-value" style={{ color: '#3b82f6', fontSize: '0.8rem' }}>{formatCurrency(adjustedStocksValue)}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Cash</span>
                        <span className="stat-value" style={{ color: '#10b981', fontSize: '0.8rem' }}>{formatCurrency(adjustedSavings)}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">CPF</span>
                        <span className="stat-value" style={{ color: '#f59e0b', fontSize: '0.8rem' }}>{formatCurrency(adjustedCpf / sgdToDisplayRate, false, true)}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Other</span>
                        <span className="stat-value" style={{ color: '#8b5cf6', fontSize: '0.8rem' }}>{formatCurrency(adjustedOther)}</span>
                    </div>
                </div>
            </div>

            <div className="price-chart-summary">
                <BaseChart
                    data={netWorthGrowthData}
                    series={netWorthSeries}
                    height={135}
                    gridPadding={{ top: 0, right: 0, bottom: 0, left: 0 }}
                    showGrid={true}
                    showXAxis={true}
                    xAxisFormatter={(val) => val.replace(/Age |Year | \(.*\)/g, '')}
                    showYAxis={true}
                    variant="transparent"
                    yAxisFormatter={(val) => {
                        const convertedVal = val * baseToDisplayRate;
                        if (convertedVal >= 1000000) return `${displayCurrencySymbol}${(convertedVal / 1000000).toFixed(0)}M`;
                        if (convertedVal >= 1000) return `${displayCurrencySymbol}${(convertedVal / 1000).toFixed(0)}k`;
                        return `${displayCurrencySymbol}${convertedVal.toFixed(0)}`;
                    }}
                    tooltipValueFormatter={(val) => formatCurrency(val)}
                />
            </div>
        </div>
    );




    return (
        <ExpandableCard
            title="Estimated Net Worth"
            expanded={isOpen}
            onToggle={onToggle}
            onHide={onHide}
            onRefresh={onRefresh}
            collapsedWidth={220}
            collapsedHeight={240}
            headerContent={header}
            collapsedHeaderControls={yearControl}
            loading={loading}
            className={className}
        >


            <div className={styles.container}>
                {/* Net Worth Growth Chart */}
                <div className={styles.chartSection}>
                    <div className={styles.sectionHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h4 className={styles.sectionTitle} style={{ margin: 0 }}>
                            Estimated Net Worth ({currentAge !== null ? 'By Age' : 'By Year'})
                            {inflationRate > 0 && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: 'var(--neu-brand)', fontWeight: 500 }}> (Adjusted for {inflationRate}% Inflation)</span>}
                        </h4>
                        {yearControl}
                    </div>

                    <div className={styles.chartContainer}>
                        <BaseChart
                            data={netWorthGrowthData}
                            series={netWorthSeries}
                            height={250}
                            showGrid={true}
                            showXAxis={true}
                            xAxisFormatter={(val) => val.replace(/Age |Year | \(.*\)/g, '')}
                            showYAxis={true}
                            yAxisFormatter={(val) => {
                                // Charts usually use base values, we convert to display
                                const convertedVal = val * baseToDisplayRate;
                                if (convertedVal >= 1000000) return `${displayCurrencySymbol}${(convertedVal / 1000000).toFixed(1)}M`;
                                if (convertedVal >= 1000) return `${displayCurrencySymbol}${(convertedVal / 1000).toFixed(0)}k`;
                                return `${displayCurrencySymbol}${convertedVal.toFixed(0)}`;
                            }}
                            tooltipValueFormatter={(val) => formatCurrency(val)}
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
                            <span className={styles.metricValue}>{formatCurrency(adjustedStocksValue)}</span>
                        </div>
                        <div className={styles.metricRow}>
                            <span className={styles.metricLabel}>Cash Savings</span>
                            <span className={styles.metricValue}>{formatCurrency(adjustedSavings)}</span>
                        </div>
                        <div className={styles.metricRow}>
                            <span className={styles.metricLabel}>CPF Estimate</span>
                            <span className={styles.metricValue}>{formatCurrency(adjustedCpf / sgdToDisplayRate, false, true)}</span>
                        </div>
                        <div className={styles.metricRow}>
                            <span className={styles.metricLabel}>Other Investments</span>
                            <span className={styles.metricValue}>{formatCurrency(adjustedOther)}</span>
                        </div>
                        <div className={`${styles.metricRow} ${styles.totalRow}`}>
                            <span className={styles.metricLabel}>Net Worth ({targetAge || targetYear})</span>
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
