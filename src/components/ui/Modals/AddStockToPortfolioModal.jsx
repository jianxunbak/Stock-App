import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Check, X } from 'lucide-react';
import Window from '../Window/Window';
import Button from '../Button/Button';
import CustomSelect from '../CustomSelect/CustomSelect';
import CustomDatePicker from '../CustomDatePicker/CustomDatePicker';
import styles from './AddStockToPortfolioModal.module.css';

// --- Main Modal Component ---

const AddStockToPortfolioModal = ({ isOpen, onClose, ticker, onAdd, portfolioList = [], isMobile, currentRate = 1, currencySymbol = '$' }) => {
    const [selectedPortfolioIds, setSelectedPortfolioIds] = useState([]);
    const [shares, setShares] = useState('');
    const [cost, setCost] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [category, setCategory] = useState('Core');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initial default selection: first portfolio in list
    useEffect(() => {
        if (isOpen && portfolioList.length > 0 && selectedPortfolioIds.length === 0) {
            setSelectedPortfolioIds([portfolioList[0].id]);
        }
    }, [isOpen, portfolioList]);

    const portfolioOptions = [
        { label: 'Main Portfolios', isGroup: true },
        ...portfolioList.filter(p => (p.type || 'main') === 'main').map(p => ({ value: p.id, label: p.name })),
        { label: 'Test Portfolios', isGroup: true },
        ...portfolioList.filter(p => p.type === 'test').map(p => ({ value: p.id, label: p.name }))
    ];

    const handleSubmit = async () => {
        if (!selectedPortfolioIds.length || !shares || !cost || !date || !category) {
            setError('Please fill in all fields and select at least one portfolio');
            return;
        }
        setError('');
        setIsSubmitting(true);
        try {
            // Normalize cost to USD (storage base)
            const normalizedCost = parseFloat(cost) / currentRate;

            await onAdd({
                portfolioIds: selectedPortfolioIds,
                ticker: ticker.toUpperCase(),
                shares: parseFloat(shares),
                totalCost: normalizedCost,
                purchaseDate: date,
                category: category
            });
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to add stock');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Window
            isOpen={isOpen}
            onClose={onClose}
            title={`Add ${ticker} to Portfolio`}
            width="450px"
            height="auto"
            headerAlign="start"
            hideCloseButton={true}
            controls={
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button
                        variant="icon"
                        onClick={onClose}
                        title="Cancel"
                        style={{ color: 'var(--neu-text-secondary)' }}
                    >
                        <X size={20} />
                    </Button>
                    <Button
                        variant="icon"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        title="Add Stock"
                        style={{ color: 'var(--neu-brand)' }}
                    >
                        {isSubmitting ? <Loader2 size={20} className={styles.spin} /> : <Check size={20} />}
                    </Button>
                </div>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className={styles.addForm} style={{ padding: 0 }}>
                    <div className={styles.formGroup}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--neu-text-tertiary)', fontWeight: 600 }}>Select Portfolio(s)</label>
                        <CustomSelect
                            value={selectedPortfolioIds}
                            onChange={setSelectedPortfolioIds}
                            options={portfolioOptions}
                            isMobile={false}
                            multiple={true}
                            placeholder="Select Portfolios"
                            useModalOnDesktop={true}
                            dropdownStyle={{ maxWidth: '400px' }}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--neu-text-tertiary)', fontWeight: 600 }}>Ticker</label>
                        <input type="text" value={ticker} readOnly disabled />
                    </div>

                    <div className={styles.formGroup}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--neu-text-tertiary)', fontWeight: 600 }}>Shares</label>
                        <input
                            type="number"
                            step="any"
                            placeholder="e.g. 10"
                            value={shares}
                            onChange={e => setShares(e.target.value)}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--neu-text-tertiary)', fontWeight: 600 }}>Cost Basis ({currencySymbol})</label>
                        <input
                            type="number"
                            step="any"
                            placeholder="Amount invested"
                            value={cost}
                            onChange={e => setCost(e.target.value)}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--neu-text-tertiary)', fontWeight: 600 }}>Cost Basis Date</label>
                        <CustomDatePicker value={date} onChange={setDate} isMobile={false} useModalOnDesktop={true} />
                    </div>

                    <div className={styles.formGroup}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--neu-text-tertiary)', fontWeight: 600 }}>Category</label>
                        <CustomSelect
                            value={category}
                            onChange={setCategory}
                            options={['Core', 'Growth', 'Compounder', 'Defensive', 'Speculative']}
                            isMobile={false}
                            useModalOnDesktop={true}
                        />
                    </div>

                    {error && <p className={styles.error}>{error}</p>}
                </div>
            </div>
        </Window>
    );
};

export default AddStockToPortfolioModal;
