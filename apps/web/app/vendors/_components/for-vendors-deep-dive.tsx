/**
 * ForVendorsDeepDive · the v2.1 4-tier vendor matrix + benefits + locks.
 *
 * WHY: ports `ForVendors` from /tmp/setnayan-keynote-template/
 * components/homepage-extras.jsx (lines 350-660). The 4-tier matrix
 * (Free / Verified / Pro / Enterprise) IS already in the v2.1 template —
 * the template was authored AFTER the v2.1 brief lock, so its pricing
 * (₱1,499 lifetime · ₱2,499/28d Pro · ₱5,499/28d Enterprise · per
 * CLAUDE.md 2026-05-30 "🔒 V2.1 BRIEF AMENDMENT #2 LOCKED" row § 1(a)
 * Pro 28-day flip ₱1,999 → ₱2,499; canonical CLAUDE-CODE-BRIEF-v2.1_
 * 2026-05-28.md § 3 superseded for the Pro 28-day price).
 *
 * DRIFT SCRUBS applied (CLAUDE.md 2026-05-28 11th row v2.1 canonical · further
 * amended 2026-05-30 row § 1(a) + § 4 Pro 28-day price flip to ₱2,499 + Pro
 * Annual to ₱24,999 + Boosters surface mention):
 *   - "Setnayan Concierge matching" rows → "Setnayan AI matching" (V2 retire)
 *   - "Concierge matchmaking" in card titles → "Setnayan AI matchmaking"
 *   - Boosted Ads + Sponsored Boost vendor ad product RETIRED 2026-06-19 (owner
 *     "delete them") — the per-week paid-visibility benefit card + matrix rows removed
 *   - Boosters surface mention added (CLAUDE.md 2026-05-30 row § 1(d) reinstated)
 *   - 0% commission claim preserved (V2 publisher posture per CLAUDE.md 2026-05-28 3rd row)
 *   - Founder bonus (100 tokens before 31 Jan 2027) REMOVED 2026-06-15 (owner); the
 *     standing "up to 10 free couple unlocks/week" verified perk stays
 *   - Verification FREE during launch (₱1,499 one-time fee removed 2026-06-13; card shows "₱0 to start")
 *   - Pro 28-day ₱1,999 → ₱2,499 (2026-05-30 § 1(a))
 *   - Pro Annual ₱19,999 → ₱24,999 (2026-05-30 § 4)
 *
 * Per [[feedback_setnayan_button_preservation]] CTAs preserved verbatim.
 */
import Link from 'next/link';
import { getVendorPrices } from '@/lib/v2-catalog';
import { VendorTierLadder } from './vendor-tier-ladder';

// The per-benefit "advantages no directory can copy" + "everything else you
// get" prose-card arrays that used to render here were removed 2026-07-05: the
// tier-comparison MATRIX + filterable benefit guide (added to /vendors this
// PR) now carry that content in full, sourced from the canonical
// VENDOR_TIER_SECTIONS. This component keeps the intro, the 0%-commission hero
// strip, the benefits-forward tier ladder, and the CTA.

