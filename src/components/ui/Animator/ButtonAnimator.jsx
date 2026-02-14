import { motion, AnimatePresence } from 'framer-motion';
import React from 'react';

// --- 1. Button Physics ---
const buttonTransition = (isPressed) => ({
    type: "spring",
    stiffness: isPressed ? 80 : 180,
    damping: isPressed ? 25 : 18,
    mass: isPressed ? 1.2 : 1
});

// --- 2. Button Container Variants ---
const buttonVariants = {
    initial: { scale: 1 },
    hover: { scale: 1.03 },
    pressed: { scale: 0.98 }
};

// --- 2. Text Variants ---
const textVariants = {
    initial: { scaleX: 1, scaleY: 1, y: 0, opacity: 1, letterSpacing: "0em" },
    hover: { scale: 1.02, y: -1 },
    pressed: { scaleX: 1.15, scaleY: 0.98, y: 2, opacity: 0.95 }
};

// --- 6. Expansion Item Variants ---
const expansionItemVariants = {
    hidden: { opacity: 0, height: 0, marginTop: 0, marginBottom: 0, scale: 0.95 },
    visible: { opacity: 1, height: 'auto', marginTop: 0, marginBottom: 0, scale: 1 },
    exit: { opacity: 0, height: 0, marginTop: 0, marginBottom: 0, scale: 0.95 }
};

const ButtonAnimator = ({
    type = 'button',
    active = false,
    children,
    as = 'div',
    className = '',
    ...props
}) => {
    let variants = {};
    let transition = {};
    let initial = "initial";
    let animate = "initial";
    let exit = undefined;

    // --- 1. Standard Button ---
    if (type === 'button') {
        variants = buttonVariants;
        transition = buttonTransition(active);
        animate = active ? "pressed" : "initial";
    }
    // --- 2. Button Text ---
    else if (type === 'text') {
        variants = textVariants;
        transition = { duration: 0.1 };
        animate = active ? "pressed" : "initial";
    }

    // --- 5. Expansion Item ---
    else if (type === 'expansionItem') {
        variants = expansionItemVariants;
        transition = { duration: 0.3 }; // Or use specific transition if needed
        animate = "visible"; // Items are always visible once mounted if using exit prop
        initial = "hidden";
        exit = "exit";
    }

    const Component = motion[as || 'div'];

    return (
        <Component
            className={className}
            variants={variants}
            initial={initial}
            animate={animate}
            exit={exit}
            whileHover={type === 'button' ? "hover" : undefined}
            whileTap={type === 'button' ? "pressed" : undefined}
            transition={transition}
            {...props}
        >
            {children}
        </Component>
    );
};

export default ButtonAnimator;
