/**
 * VendorVision · the "why" spine for /for-vendors.
 *
 * WHY: owner brief 2026-06-15 — "share our vision to the vendors." Sits between
 * VendorHero (the hook) and StackCloseVendor (the proof): the narrative that
 * earns the vendor before the feature stack.
 *
 * SCOPE (trimmed 2026-06-15 in the full-reflow pass): this section now carries
 * ONLY the emotional/why content — the promise, the three pillars, and how new
 * vendors get discovered. The "5 growth tools" grid, the Tokens panel, and the
 * Pro/Enterprise panel were REMOVED here because they duplicated downstream
 * sections (StackCloseVendor + ForVendorsDeepDive benefits = what-you-get; the
 * deep-dive tier matrix + bidding rows + FAQ = pricing/tokens). The vision now
 * hands off to those instead of repeating them. No prices referenced → no DB
 * read, component is sync.
 *
 * Owner rulings honored: every-inquiry-counts · merit-not-money ·
 * growth-gated-not-craft-gated framing [[project_setnayan_vendor_tier_ladder]];
 * discovery = leaf-match fit + admit-unknown + hybrid-anonymity + standing
 * weekly free unlocks (the founder-bonus 100-token grant was retired 2026-06-15).
 */

const PILLARS = [
  {
    n: '01',
    title: 'Set your price once. Never recompute again.',
    body: 'Set your base price, and a price for extra guests if you need one. That’s it — couples see your range instantly, with no waiting and no re-quoting for every new inquiry. Your final price is always yours to decide, couple by couple, based only on what they actually need. We’ll never force you into a fixed public rate, because every couple wants the best wedding they can afford — and a copy-paste rate card doesn’t honor that.',
  },
  {
    n: '02',
    title: 'Every inquiry counts.',
    body: 'As business owners ourselves, we’ve paid for ads and watched almost all of it go to people who were never going to book us. That ends here. You don’t pay to be listed, you don’t pay for ads that miss, and you never pay a commission on your sale. You spend only when we bring you an inquiry that actually fits your business. No fit, no inquiry, no cost — the market that reaches you is smaller, better, and built for your range.',
  },
  {
    n: '03',
    title: 'We never abuse your business.',
    body: 'Other apps let you pay to fake your success. We don’t — and neither can anyone else. You rise by doing the work well: respond fast, complete your service, earn honest reviews from the couples you served, and build a fuller set of services. The better you are, the more we put you in front of couples. We grow when you grow.',
  },
];

const DISCOVERY = [
  ['Matched on fit, not fame', 'A new vendor who’s right for a couple ranks above a famous one who’s booked or out of budget.'],
  ['No track record doesn’t bury you', '“No reviews yet” reads as unknown, never as bad — it costs you nothing in the rankings.'],
  ['Free weekly unlocks to start', 'Verified vendors get free couple unlocks every week — so a new vendor can answer matched couples without spending a peso.'],
  ['Hidden until you reply', 'Your name stays private until you answer, so couples choose you for the fit — before they’ve heard of you.'],
  ['Every search shows real matches', 'Couples always get a fillable shortlist, so new vendors get real attention from day one.'],
  ['You climb by merit', 'Reply fast, finish well, earn real reviews. Nail your first five couples and you rise fast. No budget can fake that.'],
];

