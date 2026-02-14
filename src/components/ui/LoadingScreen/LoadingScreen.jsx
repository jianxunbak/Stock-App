import React from 'react';
import styles from './LoadingScreen.module.css';

const LoadingScreen = ({ fullScreen = true, message = null }) => {
    return (
        <div className={`${styles.container} ${fullScreen ? styles.fullScreen : ''}`}>
            <div className={styles.loaderContent}>
                <div className={styles.spinner}></div>
                {message && <p className={styles.message}>{message}</p>}
            </div>
        </div>
    );
};

export default LoadingScreen;
