import React from 'react';
import styles from './InlineSpinner.module.css';

const InlineSpinner = ({ size = '24px', color, className = '' }) => {
    const style = {
        width: size,
        height: size,
        ...(color && { borderTopColor: color })
    };

    return (
        <div className={`${styles.spinnerWrapper} ${className}`}>
            <div className={styles.spinner} style={style} />
        </div>
    );
};

export default InlineSpinner;
