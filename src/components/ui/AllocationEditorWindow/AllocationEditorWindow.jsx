import React from 'react';
import Window from '../Window/Window';
import Button from '../Button/Button';
import { Trash2, Plus } from 'lucide-react';
import styles from './AllocationEditorWindow.module.css';

const AllocationEditorWindow = ({
    isOpen,
    onClose,
    catTargets,
    sectorLimits,
    onUpdateCatTarget,
    onUpdateSectorLimit,
    onRemoveSectorLimit,
    onAddSectorLimit
}) => {
    const [newSectorName, setNewSectorName] = React.useState('');

    return (
        <Window
            isOpen={isOpen}
            onClose={onClose}
            title="Manage Allocation Targets"
            headerAlign="start"
            width="600px"
            height="85vh"
            maxHeight="90vh"
        >
            <div className={styles.container}>
                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Category Targets (%)</h3>
                    <div className={styles.grid}>
                        <div className={styles.headerRow}>
                            <span>Category</span>
                            <span style={{ textAlign: 'center' }}>Min %</span>
                            <span style={{ textAlign: 'center' }}>Max %</span>
                            <span />
                        </div>
                        {Object.entries(catTargets).map(([name, target]) => (
                            <div key={name} className={styles.row}>
                                <span className={styles.name}>{name}</span>
                                <input
                                    type="number"
                                    className={styles.input}
                                    value={target.min}
                                    onChange={(e) => onUpdateCatTarget(name, 'min', e.target.value === '' ? '' : Number(e.target.value))}
                                />
                                <input
                                    type="number"
                                    className={styles.input}
                                    value={target.max}
                                    onChange={(e) => onUpdateCatTarget(name, 'max', e.target.value === '' ? '' : Number(e.target.value))}
                                />
                                <span />
                            </div>
                        ))}
                    </div>
                </section>

                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Sector Limits (%)</h3>
                    <div className={styles.grid}>
                        <div className={styles.headerRow}>
                            <span>Sector</span>
                            <span />
                            <span style={{ textAlign: 'center' }}>Max % Limit</span>
                            <span />
                        </div>
                        {Object.entries(sectorLimits).map(([name, limit]) => (
                            <div key={name} className={styles.row}>
                                <span className={styles.name}>{name}</span>
                                <span />
                                <input
                                    type="number"
                                    className={styles.input}
                                    value={limit}
                                    onChange={(e) => onUpdateSectorLimit(name, e.target.value === '' ? '' : Number(e.target.value))}
                                />
                                <Button
                                    variant="icon"
                                    onClick={() => onRemoveSectorLimit(name)}
                                    className={styles.removeBtn}
                                >
                                    <Trash2 size={16} />
                                </Button>
                            </div>
                        ))}
                    </div>

                    <div className={styles.addItemContainer}>
                        <input
                            type="text"
                            placeholder="Add sector limit..."
                            className={styles.input}
                            value={newSectorName}
                            onChange={(e) => setNewSectorName(e.target.value)}
                        />
                        <Button
                            variant="primary"
                            onClick={() => {
                                if (newSectorName.trim()) {
                                    onAddSectorLimit(newSectorName.trim(), 15);
                                    setNewSectorName('');
                                }
                            }}
                            title="Add sector limit"
                        >
                            <Plus size={16} />
                        </Button>
                    </div>
                </section>
            </div>
        </Window>
    );
};

export default AllocationEditorWindow;
