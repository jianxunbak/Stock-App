import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import styles from './CardToggleButton.module.css';

const CardToggleButton = ({ isOpen, onClick, title, ...props }) => {
    return (
        <button
            className={styles.toggleButton}
            onClick={onClick}
            title={title || (isOpen ? "Collapse" : "Expand")}
            {...props}
        >
            {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
    );
};

export default CardToggleButton;
