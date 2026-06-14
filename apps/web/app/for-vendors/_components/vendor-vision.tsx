/**
 * VendorVision · the "why" spine for /for-vendors.
 *
 * WHY: owner brief 2026-06-15 — "what we want here is to share our vision to
 * the vendors." The page led with the feature stack (VendorHero +
 * StackCloseVendor + DeepDive + Pricing table); this section is the missing
 * narrative that earns the vendor before the proof. Slots between VendorHero
 * and StackCloseVendor.
 *
 * Owner-authored vision, tightened to page-ready copy. Six moments:
 *   1. The promise — give couples their dream wedding, we give back your time.
 *   2. Set your price once — base + per-pax, shown instantly, yours to vary.
 *   3. Every inquiry counts — we've paid for ads too; you pay only on real fit.
 *   4. We never abuse your business — rise by merit, can't pay to fake success.
 *   5. New vendors get discovered — fit not fame · admit-unknown · merit climb
 *      (the deterministic leaf-match + never-empty + hybrid-anonymity model).
 *   6. Tools that grow your business — calendar sync · BYO couples · portfolio
 *      site · editorial tagging · 0% commission.
 * Then: Tokens (simple + honest, per owner 2026-06-15) and Pro/Enterprise
 * (growth-gated, not craft-gated, per owner 2026-06-15).
 *
 * Prices are DB-driven via getVendorPrices() — never hardcoded (owner rule
 * [[project_setnayan_pricing_admin_managed]]). Brand/positioning locks honored:
 * 0% commission, Setnayan-never-holds-the-money, "tiers sell reach/growth not
 * craft" [[project_setnayan_vendor_tier_ladder]], merit-reward loop.
 */
import Link from 'next/link';
import { getVendorPrices } from '@/lib/v2-catalog';

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

const TOOLS = [
  {
    title: 'Calendar sync — never double-book',
    body: 'When your day is taken, you drop out of searches for couples who need only that day. No more turning down couples you already knew you couldn’t take.',
  },
  {
    title: 'Bring your own couples',
    body: 'We send you couples — but your app should hold all of your business. Import the couples you booked outside Setnayan so everything lives in one place.',
  },
  {
    title: 'A portfolio that replaces your website',
    body: 'Every wedding you deliver is recorded and shown to the public — a living portfolio of your work. Couples see exactly why you fit, and you never need a separate website again.',
  },
  {
    title: 'Editorial tagging — your work, shared',
    body: 'Every wedding becomes a lifetime memory, and your hard work gets credited inside it. No more digging through galleries to show a couple what you can do.',
  },
  {
    title: '0% commission, always',
    body: 'Your service is your lifeblood. Couples pay you directly, Setnayan never holds the money, and we will never take a cut of it.',
  },
];

