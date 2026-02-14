import { useState, useEffect, useRef } from 'react';

export const useResizeObserver = () => {
    const [size, setSize] = useState({ width: 0, height: 0 });
    const ref = useRef(null);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const observer = new ResizeObserver((entries) => {
            if (!entries || entries.length === 0) return;
            const contentRect = entries[0].contentRect;
            setSize({ width: contentRect.width, height: contentRect.height });
        });

        observer.observe(element);

        return () => {
            observer.disconnect();
        };
    }, []);

    return [ref, size];
};
