/**
 * VendorTierLadder · benefits-forward tier presentation (owner 2026-07-01).
 *
 * REPLACES the dense 3-tier pricing matrix. Owner direction across the session:
 *   - "all i see are prices … show the benefits of the free" → Free-Verified is
 *     the SPOTLIGHT (everything you get for ₱0), price shrunk to a tag.
 *   - "show the 4 tiers from free to subscription" → Free · Solo · Pro ·
 *     Enterprise, benefit-led "everything below, plus…" cards.
 *   - "not unlimited, just a larger range" → Enterprise is a BOUNDED tier
 *     (10 seats / 300 photos / 8 events per category / nationwide) + a Custom
 *     "Talk to us" tier above it for franchises/multi-location.
 *
 * HONESTY: content is limited to what the 2026-07-01 origin/main verification
 * audit (VENDOR_TIERS_AND_BENEFITS.md §6) confirms BUILT. Roadmap items
 * (Advanced Proposal Drafting, benchmarks-vs-peers, vendor-facing theft watch,
 * bundle maker, toolkits, contract intelligence, shareable bid links) are NOT
 * claimed as live. Token model is honest: answering matched leads is
 * pay-per-lead (region tokens) on every tier — no "free answering" claim.
 *
 * Prices are DB-driven (getVendorPrices, passed as `prices`) — never hardcoded.
 * Enterprise ₱7,499 is a pending dashboard-session DB reprice; this reads
 * whatever the live catalog returns. Custom has no price (contact CTA).
 * Server component — static cards, no client JS.
 */
import Link from 'next/link';

export interface VendorTierLadderPrices {
  soloMonthly: string;
  soloAnnual: string;
  proMonthly: string;
  proAnnual: string;
  enterpriseMonthly: string;
  enterpriseAnnual: string;
}

const FREE_A = [
  ['Appear in every matched search', 'Couples looking for your category find you — matched on fit, not fame.'],
  ['Verified badge — free', 'ID, DTI, and sample work checked by hand. The trust stamp couples look for.'],
  ['Couples message you first', 'In-app chat. Your name stays private until you choose to reply.'],
  ['Your own microsite + 50-photo portfolio', 'A branded page with your work and packages — no website needed.'],
];
const FREE_B = [
  ['Real reviews, ratings & badges', 'From actual Setnayan weddings — plus earned badges and an experience tier.'],
  ['Bring your past clients — free', 'Import your book of business; their reviews and "verified wedding" proof come with them.'],
  ['Your own Performance panel', 'See your reply time, completion rate, and ranking signal — and improve them.'],
  ['0% commission, always', 'The couple pays you directly. You keep 100% of every booking.'],
];

interface Tier {
  key: string;
  label: string;
  priceKey?: 'solo' | 'pro' | 'enterprise';
  customPrice?: string;
  note: string;
  plus: string;
  benefits: string[];
  ink?: boolean;
}

const TIERS: Tier[] = [
  {
    key: 'solo',
    label: 'Solo',
    priceKey: 'solo',
    note: 'operate, friction-free',
    plus: 'Everything in Free, plus',
    benefits: [
      'Answer unlimited couples — no weekly cap',
      'Your real business name shown from day one',
      'Up to 3 service listings per category',
    ],
  },
  {
    key: 'pro',
    label: '★ Pro',
    priceKey: 'pro',
    note: 'grow — team, reach, data',
    plus: 'Everything in Solo, plus',
    benefits: [
      '3 categories + 3 team seats',
      'Full written reviews on your profile',
      'Your own link · setnayan.com/v/you',
      '50 km reach + multiple events per day',
      'Grow with data — Demand Radar, your funnel & price position',
      '100-photo portfolio + editorial features',
    ],
    ink: true,
  },
  {
    key: 'enterprise',
    label: '⬢ Enterprise',
    priceKey: 'enterprise',
    note: 'scale — a governed org',
    plus: 'Everything in Pro, plus',
    benefits: [
      'List under every category',
      'Up to 10 team seats + multi-admin governance',
      'Nationwide reach + 300-photo portfolio',
      'Up to 8 events per category',
    ],
  },
  {
    key: 'custom',
    label: '✦ Custom',
    customPrice: 'Talk to us',
    note: 'franchises & multi-location',
    plus: 'Everything in Enterprise, plus',
    benefits: [
      'Unlimited seats + multi-region / multi-location',
      'Beyond-Enterprise caps, custom terms',
      'A dedicated account team',
    ],
  },
];

