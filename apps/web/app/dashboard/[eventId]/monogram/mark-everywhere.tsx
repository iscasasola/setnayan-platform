'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

/**
 * <MarkEverywhere> — the "Your monogram, everywhere" save sequence (benchmark
 * verdict §5: "this single choreographed moment is the literal implementation
 * of 'simple to use, very premium when created,' and it is the conversion
 * engine"). Mounts once after a successful studio save (?studio=saved):
 * five materially-staged scenes — embossed invitation · napkin · GOLD LIGHT on
 * a dark dance floor (the un-served live gobo preview) · arch signage ·
 * website hero — then the propagation announcement ("Set na 'yan…") ending on
 * the ₱999 reveal upsell. Pure CSS scenes; the mark composites as inline SVG
 * (full colour) or a mask-image silhouette (single-tone scenes). Tap anywhere
 * to advance; Esc/✕ to dismiss.
 */

const SCENE_MS = 1700;

export function MarkEverywhere({ svg }: { svg: string }) {
  const [scene, setScene] = useState(0);
  const [open, setOpen] = useState(true);

  const maskUrl = useMemo(
    () => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`,
    [svg],
  );

  useEffect(() => {
    if (!open || scene >= 5) return;
    const t = window.setTimeout(() => setScene((s) => s + 1), SCENE_MS);
    return () => window.clearTimeout(t);
  }, [open, scene]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open) return null;

  const silhouette = (color: string, extra?: React.CSSProperties) => (
    <div
      aria-hidden
      style={{
        width: '52%',
        height: '52%',
        background: color,
        WebkitMaskImage: maskUrl,
        maskImage: maskUrl,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        ...extra,
      }}
    />
  );

  const inlineMark = (extra?: React.CSSProperties) => (
    <div
      aria-hidden
      className="[&>svg]:h-full [&>svg]:w-full"
      style={{ width: '52%', height: '52%', ...extra }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );

  const scenes: { label: string; body: React.ReactNode }[] = [
    {
      label: 'Your invitation',
      body: (
        <div className="flex h-full items-center justify-center" style={{ background: 'linear-gradient(160deg,#f6f1e6 0%,#efe7d6 100%)' }}>
          <div className="flex h-[72%] w-[62%] items-center justify-center rounded-lg bg-[#fbf8f0] shadow-[0_18px_50px_rgba(60,45,20,0.18)]">
            {inlineMark({ filter: 'saturate(0.9) drop-shadow(0 1px 0 rgba(255,255,255,0.9)) drop-shadow(0 -1px 1px rgba(60,45,20,0.25))' })}
          </div>
        </div>
      ),
    },
    {
      label: 'Your napkins',
      body: (
        <div
          className="flex h-full items-center justify-center"
          style={{ background: 'repeating-linear-gradient(45deg,#8d8375 0 3px,#968c7d 3px 6px)' }}
        >
          {silhouette('#f5efe2', { width: '34%', height: '34%', opacity: 0.95 })}
        </div>
      ),
    },
    {
      label: 'Gold light on your dance floor',
      body: (
        <div className="relative flex h-full items-end justify-center overflow-hidden" style={{ background: 'radial-gradient(120% 80% at 50% 0%, #17131f 0%, #0a0810 70%)' }}>
          <div className="flex h-[86%] w-full items-center justify-center" style={{ transform: 'perspective(700px) rotateX(48deg)', transformOrigin: '50% 100%' }}>
            {silhouette('#e8c877', { filter: 'blur(1.5px) drop-shadow(0 0 26px rgba(232,200,119,0.65)) drop-shadow(0 0 60px rgba(232,200,119,0.35))' })}
          </div>
        </div>
      ),
    },
    {
      label: 'Your ceremony signage',
      body: (
        <div className="flex h-full items-center justify-center" style={{ background: 'linear-gradient(170deg,#3c4a3a 0%,#5a6b53 60%,#8b9b7d 100%)' }}>
          <div className="flex h-[64%] w-[52%] items-center justify-center rounded-[50%] bg-[#fbf8f0]/95 shadow-[0_16px_46px_rgba(10,14,8,0.4)]">
            {inlineMark({ width: '68%', height: '68%' })}
          </div>
        </div>
      ),
    },
    {
      label: 'Your wedding website',
      body: (
        <div className="flex h-full flex-col" style={{ background: 'radial-gradient(120% 90% at 50% 30%, #2b2638 0%, #14111c 60%, #0a0810 100%)' }}>
          <div className="flex items-center gap-1.5 px-4 py-2.5 opacity-50">
            <span className="h-2 w-2 rounded-full bg-white/40" />
            <span className="h-2 w-2 rounded-full bg-white/40" />
            <span className="h-2 w-2 rounded-full bg-white/40" />
          </div>
          <div className="flex flex-1 items-center justify-center">{silhouette('#e9dfc8')}</div>
        </div>
      ),
    },
  ];

  const finished = scene >= scenes.length;
  const active = finished ? null : scenes[scene];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0a0810]/80 p-4 backdrop-blur-sm"
      onClick={() => (finished ? null : setScene((s) => Math.min(scenes.length, s + 1)))}
      role="dialog"
      aria-label="Your monogram, everywhere"
      data-testid="mark-everywhere"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-cream shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label="Close"
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/15 text-white/90 backdrop-blur-sm hover:bg-black/25"
        >
          ✕
        </button>

        {active ? (
          <button type="button" className="block w-full text-left" onClick={() => setScene((s) => s + 1)}>
            <div className="h-72 sm:h-80" key={scene} style={{ animation: 'sn-scene-in 480ms cubic-bezier(.22,1,.36,1) both' }}>
              {active.body}
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <p className="text-sm font-semibold text-ink" data-testid="scene-label">
                {active.label}
              </p>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/45">
                {scene + 1} / {scenes.length} · tap to continue
              </span>
            </div>
          </button>
        ) : (
          <div className="space-y-4 px-6 py-8 text-center" data-testid="everywhere-final">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-gold-deep">Set na &rsquo;yan.</p>
            <h3 className="text-2xl font-semibold tracking-tight text-ink">
              Your mark is now on your QR codes, your website, and your film.
            </h3>
            <p className="mx-auto max-w-sm text-sm text-ink/65">
              Every invitation, every table QR, your wedding website&rsquo;s hero, and your
              save-the-date now carry this monogram — automatically.
            </p>
            <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
              <Link
                href="#animated-monogram"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-mulberry px-5 py-3 text-sm font-semibold text-cream hover:bg-mulberry-700"
              >
                Make it reveal live for guests
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-ink/15 bg-white px-5 py-3 text-sm font-medium text-ink/75 hover:bg-ink/5"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: '@keyframes sn-scene-in{from{opacity:.2;transform:scale(1.02)}to{opacity:1;transform:scale(1)}}',
        }}
      />
    </div>
  );
}
