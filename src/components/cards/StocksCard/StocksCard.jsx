import React, { useState, useMemo, useEffect } from 'react';
import ExpandableCard from '../../ui/ExpandableCard/ExpandableCard';
import BaseChart from '../../ui/BaseChart/BaseChart';
import ScenarioEditorWindow from '../../ui/ScenarioEditorWindow/ScenarioEditorWindow';
import { Settings } from 'lucide-react';
import styles from './StocksCard.module.css';
import { useUserSettings } from '../../../hooks/useUserSettings';

const SCENARIO_COLORS = [
    'var(--neu-success)',      // Green
    '#60a5fa',                 // Blue
    'var(--neu-color-favorite)', // Yellow/Gold
    '#f87171',                 // Red
    '#a78bfa',                 // Purple
];

const StocksCard = ({
    isOpen = true,
    onToggle = null,
    onHide = null,
    className = "",
    dateOfBirth = null
}) => {
    const { settings, updateSettings, loading: settingsLoading } = useUserSettings();

    // Charts state - each chart contains its own scenarios
    const [charts, setCharts] = useState([
        {
            id: 1,
            name: 'Chart 1',
            visible: true,
            scenarios: [
                {
                    id: 1,
                    name: 'Scenario 1',
                    initialDeposit: 10000,
                    contributionAmount: 500,
                    contributionFrequency: 'monthly',
                    yearsOfGrowth: 30,
                    estimatedRate: 7,
                    color: SCENARIO_COLORS[0],
                    visible: true
                }
            ]
        }
    ]);

    const [nextChartId, setNextChartId] = useState(2);
    const [nextScenarioId, setNextScenarioId] = useState(2);
    const [projectionYears, setProjectionYears] = useState(30);
    const [showEditor, setShowEditor] = useState(false);

    // Load from settings
    const [isInitialized, setIsInitialized] = useState(false);

    // Load from settings (only once or when settings change externally significantly)
    useEffect(() => {
        if (settings?.stocks && !isInitialized) {
            if (settings.stocks.charts) setCharts(settings.stocks.charts);
            if (settings.stocks.nextChartId) setNextChartId(settings.stocks.nextChartId);
            if (settings.stocks.nextScenarioId) setNextScenarioId(settings.stocks.nextScenarioId);
            if (settings.stocks.projectionYears) setProjectionYears(settings.stocks.projectionYears);
            setIsInitialized(true);
        }
    }, [settings, isInitialized]);

    // Save to settings (Debounced)
    useEffect(() => {
        if (settingsLoading) return;

        const timer = setTimeout(() => {
            const currentStocks = {
                charts,
                nextChartId,
                nextScenarioId,
                projectionYears
            };

            const relevantSettings = {
                charts: settings?.stocks?.charts,
                nextChartId: settings?.stocks?.nextChartId,
                nextScenarioId: settings?.stocks?.nextScenarioId,
                projectionYears: settings?.stocks?.projectionYears
            };

            if (JSON.stringify(relevantSettings) !== JSON.stringify(currentStocks)) {
                // Merge with existing settings to preserve fields managed by other components (e.g. activeScenarioIds)
                updateSettings({
                    stocks: {
                        ...(settings?.stocks || {}),
                        ...currentStocks
                    }
                });
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [charts, nextChartId, nextScenarioId, projectionYears, settingsLoading, updateSettings, settings?.stocks]);

    // ---- Chart CRUD ----
    const addChart = () => {
        const newChart = {
            id: nextChartId,
            name: `Chart ${nextChartId}`,
            visible: true,
            scenarios: [
                {
                    id: nextScenarioId,
                    name: 'Scenario 1',
                    initialDeposit: 10000,
                    contributionAmount: 500,
                    contributionFrequency: 'monthly',
                    yearsOfGrowth: 30,
                    estimatedRate: 7,
                    color: SCENARIO_COLORS[0],
                    visible: true
                }
            ]
        };
        setCharts([...charts, newChart]);
        setNextChartId(nextChartId + 1);
        setNextScenarioId(nextScenarioId + 1);
    };

    const removeChart = (chartId) => {
        if (charts.length === 1) return;
        setCharts(charts.filter(c => c.id !== chartId));
    };

    const updateChart = (chartId, field, value) => {
        setCharts(charts.map(c =>
            c.id === chartId ? { ...c, [field]: value } : c
        ));
    };

    const toggleChartVisibility = (chartId) => {
        setCharts(charts.map(c =>
            c.id === chartId ? { ...c, visible: !c.visible } : c
        ));
    };

    // ---- Scenario CRUD (scoped to a chart) ----
    const addScenario = (chartId) => {
        setCharts(charts.map(c => {
            if (c.id !== chartId || c.scenarios.length >= 5) return c;
            const newScenario = {
                id: nextScenarioId,
                name: `Scenario ${c.scenarios.length + 1}`,
                initialDeposit: 10000,
                contributionAmount: 500,
                contributionFrequency: 'monthly',
                yearsOfGrowth: 30,
                estimatedRate: 7,
                color: SCENARIO_COLORS[c.scenarios.length % SCENARIO_COLORS.length],
                visible: true
            };
            return { ...c, scenarios: [...c.scenarios, newScenario] };
        }));
        setNextScenarioId(nextScenarioId + 1);
    };

    const removeScenario = (chartId, scenarioId) => {
        setCharts(charts.map(c => {
            if (c.id !== chartId || c.scenarios.length === 1) return c;
            return { ...c, scenarios: c.scenarios.filter(s => s.id !== scenarioId) };
        }));
    };

    const updateScenario = (chartId, scenarioId, field, value) => {
        setCharts(charts.map(c => {
            if (c.id !== chartId) return c;
            return {
                ...c,
                scenarios: c.scenarios.map(s =>
                    s.id === scenarioId ? { ...s, [field]: value } : s
                )
            };
        }));
    };

    const toggleScenarioVisibility = (chartId, scenarioId) => {
        setCharts(charts.map(c => {
            if (c.id !== chartId) return c;
            return {
                ...c,
                scenarios: c.scenarios.map(s =>
                    s.id === scenarioId ? { ...s, visible: !s.visible } : s
                )
            };
        }));
    };

    // Help calculate age
    const currentAge = useMemo(() => {
        if (!dateOfBirth) return null;
        const birth = new Date(dateOfBirth);
        if (isNaN(birth.getTime())) return null;
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    }, [dateOfBirth]);

    // ---- Compute chart data per visible chart ----
    const chartsData = useMemo(() => {
        return charts.filter(c => c.visible).map(chart => {
            const visibleScenarios = chart.scenarios.filter(s => s.visible);
            if (visibleScenarios.length === 0) return { chart, chartData: [], series: [] };

            const maxYears = projectionYears;
            const data = [];

            for (let year = 0; year <= maxYears; year++) {
                const label = currentAge !== null ? `Age ${currentAge + year}` : `Year ${year}`;
                const point = {
                    date: label,
                    year: new Date().getFullYear() + year,
                    // If currentAge is null, age property will be undefined, which is fine
                    age: currentAge !== null ? currentAge + year : undefined
                };
                visibleScenarios.forEach(scenario => {
                    if (year >= 0) {
                        const estimatedRate = Number(scenario.estimatedRate || 0);
                        const initialDeposit = Number(scenario.initialDeposit || 0);
                        const contributionAmount = Number(scenario.contributionAmount || 0);

                        const annualRate = estimatedRate / 100;
                        const periodsPerYear = scenario.contributionFrequency === 'monthly' ? 12 :
                            scenario.contributionFrequency === 'quarterly' ? 4 : 1;
                        const ratePerPeriod = annualRate / periodsPerYear;
                        const totalPeriods = year * periodsPerYear;

                        let totalInvested = initialDeposit;
                        let totalValue = initialDeposit;

                        for (let period = 1; period <= totalPeriods; period++) {
                            totalInvested += contributionAmount;
                            totalValue = (totalValue + contributionAmount) * (1 + ratePerPeriod);
                        }

                        point[`invested_${scenario.id}`] = Math.round(totalInvested * 100) / 100;
                        point[`value_${scenario.id}`] = Math.round(totalValue * 100) / 100;
                    } else {
                        point[`invested_${scenario.id}`] = null;
                        point[`value_${scenario.id}`] = null;
                    }
                });
                data.push(point);
            }

            const seriesArray = [];
            visibleScenarios.forEach(scenario => {
                seriesArray.push({
                    id: `value_${scenario.id}`,
                    name: `${scenario.name} - Value`,
                    dataKey: `value_${scenario.id}`,
                    color: scenario.color
                });
                seriesArray.push({
                    id: `invested_${scenario.id}`,
                    name: `${scenario.name} - Invested`,
                    dataKey: `invested_${scenario.id}`,
                    color: scenario.color,
                    strokeDasharray: '5 5'
                });
            });

            return { chart, chartData: data, series: seriesArray, visibleScenarios };
        });
    }, [charts, currentAge, projectionYears]);

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    };

    const finalValues = useMemo(() => {
        const values = [];
        chartsData.forEach(({ chartData, visibleScenarios }) => {
            if (chartData.length === 0) return;
            const lastPoint = chartData[chartData.length - 1];
            visibleScenarios.forEach(scenario => {
                const finalVal = lastPoint ? lastPoint[`value_${scenario.id}`] : 0;
                values.push({
                    id: scenario.id,
                    name: scenario.name,
                    color: scenario.color,
                    value: finalVal
                });
            });
        });
        return values;
    }, [chartsData]);

    const header = (
        <div className="summary-info">
            <div className="summary-name">Stocks</div>
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                width: '100%',
                fontSize: '0.8rem',
            }}>
                {finalValues.length > 0 ? (
                    finalValues.map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }}></span>
                                {item.name}
                            </span>
                            <span style={{ color: 'var(--neu-text-primary)', fontWeight: 600 }}>
                                {formatCurrency(item.value)}
                            </span>
                        </div>
                    ))
                ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>No scenarios</span>
                        <span style={{ color: 'var(--neu-text-primary)', fontWeight: 600 }}>-</span>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <>
            <ExpandableCard
                title="Stocks"
                expanded={isOpen}
                onToggle={onToggle}
                onHide={onHide}
                collapsedWidth={220}
                collapsedHeight={220}
                headerContent={header}
                className={className}
                menuItems={[
                    {
                        label: 'Manage Scenarios',
                        indicatorNode: <Settings size={14} />,
                        onClick: () => setShowEditor(true)
                    }
                ]}
            >
                <div className={styles.container}>
                    <div className={styles.globalControls} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h4 className={styles.sectionTitle} style={{ margin: 0 }}>Projected Stocks Growth</h4>

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
                                value={projectionYears}
                                onChange={(e) => setProjectionYears(e.target.value === '' ? '' : Number(e.target.value))}
                            />
                        </div>
                    </div>

                    {chartsData.map(({ chart, chartData, series, visibleScenarios }) => (
                        <div key={chart.id} className={styles.chartSection}>
                            {charts.filter(c => c.visible).length > 1 && (
                                <h4 className={styles.sectionTitle}>{chart.name}</h4>
                            )}

                            {chartData.length > 0 ? (
                                <>
                                    <div className={styles.chartContainer}>
                                        <BaseChart
                                            data={chartData}
                                            series={series}
                                            currency="$"
                                            showGrid={true}
                                            showXAxis={true}
                                            showYAxis={true}
                                            height={300}
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

                                    {/* Scenario Summary with integrated legend */}
                                    <div className={styles.summaryGrid}>
                                        {visibleScenarios.map(scenario => {
                                            const lastPoint = chartData[scenario.yearsOfGrowth];
                                            const invested = lastPoint?.[`invested_${scenario.id}`] || 0;
                                            const value = lastPoint?.[`value_${scenario.id}`] || 0;
                                            const gains = value - invested;

                                            return (
                                                <div key={scenario.id} className={styles.summaryCard}>
                                                    <div className={styles.summaryCardHeader}>
                                                        <div className={styles.scenarioColorDot} style={{ backgroundColor: scenario.color }} />
                                                        <span className={styles.summaryCardTitle}>{scenario.name}</span>
                                                    </div>
                                                    <div className={styles.summaryMetrics}>
                                                        <div className={styles.metricRow}>
                                                            <span className={styles.metricLabelWithLegend}>
                                                                <span className={styles.legendDot} style={{ backgroundColor: scenario.color }}></span>
                                                                Final Value
                                                            </span>
                                                            <span className={styles.metricValue} style={{ color: scenario.color }}>
                                                                {formatCurrency(value)}
                                                            </span>
                                                        </div>
                                                        <div className={styles.metricRow}>
                                                            <span className={styles.metricLabelWithLegend}>
                                                                <span className={styles.legendDash} style={{ borderColor: scenario.color }}></span>
                                                                Total Invested
                                                            </span>
                                                            <span className={styles.metricValue}>{formatCurrency(invested)}</span>
                                                        </div>
                                                        <div className={styles.metricRow}>
                                                            <span className={styles.metricLabel}>Total Gains</span>
                                                            <span className={styles.metricValue} style={{ color: scenario.color }}>
                                                                {formatCurrency(gains)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <p className={styles.emptyMessage}>No visible scenarios in this chart.</p>
                            )}
                        </div>
                    ))}

                    {chartsData.length === 0 && (
                        <p className={styles.emptyMessage}>All charts are hidden. Open Manage Scenarios to show them.</p>
                    )}
                </div>
            </ExpandableCard>

            <ScenarioEditorWindow
                isOpen={showEditor}
                onClose={() => setShowEditor(false)}
                charts={charts}
                onAddChart={addChart}
                onRemoveChart={removeChart}
                onUpdateChart={updateChart}
                onToggleChartVisibility={toggleChartVisibility}
                onAddScenario={addScenario}
                onRemoveScenario={removeScenario}
                onUpdateScenario={updateScenario}
                onToggleScenarioVisibility={toggleScenarioVisibility}
            />
        </>
    );
};

export default StocksCard;
