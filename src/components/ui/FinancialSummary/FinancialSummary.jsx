import React from 'react';
import styles from './FinancialSummary.module.css';

const FinancialSummary = ({ children, className, ...props }) => {
    return (
        <div className={`${styles.container} ${className || ''}`} {...props}>
            {children}
        </div>
    );
};

export default FinancialSummary;
