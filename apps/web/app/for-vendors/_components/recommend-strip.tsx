/**
 * RecommendStrip · the vendor-relevant slice of the couple add-on economy.
 *
 * WHY (full-reflow 2026-06-15): the vendor page used to carry the entire
 * couple-facing economy — the Free/Bid/À-la-carte pricing cards + the full
 * 21-service ProductionsCatalog. On a vendor-recruitment page that's misplaced
 * couple content (audited 2026-06-15). This strip keeps the ONE angle that
 * matters to a vendor — "couples book optional add-ons through Setnayan
 * Productions; recommend the ones that fit your weddings and earn a referral
 * token back" — and links to /pricing for the full list, instead of dumping it
 * inline. Preserves the reason the catalog was added (vendors recognising
 * Token-Worthy items they can recommend for referral tokens) in compact form.
 *
 * Static (no catalog DB read) by design — it's a teaser, not the catalog.
 */
import Link from 'next/link';

const EXAMPLES = ['Panood livestream', 'Papic', 'Live Background', 'Animated Monogram', 'Editorial Website'];

export function RecommendStrip() {
  return (
    <section style={{ padding: 'clamp(64px, 8vw, 96px) clamp(20px, 5vw, 56px)', background: 'var(--m-paper)' }}>
      <div
        className="m-card"
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: 'clamp(28px, 4vw, 48px)',
          background: 'var(--m-paper-2)',
          border: '1px solid var(--m-line)',
        }}
      >
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
          Beyond your own service, couples can book optional add-ons from Setnayan Productions — livestreaming,
          candid capture, a custom monogram, an editorial website. When you recommend one that fits a wedding and
          it shows up at the event, <strong style={{ color: 'var(--m-ink)' }}>a bidding token comes back to your wallet</strong>. Your good taste
          becomes free reach.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 22 }}>
          {EXAMPLES.map((name) => (
            <span key={name} className="m-pill" style={{ fontSize: 12 }}>
              {name}
            </span>
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
