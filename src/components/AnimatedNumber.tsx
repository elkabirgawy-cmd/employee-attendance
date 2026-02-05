import React, { useEffect, useMemo, useRef, useState } from "react";

type Props = {
    value: number;
    durationMs?: number; // default 650
    decimals?: number; // default 0
    className?: string;
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export default function AnimatedNumber({
    value,
    durationMs = 650,
    decimals = 0,
    className,
}: Props) {
    const [display, setDisplay] = useState<number>(value);
    const fromRef = useRef<number>(value);
    const rafRef = useRef<number | null>(null);

    const [changed, setChanged] = useState(false);

    useEffect(() => {
        setChanged(true);
        const t = setTimeout(() => setChanged(false), 300);
        return () => clearTimeout(t);
    }, [value]);

    const fmt = useMemo(() => {
        return new Intl.NumberFormat("en-US", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });
    }, [decimals]);

    useEffect(() => {
        const from = fromRef.current;
        const to = value;

        if (from === to) return;

        const start = performance.now();
        const dur = Math.max(250, durationMs);

        if (rafRef.current) cancelAnimationFrame(rafRef.current);

        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / dur);
            const eased = easeOutCubic(t);
            const next = from + (to - from) * eased;
            setDisplay(next);
            if (t < 1) rafRef.current = requestAnimationFrame(tick);
            else {
                fromRef.current = to;
                setDisplay(to);
            }
        };

        rafRef.current = requestAnimationFrame(tick);

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        };
    }, [value, durationMs]);

    return (
        <span className={`${className} transition-all duration-300 transform inline-block ${changed ? 'scale-110 opacity-70' : 'scale-100 opacity-100'}`}>
            {fmt.format(Number(display.toFixed(decimals)))}
        </span>
    );
}
