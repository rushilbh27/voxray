'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export interface Phase {
  /** scroll progress 0–1 where this phase starts */
  start: number;
  /** scroll progress 0–1 where this phase ends */
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

export function HeroScroll({ src, scrollHeight = '400vh', phases }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef    = useRef<HTMLVideoElement>(null);
  const phaseRefs   = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const container = containerRef.current;
    const video     = videoRef.current;
    if (!container || !video) return;

    const st = ScrollTrigger.create({
      trigger: container,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0,                 // no smoothing — frame-perfect
      onUpdate({ progress }) {
        // ── Video scrub ──────────────────────────────────────────────────
        if (video.readyState >= 1 && video.duration > 0) {
          video.currentTime = Math.min(progress, 0.9999) * video.duration;
        }

        // ── Phase visibility ─────────────────────────────────────────────
        phases.forEach((phase, i) => {
          const el = phaseRefs.current[i];
          if (!el) return;

          let alpha = 0;

          if (progress >= phase.start && progress <= phase.end) {
            const span  = phase.end - phase.start;
            const fadeW = Math.min(span * 0.22, 0.09);
            const local = progress - phase.start;

            // Skip fade-in at scroll=0 (first phase should be immediately visible)
            const fadeIn = phase.start > 0.001 && local < fadeW;

            alpha =
              fadeIn                  ? local / fadeW
              : local > span - fadeW  ? (span - local) / fadeW
              : 1;

            alpha = Math.max(0, Math.min(1, alpha));
          }

          el.style.opacity   = alpha.toFixed(3);
          // Drift up 22px when invisible, settle to 0 when fully visible
          el.style.transform = `translateY(${((1 - alpha) * 22).toFixed(1)}px)`;
        });
      },
    });

    return () => st.kill();
  }, [phases]);

  return (
    <div ref={containerRef} style={{ height: scrollHeight }} className="relative">
      {/* ── Sticky full-viewport container ─────────────────────────── */}
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

        {/* Left-leaning gradient — keeps text legible over any video content */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: [
              'linear-gradient(108deg, oklch(14% 0.012 55 / 0.82) 0%, oklch(14% 0.012 55 / 0.35) 48%, transparent 100%)',
              'linear-gradient(to bottom, oklch(14% 0.012 55 / 0.45) 0%, transparent 18%, transparent 78%, oklch(14% 0.012 55 / 1) 100%)',
            ].join(', '),
          }}
        />

        {/* ── Text phases ────────────────────────────────────────────── */}
        {phases.map((phase, i) => (
          <div
            key={i}
            ref={(el) => { phaseRefs.current[i] = el; }}
            className="absolute inset-0 flex items-center px-10 md:px-20 lg:px-28 opacity-0"
            style={{ willChange: 'opacity, transform' }}
          >
            <div className="max-w-[36rem]">
              {phase.eyebrow && (
                <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.24em] text-accent">
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
                <p className="mt-5 text-[15px] text-ink-2 leading-relaxed max-w-[43ch]">
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

        {/* ── Scroll cue ─────────────────────────────────────────────── */}
        <div
          aria-hidden
          className="absolute bottom-7 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none select-none"
        >
          <span className="text-[9px] font-semibold uppercase tracking-[0.3em] text-ink-3 opacity-60">
            scroll
          </span>
          <div className="w-px h-5 bg-ink-3 opacity-35" />
        </div>
      </div>
    </div>
  );
}
