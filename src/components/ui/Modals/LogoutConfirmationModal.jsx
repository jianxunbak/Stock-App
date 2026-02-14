import React from 'react';
import Window from '../Window/Window';
import Button from '../Button/Button';
import { X, Check } from 'lucide-react';

const LogoutConfirmationModal = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;

    return (
        <Window
            isOpen={isOpen}
            onClose={onClose}
            title="Sign Out"
            width="400px"
            height="auto"
            headerAlign="start"
            hideCloseButton={true}
            controls={
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <Button
                        variant="icon"
                        onClick={onClose}
                        title="Cancel"
                        style={{ color: 'var(--neu-text-secondary)' }}
                    >
                        <X size={20} />
                    </Button>
                    <Button
                        variant="icon"
                        onClick={() => {
                            onClose();
                            onConfirm();
                        }}
                        title="Sign Out"
                        style={{ color: 'var(--neu-danger)' }}
                    >
                        <Check size={20} />
                    </Button>
                </div>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <p style={{ color: 'var(--neu-text-secondary)', lineHeight: '1.5' }}>
                    Are you sure you want to sign out?
                </p>
            </div>
        </Window>
    );
};

export default LogoutConfirmationModal;
