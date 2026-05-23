'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface Props {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  glow?: boolean;
}

export function Sparkline({ data, width = 120, height = 32, color, glow = true }: Props) {
  const pathRef = useRef<SVGPathElement>(null);
  const fillRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (!pathRef.current) return;
    const len = pathRef.current.getTotalLength();
    gsap.fromTo(
      pathRef.current,
      { strokeDasharray: len, strokeDashoffset: len },
      { strokeDashoffset: 0, duration: 1.4, ease: 'expo.out' }
    );
    if (fillRef.current) {
      gsap.fromTo(fillRef.current, { opacity: 0 }, { opacity: 0.6, duration: 1.6, ease: 'power2.out', delay: 0.2 });
    }
  }, [data]);

  if (data.length < 2) {
    return <div className="h-8 text-[10px] text-ink-3 italic">no trend</div>;
  }

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });

  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  const stroke = color || 'var(--color-accent)';
  const id = `spark-grad-${data.join('-').slice(0, 12)}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path ref={fillRef} d={area} fill={`url(#${id})`} />
      <path
        ref={pathRef}
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={glow ? { filter: `drop-shadow(0 0 4px ${stroke})` } : undefined}
      />
    </svg>
  );
}
