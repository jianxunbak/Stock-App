import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import styles from './Modal.module.css';

const Modal = ({ isOpen, onClose, title, message, footer }) => {
    if (!isOpen) return null;

    return createPortal(
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h3 className={styles.title}>{title || 'Error'}</h3>
                    <button onClick={onClose} className={styles.closeButton}>
                        <X size={24} />
                    </button>
                </div>
                <div className={styles.content}>
                    {message}
                </div>
                <div className={styles.footer}>
                    {footer ? footer : (
                        <button onClick={onClose} className={styles.button}>
                            Close
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default Modal;
