'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface Props {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}

export function CountUp({
  value,
  suffix = '',
  prefix = '',
  decimals = 0,
  duration = 1.1,
  className,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const stateRef = useRef({ n: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const tween = gsap.to(stateRef.current, {
      n: value,
      duration,
      ease: 'power3.out',
      onUpdate: () => {
        const n = stateRef.current.n;
        const formatted = decimals > 0
          ? n.toFixed(decimals)
          : Math.round(n).toLocaleString();
        el.textContent = `${prefix}${formatted}${suffix}`;
      },
    });
    return () => { tween.kill(); };
  }, [value, duration, prefix, suffix, decimals]);

  const initial = decimals > 0 ? (0).toFixed(decimals) : '0';
  return <span ref={ref} className={className}>{`${prefix}${initial}${suffix}`}</span>;
}
