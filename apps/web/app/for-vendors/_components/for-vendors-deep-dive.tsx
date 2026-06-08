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
 *   - "Sponsored Boost ₱1,200/wk" preserved (matches v2.1 brief)
 *   - "Boosted Ads · ₱1,200/wk" preserved (matches v2.1 brief)
 *   - Boosters surface mention added (CLAUDE.md 2026-05-30 row § 1(d) reinstated)
 *   - 0% commission claim preserved (V2 publisher posture per CLAUDE.md 2026-05-28 3rd row)
 *   - Founder bonus 100 tokens preserved (matches v2.1 brief § 1)
 *   - ₱1,499 one-time verification preserved (matches v2.1 § 1)
 *   - Pro 28-day ₱1,999 → ₱2,499 (2026-05-30 § 1(a))
 *   - Pro Annual ₱19,999 → ₱24,999 (2026-05-30 § 4)
 *
 * Per [[feedback_setnayan_button_preservation]] CTAs preserved verbatim.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { getVendorPrices } from '@/lib/v2-catalog';

type CellValue = string | boolean;

interface MatrixSection {
  section: string;
  note: string;
  rows: [string, CellValue, CellValue, CellValue, CellValue][];
}

const MATRIX_SECTIONS: MatrixSection[] = [
  {
    section: 'The basics · every tier',
    note: 'Free already matches the best free vendor stack on the market.',
    rows: [
      ['Verified vendor profile + microsite', 'Free', 'Free', 'Free', 'Free'],
      ['In-app chat (couple-initiated)', 'Free', 'Free', 'Free', 'Free'],
      ['Pipeline · Bid → Chat → Quote → Accept', 'Free', 'Free', 'Free', 'Free'],
      ['Create service packages', 'Free', 'Free', 'Free', 'Free'],
      ['Photo portfolio', 'Up to 15', 'Unlimited', 'Unlimited', 'Unlimited'],
      ['Calendar with .ics export', 'Free', 'Free', 'Free', 'Free'],
    ],
  },
  {
    section: '🪙 Bidding · the per-action engine',
    note: 'Vendors spend tokens to accept couple inquiries. Earn tokens by recommending Productions services that couples buy and use (handshake-confirmed).',
    rows: [
      ['Bids per week', 'Up to 10', 'Unlimited', 'Unlimited', 'Unlimited'],
      ['Bidding token packs', 'Buy packs', 'Buy packs', 'Buy packs', 'Buy packs'],
      [
        'Founder bonus 100 tokens (until 31 Jan 2027)',
        '—',
        'On verification',
        'On verification',
        'On verification',
      ],
      ['Ongoing token bonus qualification', false, true, true, true],
      ['Earn tokens from Productions referrals', 'Free', 'Free', 'Free', 'Free'],
    ],
  },
  {
    section: '📡 Reach & visibility',
    note: 'Boost radius scales by tier. Boost individual features for 7 days · 4–100 tokens each. Higher tiers also unlock paid ad placements and a shareable bid link for social.',
    rows: [
      ['Boost radius', '10km', '20km', '50km', '100km'],
      ['Boosters · 7-day feature unlocks · 4–100 tokens each', true, true, true, true],
      ['Sponsored Boost · top of category search', false, false, true, true],
      ['Boosted Ads add-on', false, false, true, true],
      ['Additional branch add-on', false, false, true, true],
      ['Sharable bid link for social media', false, false, false, true],
    ],
  },
  {
    section: '🌐 Your vendor surfaces',
    note: 'From a profile to a full custom microsite with a bid button. Higher tiers get more polish.',
    rows: [
      ['Public vendor website', '—', 'Website', 'Custom website', 'Custom website'],
      ['Custom slug · setnayan.com/v/yourname', false, false, true, true],
      ['Bid Button on your website', false, false, true, true],
      ['Video call with couples', false, true, true, true],
      ['Show star ratings on profile', false, true, true, true],
      ['Show full reviews on profile', false, false, true, true],
    ],
  },
  {
    section: '🗓 Schedule',
    note: 'Manual on Free; Hybrid on Verified+ — pending bids show as white-marker holds, locked bids auto-block the date.',
    rows: [
      ['Scheduling mode', 'Manual', 'Hybrid', 'Hybrid', 'Hybrid'],
      ['Multiple events per day', false, false, true, true],
    ],
  },
  {
    section: '🛠 Pro tools',
    note: 'Editorial tagging that auto-builds your "successful weddings" collection, category-specific toolkits, AI proposal drafts — the toolkit Pro+ vendors use to close more weddings.',
    rows: [
      [
        'Editorial Tagging · auto-featured in couples\' editorials',
        false,
        false,
        true,
        true,
      ],
      ['On Boarding Bundle Maker', false, false, true, true],
      ['File sharing with couples', false, false, true, true],
      ['Specialized Tools · per-category toolkit', false, false, true, true],
      ['AI Proposal Builder', false, false, true, true],
      ['Category benchmark analytics', false, false, true, true],
      ['Demand pulse · what couples are searching', false, false, true, true],
      ['Reverse-image portfolio theft monitoring', false, false, true, true],
      ['Crew-rate marketplace', false, false, true, true],
      ['Co-listing with Setnayan Productions', false, false, true, true],
    ],
  },
  {
    section: '🏢 Scope (Enterprise difference)',
    note: 'Pro is built for one team running one category. Enterprise opens it up — multiple categories, unlimited team accounts.',
    rows: [
      ['Categories you can list under', '1', '1', '1', 'Multiple'],
      ['Team accounts', '1', '1', 'Up to 5', 'Unlimited'],
    ],
  },
  {
    section: '🤝 Ops + support',
    note: 'Every vendor gets couple matchmaking. Pro+ adds priority support; Enterprise adds a quarterly review.',
    rows: [
      ['Couple matching', 'Free', 'Free', 'Priority', 'Priority'],
      ['Priority support · sub-4h response', false, false, true, true],
      ['Quarterly business review', false, false, false, true],
    ],
  },
];

