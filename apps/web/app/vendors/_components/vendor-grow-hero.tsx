/**
 * VendorGrowHero — the photographic hero for the rebuilt /vendors page
 * ("Everything your business needs. Set na 'yan.").
 *
 * A full-bleed warm candid photo (a real repo asset —
 * public/for-vendors/vendor-planning.webp: a wedding-business owner planning
 * her bookings at her desk) under a dark scrim with white display copy + two
 * CTAs. No eyebrow kicker (per the project's no-eyebrow-kickers rule). The
 * persistent glass nav + footer are global site-chrome — this component
 * renders NO nav of its own.
 *
 * Clean Editorial tokens only (--m-*). Radii route through --m-r-* per the
 * radius-token lint guard. No prices here (the tier prices live in the matrix,
 * DB-sourced) — the hero speaks the "all set, kept free" thesis, not a number.
 */
import Image from 'next/image';
import Link from 'next/link';

export function VendorGrowHero() {
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
      {/* Full-bleed on-brand candid photo — a real repo asset. */}
      <Image
        src="/for-vendors/vendor-planning.webp"
        alt="A wedding-business owner at her desk, planning her bookings on a laptop — the business Setnayan is built to grow"
        fill
        priority
        sizes="100vw"
        style={{ objectFit: 'cover', objectPosition: 'center 45%' }}
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
            maxWidth: '16ch',
            textShadow: '0 2px 40px rgba(0,0,0,.35)',
          }}
        >
          Everything your business needs. Set na &rsquo;yan.
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
          Profile, clients, calendar, bookings, and your own website. All set up
          free, kept free. Pay only for the extra reach you choose.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Link href="/open-shop" className="m-btn m-btn-orange m-btn-lg">
            List your business for free
          </Link>
          <a href="#model" className="m-btn m-btn-lg m-hero-wire">
            How the model works ↓
          </a>
        </div>
      </div>
      {/* Wire button — glass on the photo (kept local; not a global variant). */}
      <style>{`
        .m-hero-wire {
          background: rgba(255,255,255,.08);
          color: #fff;
          border: 1px solid rgba(255,255,255,.5);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }
        .m-hero-wire:hover { background: rgba(255,255,255,.16); }
      `}</style>
    </header>
  );
}