export function VendorVision() {
  return (
    <section
      style={{
        padding: 'clamp(72px, 9vw, 112px) clamp(20px, 5vw, 56px)',
        background: 'var(--m-paper)',
        borderTop: '1px solid var(--m-line-soft)',
      }}
    >
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        {/* ── 1 · The promise ───────────────────────────────────────────── */}
        <div className="m-mono" style={{ fontSize: 12, letterSpacing: '0.18em', color: 'var(--m-orange-2)', textTransform: 'uppercase' }}>
          Our promise to you
        </div>
        <h2
          className="m-display"
          style={{ fontSize: 'clamp(34px, 5.2vw, 60px)', lineHeight: 1.02, margin: '18px 0 0', color: 'var(--m-ink)', maxWidth: 880 }}
        >
          You give couples the wedding of their dreams.
          <br />
          <span style={{ color: 'var(--m-orange-2)' }}>We give you back your time.</span>
        </h2>
        <p style={{ fontSize: 'clamp(16px, 2vw, 19px)', color: 'var(--m-slate)', lineHeight: 1.6, marginTop: 24, maxWidth: 720 }}>
          Every couple deserves your best work — and every couple is hours of it. The hardest part isn’t the
          service. It’s that every conversation starts from zero: the same questions, the same back-and-forth,
          before you even know if it’s a real fit. Setnayan changes <em>where you start</em>. By the time a couple
          reaches you, we’ve already done the matching — so you begin at <strong style={{ color: 'var(--m-ink)' }}>“here’s what I need”</strong>, not
          <strong style={{ color: 'var(--m-ink)' }}> “how much, and are you even free?”</strong>
        </p>

        {/* ── 2-4 · The three pillars ───────────────────────────────────── */}
        <div style={{ marginTop: 'clamp(48px, 6vw, 72px)', display: 'grid', gap: 0 }}>
          {PILLARS.map((pil, i) => (
            <div
              key={pil.n}
              className="m-vv-pillar"
              style={{
                display: 'grid',
                gap: 'clamp(8px, 3vw, 40px)',
                padding: 'clamp(28px, 4vw, 40px) 0',
                borderTop: i === 0 ? '1px solid var(--m-ink)' : '1px solid var(--m-line)',
                alignItems: 'start',
              }}
            >
              <div className="m-display" style={{ fontSize: 'clamp(28px, 4vw, 40px)', color: 'var(--m-orange-3)', lineHeight: 1 }}>
                {pil.n}
              </div>
              <div>
                <h3 className="m-display" style={{ fontSize: 'clamp(22px, 3vw, 30px)', color: 'var(--m-ink)', margin: 0, lineHeight: 1.1 }}>
                  {pil.title}
                </h3>
                <p style={{ fontSize: 16, color: 'var(--m-slate)', lineHeight: 1.62, marginTop: 12, maxWidth: 640 }}>{pil.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── 5 · New vendors get discovered (the owner's question) ─────── */}
        <div
          className="m-card"
          style={{
            marginTop: 'clamp(48px, 6vw, 72px)',
            padding: 'clamp(28px, 4vw, 48px)',
            background: 'var(--m-orange-4)',
            border: '1px solid var(--m-orange-3)',
          }}
        >
          <div className="m-mono" style={{ fontSize: 12, letterSpacing: '0.16em', color: 'var(--m-orange-2)', textTransform: 'uppercase' }}>
            New in the industry?
          </div>
          <h3 className="m-display" style={{ fontSize: 'clamp(26px, 3.6vw, 40px)', color: 'var(--m-ink)', margin: '12px 0 0', lineHeight: 1.05 }}>
            You’re not buried. You’re discoverable from day one.
          </h3>
          <p style={{ fontSize: 16, color: 'var(--m-slate)', lineHeight: 1.6, marginTop: 14, maxWidth: 680 }}>
            Here, being good is the growth strategy. There’s no “who’s-been-here-longest” leaderboard — we put
            you in front of couples you genuinely fit, then let your work do the rest.
          </p>
          <div className="m-vv-disc" style={{ display: 'grid', gap: 'clamp(16px, 2.5vw, 28px)', marginTop: 28 }}>
            {DISCOVERY.map(([h, b]) => (
              <div key={h} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span aria-hidden style={{ color: 'var(--m-orange-2)', fontWeight: 700, lineHeight: 1.4, flexShrink: 0 }}>
                  &rarr;
                </span>
                <div>
                  <div className="m-display" style={{ fontSize: 17, color: 'var(--m-ink)', lineHeight: 1.2 }}>{h}</div>
                  <p style={{ fontSize: 14, color: 'var(--m-slate)', lineHeight: 1.5, marginTop: 4 }}>{b}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Responsive — pillars go 2-col (number rail + body) on desktop;
          discovery goes 2-col on wider screens. */}
      <style>{`
        @media (min-width: 768px) {
          .m-vv-pillar { grid-template-columns: 80px 1fr; }
          .m-vv-disc { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 767px) {
          .m-vv-pillar { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  );
}
