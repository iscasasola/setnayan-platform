/**
 * RecommendStrip · the vendor-relevant slice of the couple add-on economy.
 *
 * WHY (full-reflow 2026-06-15): replaced the misplaced couple-facing Pricing
 * cards + full 21-service ProductionsCatalog with the ONE angle that matters to
 * a vendor — "couples book optional add-ons through Setnayan Productions;
 * recommend the ones that fit your weddings and earn a referral token back."
 *
 * 2026-06-15 (photos): shows four real Productions services with their actual
 * on-brand product photos (the same `/add-ons/*.avif` assets used on the couple
 * surface) instead of text pills, so "recommend an add-on" is tangible. Links
 * to /pricing for the full catalog rather than dumping it inline.
 */
import Image from 'next/image';
import Link from 'next/link';

const SERVICES = [
  { name: 'Papic', blurb: 'Candid guest capture', img: '/add-ons/papic.avif' },
  { name: 'Panood', blurb: 'Multi-cam livestream', img: '/add-ons/panood.avif' },
  { name: 'Animated Monogram', blurb: 'Their gold-foil mark', img: '/add-ons/custom-monogram.avif' },
  { name: 'Highlight Reel', blurb: 'Same-day edit', img: '/add-ons/ai-video.avif' },
];

export function RecommendStrip() {
  return (
    <section style={{ padding: 'clamp(64px, 8vw, 96px) clamp(20px, 5vw, 56px)', background: 'var(--m-paper)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div className="m-mono" style={{ fontSize: 12, letterSpacing: '0.16em', color: 'var(--m-orange-2)', textTransform: 'uppercase' }}>
          Recommend &amp; earn
        </div>
        <h2
          className="m-display"
          style={{ fontSize: 'clamp(26px, 3.6vw, 40px)', color: 'var(--m-ink)', margin: '12px 0 0', lineHeight: 1.05, maxWidth: 720 }}
        >
          Recommend an add-on. Earn a token back.
        </h2>
        <p style={{ fontSize: 16, color: 'var(--m-slate)', lineHeight: 1.6, marginTop: 14, maxWidth: 680 }}>
          Beyond your own service, couples can book optional add-ons from Setnayan Productions. When you recommend
          one that fits a wedding and it shows up at the event, <strong style={{ color: 'var(--m-ink)' }}>a bidding token comes back to your
          wallet</strong>. Your good taste becomes free reach.
        </p>

        <div
          className="m-rec-grid"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 28 }}
        >
          {SERVICES.map((s) => (
            <div
              key={s.name}
              className="m-card"
              style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ position: 'relative', aspectRatio: '16 / 9', background: 'var(--m-paper-2)' }}>
                <Image
                  src={s.img}
                  alt={`${s.name} — ${s.blurb}`}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  style={{ objectFit: 'cover' }}
                />
              </div>
              <div style={{ padding: '14px 16px' }}>
                <div className="m-display" style={{ fontSize: 16, color: 'var(--m-ink)', lineHeight: 1.15 }}>{s.name}</div>
                <div style={{ fontSize: 13, color: 'var(--m-slate)', marginTop: 3 }}>{s.blurb}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24 }}>
          <Link href="/pricing" className="m-btn m-btn-ghost">
            See everything couples can book &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
