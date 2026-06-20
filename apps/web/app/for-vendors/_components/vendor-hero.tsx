/**
 * VendorHero · the inline hero from "Setnayan For Vendors.html".
 *
 * WHY: ports the template's vendor-led hero — "RUN YOUR WEDDING BUSINESS,
 * NOT YOUR DMS." — with the pipeline card on the right. All copy passes
 * v2.1 drift scrub per CLAUDE.md 2026-05-28 11th row · further amended
 * 2026-05-30 row § 1(a) Pro 28-day price flip ₱1,999 → ₱2,499:
 *   - 0% commission · we never touch the money (preserved)
 *   - Pro ₱2,499/28d (CLAUDE.md 2026-05-30 § 1(a) cadence + price update)
 *   - Founder bonus (100 free tokens before 31 Jan 2027) REMOVED 2026-06-15 (owner)
 *   - "Concierge matchmaking" copy in hero blurb → "Setnayan AI matchmaking"
 *     per V2 retire of Concierge brand
 *
 * Per [[feedback_setnayan_button_preservation]] — CTA placement +
 * interaction concept preserved verbatim from template.
 */
import Image from 'next/image';
import Link from 'next/link';
import { getVendorPrices } from '@/lib/v2-catalog';

export async function VendorHero() {
  const p = await getVendorPrices();
  return (
    <section
      style={{
        padding: 'clamp(64px, 10vw, 96px) clamp(20px, 5vw, 56px) 64px',
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
          gap: 'clamp(32px, 4vw, 56px)',
          alignItems: 'stretch',
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
            Pro at <strong style={{ color: 'var(--m-ink)' }}>{p.proMonthly}/28 days</strong>{' '}
            unlocks AI matchmaking, boosted reach, AI proposal
            drafting, and demand pulse.
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
          <p style={{ marginTop: 14, fontSize: 13.5, color: 'var(--m-slate)' }}>
            Curious what couples see?{' '}
            <Link
              href="/tour"
              style={{
                color: 'var(--m-mulberry)',
                fontWeight: 500,
                textDecoration: 'underline',
                textUnderlineOffset: 2,
              }}
            >
              Walk through a real wedding →
            </Link>
          </p>
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
            {/* Factual claims only — the prior "42 verified vendors / 23 in
                verification" counts were fabricated (founder-only marketplace);
                removed 2026-06-15 per owner "use factual numbers only". */}
            <span>0% commission, ever</span>
            <span aria-hidden>·</span>
            <span>Paid straight to you</span>
            <span aria-hidden>·</span>
            <span>Free during launch</span>
          </div>
        </div>

        {/* Right rail — a FULL-BLEED photo of a vendor thriving (owner 2026-06-15:
            "i want a full bleed photo"). Bleeds to the viewport right edge and
            fills the row height; no card chrome, no overlay chip. The left
            column, headline, and CTAs are untouched (button-preservation lock).
            Bleed + height handled in the responsive <style> via .m-hero-photo. */}
        <div className="m-hero-photo" style={{ position: 'relative', overflow: 'hidden', minHeight: 'clamp(360px, 50vh, 560px)' }}>
          <Image
            src="/for-vendors/vendor-success.avif"
            alt="A happy, confident Filipino wedding florist laughing in her sunlit studio surrounded by fresh flowers — a vendor thriving with Setnayan"
            fill
            priority
            sizes="(max-width: 1023px) 100vw, 46vw"
            style={{ objectFit: 'cover', objectPosition: 'center 32%' }}
          />
        </div>
      </div>

      {/* Operational wins strip — the four reasons vendors switch from
          Viber/IG DMs (owner brief 2026-06-13). Leads the pitch before the
          deep-dive matrix repeats each in detail. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
          marginTop: 56,
          position: 'relative',
        }}
      >
        {[
          {
            title: 'The ultimate calendar',
            body: 'Team roles, agent privacy redactions, and locked dates that make double-bookings impossible.',
          },
          {
            title: '0% commission',
            body: 'Couples pay you directly. You keep 100% of every booking — Setnayan never takes a cut.',
          },
          {
            title: 'Verified badge — free',
            body: 'ID, DTI, sample work, references. An official stamp of legitimacy, free during launch.',
          },
          {
            title: 'Automated bookings',
            body: 'Bid request → chat → quote → locked date in one rail, not 50 back-and-forth messages.',
          },
        ].map((w) => (
          <div key={w.title} className="m-card" style={{ padding: 20 }}>
            <div className="m-display" style={{ fontSize: 18, color: 'var(--m-ink)' }}>
              {w.title}
            </div>
            <p style={{ fontSize: 13, color: 'var(--m-slate)', lineHeight: 1.55, marginTop: 6 }}>{w.body}</p>
          </div>
        ))}
      </div>

      {/* Responsive grid — desktop 2-col, mobile stack */}
      <style>{`
        @media (min-width: 1024px) {
          .m-vendor-hero-grid {
            grid-template-columns: 1.05fr 1fr;
          }
          /* Bleed the hero photo to the viewport right edge + fill the row height.
             Bleed assumes this section spans the full viewport width — do NOT wrap
             the hero in a max-width container or the negative margin won't reach the
             edge. min-height scales with viewport width so the 3:4 portrait never
             crops to a thin landscape slit on ultrawide. */
          .m-hero-photo {
            margin-right: calc(-1 * clamp(20px, 5vw, 56px));
            align-self: stretch;
            min-height: clamp(420px, 42vw, 680px);
          }
        }
        @media (max-width: 1023px) {
          .m-vendor-hero-grid {
            grid-template-columns: 1fr;
          }
          /* On mobile the photo becomes a full-bleed band under the copy. */
          .m-hero-photo {
            margin: 4px calc(-1 * clamp(20px, 5vw, 56px)) 0;
          }
        }
      `}</style>
    </section>
  );
}
