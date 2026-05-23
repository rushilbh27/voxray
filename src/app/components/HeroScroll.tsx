'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export interface Phase {
  /** Scroll progress 0–1 where this phase is active */
  start: number;
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
  /** Scroll progress (0–1) where the climax / explosion effect fires */
  explosionAt?: number;
}

// SVG feTurbulence noise — generates film-grain texture in pure CSS
const GRAIN_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.80' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='256' height='256' filter='url(%23g)'/%3E%3C/svg%3E\")";

export function HeroScroll({
  src,
  scrollHeight = '400vh',
  phases,
  explosionAt,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef     = useRef<HTMLVideoElement>(null);
  const phaseRefs    = useRef<Array<HTMLDivElement | null>>([]);
  const fogRef       = useRef<HTMLDivElement>(null);
  const burstRef     = useRef<HTMLDivElement>(null);
  const scrollCueRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const container = containerRef.current;
    const video     = videoRef.current;
    if (!container || !video) return;

    const reduced    = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const BURST_HALF = 0.055;

    // All per-frame logic in one function so we can call it at p=0 immediately
    // (ScrollTrigger.onUpdate does NOT fire until the user first scrolls)
    const applyProgress = (progress: number) => {
      // ── Video scrub ──────────────────────────────────────────────────
      if (video.readyState >= 1 && video.duration > 0) {
        video.currentTime = Math.min(progress, 0.9999) * video.duration;
      }

      // ── Scroll cue fades once user starts scrolling ──────────────────
      if (scrollCueRef.current) {
        scrollCueRef.current.style.opacity =
          Math.max(0, 1 - progress / 0.08).toFixed(3);
      }

      // ── Phase text overlays ──────────────────────────────────────────
      phases.forEach((phase, i) => {
        const el = phaseRefs.current[i];
        if (!el) return;

        let alpha = 0;

        if (progress >= phase.start && progress <= phase.end) {
          const span  = phase.end - phase.start;
          const fadeW = Math.min(span * 0.22, 0.09);
          const local = progress - phase.start;

          // Skip fade-in when phase starts at 0 (immediately visible on load)
          const applyFadeIn = phase.start > 0.005 && local < fadeW;

          alpha = applyFadeIn
            ? local / fadeW
            : local > span - fadeW
            ? (span - local) / fadeW
            : 1;

          alpha = Math.max(0, Math.min(1, alpha));
        }

        el.style.opacity   = alpha.toFixed(3);
        el.style.transform = `translateY(${((1 - alpha) * 20).toFixed(1)}px)`;
      });

      // ── Explosion effects (skip if reduced motion or not configured) ──
      if (reduced || explosionAt == null) return;

      // Ambient fog — builds gradually as hands approach the touch point
      if (fogRef.current) {
        const fogStart = Math.max(0, explosionAt - 0.40);
        const fogPeak  = explosionAt - 0.015;
        let fogAlpha = 0;

        if (progress >= fogStart && progress < fogPeak) {
          const t = (progress - fogStart) / (fogPeak - fogStart);
          fogAlpha = Math.pow(t, 1.6) * 0.22; // power ease — imperceptible early
        } else if (progress >= fogPeak) {
          fogAlpha = Math.max(0, 0.22 - (progress - fogPeak) * 1.8); // fast collapse
        }

        fogRef.current.style.opacity = fogAlpha.toFixed(3);
      }

      // Explosion burst — sharp bell curve centred on explosion point
      if (burstRef.current) {
        const dist  = Math.abs(progress - explosionAt);
        const burst = dist < BURST_HALF
          ? Math.pow(Math.max(0, 1 - dist / BURST_HALF), 2.0)
          : 0;
        burstRef.current.style.opacity = burst.toFixed(3);
      }
    };

    const st = ScrollTrigger.create({
      trigger: container,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0, // frame-perfect, no smoothing lag
      onUpdate: ({ progress }) => applyProgress(progress),
    });

    // Seed initial state at progress=0 immediately (before first scroll event)
    applyProgress(0);

    return () => st.kill();
  }, [phases, explosionAt]);

  return (
    <div ref={containerRef} style={{ height: scrollHeight }} className="relative">

      {/* ── Sticky full-viewport container ────────────────────────────── */}
      <div
        className="sticky top-0 overflow-hidden bg-canvas"
        style={{ height: '100dvh' }}
      >
        {/* Video */}
        <video
          ref={videoRef}
          src={src}
          playsInline
          muted
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Film grain — cinematic SVG noise texture */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: GRAIN_URI,
            backgroundSize:  '256px 256px',
            opacity:         0.038,
            mixBlendMode:    'overlay',
          }}
        />

        {/* Left + top + bottom vignette */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: [
              'linear-gradient(108deg, oklch(14% 0.012 55 / 0.82) 0%, oklch(14% 0.012 55 / 0.28) 44%, transparent 68%)',
              'linear-gradient(to bottom, oklch(14% 0.012 55 / 0.38) 0%, transparent 16%)',
              'linear-gradient(to top, oklch(14% 0.012 55 / 1) 0%, transparent 22%)',
            ].join(', '),
          }}
        />

        {/* Ambient fog — screen-blend warm glow that builds as hands approach */}
        <div
          ref={fogRef}
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-0"
          style={{
            background:   'radial-gradient(ellipse 85% 70% at 60% 50%, oklch(74% 0.175 55 / 0.90) 0%, oklch(68% 0.230 42 / 0.35) 38%, transparent 68%)',
            mixBlendMode: 'screen',
          }}
        />

        {/* Explosion burst — fires at the touch moment */}
        <div
          ref={burstRef}
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-0"
          style={{
            background: [
              'radial-gradient(ellipse 45% 35% at 60% 50%, oklch(97% 0.015 75 / 1) 0%, oklch(90% 0.120 65 / 0.85) 18%, transparent 45%)',
              'radial-gradient(ellipse 90% 72% at 60% 50%, oklch(80% 0.185 55 / 0.55) 0%, oklch(74% 0.175 45 / 0.25) 42%, transparent 62%)',
              'radial-gradient(ellipse 140% 110% at 60% 50%, oklch(68% 0.230 42 / 0.18) 0%, transparent 58%)',
            ].join(', '),
            mixBlendMode: 'screen',
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
            <div className="max-w-[33rem]">
              {phase.eyebrow && (
                <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.26em] text-accent">
                  {phase.eyebrow}
                </p>
              )}
              <h2
                className="font-black text-ink leading-[0.93] tracking-[-0.03em] whitespace-pre-line"
                style={{ fontSize: 'clamp(2.6rem, 6.5vw, 5.5rem)' }}
              >
                {phase.headline}
              </h2>
              {phase.body && (
                <p className="mt-5 text-[15px] text-ink-2 leading-relaxed max-w-[42ch]">
                  {phase.body}
                </p>
              )}
              {phase.cta && (
                <div className="mt-8">
                  <Link
                    href={phase.cta.href}
                    className="inline-flex items-center gap-2.5 px-5 py-2.5 bg-accent hover:bg-accent-hover text-canvas text-sm font-semibold rounded-lg transition-colors"
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
          ref={scrollCueRef}
          aria-hidden
          className="absolute bottom-7 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none select-none"
        >
          <span className="text-[9px] font-semibold uppercase tracking-[0.32em] text-ink-3 opacity-55">
            scroll
          </span>
          <div className="w-px h-5 bg-ink-3 opacity-30" />
        </div>

      </div>
    </div>
  );
}