export async function ForVendorsDeepDive() {
  const p = await getVendorPrices();
  return (
    <section
      style={{
        padding: 'clamp(64px, 11vw, 120px) clamp(20px, 5vw, 56px)',
        background: 'var(--m-paper)',
      }}
    >
      <div
        className="m-grid-2"
        style={{
          display: 'grid',
          gap: 64,
          alignItems: 'end',
          marginBottom: 64,
        }}
      >
        <div>
          <div className="m-eyebrow">For vendors · deep dive</div>
          <h2
            className="m-serif"
            style={{
              fontSize: 'clamp(48px, 7vw, 84px)',
              lineHeight: 1.04,
              margin: '20px 0 16px',
              letterSpacing: '-0.025em',
              color: 'var(--m-ink)',
              fontWeight: 400,
            }}
          >
            Better tools,{' '}
            <em style={{ fontStyle: 'italic', color: 'var(--m-blush-deep)' }}>
              more weddings.
            </em>
          </h2>
        </div>
        <p
          style={{
            fontSize: 17,
            color: 'var(--m-slate)',
            lineHeight: 1.55,
            maxWidth: 520,
          }}
        >
          You&apos;re already great at the work. We just want fewer DMs, cleaner
          books, and more couples knowing you exist. Free to start. Upgrade
          only when you&apos;re ready for more reach.
        </p>
      </div>

      {/* PRIMARY — 0% commission leads as the hero advantage. The per-benefit
          detail (the "advantages no directory can copy" + "everything else you
          get" prose cards) now lives in the far more complete tier-comparison
          MATRIX + filterable benefit guide on the page below, so those two
          duplicate prose grids were removed here (owner 2026-07-05 de-dupe). */}
      <div>
        <div className="m-eyebrow">Your edge · only on Setnayan</div>
      </div>

      {/* 0% commission strip — the headline advantage */}
      <div
        className="m-card m-callout"
        style={{
          padding: 22,
          display: 'grid',
          gap: 20,
          alignItems: 'center',
          background: 'var(--m-ivory)',
        }}
      >
        <div
          className="m-display"
          style={{ fontSize: 'clamp(1.6rem, 3.5vw, 36px)', color: 'var(--m-orange-2)' }}
        >
          0%
        </div>
        <div>
          <div className="m-label-mono">
            0% commission · we never touch your transactions
          </div>
          <div
            style={{
              fontSize: 14,
              color: 'var(--m-slate)',
              marginTop: 4,
              lineHeight: 1.5,
            }}
          >
            Vendor and couple agree on the price. Couple pays the vendor directly.
            Setnayan doesn&apos;t see the money, doesn&apos;t middleman the
            contract, doesn&apos;t take a cut. We make money on subscriptions,
            tokens, and our own Productions services, not on your bookings.
            Vendor keeps <strong style={{ color: 'var(--m-ink)' }}>100%</strong>.
          </div>
        </div>
        <span
          className="m-mono"
          style={{ fontSize: 11, color: 'var(--m-slate-2)' }}
        >
          vendor keeps 100%
        </span>
      </div>

      {/* Pricing — value first, price after. Tier intro + 3-tier matrix. */}
      <div style={{ marginBottom: 14, marginTop: 48 }}>
        <div className="m-eyebrow" style={{ color: 'var(--m-slate-2)' }}>
          Free · Solo · Pro · Enterprise · Custom, one tier for every stage
        </div>
        <div
          style={{
            fontSize: 14,
            color: 'var(--m-slate)',
            marginTop: 8,
            maxWidth: 760,
            lineHeight: 1.5,
          }}
        >
          Free gets you found, trusted, and messaged, forever, at no cost. The paid
          tiers don&rsquo;t unlock your craft. They expand it: unlimited answering, your
          real name up front, more categories, more team, wider reach, and the data to
          grow. Every one of them is{' '}
          <em style={{ color: 'var(--m-ink)' }}>only possible because Setnayan</em>{' '}
          has the couples, the marketplace, and the data behind it.
        </div>
      </div>

      {/* Benefits-forward tier ladder — Free-Verified spotlight + Solo/Pro/
          Enterprise/Custom benefit cards (replaces the dense price matrix;
          honest to VENDOR_TIERS §6). */}
      <VendorTierLadder prices={p} />

      {/* Vendor CTA strip */}
      <div
        className="m-card m-vendor-cta-strip"
        style={{
          marginTop: 28,
          padding: 32,
          background: 'var(--m-ink)',
          color: 'var(--m-paper)',
          border: 'none',
          display: 'grid',
          gap: 32,
          alignItems: 'center',
        }}
      >
        <div>
          <div className="m-label-mono" style={{ color: 'var(--m-orange-3)' }}>
            Ready to switch?
          </div>
          <div
            className="m-display"
            style={{ fontSize: 'clamp(1.85rem, 4.5vw, 44px)', color: 'var(--m-paper)', marginTop: 8, lineHeight: 1.02 }}
          >
            Register your business in three minutes.
          </div>
          <div
            style={{
              fontSize: 14,
              color: 'var(--m-slate-4)',
              marginTop: 10,
              lineHeight: 1.55,
              maxWidth: 520,
            }}
          >
            Profile, photos, services, calendar. Get listed today. Verification
            in 24 hours. First proposal in your inbox by next week.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link
            href="/open-shop"
            className="m-btn m-btn-orange m-btn-lg"
            style={{ justifyContent: 'center' }}
          >
            Register your business, free
          </Link>
          <Link
            href="/help#contact"
            className="m-btn m-btn-ghost m-btn-lg"
            style={{
              justifyContent: 'center',
              color: 'var(--m-paper)',
              borderColor: 'rgba(255,255,255,0.18)',
            }}
          >
            Book a 15-min vendor demo
          </Link>
        </div>
      </div>

      {/* Responsive overrides */}
      <style>{`
        @media (min-width: 1024px) {
          .m-grid-2 { grid-template-columns: 1fr 1fr; }
          .m-callout { grid-template-columns: auto 1fr auto; }
          .m-vendor-cta-strip { grid-template-columns: 1.4fr 1fr; }
        }
        @media (max-width: 1023px) {
          .m-grid-2 { grid-template-columns: 1fr; }
          .m-callout { grid-template-columns: 1fr; }
          .m-vendor-cta-strip { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  );
}