const BENEFITS = [
  {
    tag: 'Lead capture',
    title: 'Couples find you, message you, book you — without leaving Setnayan.',
    body: 'Show up in every couple’s vendor finder for your category. No third-party fees, no inboxes to juggle.',
  },
  {
    tag: 'BIR done for you',
    title: 'Official Receipts, 2307s, and EWT generated on every payout.',
    body: 'Stop hand-writing receipts. Setnayan stamps each payment with a proper BIR OR and emails the 2307 to the couple at year-end.',
  },
  {
    tag: 'Calendar that means something',
    title: 'Agent-redacted booking calendar with team roles + per-service scoping.',
    body: 'Your team sees what they need to see — service captains see crew counts, dispatch sees addresses, accounts sees the invoice. No more shared Google sheets.',
  },
  {
    tag: 'Bid pipeline',
    title: 'Request bid → Chat → Quote → Accept in one rail.',
    body: 'Couples request a bid through your microsite, you spend 1 token to open the thread, you chat and finalize pricing together, customer accepts. Reply-time stats show on your public profile — fast vendors get more bookings.',
  },
  {
    tag: 'Grow with the platform',
    title: 'Wedding today. Debut, birthday, corporate, anniversaries — yours next.',
    body: 'Every event type opens as our verified vendor count crosses the threshold in your area. Your verification, reviews, and CRM history carry into each one — no second listing, no second login.',
  },
  {
    tag: 'Sponsored boost',
    title: 'Pay-per-week visibility from 10km → 30km radius. Pause anytime.',
    body: 'Ready to scale? Boost your profile across nearby cities for a week at a time. Cancel mid-week, prorated refund.',
  },
  {
    tag: 'Crew-rate marketplace',
    title: 'Coming soon — list your crew, earn from every booking they take.',
    body: 'Service captains, photographers, AV ops can opt into Setnayan’s crew rates. You earn a referral cut on every gig your team picks up.',
  },
];