export function VendorTierLadder({ prices }: { prices: VendorTierLadderPrices }) {
  const priceFor = (k: 'solo' | 'pro' | 'enterprise') =>
    k === 'solo'
      ? { m: prices.soloMonthly, y: prices.soloAnnual }
      : k === 'pro'
        ? { m: prices.proMonthly, y: prices.proAnnual }
        : { m: prices.enterpriseMonthly, y: prices.enterpriseAnnual };

  return (
    <section
      style={{
        padding: 'clamp(56px, 9vw, 104px) clamp(20px, 5vw, 56px)',
        background: 'var(--m-paper-2)',
      }}
    >
      {/* ─── FREE-VERIFIED spotlight ─────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--m-ink)',
          color: 'var(--m-paper)',
          borderRadius: 'var(--m-r-lg, 18px)',
          padding: 'clamp(24px, 4vw, 40px)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            right: -80,
            top: -80,
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: 'var(--m-orange)',
            opacity: 0.08,
            filter: 'blur(48px)',
            pointerEvents: 'none',
          }}
        />
        <div
          className="m-fv-spot-head"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', position: 'relative' }}
        >
          <div style={{ maxWidth: 560 }}>
            <div className="m-mono" style={{ fontSize: 12, letterSpacing: '0.16em', color: 'var(--m-orange-3)', textTransform: 'uppercase' }}>
              Start here · free, forever
            </div>
            <h2
              className="m-serif"
              style={{ fontSize: 'clamp(30px, 5vw, 52px)', lineHeight: 1.04, margin: '14px 0 10px', color: 'var(--m-paper)', fontWeight: 400 }}
            >
              Everything you need to get booked —{' '}
              <em style={{ fontStyle: 'italic', color: 'var(--m-orange-3)' }}>for ₱0.</em>
            </h2>
            <p style={{ fontSize: 15, color: 'var(--m-slate-4)', lineHeight: 1.55, margin: 0 }}>
              No card, no trial clock, no commission. List your verified business today and couples can
              find you, message you, and book you. You only pay per lead when a matched couple reaches
              you — never a fee just to be here.
            </p>
          </div>
          <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
            <div className="m-display" style={{ fontSize: 'clamp(44px, 7vw, 64px)', color: 'var(--m-paper)', lineHeight: 1 }}>₱0</div>
            <div className="m-mono" style={{ fontSize: 11, color: 'var(--m-orange-3)', letterSpacing: '0.06em' }}>forever · 0% commission</div>
          </div>
        </div>

        <div className="m-fv-spot-grid" style={{ display: 'grid', gap: '0 32px', marginTop: 22, position: 'relative' }}>
          {[FREE_A, FREE_B].map((col, ci) => (
            <div key={ci}>
              {col.map(([h, b], i) => (
                <div
                  key={h}
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                    padding: '12px 0',
                    borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.09)',
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      flex: '0 0 auto',
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: 'var(--m-orange)',
                      color: 'var(--m-ink)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      marginTop: 1,
                    }}
                  >
                    ✓
                  </span>
                  <div>
                    <div style={{ fontSize: 14.5, color: 'var(--m-paper)', fontWeight: 500, lineHeight: 1.3 }}>{h}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--m-slate-4)', lineHeight: 1.5, marginTop: 2 }}>{b}</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24, position: 'relative' }}>
          <Link href="/signup?as=vendor" className="m-btn m-btn-orange m-btn-lg" style={{ justifyContent: 'center' }}>
            Register your business — free
          </Link>
        </div>
      </div>

      {/* ─── Paid ladder ─────────────────────────────────────────────────── */}
      <div style={{ marginTop: 'clamp(36px, 5vw, 56px)', marginBottom: 20 }}>
        <div className="m-eyebrow">Ready to grow · what each tier adds</div>
        <h3
          className="m-serif"
          style={{ fontSize: 'clamp(28px, 4.5vw, 44px)', lineHeight: 1.05, margin: '12px 0 0', color: 'var(--m-ink)', fontWeight: 400 }}
        >
          Free finds you.{' '}
          <em style={{ fontStyle: 'italic', color: 'var(--m-blush-deep)' }}>Paid grows you.</em>
        </h3>
      </div>

      <div className="m-tier-cards" style={{ display: 'grid', gap: 14, alignItems: 'stretch' }}>
        {TIERS.map((t) => {
          const p = t.priceKey ? priceFor(t.priceKey) : null;
          return (
            <div
              key={t.key}
              className="m-card"
              style={{
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                background: t.ink ? 'var(--m-ink)' : 'var(--m-paper)',
                color: t.ink ? 'var(--m-paper)' : 'var(--m-ink)',
                border: t.ink ? '1px solid var(--m-orange-3)' : '1px solid var(--m-line)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span className="m-display" style={{ fontSize: 20, color: t.ink ? 'var(--m-paper)' : 'var(--m-ink)' }}>{t.label}</span>
              </div>
              <div>
                {p ? (
                  <>
                    <span className="m-display" style={{ fontSize: 26, color: t.ink ? 'var(--m-paper)' : 'var(--m-ink)' }}>{p.m}</span>
                    <span className="m-mono" style={{ fontSize: 11, color: t.ink ? 'var(--m-slate-4)' : 'var(--m-slate-2)' }}> / 28d</span>
                    <div className="m-mono" style={{ fontSize: 10.5, color: t.ink ? 'var(--m-orange-3)' : 'var(--m-slate-2)', marginTop: 3 }}>
                      or {p.y} / yr
                    </div>
                  </>
                ) : (
                  <span className="m-display" style={{ fontSize: 22, color: 'var(--m-ink)' }}>{t.customPrice}</span>
                )}
                <div className="m-mono" style={{ fontSize: 10.5, color: t.ink ? 'var(--m-slate-4)' : 'var(--m-slate-2)', marginTop: 4 }}>{t.note}</div>
              </div>
              <div
                className="m-mono"
                style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.ink ? 'var(--m-orange-3)' : 'var(--m-orange-2)', paddingTop: 8, borderTop: `1px solid ${t.ink ? 'rgba(255,255,255,0.12)' : 'var(--m-line-soft)'}` }}
              >
                {t.plus}
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                {t.benefits.map((b) => (
                  <li key={b} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span aria-hidden style={{ color: t.ink ? 'var(--m-orange-3)' : 'var(--m-orange-2)', fontSize: 13, marginTop: 1 }}>+</span>
                    <span style={{ fontSize: 12.5, color: t.ink ? 'var(--m-slate-4)' : 'var(--m-slate)', lineHeight: 1.45 }}>{b}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={t.key === 'custom' ? '/help#contact' : '/signup?as=vendor'}
                className={`m-btn ${t.ink ? 'm-btn-orange' : 'm-btn-ghost'}`}
                style={{ justifyContent: 'center', marginTop: 4 }}
              >
                {t.key === 'custom' ? 'Talk to us →' : 'Choose ' + t.label.replace(/[★⬢✦]\s*/, '')}
              </Link>
            </div>
          );
        })}
      </div>

      <p className="m-mono" style={{ fontSize: 10.5, color: 'var(--m-slate-3)', marginTop: 16, lineHeight: 1.5, maxWidth: 720 }}>
        Prices read the live catalog and are billed per 28-day cycle (annual saves ~23%). Answering a
        matched couple uses a region-banded lead token on every tier — you pay per real inquiry, not to
        be listed. 0% commission on every booking. Enterprise is a bounded plan; franchises and
        multi-location go Custom.
      </p>

      <style>{`
        @media (min-width: 720px) { .m-fv-spot-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 719px) { .m-fv-spot-grid { grid-template-columns: 1fr; } }
        .m-tier-cards { grid-template-columns: 1fr; }
        @media (min-width: 640px) { .m-tier-cards { grid-template-columns: 1fr 1fr; } }
        @media (min-width: 1024px) { .m-tier-cards { grid-template-columns: repeat(4, 1fr); } }
      `}</style>
    </section>
  );
}
