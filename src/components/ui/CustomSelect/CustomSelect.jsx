import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Edit2, Trash2, Check } from 'lucide-react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CardAnimator } from '../Animator';
import styles from './CustomSelect.module.css';

const CustomSelect = ({
    value,
    onChange,
    options = [],
    style,
    onDelete,
    onEdit,
    placeholder = 'Select option',
    triggerClassName,
    useModalOnDesktop = false,
    containerStyle,
    isOpen: controlledIsOpen,
    onOpenChange,
    multiple = false,
    isMobile: propIsMobile
}) => {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const containerRef = useRef(null);
    const menuRef = useRef(null);
    const [internalIsMobile, setInternalIsMobile] = useState(window.innerWidth < 768);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

    const isMobile = propIsMobile !== undefined ? propIsMobile : internalIsMobile;

    const isControlled = controlledIsOpen !== undefined;
    const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

    const updateIsOpen = (val) => {
        if (isControlled) {
            if (onOpenChange) onOpenChange(val);
        } else {
            setInternalIsOpen(val);
        }
    };

    useEffect(() => {
        const handleResize = () => {
            setInternalIsMobile(window.innerWidth < 768);
            updateIsOpen(false);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!isOpen) return;

            // Critical check: Is the click coming from inside the portal?
            if (menuRef.current && menuRef.current.contains(event.target)) {
                return;
            }

            // Is the click the trigger area?
            if (containerRef.current && containerRef.current.contains(event.target)) {
                return;
            }

            updateIsOpen(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleToggle = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (!isOpen && containerRef.current && !isMobile && !useModalOnDesktop) {
            const rect = containerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom,
                left: rect.left,
                width: rect.width
            });
        }
        updateIsOpen(!isOpen);
    };

    // Multi-select Logic
    const toggleOption = (optValue) => {
        if (!multiple) {
            onChange(optValue);
            updateIsOpen(false);
            return;
        }

        const currentValues = Array.isArray(value) ? value : [value];
        const exists = currentValues.some(v => v === optValue); // loose check if values are simple types? strictly check?
        // Assume strict equality for IDs
        if (exists) {
            onChange(currentValues.filter(v => v !== optValue));
        } else {
            onChange([...currentValues, optValue]);
        }
    };

    const handleSelectAll = (e) => {
        e.stopPropagation();
        const allValues = options
            .filter(opt => !opt.isGroup) // Exclude groups
            .map(opt => opt.value !== undefined ? opt.value : opt);

        const currentValues = Array.isArray(value) ? value : [value];

        // If all selectable options are already selected, deselect all
        // Otherwise select all
        const allSelected = allValues.every(val => currentValues.includes(val));

        if (allSelected) {
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

        // Count total selectable options
        const totalOptions = options.filter(opt => !opt.isGroup).length;
        if (currentValues.length === totalOptions && totalOptions > 0) return "All Selected"; // Or custom label via props?

        if (currentValues.length === 1) {
            const found = options.find(opt => (opt.value !== undefined ? opt.value : opt) === currentValues[0]);
            return found?.label || currentValues[0];
        }

        return `${currentValues.length} Selected`;
    };

    const menuContent = (
        <CardAnimator
            type="fabricCard"
            active={isOpen}
            className={styles.customSelectMenu}
            maxRadius={12}
            style={{
                width: '100%',
                padding: '0.25rem'
            }}
        >
            <div className={styles.customSelectOptionsList}>
                {multiple && options.length > 0 && (
                    <div
                        className={`${styles.customSelectOption} ${styles.selectAllOption}`}
                        onClick={handleSelectAll}
                    >
                        <div className={`${styles.checkbox} ${Array.isArray(value) &&
                            options.filter(o => !o.isGroup).length > 0 &&
                            value.length >= options.filter(o => !o.isGroup).length ? styles.checked : ''
                            }`}>
                            {(Array.isArray(value) && options.filter(o => !o.isGroup).length > 0 && value.length >= options.filter(o => !o.isGroup).length) && <Check size={12} className={styles.checkIcon} />}
                        </div>
                        <span style={{ flex: 1 }}>Select All</span>
                    </div>
                )}

                {options.map((option, idx) => {
                    const isGroup = option.isGroup;
                    if (isGroup) {
                        return (
                            <div key={`group-${idx}`} className={styles.customSelectGroupLabel}>
                                {option.label}
                            </div>
                        );
                    }

                    const optValue = option.value !== undefined ? option.value : option;
                    const optLabel = option.label !== undefined ? option.label : option;
                    const isSelected = isOptionSelected(optValue);

                    return (
                        <div
                            key={idx}
                            className={`${styles.customSelectOption} ${isSelected ? styles.selected : ''}`}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleOption(optValue);
                            }}
                        >
                            {multiple && (
                                <div className={`${styles.checkbox} ${isSelected ? styles.checked : ''}`}>
                                    {isSelected && <Check size={12} className={styles.checkIcon} />}
                                </div>
                            )}
                            <span style={{ flex: 1 }}>{optLabel}</span>
                            <div className={styles.optionActions}>
                                {onEdit && (
                                    <button
                                        type="button"
                                        className={styles.editOptionBtn}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onEdit(optValue);
                                        }}
                                        title="Edit"
                                    >
                                        <Edit2 size={12} />
                                    </button>
                                )}
                                {onDelete && (
                                    <button
                                        type="button"
                                        className={styles.deleteOptionBtn}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onDelete(optValue);
                                        }}
                                        title="Delete"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </CardAnimator>
    );

    return (
        <div
            className={styles.customSelectContainer}
            ref={containerRef}
            style={{ ...containerStyle, pointerEvents: 'auto' }}
        >
            <div
                className={triggerClassName || styles.customSelectTrigger}
                onClick={handleToggle}
                style={{ ...style, cursor: 'pointer', pointerEvents: 'auto' }}
            >
                {getTriggerText()}
                {!triggerClassName && <ChevronDown size={16} color="var(--text-secondary)" />}
            </div>
            {isOpen && createPortal(
                isMobile ? (
                    <div
                        className={styles.mobileModalOverlay}
                        style={{ zIndex: 2000000, pointerEvents: 'auto' }}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            updateIsOpen(false);
                        }}
                    >
                        <div
                            className={styles.mobileModalContent}
                            onClick={(e) => e.stopPropagation()}
                            style={{ background: 'var(--neu-bg)' }}
                            ref={menuRef}
                        >
                            {menuContent}
                        </div>
                    </div>
                ) : useModalOnDesktop ? (
                    <div
                        className={`${styles.mobileModalOverlay} ${styles.centered}`}
                        style={{ zIndex: 2000000, pointerEvents: 'auto' }}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            updateIsOpen(false);
                        }}
                    >
                        <div
                            style={{ width: '400px', pointerEvents: 'auto' }}
                            onClick={(e) => e.stopPropagation()}
                            ref={menuRef}
                        >
                            {menuContent}
                        </div>
                    </div>
                ) : (
                    <div
                        className={styles.desktopDropdownWrapper}
                        ref={menuRef}
                        style={{
                            position: 'fixed',
                            top: `${coords.top + 5}px`,
                            left: `${coords.left}px`,
                            width: `${coords.width}px`,
                            minWidth: '220px',
                            zIndex: 2000000,
                            pointerEvents: 'auto'
                        }}
                    >
                        {menuContent}
                    </div>
                ),
                document.body
            )}
        </div>
    );
};

export default CustomSelect;
