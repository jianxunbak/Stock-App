import React, { useState, useRef } from 'react';
import { ButtonAnimator } from '../Animator';
import './ButtonShared.css';

/**
 * Button - Tuned 'Medium-Fast' Recovery.
 * Syncing the return physics with the search bar for a unified laboratory feel.
 */
const Button = ({ children, onClick, className = '', ...props }) => {
    const [isPressed, setIsPressed] = useState(false);
    const pressTimerRef = useRef(null);

    const handlePressStart = () => {
        setIsPressed(true);
        if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    };

    const handlePressEnd = () => {
        // Use a quicker release to match the new physics
        pressTimerRef.current = setTimeout(() => {
            setIsPressed(false);
        }, 150); // Reduced delay for snappier feel
    };

    return (
        <ButtonAnimator
            as="button"
            type="button"
            active={isPressed}
            className={`neu-btn-base ${className} ${isPressed ? 'pressed-latch' : ''}`}
            onClick={onClick}
            onMouseDown={handlePressStart}
            onMouseUp={handlePressEnd}
            onMouseLeave={handlePressEnd}
            onTouchStart={handlePressStart}
            onTouchEnd={handlePressEnd}
            data-variant={props.variant} // Ensure variant is passed to DOM for CSS
            {...props}
        >
            <ButtonAnimator
                type="text"
                active={isPressed}
                as="span"
                className="neu-text-base"
            >
                {children}
            </ButtonAnimator>
        </ButtonAnimator>
    );
};

export default Button;
