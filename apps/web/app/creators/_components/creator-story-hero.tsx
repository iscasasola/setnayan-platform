/**
 * CreatorStoryHero — the photographic hero for the /creators storyteller page
 * ("Everywhere else, they watch. Here, they book.").
 *
 * Mirrors the /vendors hero pattern (vendor-grow-hero.tsx): a full-bleed
 * cinematic photo (a real repo asset — public/realstories/maria-juan-tagaytay.jpg,
 * already serving the Real Stories showcase) under a dark scrim with white
 * display copy + two CTAs. No eyebrow kicker (per the project's
 * no-eyebrow-kickers rule for heroes). The persistent glass nav + footer are
 * global site-chrome — this component renders NO nav of its own.
 *
 * Clean Editorial tokens only (--m-*). Radii route through --m-r-* per the
 * radius-token lint guard. No scroll-lock gate (that's a bespoke /vendors
 * decision-gate behavior) — plain CTA links keep this hero a pure Server
 * Component with the LCP <Image>.
 */
import Image from 'next/image';
import Link from 'next/link';

export function CreatorStoryHero() {
  return (
    <header
      style={{
        position: 'relative',
        minHeight: '92vh',
        display: 'flex',
        alignItems: 'flex-end',
        overflow: 'hidden',
        color: '#fff',
        background: 'var(--m-ink)',
      }}
    >
      {/* Full-bleed cinematic real-story photo — a real repo asset. */}
      <Image
        src="/realstories/maria-juan-tagaytay.jpg"
        alt="A cinematic Filipino wedding portrait — the kind of real event a Setnayan storyteller publishes as a Chapter"
        fill
        priority
        sizes="100vw"
        style={{ objectFit: 'cover', objectPosition: 'center 40%' }}
      />
      {/* Dark scrim — left-weighted for legible copy, bottom-weighted for depth. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, rgba(18,14,10,.74), rgba(18,14,10,.30) 55%, transparent), linear-gradient(0deg, rgba(18,14,10,.86) 4%, transparent 50%)',
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 1120,
          margin: '0 auto',
          width: '100%',
          padding: '0 clamp(20px, 5vw, 56px) clamp(44px, 7vw, 80px)',
        }}
      >
        <h1
          className="m-display"
          style={{
            fontSize: 'clamp(40px, 7.5vw, 84px)',
            lineHeight: 0.98,
            letterSpacing: '-0.025em',
            margin: '0 0 18px',
            maxWidth: '15ch',
            /* .m-display hard-sets color:var(--m-ink) — override to white so the
               headline reads over the photo (same fix as the /vendors hero,
               owner 2026-07-10). */
            color: '#fff',
            textShadow: '0 2px 40px rgba(0,0,0,.35)',
          }}
        >
          Everywhere else, they watch. Here, they book.
        </h1>
        <p
          style={{
            fontSize: 'clamp(16px, 2vw, 19px)',
            color: '#eae0cf',
            maxWidth: '52ch',
            margin: '0 0 30px',
            lineHeight: 1.55,
          }}
        >
          Publish your real events as Chapters on your own page — your edit
          embedded, the real vendors behind it shoppable. Free, forever. You
          keep your channel and its monetization.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/signup" className="m-btn m-btn-orange m-btn-lg">
            Publish your story — free
          </Link>
          <Link href="/creators#chapter" className="m-btn m-btn-ghost m-btn-lg" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.45)' }}>
            See what a Chapter is ↓
          </Link>
        </div>
      </div>
    </header>
  );
}
