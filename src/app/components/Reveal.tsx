'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface Props {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  stagger?: number;
  selector?: string;
  className?: string;
}

export function Reveal({ children, delay = 0, y = 14, stagger, selector, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const targets = selector ? el.querySelectorAll<HTMLElement>(selector) : [el];
    const tween = gsap.fromTo(
      targets,
      { autoAlpha: 0, y },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.75,
        delay,
        stagger: stagger ?? 0,
        ease: 'expo.out',
      }
    );
    return () => { tween.kill(); };
  }, [delay, y, stagger, selector]);

  return <div ref={ref} className={className}>{children}</div>;
}
