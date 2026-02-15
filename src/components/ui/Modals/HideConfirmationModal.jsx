import React from 'react';
import Window from '../Window/Window';
import Button from '../Button/Button';
import { X, Check } from 'lucide-react';

const HideConfirmationModal = ({ isOpen, onClose, onConfirm, cardLabel }) => {
    if (!isOpen) return null;

    return (
        <Window
            isOpen={isOpen}
            onClose={onClose}
            title="Hide Card"
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
                            onConfirm();
                            onClose();
                        }}
                        title="Confirm Hide"
                        style={{ color: 'var(--neu-danger)' }}
                    >
                        <Check size={20} />
                    </Button>
                </div>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <p style={{ color: 'var(--neu-text-primary)', fontWeight: 500, margin: 0 }}>
                    Hide the "{cardLabel}" card?
                </p>
                <p style={{ color: 'var(--neu-text-secondary)', lineHeight: '1.5', fontSize: '0.9rem' }}>
                    This card will be removed from your view. You can turn it back on anytime in <strong>User Details &rarr; Preferences</strong> (click your profile icon in the top right).
                </p>
            </div>
        </Window>
    );
};

export default HideConfirmationModal;
