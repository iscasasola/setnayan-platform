'use client';

/**
 * The Ala ala tile's showcase pop-up (owner 2026-07-03: "the first bottom nav
 * is ala ala. we want to showcase our editorial here — 2 sample editorials
 * that should be complete"). Two COMPLETE sample editions, each a real
 * readable page under /realstories — this overlay is the front-page rack, not
 * a mockup. Fills the Ala ala slot in the locked hero-button pattern
 * (PR #2698) the same way the demos fill Papic / Panood / 3D Plan.
 *
 * Honesty: both cards carry the Sample badge; real editorials publish with
 * each family's consent (first real one lands from the founder's own wedding).
 */

import Link from 'next/link';
import { OverlayShell, type OverlayId } from './HomeOverlays';

type Edition = {
  href: string;
  edition: string;
  names: string;
  meta: string;
  quote: string;
  attribution: string;
  image: string;
};

const EDITIONS: Edition[] = [
  {
    href: '/realstories/maria-and-juan-tagaytay-garden-wedding',
    edition: 'Edition 01 · Wedding',
    names: 'Maria & Juan',
    meta: 'A garden overlooking Taal · Tagaytay',
    quote: 'When Maria walked in, the whole garden went quiet. Even the birds.',
    attribution: 'Ate Celine, Maid of Honor',
    image: '/realstories/maria-juan-tagaytay.jpg',
  },
  {
    href: '/realstories/sofia-reyes-makati-debut',
    edition: 'Edition 06 · Debut',
    names: 'Sofia Reyes',
    meta: 'Eighteen roses, eighteen candles · Makati',
    quote: 'I’ve watched her grow up. This night, I watched her arrive.',
    attribution: 'Ninong Ernesto, fourth rose',
    image: '/realstories/sofia-reyes-makati.jpg',
  },
];

function EditionCard({ e, onClose }: { e: Edition; onClose: () => void }) {
  return (
    <Link
      href={e.href}
      onClick={onClose}
      style={{
        flex: '1 1 250px',
        minWidth: 0,
        textDecoration: 'none',
        border: '1px solid rgba(42,43,46,.12)',
        borderRadius: 'var(--m-r-16, 16px)',
        overflow: 'hidden',
        background: '#fff',
        display: 'block',
      }}
    >
      <div style={{ position: 'relative', height: 128, overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={e.image}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        <span
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            fontFamily: 'var(--hr-mono)',
            fontSize: 9,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            background: 'rgba(255,255,255,.92)',
            color: '#54514d',
            padding: '3px 9px',
            borderRadius: 'var(--m-r-full)',
          }}
        >
          Sample
        </span>
      </div>
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{ fontFamily: 'var(--hr-mono)', fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: '#97742f' }}>
          {e.edition}
        </div>
        <div style={{ fontFamily: 'var(--hr-serif)', fontStyle: 'italic', fontSize: 19, color: '#2a2925', marginTop: 3 }}>
          {e.names}
        </div>
        <div style={{ fontSize: 11.5, color: '#8c8884', marginTop: 2 }}>{e.meta}</div>
        <p style={{ fontSize: 12.5, lineHeight: 1.5, color: '#54514d', margin: '9px 0 0' }}>
          “{e.quote}”
        </p>
        <div style={{ fontSize: 10.5, color: '#a8a4a0', marginTop: 3 }}>— {e.attribution}</div>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: '#2a2925', marginTop: 10 }}>
          Read the full edition →
        </div>
      </div>
    </Link>
  );
}

export function AlaalaEditorialOverlay({ current, onClose }: { current: OverlayId; onClose: () => void }) {
  return (
    <OverlayShell
      id="alaala-editorial"
      current={current}
      onClose={onClose}
      label="Ala ala editorials"
      cardStyle={{ maxWidth: 640 }}
    >
      <div className="hr-ov-eyebrow">Ala ala · Editorials</div>
      <h2 className="hr-ov-title">Every event becomes a front-page story.</h2>
      <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.55, color: '#6c675e' }}>
        Not a photo dump, a real storyline you can relive: the write-up, the
        photos, what your guests said. Read two complete sample editions.
      </p>

      <div style={{ display: 'flex', gap: 14, marginTop: 18, flexWrap: 'wrap' }}>
        {EDITIONS.map((e) => (
          <EditionCard key={e.href} e={e} onClose={onClose} />
        ))}
      </div>

      <p style={{ margin: '16px 0 0', fontSize: 10.5, color: '#a8a4a0', textAlign: 'center' }}>
        Sample editions. Real editorials publish only with each family&rsquo;s consent.
      </p>
    </OverlayShell>
  );
}