const LOCKS = [
  {
    num: '1',
    tag: '🔗 The couples',
    title: 'Couple matchmaking',
    body: "We hand-curate couple → vendor matches from briefs already in the platform. Not lead-gen ads — actual ops-team intros.",
  },
  {
    num: '2',
    tag: '📊 The data',
    title: 'Category benchmarks',
    body: "Your funnel, your pricing, your reply-time — vs the median for your category. Know if you're under-priced before you lose a deal.",
  },
  {
    num: '3',
    tag: '📊 The data',
    title: 'Reverse-image theft watch',
    body: 'Monthly scans of the open web for stolen versions of your portfolio. We surface the evidence — you decide what to do with it. Only possible because we see the marketplace.',
  },
  {
    num: '4',
    tag: '🎬 First-party',
    title: 'Co-listing with Productions',
    body: "Setnayan Productions is in every couple's bundle recommendation. Pro lets your service ride alongside ours.",
  },
];

function MatrixCell({
  value,
  isPro,
}: {
  value: CellValue;
  isPro: boolean;
}): ReactNode {
  if (typeof value === 'boolean') {
    if (value) {
      return (
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: isPro ? 'var(--m-orange)' : 'var(--m-sage)',
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
          }}
        >
          ✓
        </span>
      );
    }
    return (
      <span
        className="m-mono"
        style={{
          color: 'var(--m-slate-3)',
          fontSize: 12,
        }}
      >
        —
      </span>
    );
  }
  if (value === '—') {
    return (
      <span
        className="m-mono"
        style={{ color: 'var(--m-slate-3)', fontSize: 12 }}
      >
        —
      </span>
    );
  }
  return (
    <span
      className="m-mono"
      style={{
        fontSize: 11,
        fontWeight: isPro ? 500 : 400,
        color: isPro ? 'var(--m-paper)' : 'var(--m-ink)',
      }}
    >
      {value}
    </span>
  );
}

