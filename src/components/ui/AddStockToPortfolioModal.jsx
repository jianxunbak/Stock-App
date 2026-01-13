import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Loader2, Check } from 'lucide-react';
import Modal from './Modal';
import styles from './AddStockToPortfolioModal.module.css';

// --- Sub-components (Reused/Refactored from Portfolio pages with Desktop Modal fix) ---

const CustomSelect = ({ value, onChange, options, placeholder, isMobile, multiple = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            const isInsideContainer = containerRef.current && containerRef.current.contains(event.target);
            const isInsideMenu = menuRef.current && menuRef.current.contains(event.target);

            if (!isInsideContainer && !isInsideMenu) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (optValue) => {
        if (!multiple) {
            onChange(optValue);
            setIsOpen(false);
            return;
        }

        const currentValues = Array.isArray(value) ? value : [value];
        if (currentValues.includes(optValue)) {
            onChange(currentValues.filter(v => v !== optValue));
        } else {
            onChange([...currentValues, optValue]);
        }
    };

    const handleSelectAll = (e) => {
        e.stopPropagation();
        const allValues = options.map(opt => opt.value || opt);
        const currentValues = Array.isArray(value) ? value : [value];

        if (currentValues.length === allValues.length) {
            onChange([]);
        } else {
            onChange(allValues);
        }
    };

    const isOptionSelected = (optValue) => {
        if (multiple) {
            return Array.isArray(value) && value.includes(optValue);
        }
        return value === optValue;
    };

    const getTriggerText = () => {
        if (!multiple) {
            return options.find(opt => (opt.value || opt) === value)?.label || value || placeholder;
        }
        const currentValues = Array.isArray(value) ? value : [];
        if (currentValues.length === 0) return placeholder;
        if (currentValues.length === options.length) return "All Portfolios";
        if (currentValues.length === 1) return options.find(opt => (opt.value || opt) === currentValues[0])?.label || currentValues[0];
        return `${currentValues.length} Portfolios Selected`;
    };

    const menuContent = (
        <div className={styles.customSelectMenu} ref={menuRef}>
            <div className={styles.customSelectOptionsList}>
                {multiple && (
                    <div
                        className={`${styles.customSelectOption} ${styles.selectAllOption}`}
                        onClick={handleSelectAll}
                    >
                        <div className={`${styles.checkbox} ${Array.isArray(value) && value.length === options.length ? styles.checked : ''}`}>
                            {Array.isArray(value) && value.length === options.length && <Check size={12} className={styles.checkIcon} />}
                        </div>
                        Select All
                    </div>
                )}
                {options.map((opt, idx) => {
                    if (opt.isGroup) {
                        return (
                            <div key={`group-${idx}`} className={styles.customSelectGroupLabel}>
                                {opt.label}
                            </div>
                        );
                    }
                    const optValue = opt.value || opt;
                    const optLabel = opt.label || opt;
                    const isSelected = isOptionSelected(optValue);

                    return (
                        <div
                            key={optValue}
                            className={`${styles.customSelectOption} ${isSelected ? styles.selected : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleOption(optValue);
                            }}
                        >
                            {multiple && (
                                <div className={`${styles.checkbox} ${isSelected ? styles.checked : ''}`}>
                                    {isSelected && <Check size={12} className={styles.checkIcon} />}
                                </div>
                            )}
                            {optLabel}
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className={styles.customSelectContainer} ref={containerRef}>
            <div className={styles.customSelectTrigger} onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
                {getTriggerText()}
                <ChevronDown size={16} />
            </div>
            {isOpen && createPortal(
                <div className={styles.mobileModalOverlay} onClick={() => setIsOpen(false)}>
                    <div className={styles.mobileModalContent} onClick={e => e.stopPropagation()}>
                        {menuContent}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

const CustomDatePicker = ({ value, onChange, isMobile }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    const menuRef = useRef(null);
    const [viewDate, setViewDate] = useState(new Date(value || new Date()));

    useEffect(() => {
        const handleClickOutside = (event) => {
            const isInsideContainer = containerRef.current && containerRef.current.contains(event.target);
            const isInsideMenu = menuRef.current && menuRef.current.contains(event.target);

            if (!isInsideContainer && !isInsideMenu) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const daysInMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1).getDay();

    const handleDayClick = (day) => {
        const dateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        onChange(dateStr);
        setIsOpen(false);
    };

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

    const totalDays = daysInMonth(viewDate);
    const startOffset = firstDayOfMonth(viewDate);
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(<div key={`e-${i}`} className={styles.dateCell} />);
    for (let d = 1; d <= totalDays; d++) {
        const dateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        cells.push(
            <div key={d} className={`${styles.dateCell} ${value === dateStr ? styles.selected : ''}`} onClick={(e) => { e.stopPropagation(); handleDayClick(d); }}>
                {d}
            </div>
        );
    }

    const popup = (
        <div className={styles.datePickerPopup} ref={menuRef}>
            <div className={styles.dateHeader}>
                <button className={styles.iconBtn} onClick={(e) => { e.stopPropagation(); setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1)); }}><ChevronLeft size={16} /></button>
                <span>{monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}</span>
                <button className={styles.iconBtn} onClick={(e) => { e.stopPropagation(); setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1)); }}><ChevronRight size={16} /></button>
            </div>
            <div className={styles.dateGrid}>
                {dayNames.map(n => <div key={n} className={styles.dayName}>{n}</div>)}
                {cells}
            </div>
        </div>
    );

    return (
        <div ref={containerRef} className={styles.datePickerContainer}>
            <div className={styles.customSelectTrigger} onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
                {value || 'Select Date'}
                <Calendar size={16} />
            </div>
            {isOpen && createPortal(
                <div className={styles.mobileModalOverlay} onClick={() => setIsOpen(false)}>
                    <div className={styles.mobileModalContent} onClick={e => e.stopPropagation()}>
                        {popup}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

// --- Main Modal Component ---

const AddStockToPortfolioModal = ({ isOpen, onClose, ticker, onAdd, portfolioList = [], isMobile, currentRate = 1 }) => {
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
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Add ${ticker} to Portfolio`}
            message={
                <div className={styles.addForm}>
                    <div className={styles.formGroup}>
                        <label>Select Portfolio(s)</label>
                        <CustomSelect
                            value={selectedPortfolioIds}
                            onChange={setSelectedPortfolioIds}
                            options={portfolioOptions}
                            isMobile={isMobile}
                            multiple={true}
                            placeholder="Select Portfolios"
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label>Ticker</label>
                        <input type="text" value={ticker} readOnly disabled />
                    </div>

                    <div className={styles.formGroup}>
                        <label>Shares</label>
                        <input
                            type="number"
                            step="any"
                            placeholder="e.g. 10"
                            value={shares}
                            onChange={e => setShares(e.target.value)}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label>Cost Basis</label>
                        <input
                            type="number"
                            step="any"
                            placeholder="Amount invested"
                            value={cost}
                            onChange={e => setCost(e.target.value)}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label>Cost Basis Date</label>
                        <CustomDatePicker value={date} onChange={setDate} isMobile={isMobile} />
                    </div>

                    <div className={styles.formGroup}>
                        <label>Category</label>
                        <CustomSelect
                            value={category}
                            onChange={setCategory}
                            options={['Core', 'Growth', 'Compounder', 'Defensive', 'Speculative']}
                            isMobile={isMobile}
                        />
                    </div>

                    {error && <p className={styles.error}>{error}</p>}
                </div>
            }
            footer={
                <div className={styles.modalFooter}>
                    <button className={styles.secondaryButton} onClick={onClose}>Cancel</button>
                    <button className={styles.submitBtn} onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 size={18} className={styles.spin} /> : 'Add Position'}
                    </button>
                </div>
            }
        />
    );
};

export default AddStockToPortfolioModal;
