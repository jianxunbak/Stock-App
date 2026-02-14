import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import Button from '../Button/Button';
import styles from './ThemeToggle.module.css';

const ThemeToggle = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <Button
            variant="icon"
            onClick={toggleTheme}
            aria-label="Toggle Theme"
            className={styles.toggleButton}
        >
            {theme === 'dark' ? (
                <Sun size={20} className={styles.icon} />
            ) : (
                <Moon size={20} className={styles.icon} />
            )}
        </Button>
    );
};

export default ThemeToggle;
