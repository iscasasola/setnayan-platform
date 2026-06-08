/**
 * VendorHero · the inline hero from "Setnayan For Vendors.html".
 *
 * WHY: ports the template's vendor-led hero — "RUN YOUR WEDDING BUSINESS,
 * NOT YOUR DMS." — with the pipeline card on the right. All copy passes
 * v2.1 drift scrub per CLAUDE.md 2026-05-28 11th row · further amended
 * 2026-05-30 row § 1(a) Pro 28-day price flip ₱1,999 → ₱2,499:
 *   - 0% commission · we never touch the money (preserved)
 *   - Pro ₱2,499/28d (CLAUDE.md 2026-05-30 § 1(a) cadence + price update)
 *   - 100 free bidding tokens on verification before 31 Jan 2027 (preserved)
 *   - "Concierge matchmaking" copy in hero blurb → "Today's Focus matchmaking"
 *     per V2 retire of Concierge brand
 *
 * Per [[feedback_setnayan_button_preservation]] — CTA placement +
 * interaction concept preserved verbatim from template.
 */
import Link from 'next/link';

export function VendorHero() {
  return (
    <section
      style={{
        padding: '96px 56px 64px',
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--m-paper)',
      }}
    >
      {/* Soft orange blob — top-right glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -60,
          right: -60,
          width: 520,
          height: 520,
          pointerEvents: 'none',
          background:
            'radial-gradient(circle, var(--m-orange) 0%, transparent 65%)',
          opacity: 0.1,
          filter: 'blur(40px)',
        }}
      />
      <div
        className="m-vendor-hero-grid"
        style={{
          display: 'grid',
          gap: 64,
          alignItems: 'center',
          position: 'relative',
        }}
      >
        <div>
          <div
            className="m-mono"
            style={{
              fontSize: 12,
              letterSpacing: '0.18em',
              color: 'var(--m-slate-2)',
              marginBottom: 24,
              textTransform: 'uppercase',
            }}
          >
            FOR VENDORS · ₱0 TO START
          </div>
          <h1
            className="m-display"
            style={{
              fontSize: 'clamp(56px, 9vw, 120px)',
              lineHeight: 0.96,
              margin: 0,
              color: 'var(--m-ink)',
            }}
          >
            RUN YOUR
            <br />
            WEDDING BUSINESS
            <br />
            <span style={{ color: 'var(--m-orange)' }}>NOT YOUR DMS.</span>
          </h1>
          <p
            style={{
              fontSize: 18,
              color: 'var(--m-slate)',
              lineHeight: 1.55,
              maxWidth: 560,
              marginTop: 28,
            }}
          >
            A verified profile + in-app chat + real reviews — free, forever.{' '}
            <strong style={{ color: 'var(--m-ink)' }}>
              0% commission · Setnayan never takes a cut of your bookings.
            </strong>{' '}
            Pro at <strong style={{ color: 'var(--m-ink)' }}>₱6,000/28 days</strong>{' '}
            unlocks AI matchmaking, boosted reach, AI proposal
            drafting, demand pulse. Founder bonus{' '}
            <strong style={{ color: 'var(--m-ink)' }}>
              100 free bidding tokens
            </strong>{' '}
            on verification before 31 Jan 2027.
          </p>
          <div
            style={{
              display: 'flex',
              gap: 12,
              marginTop: 28,
              flexWrap: 'wrap',
            }}
          >
            <Link
              href="/signup?as=vendor"
              className="m-btn m-btn-primary m-btn-lg"
            >
              Register your business — free
            </Link>
            <Link
              href="/help#contact"
              className="m-btn m-btn-ghost m-btn-lg"
            >
              Book a 15-min demo →
            </Link>
          </div>
          <div
            className="m-mono"
            style={{
              fontSize: 12,
              color: 'var(--m-slate-2)',
              marginTop: 22,
              display: 'flex',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            <span>42 verified vendors live</span>
            <span aria-hidden>·</span>
            <span>23 in verification</span>
            <span aria-hidden>·</span>
            <span>0% commission, ever</span>
          </div>
        </div>

        {/* Right rail — vendor pipeline card */}
        <div
          className="m-card"
          style={{
            padding: 22,
            background: 'var(--m-ink)',
            color: 'var(--m-paper)',
            border: 'none',
            boxShadow: 'var(--m-shadow-lg)',
          }}
        >
          <div
            className="m-label-mono"
            style={{ color: 'var(--m-orange-3)' }}
          >
            Pipeline · Ato Catering
          </div>
          <div
            className="m-display"
            style={{ fontSize: 28, color: 'var(--m-paper)', marginTop: 8 }}
          >
            9 ACTIVE LEADS
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
              marginTop: 16,
            }}
          >
            {[
              { col: 'Bid Requests', n: 3, hot: false },
              { col: 'Chat', n: 2, hot: false },
              { col: 'Accepted', n: 3, hot: true },
              { col: 'Completed', n: 2, hot: false },
            ].map((s) => (
              <div
                key={s.col}
                style={{
                  padding: 10,
                  background: s.hot
                    ? 'var(--m-orange-4)'
                    : 'rgba(255,255,255,0.06)',
                  borderRadius: 6,
                }}
              >
                <div
                  className="m-mono"
                  style={{
                    fontSize: 9,
                    color: s.hot ? 'var(--m-orange-2)' : 'var(--m-slate-4)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {s.col}
                </div>
                <div
                  className="m-display"
                  style={{
                    fontSize: 24,
                    color: s.hot ? 'var(--m-orange-2)' : 'var(--m-paper)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {s.n}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 14,
              padding: 12,
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 6,
            }}
          >
            <div
              className="m-label-mono"
              style={{ color: 'var(--m-orange-3)' }}
            >
              Today&apos;s earnings
            </div>
            <div
              className="m-display"
              style={{ fontSize: 28, color: 'var(--m-paper)', marginTop: 4 }}
            >
              ₱228K · 2 payouts
            </div>
            <div
              className="m-mono"
              style={{ fontSize: 10, color: 'var(--m-slate-4)', marginTop: 4 }}
            >
              BIR ORs auto-stamped · 24h disbursement
            </div>
          </div>
        </div>
      </div>

      {/* Responsive grid — desktop 2-col, mobile stack */}
      <style>{`
        @media (min-width: 1024px) {
          .m-vendor-hero-grid {
            grid-template-columns: 1.15fr 1fr;
          }
        }
        @media (max-width: 1023px) {
          .m-vendor-hero-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
