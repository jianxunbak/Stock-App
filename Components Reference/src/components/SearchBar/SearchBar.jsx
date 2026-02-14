import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { Search, X, ArrowRight } from 'lucide-react';
import { SearchBarAnimator } from '../Animator';
import './SearchBar.css';

/**
 * SearchBar Component
 * An expandable search bar that starts as a button and expands into an input field.
 */
const SearchBar = ({
    placeholder = "Search...",
    onSearch,
    onEnter,
    className = "",
    expandedWidth = "250px",
    collapsedWidth = "2rem",
    style = {}
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isPressed, setIsPressed] = useState(false);
    const [searchValue, setSearchValue] = useState("");
    const [showContent, setShowContent] = useState(false);
    const inputRef = useRef(null);
    const containerRef = useRef(null);
    const pressTimerRef = useRef(null);

    useEffect(() => {
        if (isExpanded) {
            const timer = setTimeout(() => setShowContent(true), 250);
            return () => clearTimeout(timer);
        } else {
            setShowContent(false);
        }
    }, [isExpanded]);

    const handlePressStart = (e) => {
        if (!isExpanded) {
            setIsPressed(true);
            if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
        }
    };

    const handlePressEnd = (e) => {
        if (!isExpanded && isPressed) {
            setIsExpanded(true);
            pressTimerRef.current = setTimeout(() => {
                setIsPressed(false);
            }, 150);
        } else if (!isExpanded) {
            setIsPressed(false);
        }
    };

    const handleClear = (e) => {
        e.stopPropagation();
        setSearchValue("");
        if (onSearch) onSearch("");
        inputRef.current?.focus();
    };

    const handleClickOutside = (event) => {
        if (containerRef.current && !containerRef.current.contains(event.target)) {
            if (searchValue === "") {
                setIsExpanded(false);
            }
        }
    };

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [searchValue]);

    useEffect(() => {
        if (showContent) {
            inputRef.current?.focus();
        }
    }, [showContent]);

    const handleInputChange = (e) => {
        const value = e.target.value;
        setSearchValue(value);
        if (onSearch) onSearch(value);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && onEnter) {
            onEnter(searchValue);
            if (searchValue === "") {
                setIsExpanded(false);
            }
        }
    };

    const triggerControls = useAnimation();
    const prevExpanded = useRef(isExpanded);

    useEffect(() => {
        if (prevExpanded.current && !isExpanded) {
            triggerControls.start("bounce");
        }
        prevExpanded.current = isExpanded;
    }, [isExpanded, triggerControls]);

    return (
        <motion.div
            animate={triggerControls}
            variants={{
                bounce: {
                    scaleX: [1, 1.12, 0.92, 1.04, 1],
                    scaleY: [1, 0.92, 1.08, 0.96, 1],
                    transition: {
                        delay: 0.2, // Start bouncing as it finishes collapsing
                        duration: 0.5,
                        ease: "easeInOut"
                    }
                }
            }}
            style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                ...style
            }}
            className={className}
        >
            <SearchBarAnimator
                type="fabricSearchBar"
                active={isExpanded}
                ref={containerRef}
                className={`search-bar-container ${isExpanded ? 'active expanded' : ''} ${isPressed ? 'pressed-latch active' : 'hover-pop'}`}
                onMouseDown={handlePressStart}
                onMouseUp={handlePressEnd}
                onMouseLeave={() => setIsPressed(false)}
                onTouchStart={handlePressStart}
                onTouchEnd={handlePressEnd}
                animate={{
                    width: isExpanded ? expandedWidth : collapsedWidth
                }}
                initial={false}
                style={{
                    width: isExpanded ? expandedWidth : collapsedWidth,
                }}
                transition={{ type: "spring", stiffness: 200, damping: 30 }}
            >
                <motion.div
                    layout="position"
                    className="search-bar-icon-wrapper"
                >
                    <Search size={18} />
                </motion.div>

                <AnimatePresence>
                    {showContent && (
                        <motion.div
                            layout="position"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{ display: 'flex', flex: 1, alignItems: 'center', height: '100%', overflow: 'hidden' }}
                            transition={{ duration: 0.2 }}
                        >
                            <input
                                ref={inputRef}
                                type="text"
                                className="search-bar-input"
                                placeholder={placeholder}
                                value={searchValue}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                            />
                            <div className="search-bar-actions">
                                <AnimatePresence>
                                    {searchValue.length > 0 && (
                                        <motion.button
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.8 }}
                                            type="button"
                                            className="tag-remove-btn"
                                            onClick={handleClear}
                                            title="Clear search"
                                        >
                                            <X size={14} />
                                        </motion.button>
                                    )}
                                </AnimatePresence>
                                <button
                                    type="button"
                                    className={`search-submit-btn ${searchValue ? 'has-text' : ''}`}
                                    onClick={() => onEnter?.(searchValue)}
                                    title="Search"
                                >
                                    <ArrowRight size={14} />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </SearchBarAnimator>
        </motion.div>
    );
};

export default SearchBar;