export async function ForVendorsDeepDive() {
  const p = await getVendorPrices();
  return (
    <section
      style={{
        padding: '120px 56px',
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
          books, and more couples knowing you exist. Free to start — pay only
          when you opt into a boost.
        </p>
      </div>

      {/* Free vs Pro intro */}
      <div style={{ marginBottom: 14 }}>
        <div className="m-eyebrow" style={{ color: 'var(--m-slate-2)' }}>
          Free vs Pro · what you get on each side
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
          Free is designed to beat the patchwork stack you use today (Kasal +
          Google Calendar + WhatsApp + Wave). Pro is the stuff{' '}
          <em style={{ color: 'var(--m-ink)' }}>only Setnayan can offer</em> —
          because we have the couples, the data, and the ops team.
        </div>
      </div>

      {/* 4-tier matrix */}
      <div
        className="m-card m-matrix-container"
        style={{ padding: 0, overflow: 'hidden' }}
      >
        {/* Header row · 4 tiers */}
        <div
          className="m-matrix-row"
          style={{
            display: 'grid',
            gridTemplateColumns: '1.7fr 1fr 1fr 1fr 1fr',
            background: 'var(--m-paper)',
          }}
        >
          <div
            style={{
              padding: '22px 24px',
              borderBottom: '1px solid var(--m-line)',
            }}
          >
            <div className="m-label-mono">Capability</div>
          </div>
          {/* FREE */}
          <div
            style={{
              padding: '22px 16px',
              borderBottom: '1px solid var(--m-line)',
              borderLeft: '1px solid var(--m-line-soft)',
            }}
          >
            <div className="m-label-mono">Free</div>
            <div
              className="m-display"
              style={{
                fontSize: 22,
                color: 'var(--m-ink)',
                marginTop: 4,
              }}
            >
              ₱0{' '}
              <span style={{ fontSize: 12, color: 'var(--m-slate-2)' }}>/ 28d</span>
            </div>
            <div
              className="m-mono"
              style={{ fontSize: 10, color: 'var(--m-slate-2)', marginTop: 4 }}
            >
              no card needed
            </div>
          </div>
          {/* VERIFIED */}
          <div
            style={{
              padding: '22px 16px',
              borderBottom: '1px solid var(--m-line)',
              borderLeft: '1px solid var(--m-line-soft)',
            }}
          >
            <div className="m-label-mono">✓ Verified</div>
            <div
              className="m-display"
              style={{
                fontSize: 22,
                color: 'var(--m-ink)',
                marginTop: 4,
              }}
            >
              ₱0{' '}
              <span style={{ fontSize: 12, color: 'var(--m-slate-2)' }}>to start</span>
            </div>
            <div
              className="m-mono"
              style={{ fontSize: 10, color: 'var(--m-slate-2)', marginTop: 4 }}
            >
              verified badge · free to get
            </div>
          </div>
          {/* PRO (highlighted) */}
          <div
            style={{
              padding: '22px 16px',
              borderBottom: '1px solid var(--m-line)',
              background: 'var(--m-ink)',
              color: 'var(--m-paper)',
              position: 'relative',
            }}
          >
            <div className="m-label-mono" style={{ color: 'var(--m-orange-3)' }}>
              ★ Pro
            </div>
            <div
              className="m-display"
              style={{
                fontSize: 22,
                color: 'var(--m-paper)',
                marginTop: 4,
              }}
            >
              {p.proMonthly}{' '}
              <span style={{ fontSize: 12, color: 'var(--m-slate-4)' }}>/ 28d</span>
            </div>
            <div
              className="m-mono"
              style={{ fontSize: 10, color: 'var(--m-slate-4)', marginTop: 4 }}
            >
              3 categories · 3 accounts
            </div>
            {/* Annual alternative · added 2026-05-29 per CLAUDE.md eleventh
                2026-05-28 row · price updated ₱19,999 → ₱24,999 per CLAUDE.md
                2026-05-30 "🔒 V2.1 BRIEF AMENDMENT #2 LOCKED" row § 4.
                vendor_billing_catalog row pro_vendor_annual ₱24,999/yr is
                ~23% off Pro 28-day × 13 cycles = ₱32,487 sticker (save ₱7,488). */}
            <div
              className="m-mono"
              style={{ fontSize: 10, color: 'var(--m-orange-3)', marginTop: 6 }}
            >
              or {p.proAnnual}/yr · save {p.proAnnualSave}
            </div>
          </div>
          {/* ENTERPRISE */}
          <div
            style={{
              padding: '22px 16px',
              borderBottom: '1px solid var(--m-line)',
              borderLeft: '1px solid var(--m-line-soft)',
            }}
          >
            <div className="m-label-mono">⬢ Enterprise</div>
            <div
              className="m-display"
              style={{
                fontSize: 22,
                color: 'var(--m-ink)',
                marginTop: 4,
              }}
            >
              {p.enterpriseMonthly}{' '}
              <span style={{ fontSize: 12, color: 'var(--m-slate-2)' }}>/ 28d</span>
            </div>
            <div
              className="m-mono"
              style={{ fontSize: 10, color: 'var(--m-slate-2)', marginTop: 4 }}
            >
              all categories · unlimited team
            </div>
            {/* Annual alternative · added 2026-05-29 per CLAUDE.md eleventh
                2026-05-28 row · vendor_billing_catalog row
                enterprise_vendor_annual ₱54,999/yr ~17% off vs ₱65,988
                (save ₱10,989) */}
            <div
              className="m-mono"
              style={{ fontSize: 10, color: 'var(--m-orange-2)', marginTop: 6 }}
            >
              or {p.enterpriseAnnual}/yr · save {p.enterpriseAnnualSave}
            </div>
          </div>
        </div>

        {MATRIX_SECTIONS.map((sec) => (
          <div key={sec.section}>
            <div
              className="m-matrix-row"
              style={{
                display: 'grid',
                gridTemplateColumns: '1.7fr 1fr 1fr 1fr 1fr',
                background: 'var(--m-paper-2)',
              }}
            >
              <div style={{ padding: '18px 24px 6px', gridColumn: '1 / -1' }}>
                <div
                  className="m-display"
                  style={{
                    fontSize: 14,
                    color: 'var(--m-ink)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                  }}
                >
                  {sec.section}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--m-slate-2)',
                    marginTop: 4,
                    lineHeight: 1.45,
                  }}
                >
                  {sec.note}
                </div>
              </div>
            </div>
            {sec.rows.map((row, ri) => {
              const [feature, ...vals] = row;
              return (
                <div
                  key={`${sec.section}-${ri}`}
                  className="m-matrix-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.7fr 1fr 1fr 1fr 1fr',
                    borderTop: '1px solid var(--m-line-soft)',
                  }}
                >
                  <div
                    style={{
                      padding: '14px 24px',
                      fontSize: 13,
                      color: 'var(--m-ink)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {feature}
                  </div>
                  {vals.map((v, ci) => {
                    const isPro = ci === 2;
                    return (
                      <div
                        key={ci}
                        style={{
                          padding: '14px 16px',
                          borderLeft:
                            '1px solid ' +
                            (isPro
                              ? 'rgba(255,255,255,0.08)'
                              : 'var(--m-line-soft)'),
                          background: isPro ? 'var(--m-ink)' : 'var(--m-paper)',
                          color: isPro ? 'var(--m-paper)' : 'var(--m-slate)',
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <MatrixCell value={v} isPro={isPro} />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Why Pro is locked to Setnayan — 4 ecosystem reasons */}
      <div style={{ marginTop: 28 }}>
        <div className="m-eyebrow">Why Pro can&apos;t be bought elsewhere</div>
        <h3
          className="m-serif"
          style={{
            fontSize: 40,
            lineHeight: 1.06,
            margin: '12px 0 24px',
            color: 'var(--m-ink)',
            fontWeight: 400,
            maxWidth: 760,
          }}
        >
          Four ecosystem locks. Each one is impossible to replicate{' '}
          <em style={{ fontStyle: 'italic', color: 'var(--m-blush-deep)' }}>
            with any stack of SaaS.
          </em>
        </h3>
        <div
          className="m-locks-grid"
          style={{
            display: 'grid',
            gap: 14,
          }}
        >
          {LOCKS.map((c) => (
            <div
              key={c.num}
              className="m-card"
              style={{
                padding: 22,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                background: 'var(--m-paper)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span
                  className="m-mono"
                  style={{ fontSize: 11, color: 'var(--m-orange-2)' }}
                >
                  {c.tag}
                </span>
                <span
                  className="m-display"
                  style={{ fontSize: 22, color: 'var(--m-orange-3)' }}
                >
                  {c.num}
                </span>
              </div>
              <div
                className="m-display"
                style={{
                  fontSize: 20,
                  color: 'var(--m-ink)',
                  textTransform: 'uppercase',
                  lineHeight: 1.1,
                  marginTop: 4,
                }}
              >
                {c.title}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--m-slate)',
                  lineHeight: 1.5,
                }}
              >
                {c.body}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Founder bonus callout */}
      <div
        className="m-card m-callout"
        style={{
          padding: 22,
          marginTop: 16,
          display: 'grid',
          gap: 20,
          alignItems: 'center',
          background: 'var(--m-ink)',
          color: 'var(--m-paper)',
          border: 'none',
        }}
      >
        <div
          className="m-display"
          style={{ fontSize: 36, color: 'var(--m-orange-3)' }}
        >
          100×
        </div>
        <div>
          <div className="m-label-mono" style={{ color: 'var(--m-orange-3)' }}>
            Founder bonus · 100 free bidding tokens on verification
          </div>
          <div
            style={{
              fontSize: 14,
              color: 'var(--m-paper)',
              marginTop: 4,
              lineHeight: 1.5,
            }}
          >
            Verify your business before{' '}
            <strong style={{ color: 'var(--m-orange-3)' }}>
              31 January 2027
            </strong>{' '}
            and we drop{' '}
            <strong style={{ color: 'var(--m-orange-3)' }}>
              100 free bidding tokens
            </strong>{' '}
            into your account — enough to chase ~100 couple inquiries without
            spending a peso on packs. After 31 Jan 2027, founder bonus ends.
          </div>
        </div>
        <Link
          href="/signup?as=vendor"
          className="m-btn m-btn-orange"
          style={{ padding: '10px 18px' }}
        >
          Verify now →
        </Link>
      </div>

      {/* 0% commission strip */}
      <div
        className="m-card m-callout"
        style={{
          padding: 22,
          marginTop: 16,
          display: 'grid',
          gap: 20,
          alignItems: 'center',
          background: 'var(--m-ivory)',
        }}
      >
        <div
          className="m-display"
          style={{ fontSize: 36, color: 'var(--m-orange-2)' }}
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
            tokens, and our own Productions services — not on your bookings.
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

      {/* Enterprise tier teaser */}
      <div
        className="m-card m-callout"
        style={{
          padding: 22,
          marginTop: 16,
          display: 'grid',
          gap: 20,
          alignItems: 'center',
          background: 'var(--m-paper-2)',
        }}
      >
        <div
          className="m-display"
          style={{ fontSize: 36, color: 'var(--m-orange-2)' }}
        >
          {p.enterpriseMonthly}
        </div>
        <div>
          <div className="m-label-mono">Enterprise · {p.enterpriseMonthly} / 28 days</div>
          <div
            style={{
              fontSize: 14,
              color: 'var(--m-slate)',
              marginTop: 4,
              lineHeight: 1.5,
            }}
          >
            Multi-category listing + unlimited team accounts. Same Pro feature
            set, scaled for full-service event houses running coordination,
            florals, photo, and catering under one roof. Verification still
            required.
          </div>
        </div>
        <Link
          href="/help#contact"
          className="m-btn m-btn-ghost"
          style={{ padding: '10px 18px' }}
        >
          Talk to ops →
        </Link>
      </div>

      {/* Benefit grid */}
      <div
        className="m-benefits-grid"
        style={{
          display: 'grid',
          gap: 16,
          marginTop: 28,
        }}
      >
        {BENEFITS.map((b) => (
          <div
            key={b.tag}
            className="m-card"
            style={{
              padding: 22,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              height: '100%',
            }}
          >
            <span
              className="m-mono"
              style={{ fontSize: 11, color: 'var(--m-orange-2)' }}
            >
              {b.tag}
            </span>
            <div
              className="m-display"
              style={{
                fontSize: 22,
                color: 'var(--m-ink)',
                textTransform: 'uppercase',
                lineHeight: 1.08,
              }}
            >
              {b.title}
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--m-slate)',
                lineHeight: 1.55,
              }}
            >
              {b.body}
            </div>
          </div>
        ))}
      </div>

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
            style={{ fontSize: 44, color: 'var(--m-paper)', marginTop: 8, lineHeight: 1.02 }}
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
            Profile, photos, services, calendar — get listed today. Verification
            in 24 hours. First proposal in your inbox by next week.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link
            href="/signup?as=vendor"
            className="m-btn m-btn-orange m-btn-lg"
            style={{ justifyContent: 'center' }}
          >
            Register your business — free
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
          .m-locks-grid { grid-template-columns: repeat(4, 1fr); }
          .m-benefits-grid { grid-template-columns: repeat(3, 1fr); }
          .m-callout { grid-template-columns: auto 1fr auto; }
          .m-vendor-cta-strip { grid-template-columns: 1.4fr 1fr; }
        }
        @media (max-width: 1023px) {
          .m-grid-2 { grid-template-columns: 1fr; }
          .m-locks-grid { grid-template-columns: repeat(2, 1fr); }
          .m-benefits-grid { grid-template-columns: 1fr; }
          .m-callout { grid-template-columns: 1fr; }
          .m-vendor-cta-strip { grid-template-columns: 1fr; }
          .m-matrix-container { overflow-x: auto; }
          .m-matrix-row {
            min-width: 760px;
          }
        }
      `}</style>
    </section>
  );
}
