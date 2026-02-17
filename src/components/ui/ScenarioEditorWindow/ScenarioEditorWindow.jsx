import React from 'react';
import Window from '../Window/Window';
import Button from '../Button/Button';
import DropdownButton from '../DropdownButton/DropdownButton';
import { Plus, ChevronDown, Trash2 } from 'lucide-react';
import styles from './ScenarioEditorWindow.module.css';

const FREQUENCY_OPTIONS = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'annually', label: 'Annually' }
];

const ScenarioEditorWindow = ({
    isOpen,
    onClose,
    charts,
    onAddChart,
    onRemoveChart,
    onUpdateChart,
    onToggleChartVisibility,
    onAddScenario,
    onRemoveScenario,
    onUpdateScenario,
    onToggleScenarioVisibility,
    baseCurrency = 'USD',
    baseCurrencySymbol = '$'
}) => {
    const getFrequencyLabel = (value) => {
        return FREQUENCY_OPTIONS.find(opt => opt.value === value)?.label || value;
    };

    return (
        <Window
            isOpen={isOpen}
            onClose={onClose}
            title="Manage Investment Scenarios"
            width="640px"
            height="85vh"
            headerAlign="start"
            contentClassName={styles.windowContent}
            controls={
                <Button
                    variant="icon"
                    onClick={onAddChart}
                    style={{ padding: '0.5rem' }}
                    title="Add new chart"
                >
                    <Plus size={18} />
                </Button>
            }
        >
            <div className={styles.container}>
                {charts.map((chart) => (
                    <div key={chart.id} className={styles.chartGroup}>
                        {/* Chart Header */}
                        <div className={styles.chartHeader}>
                            <div className={styles.chartHeaderLeft}>
                                <div
                                    className={`${styles.customToggle} ${chart.visible ? styles.active : ''}`}
                                    onClick={() => onToggleChartVisibility(chart.id)}
                                    title={chart.visible ? 'Hide chart' : 'Show chart'}
                                >
                                    <div className={styles.toggleKnob} />
                                </div>
                                <input
                                    type="text"
                                    className={styles.chartNameInput}
                                    value={chart.name}
                                    onChange={(e) => onUpdateChart(chart.id, 'name', e.target.value)}
                                    placeholder="Chart name"
                                />
                            </div>
                            <div className={styles.chartHeaderRight}>
                                <Button
                                    variant="icon"
                                    onClick={() => onAddScenario(chart.id)}
                                    disabled={chart.scenarios.length >= 5}
                                    style={{ padding: '0.25rem' }}
                                    title="Add scenario"
                                >
                                    <Plus size={16} />
                                </Button>
                                {charts.length > 1 && (
                                    <Button
                                        variant="icon"
                                        onClick={() => onRemoveChart(chart.id)}
                                        style={{ padding: '0.25rem' }}
                                        title="Remove chart"
                                    >
                                        <Trash2 size={16} />
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Scenarios within this chart */}
                        <div className={styles.scenarioList}>
                            {chart.scenarios.map((scenario) => (
                                <div key={scenario.id} className={styles.scenarioCard}>
                                    <div className={styles.scenarioHeader}>
                                        <div className={styles.scenarioHeaderLeft}>
                                            <div
                                                className={`${styles.customToggle} ${styles.small} ${scenario.visible ? styles.active : ''}`}
                                                onClick={() => onToggleScenarioVisibility(chart.id, scenario.id)}
                                                title={scenario.visible ? 'Hide scenario' : 'Show scenario'}
                                            >
                                                <div className={styles.toggleKnob} />
                                            </div>
                                            <div
                                                className={styles.scenarioColorDot}
                                                style={{ backgroundColor: scenario.color }}
                                            />
                                            <input
                                                type="text"
                                                className={styles.scenarioNameInput}
                                                value={scenario.name}
                                                onChange={(e) => onUpdateScenario(chart.id, scenario.id, 'name', e.target.value)}
                                                placeholder="Scenario name"
                                            />
                                        </div>
                                        {chart.scenarios.length > 1 && (
                                            <Button
                                                variant="icon"
                                                onClick={() => onRemoveScenario(chart.id, scenario.id)}
                                                style={{ padding: '0.25rem' }}
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                        )}
                                    </div>

                                    <div className={styles.calculatorForm}>
                                        <div className={styles.inputGroup}>
                                            <label className={styles.inputLabel}>Initial Deposit ({baseCurrencySymbol})</label>
                                            <input
                                                type="number"
                                                className={styles.numberInput}
                                                value={scenario.initialDeposit}
                                                onChange={(e) => onUpdateScenario(chart.id, scenario.id, 'initialDeposit', e.target.value === '' ? '' : Number(e.target.value))}
                                                min="0"
                                                step="100"
                                            />
                                        </div>

                                        <div className={styles.inputGroup}>
                                            <label className={styles.inputLabel}>Contribution Amount ({baseCurrencySymbol})</label>
                                            <input
                                                type="number"
                                                className={styles.numberInput}
                                                value={scenario.contributionAmount}
                                                onChange={(e) => onUpdateScenario(chart.id, scenario.id, 'contributionAmount', e.target.value === '' ? '' : Number(e.target.value))}
                                                min="0"
                                                step="50"
                                            />
                                        </div>

                                        <div className={styles.inputGroup}>
                                            <label className={styles.inputLabel}>Contribution Frequency</label>
                                            <DropdownButton
                                                label={getFrequencyLabel(scenario.contributionFrequency)}
                                                icon={<ChevronDown size={14} />}
                                                items={FREQUENCY_OPTIONS.map(opt => ({
                                                    label: opt.label,
                                                    isActive: scenario.contributionFrequency === opt.value,
                                                    onClick: () => onUpdateScenario(chart.id, scenario.id, 'contributionFrequency', opt.value)
                                                }))}
                                                closeOnSelect={true}
                                                variant="outline"
                                                className={styles.frequencyDropdown}
                                                buttonStyle={{
                                                    width: '100%',
                                                    justifyContent: 'flex-start',
                                                    gap: '0.5rem',
                                                    height: 'auto',
                                                    padding: '0.6rem 0.75rem',
                                                    fontSize: '0.9rem',
                                                    fontWeight: 500,
                                                    background: 'var(--neu-bg)',
                                                    border: 'none',
                                                    borderRadius: 'var(--neu-radius-sm, 8px)',
                                                    boxShadow: 'inset 2px 2px 5px var(--neu-shadow-dark), inset -2px -2px 5px var(--neu-shadow-light)',
                                                    textAlign: 'left',
                                                    alignItems: 'left'
                                                }}
                                            />
                                        </div>



                                        <div className={styles.inputGroup}>
                                            <label className={styles.inputLabel}>Estimated Rate (%)</label>
                                            <input
                                                type="number"
                                                className={styles.numberInput}
                                                value={scenario.estimatedRate}
                                                onChange={(e) => onUpdateScenario(chart.id, scenario.id, 'estimatedRate', e.target.value === '' ? '' : Number(e.target.value))}
                                                min="0"
                                                max="100"
                                                step="0.1"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </Window>
    );
};

export default ScenarioEditorWindow;