export async function VendorVision() {
  const p = await getVendorPrices();
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

        {/* ── 6 · Tools that grow your business ─────────────────────────── */}
        <div style={{ marginTop: 'clamp(56px, 7vw, 88px)' }}>
          <h3 className="m-display" style={{ fontSize: 'clamp(26px, 3.6vw, 40px)', color: 'var(--m-ink)', margin: 0, lineHeight: 1.05, maxWidth: 760 }}>
            We’re modernizing this industry by handing you the tools to grow it.
          </h3>
          <div
            className="m-vv-tools"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginTop: 28 }}
          >
            {TOOLS.map((t) => (
              <div key={t.title} className="m-card" style={{ padding: 22 }}>
                <div className="m-display" style={{ fontSize: 18, color: 'var(--m-ink)', lineHeight: 1.18 }}>{t.title}</div>
                <p style={{ fontSize: 13.5, color: 'var(--m-slate)', lineHeight: 1.55, marginTop: 8 }}>{t.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tokens · simple + honest (owner 2026-06-15) ───────────────── */}
        <div
          style={{
            marginTop: 'clamp(56px, 7vw, 88px)',
            padding: 'clamp(28px, 4vw, 44px)',
            border: '1px solid var(--m-line)',
            borderRadius: 12,
            background: 'var(--m-paper-2)',
          }}
        >
          <div className="m-mono" style={{ fontSize: 12, letterSpacing: '0.16em', color: 'var(--m-orange-2)', textTransform: 'uppercase' }}>
            Tokens
          </div>
          <h3 className="m-display" style={{ fontSize: 'clamp(24px, 3.2vw, 34px)', color: 'var(--m-ink)', margin: '12px 0 0', lineHeight: 1.08 }}>
            You only spend when a real couple reaches you.
          </h3>
          <p style={{ fontSize: 16, color: 'var(--m-slate)', lineHeight: 1.62, marginTop: 14, maxWidth: 700 }}>
            No listing fee. No commission. The only thing you ever spend is a <strong style={{ color: 'var(--m-ink)' }}>token</strong> — and only to
            open a conversation with a couple we’ve matched to you. One token opens one real inquiry; after that, the
            whole conversation is yours, free. Verified vendors get <strong style={{ color: 'var(--m-ink)' }}>free couple unlocks every week</strong>, so
            you can start without spending. Beyond that, top up in packs at {p.tokenUnit} a token, whenever you want.
          </p>
          <p style={{ fontSize: 15, color: 'var(--m-slate-2)', lineHeight: 1.6, marginTop: 12, maxWidth: 700 }}>
            And it can pay you back: every Setnayan service you recommend that shows up at the wedding earns a token
            returned to your wallet. Refer well, and you barely spend at all.
          </p>
        </div>

        {/* ── Pro & Enterprise · growth-gated, not craft-gated ──────────── */}
        <div
          style={{
            marginTop: 'clamp(40px, 5vw, 56px)',
            padding: 'clamp(28px, 4vw, 48px)',
            borderRadius: 12,
            background: 'var(--m-ink)',
            color: 'var(--m-paper)',
            boxShadow: 'var(--m-shadow-lg)',
          }}
        >
          <div className="m-mono" style={{ fontSize: 12, letterSpacing: '0.16em', color: 'var(--m-orange-3)', textTransform: 'uppercase' }}>
            When you outgrow free
          </div>
          <h3 className="m-display" style={{ fontSize: 'clamp(24px, 3.4vw, 38px)', color: 'var(--m-paper)', margin: '12px 0 0', lineHeight: 1.06, maxWidth: 760 }}>
            Free is a whole business. Pro and Enterprise are for when you’re growing.
          </h3>
          <p style={{ fontSize: 16, color: 'var(--m-slate-4)', lineHeight: 1.6, marginTop: 14, maxWidth: 700 }}>
            As your business grows, you need more — more categories to list in, more team accounts, wider reach, and
            more tools to run it all. That’s exactly what Pro and Enterprise add. You’re never paying to unlock your
            craft; you’re paying to <strong style={{ color: 'var(--m-paper)' }}>expand it</strong>.
          </p>
          <div className="m-vv-tiers" style={{ display: 'grid', gap: 16, marginTop: 28 }}>
            <div style={{ padding: 22, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="m-mono" style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--m-orange-3)', textTransform: 'uppercase' }}>
                Pro
              </div>
              <div className="m-display" style={{ fontSize: 28, color: 'var(--m-paper)', marginTop: 8 }}>
                {p.proMonthly}
                <span style={{ fontSize: 14, color: 'var(--m-slate-4)' }}> / 28 days</span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--m-slate-4)', lineHeight: 1.55, marginTop: 10 }}>
                For the vendor who’s growing. List in more categories, add your team, widen your reach, and get priority
                in matching so you surface to more of the couples who fit you.
              </p>
            </div>
            <div style={{ padding: 22, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="m-mono" style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--m-orange-3)', textTransform: 'uppercase' }}>
                Enterprise
              </div>
              <div className="m-display" style={{ fontSize: 28, color: 'var(--m-paper)', marginTop: 8 }}>
                {p.enterpriseMonthly}
                <span style={{ fontSize: 14, color: 'var(--m-slate-4)' }}> / 28 days</span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--m-slate-4)', lineHeight: 1.55, marginTop: 10 }}>
                For full-service houses running coordination, florals, photo, and catering under one roof. Every category,
                unlimited team, the widest reach, multiple events a day.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link href="/signup?as=vendor" className="m-btn m-btn-orange m-btn-lg">
              Register your business — free
            </Link>
            <span style={{ fontSize: 13, color: 'var(--m-slate-4)' }}>
              0% commission on every tier. Full feature-by-feature comparison below.
            </span>
          </div>
        </div>
      </div>

      {/* Responsive — pillars go 2-col (number rail + body) on desktop;
          discovery + tiers go 2-col on wider screens. */}
      <style>{`
        @media (min-width: 768px) {
          .m-vv-pillar { grid-template-columns: 80px 1fr; }
          .m-vv-disc { grid-template-columns: 1fr 1fr; }
          .m-vv-tiers { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 767px) {
          .m-vv-pillar { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  );
}
