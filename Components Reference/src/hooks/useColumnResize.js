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

    const handleResizeStart = useCallback((e, columnKey) => {
        // Prevent default text selection
        e.preventDefault();
        e.stopPropagation();

        const currentWidth = columnWidths[columnKey] || 100; // Default fallback

        resizeState.current = {
            startX: e.pageX,
            startWidth: currentWidth,
            columnKey: columnKey
        };

        setIsResizing(true);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [columnWidths]);

    const handleMouseMove = useCallback((e) => {
        if (!resizeState.current.columnKey) return;

        const { startX, startWidth, columnKey } = resizeState.current;
        const diff = e.pageX - startX;
        const newWidth = Math.max(minWidth, startWidth + diff);

        setColumnWidths(prev => ({
            ...prev,
            [columnKey]: newWidth
        }));
    }, [minWidth]);

    const handleMouseUp = useCallback(() => {
        setIsResizing(false);
        resizeState.current = { startX: 0, startWidth: 0, columnKey: null };
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    return { columnWidths, handleResizeStart, isResizing };
};
