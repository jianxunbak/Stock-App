import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook for resizable table columns.
 * 
 * @param {Object} initialWidths - Map of column keys to initial width values (px).
 * @param {number} minWidth - Minimum column width in pixels (default: 50).
 * 
 * @returns {Object} {
 *   columnWidths: Object, // Map of current widths
 *   handleResizeStart: Function, // Handler to start resizing (mouseDown)
 *   isResizing: boolean // Active state
 * }
 */
export const useColumnResize = (initialWidths = {}, minWidth = 50) => {
    const [columnWidths, setColumnWidths] = useState(initialWidths);
    const [isResizing, setIsResizing] = useState(false);

    // Refs to track state without triggering re-renders during mouse move
    const resizeState = useRef({
        activeFunc: null,
        startX: 0,
        startWidth: 0,
        columnKey: null
    });

    // Update widths if initialWidths changes (important for dynamic columns)
    useEffect(() => {
        setColumnWidths(prev => {
            // Only update if there are new keys or if prev is empty
            const hasNewKeys = Object.keys(initialWidths).some(key => !(key in prev));
            if (hasNewKeys || Object.keys(prev).length === 0) {
                return { ...initialWidths, ...prev };
            }
            return prev;
        });
    }, [initialWidths]);

    const handleResizeStart = useCallback((e, columnKey) => {
        // Prevent default text selection/scroll
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();

        const currentWidth = columnWidths[columnKey] || 100; // Default fallback
        const pageX = e.type.includes('touch') ? e.touches[0].pageX : e.pageX;

        resizeState.current = {
            startX: pageX,
            startWidth: currentWidth,
            columnKey: columnKey
        };

        setIsResizing(true);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        // Prevent scrolling on touch devices while resizing
        document.body.style.touchAction = 'none';

        if (e.type.includes('touch')) {
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd);
        } else {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }
    }, [columnWidths]);

    const handleMouseMove = useCallback((e) => {
        if (!resizeState.current.columnKey) return;

        const { startX, startWidth, columnKey } = resizeState.current;
        const diff = e.pageX - startX;
        const newWidth = Math.max(minWidth, startWidth + diff);

        if (resizeState.current.activeFunc) {
            cancelAnimationFrame(resizeState.current.activeFunc);
        }

        resizeState.current.activeFunc = requestAnimationFrame(() => {
            setColumnWidths(prev => ({
                ...prev,
                [columnKey]: newWidth
            }));
        });
    }, [minWidth]);

    const handleMouseUp = useCallback(() => {
        setIsResizing(false);
        resizeState.current = { startX: 0, startWidth: 0, columnKey: null };
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.body.style.touchAction = '';

        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);

    const handleTouchMove = useCallback((e) => {
        if (!resizeState.current.columnKey) return;

        // Critical: Prevent scrolling
        if (e.cancelable) e.preventDefault();

        const { startX, startWidth, columnKey } = resizeState.current;
        const diff = e.touches[0].pageX - startX;
        const newWidth = Math.max(minWidth, startWidth + diff);

        if (resizeState.current.activeFunc) {
            cancelAnimationFrame(resizeState.current.activeFunc);
        }

        resizeState.current.activeFunc = requestAnimationFrame(() => {
            setColumnWidths(prev => ({
                ...prev,
                [columnKey]: newWidth
            }));
        });
    }, [minWidth]);

    const handleTouchEnd = useCallback(() => {
        setIsResizing(false);
        resizeState.current = { startX: 0, startWidth: 0, columnKey: null };
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.body.style.touchAction = '';

        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
    }, [handleTouchMove]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

    return { columnWidths, handleResizeStart, isResizing, setColumnWidths };
};
