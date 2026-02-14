import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import Button from '../Button/Button';
import styles from './ScrollToTop.module.css';

const ScrollToTop = () => {
    const [isVisible, setIsVisible] = useState(false);

    const toggleVisibility = () => {
        if (window.scrollY > 300) {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    };

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    useEffect(() => {
        window.addEventListener('scroll', toggleVisibility);
        return () => {
            window.removeEventListener('scroll', toggleVisibility);
        };
    }, []);

    return (
        <div className={`${styles.container} ${isVisible ? styles.visible : ''}`}>
            <Button
                variant="icon"
                onClick={scrollToTop}
                aria-label="Scroll to top"
            >
                <ArrowUp size={24} />
            </Button>
        </div>
    );
};

export default ScrollToTop;
