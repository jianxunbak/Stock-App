import React from 'react';
import './StockSummary.css';

const StockSummary = ({
    children,
    visibleSectionsCount = 1,
    className = "",
    style = {},
    ...props
}) => {
    // Determine if we should use the stacked grid layout
    const isStacked = visibleSectionsCount > 1;

    return (
        <div
            className={`stock-summary-container ${isStacked ? 'stacked' : ''} ${className}`}
            style={style}
            {...props}
        >
            {children}
        </div>
    );
};

export default StockSummary;
