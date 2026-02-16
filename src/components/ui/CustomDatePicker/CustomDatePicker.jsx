import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CardAnimator } from '../Animator';
import styles from './CustomDatePicker.module.css';

const CustomDatePicker = ({ value, onChange, triggerClassName, isMobile: propIsMobile, style, useModalOnDesktop = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState(null); // 'month' or 'year' or null
    const containerRef = useRef(null);
    const popupRef = useRef(null);
    const yearListRef = useRef(null);

    const parseDate = (val) => {
        if (!val) return new Date();
        const d = new Date(val);
        return isNaN(d.getTime()) ? new Date() : d;
    };

    const [viewDate, setViewDate] = useState(parseDate(value));
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const [internalIsMobile, setInternalIsMobile] = useState(window.innerWidth < 768);

    const isMobile = propIsMobile !== undefined ? propIsMobile : internalIsMobile;

    useEffect(() => {
        const handleResize = () => setInternalIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setViewDate(parseDate(value));
        }
    }, [isOpen, value]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!isOpen) return;

            // Critical check: Is the click coming from inside the portal?
            if (popupRef.current && popupRef.current.contains(event.target)) return;

            // Is the click the trigger area?
            if (containerRef.current && containerRef.current.contains(event.target)) {
                return;
            }

            setIsOpen(false);
            setActiveDropdown(null);
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    useEffect(() => {
        const handleInnerClickOutside = (event) => {
            if (!activeDropdown) return;
            const selectors = popupRef.current?.querySelector(`.${styles.headerSelectors}`);
            if (selectors && !selectors.contains(event.target)) {
                setActiveDropdown(null);
            }
        };

        if (activeDropdown) {
            document.addEventListener('mousedown', handleInnerClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleInnerClickOutside);
    }, [activeDropdown]);

    const daysInMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1).getDay();

    const handlePrevMonth = (e) => {
        e.stopPropagation();
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    };

    const handleNextMonth = (e) => {
        e.stopPropagation();
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    };

    const handleDayClick = (day) => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth() + 1;
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        onChange(dateStr);
        setIsOpen(false);
        setActiveDropdown(null);
    };

    const handleToggle = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (!isOpen && containerRef.current && !isMobile) {
            const rect = containerRef.current.getBoundingClientRect();

            // Calculate available space in viewport
            const spaceBelow = window.innerHeight - rect.bottom;

            // Absolute viewport coordinates
            let top = rect.bottom + 5;
            let left = rect.left;

            // Flip to top if not enough space below (approx 350px needed)
            if (spaceBelow < 350 && rect.top > 350) {
                top = rect.top - 365;
            }

            // Shift left if not enough space on right
            const spaceRight = window.innerWidth - rect.left;
            if (spaceRight < 400) {
                left = window.innerWidth - 410;
            }

            setCoords({ top, left });
        }
        setIsOpen(!isOpen);
        setActiveDropdown(null);
    };

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

    const totalDays = daysInMonth(viewDate);
    const startOffset = firstDayOfMonth(viewDate);

    const cells = [];
    for (let i = 0; i < startOffset; i++) {
        cells.push(<div key={`empty-${i}`} className={`${styles.dateCell} ${styles.empty}`}></div>);
    }
    for (let day = 1; day <= totalDays; day++) {
        const currentYear = viewDate.getFullYear();
        const currentMonth = viewDate.getMonth() + 1;
        const currentDateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isSelected = value === currentDateStr;
        cells.push(
            <div
                key={day}
                className={`${styles.dateCell} ${isSelected ? styles.selected : ''}`}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDayClick(day);
                }}
            >
                {day}
            </div>
        );
    }

    const handleMonthChange = (monthIndex) => {
        setViewDate(new Date(viewDate.getFullYear(), monthIndex, 1));
        setActiveDropdown(null);
    };

    const handleYearChange = (year) => {
        setViewDate(new Date(year, viewDate.getMonth(), 1));
        setActiveDropdown(null);
    };

    useEffect(() => {
        if (activeDropdown === 'year' && yearListRef.current) {
            const activeItem = yearListRef.current.querySelector(`.${styles.active}`);
            if (activeItem) {
                activeItem.scrollIntoView({ block: 'center', behavior: 'instant' });
            }
        }
    }, [activeDropdown]);

    const years = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const startYear = currentYear - 100;
        const yearsArray = [];
        for (let y = currentYear; y >= startYear; y--) {
            yearsArray.push(y);
        }
        return yearsArray;
    }, []);

    const renderPopupContent = () => (
        <CardAnimator
            type="fabricCard"
            active={isOpen}
            className={styles.datePickerPopup}
            maxRadius={20}
            style={{
                width: '100%',
                padding: '1.25rem'
            }}
        >
            <div className={styles.dateHeader}>
                <button onClick={handlePrevMonth} className={styles.iconBtn}><ChevronLeft size={16} /></button>
                <div className={styles.headerSelectors}>
                    {/* Month Selector */}
                    <div className={styles.selectorWrapper}>
                        <button
                            className={styles.headerSelect}
                            onClick={() => setActiveDropdown(activeDropdown === 'month' ? null : 'month')}
                        >
                            {monthNames[viewDate.getMonth()]}
                            <ChevronDown size={14} style={{ opacity: 0.6 }} />
                        </button>
                        <AnimatePresence>
                            {activeDropdown === 'month' && (
                                <motion.div
                                    className={styles.customDropdown}
                                    initial={{ opacity: 0, scale: 0.9, y: -10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                >
                                    <CardAnimator type="fabricCard" active={true} style={{ padding: '0.25rem' }}>
                                        <div className={styles.dropdownList}>
                                            {monthNames.map((name, i) => (
                                                <button
                                                    key={name}
                                                    className={`${styles.dropdownItem} ${viewDate.getMonth() === i ? styles.active : ''}`}
                                                    onClick={() => handleMonthChange(i)}
                                                >
                                                    {name}
                                                </button>
                                            ))}
                                        </div>
                                    </CardAnimator>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Year Selector */}
                    <div className={styles.selectorWrapper}>
                        <button
                            className={styles.headerSelect}
                            onClick={() => setActiveDropdown(activeDropdown === 'year' ? null : 'year')}
                        >
                            {viewDate.getFullYear()}
                            <ChevronDown size={14} style={{ opacity: 0.6 }} />
                        </button>
                        <AnimatePresence>
                            {activeDropdown === 'year' && (
                                <motion.div
                                    className={styles.customDropdown}
                                    initial={{ opacity: 0, scale: 0.9, y: -10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                >
                                    <CardAnimator type="fabricCard" active={true} style={{ padding: '0.25rem' }}>
                                        <div className={styles.dropdownList} ref={yearListRef}>
                                            {years.map(y => (
                                                <button
                                                    key={y}
                                                    className={`${styles.dropdownItem} ${viewDate.getFullYear() === y ? styles.active : ''}`}
                                                    onClick={() => handleYearChange(y)}
                                                >
                                                    {y}
                                                </button>
                                            ))}
                                        </div>
                                    </CardAnimator>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
                <button onClick={handleNextMonth} className={styles.iconBtn}><ChevronRight size={16} /></button>
            </div>
            <div className={styles.dateGrid}>
                {dayNames.map(d => <div key={d} className={styles.dayName}>{d}</div>)}
                {cells}
            </div>
        </CardAnimator>
    );

    return (
        <div
            className={styles.datePickerContainer}
            ref={containerRef}
            style={{ pointerEvents: 'auto' }}
        >
            <div
                className={triggerClassName || styles.customSelectTrigger}
                onClick={handleToggle}
                style={{ ...style, cursor: 'pointer', pointerEvents: 'auto' }}
            >
                {value || 'Select Date'}
                {!triggerClassName && <Calendar size={16} color="var(--text-secondary)" />}
            </div>
            {isOpen && createPortal(
                isMobile ? (
                    <div
                        className={styles.mobileModalOverlay}
                        style={{ zIndex: 2000000, pointerEvents: 'auto' }}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsOpen(false);
                        }}
                    >
                        <div
                            className={styles.mobileModalContent}
                            onClick={(e) => e.stopPropagation()}
                            style={{ background: 'var(--neu-bg)' }}
                            ref={popupRef}
                        >
                            {renderPopupContent()}
                        </div>
                    </div>
                ) : useModalOnDesktop ? (
                    <div
                        className={`${styles.mobileModalOverlay} ${styles.centered}`}
                        style={{ zIndex: 2000000, pointerEvents: 'auto' }}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsOpen(false);
                        }}
                    >
                        <div
                            style={{ width: '350px', pointerEvents: 'auto' }}
                            onClick={(e) => e.stopPropagation()}
                            ref={popupRef}
                        >
                            {renderPopupContent()}
                        </div>
                    </div>
                ) : (
                    <div
                        className={styles.desktopDropdownWrapper}
                        ref={popupRef}
                        style={{
                            position: 'fixed',
                            top: `${coords.top}px`,
                            left: `${coords.left}px`,
                            width: '350px',
                            zIndex: 2000000,
                            pointerEvents: 'auto'
                        }}
                    >
                        {renderPopupContent()}
                    </div>
                ),
                document.body
            )}
        </div>
    );
};

export default CustomDatePicker;
