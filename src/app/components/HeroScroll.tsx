'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export interface Phase {
  start: number;  // 0–1 scroll progress
  end: number;
  eyebrow?: string;
  headline: string;
  body?: string;
  cta?: { label: string; href: string };
}

interface Props {
  src: string;
  scrollHeight?: string;
  phases: Phase[];
}

// SVG feTurbulence noise — film-grain texture, pure CSS
const GRAIN_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='256' height='256' filter='url(%23g)'/%3E%3C/svg%3E\")";

export function HeroScroll({ src, scrollHeight = '400vh', phases }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef     = useRef<HTMLVideoElement>(null);
  const phaseRefs    = useRef<Array<HTMLDivElement | null>>([]);
  const cueRef       = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const container = containerRef.current;
    const video     = videoRef.current;
    if (!container || !video) return;

    const applyProgress = (progress: number) => {
      // Video scrub — frame-perfect
      if (video.readyState >= 1 && video.duration > 0) {
        video.currentTime = Math.min(progress, 0.9999) * video.duration;
      }

      // Scroll cue disappears once user starts scrolling
      if (cueRef.current) {
        cueRef.current.style.opacity = Math.max(0, 1 - progress / 0.06).toFixed(3);
      }

      // Phase text overlays
      phases.forEach((phase, i) => {
        const el = phaseRefs.current[i];
        if (!el) return;

        let alpha = 0;

        if (progress >= phase.start && progress <= phase.end) {
          const span  = phase.end - phase.start;
          const fadeW = Math.min(span * 0.20, 0.08);
          const local = progress - phase.start;

          // Phase 0 (start=0): skip fade-in, show immediately
          const doFadeIn = phase.start > 0.004 && local < fadeW;

          alpha = doFadeIn
            ? local / fadeW
            : local > span - fadeW
            ? (span - local) / fadeW
            : 1;

          alpha = Math.max(0, Math.min(1, alpha));
        }

        el.style.opacity   = alpha.toFixed(3);
        el.style.transform = `translateY(${((1 - alpha) * 18).toFixed(1)}px)`;
      });
    };

    const st = ScrollTrigger.create({
      trigger: container,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0,
      onUpdate: ({ progress }) => applyProgress(progress),
    });

    // Seed at progress=0 on mount — onUpdate won't fire until first scroll
    applyProgress(0);

    return () => st.kill();
  }, [phases]);

  return (
    <div ref={containerRef} style={{ height: scrollHeight }} className="relative">
      <div className="sticky top-0 overflow-hidden bg-canvas" style={{ height: '100dvh' }}>

        {/* Video */}
        <video
          ref={videoRef}
          src={src}
          playsInline
          muted
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Film grain */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: GRAIN_URI,
            backgroundSize: '256px 256px',
            opacity: 0.035,
            mixBlendMode: 'overlay',
          }}
        />

        {/* Vignette: left text shield + top fade + bottom seal */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: [
              'linear-gradient(110deg, oklch(14% 0.012 55 / 0.88) 0%, oklch(14% 0.012 55 / 0.40) 40%, transparent 65%)',
              'linear-gradient(to bottom, oklch(14% 0.012 55 / 0.50) 0%, transparent 18%)',
              'linear-gradient(to top,   oklch(14% 0.012 55 / 1.00) 0%, transparent 20%)',
            ].join(', '),
          }}
        />

        {/* Text phases */}
        {phases.map((phase, i) => (
          <div
            key={i}
            ref={(el) => { phaseRefs.current[i] = el; }}
            className="absolute inset-0 flex items-center px-10 md:px-20 lg:px-28 opacity-0"
            style={{ willChange: 'opacity, transform' }}
          >
            <div className="max-w-[32rem]">
              {phase.eyebrow && (
                <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.28em] text-accent">
                  {phase.eyebrow}
                </p>
              )}
              <h2
                className="font-black text-ink leading-[0.92] tracking-[-0.03em] whitespace-pre-line"
                style={{ fontSize: 'clamp(2.8rem, 6.8vw, 5.8rem)' }}
              >
                {phase.headline}
              </h2>
              {phase.body && (
                <p className="mt-6 text-[15px] text-ink-2 leading-relaxed max-w-[40ch]">
                  {phase.body}
                </p>
              )}
              {phase.cta && (
                <div className="mt-9">
                  <Link
                    href={phase.cta.href}
                    className="inline-flex items-center gap-2.5 px-6 py-3 bg-accent hover:bg-accent-hover text-canvas text-sm font-bold rounded-lg transition-colors"
                  >
                    {phase.cta.label}
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Scroll cue */}
        <div
          ref={cueRef}
          aria-hidden
          className="absolute bottom-7 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none select-none"
        >
          <span className="text-[9px] font-bold uppercase tracking-[0.32em] text-ink-3 opacity-50">
            scroll
          </span>
          <div className="w-px h-5 bg-ink-3 opacity-25" />
        </div>

      </div>
    </div>
  );
}
