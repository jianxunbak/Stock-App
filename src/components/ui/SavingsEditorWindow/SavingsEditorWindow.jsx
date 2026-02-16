import React, { useState, useMemo } from 'react';
import Window from '../Window/Window';
import Button from '../Button/Button';
import DropdownButton from '../DropdownButton/DropdownButton';
import { Trash2, Plus, Link, FolderPlus, Layers, ChevronDown } from 'lucide-react';
import styles from './SavingsEditorWindow.module.css';

const SavingsEditorWindow = ({
    isOpen,
    onClose,
    scenarios,
    settings,
    stocksCharts = [],
    onAddScenario,
    onRemoveScenario,
    onUpdateScenario,
    onUpdateExpenses
}) => {
    const [newExpenseName, setNewExpenseName] = useState('');

    // Ensure expenses has the new structure: { items: [], groups: [], linked: [] }
    const normalizeExpenses = (expenses) => {
        if (!expenses || typeof expenses !== 'object') return { items: [], groups: [], linked: [] };
        if (Array.isArray(expenses)) return { items: [], groups: [], linked: [] };

        // If it's the new structure, return as is
        if ('items' in expenses || 'groups' in expenses || 'linked' in expenses) {
            return {
                items: expenses.items || [],
                groups: expenses.groups || [],
                linked: expenses.linked || []
            };
        }

        // Migrate legacy object structure
        const items = Object.entries(expenses).map(([name, value], idx) => ({
            id: `legacy-${idx}-${Date.now()}`,
            name: name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^[a-z]/, L => L.toUpperCase()),
            value: Number(value),
            frequency: 'Monthly'
        }));

        return { items, groups: [], linked: [] };
    };

    const handleUpdateStructuredExpenses = (scenarioId, updatedExpenses) => {
        onUpdateExpenses(scenarioId, updatedExpenses);
    };

    const handleAddItem = (scenarioId, groupId = null) => {
        const scenario = scenarios.find(s => s.id === scenarioId);
        const expenses = normalizeExpenses(scenario.expenses);
        const newItem = { id: Date.now().toString(), name: 'New Expense', value: 0, frequency: 'Monthly' };

        if (groupId) {
            expenses.groups = expenses.groups.map(g =>
                g.id === groupId ? { ...g, items: [...(g.items || []), newItem] } : g
            );
        } else {
            expenses.items.push(newItem);
        }

        handleUpdateStructuredExpenses(scenarioId, expenses);
    };

    const handleAddGroup = (scenarioId) => {
        const scenario = scenarios.find(s => s.id === scenarioId);
        const expenses = normalizeExpenses(scenario.expenses);
        const newGroup = { id: Date.now().toString(), name: 'New Group', items: [] };
        expenses.groups.push(newGroup);
        handleUpdateStructuredExpenses(scenarioId, expenses);
    };

    const handleRemoveItem = (scenarioId, itemId, groupId = null) => {
        const scenario = scenarios.find(s => s.id === scenarioId);
        const expenses = normalizeExpenses(scenario.expenses);

        if (groupId) {
            expenses.groups = expenses.groups.map(g =>
                g.id === groupId ? { ...g, items: g.items.filter(i => i.id !== itemId) } : g
            );
        } else {
            expenses.items = expenses.items.filter(i => i.id !== itemId);
        }

        handleUpdateStructuredExpenses(scenarioId, expenses);
    };

    const handleRemoveGroup = (scenarioId, groupId) => {
        const scenario = scenarios.find(s => s.id === scenarioId);
        const expenses = normalizeExpenses(scenario.expenses);
        expenses.groups = expenses.groups.filter(g => g.id !== groupId);
        handleUpdateStructuredExpenses(scenarioId, expenses);
    };

    const handleUpdateItem = (scenarioId, itemId, field, value, groupId = null) => {
        const scenario = scenarios.find(s => s.id === scenarioId);
        const expenses = normalizeExpenses(scenario.expenses);

        if (groupId) {
            expenses.groups = expenses.groups.map(g =>
                g.id === groupId ? {
                    ...g,
                    items: g.items.map(i => i.id === itemId ? { ...i, [field]: value } : i)
                } : g
            );
        } else {
            expenses.items = expenses.items.map(i => i.id === itemId ? { ...i, [field]: value } : i);
        }

        handleUpdateStructuredExpenses(scenarioId, expenses);
    };

    const handleUpdateGroup = (scenarioId, groupId, field, value) => {
        const scenario = scenarios.find(s => s.id === scenarioId);
        const expenses = normalizeExpenses(scenario.expenses);
        expenses.groups = expenses.groups.map(g => g.id === groupId ? { ...g, [field]: value } : g);
        handleUpdateStructuredExpenses(scenarioId, expenses);
    };

    const normalizedOtherInvestments = useMemo(() => {
        const data = settings?.otherInvestments;
        if (!data) return { items: [], groups: [] };

        // Handle legacy array format
        if (Array.isArray(data)) return { items: data, groups: [] };

        // Ensure groups and items are always arrays
        return {
            items: Array.isArray(data.items) ? data.items : [],
            groups: Array.isArray(data.groups) ? data.groups : []
        };
    }, [settings?.otherInvestments]);

    const handleAddLinked = (scenarioId, type, sourceData) => {
        const scenario = scenarios.find(s => s.id === scenarioId);
        if (!scenario) return;

        const expenses = normalizeExpenses(scenario.expenses);

        let newItem;
        if (type === 'cpf') {
            const salary = Number(settings?.cpf?.monthlySalary || 0);
            const bonus = Number(settings?.cpf?.annualBonus || 0);
            const monthlyBonus = bonus / 12;
            const cpfValue = (Math.min(salary, 8000) + Math.min(monthlyBonus, 8500 - Math.min(salary, 8000))) * 0.2;

            newItem = {
                id: `linked-cpf-${Date.now()}`,
                name: 'CPF Contribution',
                value: Math.round(cpfValue),
                frequency: 'Monthly',
                isLinked: true,
                source: 'CPF Card'
            };
        } else if (type === 'total-other') {
            const allItems = [
                ...normalizedOtherInvestments.items,
                ...normalizedOtherInvestments.groups.flatMap(g => g.items || [])
            ];

            const totalMonthlyVal = allItems.reduce((sum, item) => {
                const p = Number(item.paymentAmount || 0);
                const f = item.frequency || 'One-time';
                if (f === 'Monthly') return sum + p;
                if (f === 'Yearly') return sum + (p / 12);
                if (f === 'Quarterly') return sum + (p / 3);
                return sum;
            }, 0);

            newItem = {
                id: `linked-total-other-${Date.now()}`,
                name: 'Total Other Investments',
                value: Math.round(totalMonthlyVal),
                frequency: 'Monthly',
                isLinked: true,
                source: 'Other Investments (Total)'
            };
        } else if (type === 'group-investment') {
            const group = sourceData;
            const totalMonthlyVal = (group.items || []).reduce((sum, item) => {
                const p = Number(item.paymentAmount || 0);
                const f = item.frequency || 'One-time';
                if (f === 'Monthly') return sum + p;
                if (f === 'Yearly') return sum + (p / 12);
                if (f === 'Quarterly') return sum + (p / 3);
                return sum;
            }, 0);

            newItem = {
                id: `linked-group-${group.id}-${Date.now()}`,
                name: `${group.name} (Total)`,
                value: Math.round(totalMonthlyVal),
                frequency: 'Monthly',
                isLinked: true,
                source: 'Other Investments (Group)'
            };
        } else if (type === 'investment') {
            const p = Number(sourceData.paymentAmount || 0);
            const f = sourceData.frequency || 'Monthly';

            // Normalize to monthly value for the expense editor
            let monthlyVal = p;
            if (f === 'Yearly') monthlyVal = p / 12;
            else if (f === 'Quarterly') monthlyVal = p / 3;
            else if (f === 'One-time') monthlyVal = 0;

            newItem = {
                id: `linked-inv-${sourceData.id}-${Date.now()}`,
                name: sourceData.name,
                value: Math.round(monthlyVal),
                frequency: 'Monthly', // Expenses are typically viewed monthly
                isLinked: true,
                source: sourceData.source || 'Other Investments'
            };
        }

        if (newItem) {
            expenses.linked.push(newItem);
            onUpdateScenario(scenarioId, 'expenses', expenses);
        }
    };

    const handleRemoveLinked = (scenarioId, itemId) => {
        const scenario = scenarios.find(s => s.id === scenarioId);
        const expenses = normalizeExpenses(scenario.expenses);
        expenses.linked = expenses.linked.filter(i => i.id !== itemId);
        handleUpdateStructuredExpenses(scenarioId, expenses);
    };

    // Calculate totals for summary
    const calculateTotals = (scenario) => {
        const { items = [], groups = [], linked = [] } = normalizeExpenses(scenario.expenses);

        const getItemMonthly = (item) => {
            const val = Number(item.value || 0);
            if (item.frequency === 'Yearly') return val / 12;
            if (item.frequency === 'Quarterly') return val / 3;
            return val;
        };

        let total = 0;
        items.forEach(i => total += getItemMonthly(i));
        groups.forEach(g => g.items.forEach(i => total += getItemMonthly(i)));
        linked.forEach(i => total += getItemMonthly(i));

        const monthlyPay = Number(scenario.monthlyPay || 0);
        // Simple CPF calculation for display
        const salary = Number(settings?.cpf?.monthlySalary || 0);
        const bonus = Number(settings?.cpf?.annualBonus || 0);
        const monthlyBonus = bonus / 12;
        const cpf = (Math.min(salary, 8000) + Math.min(monthlyBonus, 8500 - Math.min(salary, 8000))) * 0.2;

        return { totalExpenses: total, cpf, monthlySavings: monthlyPay - cpf - total };
    };

    return (
        <Window
            isOpen={isOpen}
            onClose={onClose}
            title="Manage Savings and Expenses"
            headerAlign="start"
            width="750px"
            height="85vh"
            maxHeight="90vh"
            controls={
                <Button
                    variant="icon"
                    onClick={onAddScenario}
                    style={{ padding: '0.5rem' }}
                    title="Add new scenario"
                >
                    <Plus size={18} />
                </Button>
            }
        >
            <div className={styles.container}>
                <div className={styles.scenarioList}>
                    {scenarios.map((scenario) => {
                        const expenses = normalizeExpenses(scenario.expenses);
                        const { totalExpenses, cpf, monthlySavings } = calculateTotals(scenario);

                        return (
                            <div key={scenario.id} className={styles.scenarioCard}>
                                <div className={styles.scenarioHeader}>
                                    <div className={styles.scenarioHeaderLeft}>
                                        <div
                                            className={`${styles.customToggle} ${scenario.visible ? styles.active : ''}`}
                                            onClick={() => onUpdateScenario(scenario.id, 'visible', !scenario.visible)}
                                        >
                                            <div className={styles.toggleKnob} />
                                        </div>
                                        <div className={styles.scenarioColorDot} style={{ backgroundColor: scenario.color }} />
                                        <input
                                            type="text"
                                            className={styles.scenarioNameInput}
                                            value={scenario.name}
                                            onChange={(e) => onUpdateScenario(scenario.id, 'name', e.target.value)}
                                        />
                                    </div>
                                    {scenarios.length > 1 && (
                                        <Button variant="icon" onClick={() => onRemoveScenario(scenario.id)}>
                                            <Trash2 size={16} />
                                        </Button>
                                    )}
                                </div>

                                <section className={styles.section}>
                                    <h3 className={styles.sectionTitle}>Income & Savings</h3>
                                    <div className={styles.inputGrid}>
                                        <div className={styles.inputGroup}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                <label className={styles.label}>Monthly Pay ($)</label>
                                                {settings?.cpf?.monthlySalary && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {!scenario.isManualPay ? (
                                                            <span style={{ fontSize: '0.65rem', color: 'var(--neu-success)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <Link size={10} /> Linked
                                                            </span>
                                                        ) : (
                                                            <span style={{ fontSize: '0.65rem', color: 'var(--neu-text-tertiary)', fontWeight: 700 }}>
                                                                Manual entry
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ position: 'relative' }}>
                                                {!scenario.isManualPay && settings?.cpf?.monthlySalary ? (
                                                    <div className={styles.flatValue}>
                                                        ${Number(settings.cpf.monthlySalary).toLocaleString()}
                                                        <button
                                                            onClick={() => onUpdateScenario(scenario.id, 'isManualPay', true)}
                                                            style={{
                                                                marginLeft: '12px',
                                                                background: 'none',
                                                                border: 'none',
                                                                fontSize: '0.65rem',
                                                                color: 'var(--neu-text-tertiary)',
                                                                fontWeight: 600,
                                                                cursor: 'pointer',
                                                                textDecoration: 'underline'
                                                            }}
                                                        >
                                                            Edit
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div style={{ position: 'relative' }}>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            className={styles.input}
                                                            value={scenario.monthlyPay}
                                                            onChange={(e) => onUpdateScenario(scenario.id, 'monthlyPay', e.target.value)}
                                                            placeholder="Enter salary"
                                                        />
                                                        {settings?.cpf?.monthlySalary && (
                                                            <button
                                                                onClick={() => {
                                                                    onUpdateScenario(scenario.id, 'isManualPay', false);
                                                                    onUpdateScenario(scenario.id, 'monthlyPay', Number(settings.cpf.monthlySalary));
                                                                }}
                                                                style={{
                                                                    position: 'absolute',
                                                                    right: '10px',
                                                                    top: '50%',
                                                                    transform: 'translateY(-50%)',
                                                                    background: 'rgba(var(--neu-success-rgb), 0.1)',
                                                                    border: 'none',
                                                                    borderRadius: '4px',
                                                                    padding: '2px 8px',
                                                                    fontSize: '0.6rem',
                                                                    color: 'var(--neu-success)',
                                                                    fontWeight: 700,
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                Link CPF
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <label className={styles.label}>Initial Savings ($)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className={styles.input}
                                                value={scenario.initialSavings}
                                                onChange={(e) => onUpdateScenario(scenario.id, 'initialSavings', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </section>

                                <section className={styles.section}>
                                    <div className={styles.sectionHeader}>
                                        <h3 className={styles.sectionTitle}>Monthly Expenses</h3>
                                        <div className={styles.sectionActions}>
                                            <Button variant="secondary" size="sm" onClick={() => handleAddGroup(scenario.id)}>
                                                <FolderPlus size={14} />
                                            </Button>
                                            <Button variant="secondary" size="sm" onClick={() => handleAddItem(scenario.id)}>
                                                <Plus size={14} />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className={styles.groupsList}>
                                        {/* Groups */}
                                        {expenses.groups.map(group => (
                                            <div key={group.id} className={styles.groupContainer}>
                                                <div className={styles.groupHeader}>
                                                    <input
                                                        className={styles.groupTitle}
                                                        value={group.name}
                                                        onChange={(e) => handleUpdateGroup(scenario.id, group.id, 'name', e.target.value)}
                                                    />
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <Button variant="icon" size="sm" onClick={() => handleAddItem(scenario.id, group.id)}>
                                                            <Plus size={14} />
                                                        </Button>
                                                        <Button variant="icon" size="sm" onClick={() => handleRemoveGroup(scenario.id, group.id)}>
                                                            <Trash2 size={14} color="var(--neu-danger)" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className={styles.groupItems}>
                                                    {group.items.map(item => (
                                                        <div key={item.id} className={styles.expenseRow}>
                                                            <input
                                                                className={styles.input}
                                                                value={item.name}
                                                                onChange={(e) => handleUpdateItem(scenario.id, item.id, 'name', e.target.value, group.id)}
                                                            />
                                                            <div className={styles.valueWrapper}>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    className={styles.input}
                                                                    value={item.value}
                                                                    onChange={(e) => handleUpdateItem(scenario.id, item.id, 'value', e.target.value, group.id)}
                                                                />
                                                                {item.frequency !== 'Monthly' && (
                                                                    <span className={styles.monthlyExtrapolation}>
                                                                        ≈ ${Math.round(item.value / (item.frequency === 'Yearly' ? 12 : 3)).toLocaleString()}/mo
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <DropdownButton
                                                                label={item.frequency}
                                                                variant="ghost"
                                                                size="sm"
                                                                icon={<ChevronDown size={14} />}
                                                                closeOnSelect={true}
                                                                buttonStyle={{ fontSize: '0.8rem', width: '105px', justifyContent: 'space-between' }}
                                                                items={[
                                                                    { label: 'Monthly', onClick: () => handleUpdateItem(scenario.id, item.id, 'frequency', 'Monthly', group.id) },
                                                                    { label: 'Quarterly', onClick: () => handleUpdateItem(scenario.id, item.id, 'frequency', 'Quarterly', group.id) },
                                                                    { label: 'Yearly', onClick: () => handleUpdateItem(scenario.id, item.id, 'frequency', 'Yearly', group.id) },
                                                                ]}
                                                            />
                                                            <Button variant="icon" size="sm" onClick={() => handleRemoveItem(scenario.id, item.id, group.id)}>
                                                                <Trash2 size={14} />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}

                                        {/* Standalone Items */}
                                        <div className={styles.standaloneItems}>
                                            {expenses.items.map(item => (
                                                <div key={item.id} className={styles.expenseRow}>
                                                    <input
                                                        className={styles.input}
                                                        value={item.name}
                                                        onChange={(e) => handleUpdateItem(scenario.id, item.id, 'name', e.target.value)}
                                                    />
                                                    <div className={styles.valueWrapper}>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            className={styles.input}
                                                            value={item.value}
                                                            onChange={(e) => handleUpdateItem(scenario.id, item.id, 'value', e.target.value)}
                                                        />
                                                        {item.frequency !== 'Monthly' && (
                                                            <span className={styles.monthlyExtrapolation}>
                                                                ≈ ${Math.round(item.value / (item.frequency === 'Yearly' ? 12 : 3)).toLocaleString()}/mo
                                                            </span>
                                                        )}
                                                    </div>
                                                    <DropdownButton
                                                        label={item.frequency}
                                                        variant="ghost"
                                                        size="sm"
                                                        icon={<ChevronDown size={14} />}
                                                        closeOnSelect={true}
                                                        buttonStyle={{ fontSize: '0.8rem', width: '105px', justifyContent: 'space-between' }}
                                                        items={[
                                                            { label: 'Monthly', onClick: () => handleUpdateItem(scenario.id, item.id, 'frequency', 'Monthly') },
                                                            { label: 'Quarterly', onClick: () => handleUpdateItem(scenario.id, item.id, 'frequency', 'Quarterly') },
                                                            { label: 'Yearly', onClick: () => handleUpdateItem(scenario.id, item.id, 'frequency', 'Yearly') },
                                                        ]}
                                                    />
                                                    <Button variant="icon" size="sm" onClick={() => handleRemoveItem(scenario.id, item.id)}>
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </section>

                                <section className={styles.section}>
                                    <h3 className={styles.sectionTitle}>Linked CPF and Other Investments</h3>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <DropdownButton
                                            variant="secondary"
                                            size="sm"
                                            icon={<Link size={14} />}
                                            closeOnSelect={true}
                                            items={[
                                                {
                                                    label: 'Link CPF Contribution',
                                                    disabled: expenses.linked.some(i => i.source === 'CPF Card'),
                                                    onClick: () => handleAddLinked(scenario.id, 'cpf'),
                                                    icon: <Link size={14} />
                                                },
                                                { type: 'divider' },
                                                { type: 'header', label: 'Other Investments' },
                                                {
                                                    label: 'Total Other Investments',
                                                    disabled: expenses.linked.some(i => i.source === 'Other Investments (Total)'),
                                                    onClick: () => handleAddLinked(scenario.id, 'total-other'),
                                                    icon: <Layers size={14} />
                                                },
                                                { type: 'header', label: 'Investment Groups' },
                                                ...normalizedOtherInvestments.groups.map(group => ({
                                                    label: `${group.name} (Group Total)`,
                                                    disabled: expenses.linked.some(i => i.id.startsWith(`linked-group-${group.id}`)),
                                                    onClick: () => handleAddLinked(scenario.id, 'group-investment', group),
                                                    icon: <FolderPlus size={14} />
                                                })),
                                                { type: 'header', label: 'Specific Assets' },
                                                ...[
                                                    ...normalizedOtherInvestments.items,
                                                    ...normalizedOtherInvestments.groups.flatMap(g => (g.items || []).map(i => ({ ...i, groupName: g.name })))
                                                ].map(item => ({
                                                    label: item.groupName ? `${item.name} (${item.groupName})` : item.name,
                                                    disabled: expenses.linked.some(i => i.id.startsWith(`linked-inv-${item.id}`)),
                                                    onClick: () => handleAddLinked(scenario.id, 'investment', { ...item, source: item.groupName ? `Other Investments (${item.groupName})` : 'Other Investments' }),
                                                    icon: <Layers size={14} />
                                                }))
                                            ]}
                                        />
                                    </div>

                                    <div className={styles.linkedList} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
                                        {expenses.linked.map(item => (
                                            <div key={item.id} className={styles.linkedItem}>
                                                <div className={styles.linkedInfo}>
                                                    <span className={styles.linkedLabel}>{item.name}</span>
                                                    <span className={styles.linkedSource}>Source: {item.source} • {item.frequency}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                        <span className={styles.linkedValue}>${item.value.toLocaleString()}</span>
                                                        {item.frequency !== 'Monthly' && (
                                                            <span style={{ fontSize: '0.65rem', color: 'var(--neu-text-tertiary)', fontWeight: 600 }}>
                                                                ≈ ${Math.round(item.value / (item.frequency === 'Yearly' ? 12 : 3)).toLocaleString()}/mo
                                                            </span>
                                                        )}
                                                    </div>
                                                    <Button variant="icon" size="sm" onClick={() => handleRemoveLinked(scenario.id, item.id)}>
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <div className={styles.summary}>
                                    <div className={styles.summaryRow}>
                                        <span>Total Monthly Expenses:</span>
                                        <span className={styles.expenseTotal}>${Math.round(totalExpenses).toLocaleString()}</span>
                                    </div>
                                    <div className={styles.summaryRow}>
                                        <span>CPF Contribution:</span>
                                        <span>${Math.round(cpf).toLocaleString()}</span>
                                    </div>
                                    <div className={styles.summaryRow}>
                                        <span>Estimated Monthly Savings:</span>
                                        <span className={styles.savingsTotal}>${Math.round(monthlySavings).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </Window>
    );
};

export default SavingsEditorWindow;
