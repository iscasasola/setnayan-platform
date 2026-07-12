/**
 * VendorWorthIt · the "add it up, then look at the price" value section.
 *
 * WHY (owner brief 2026-07-01 — for-vendors redesign · "make it feel worth
 * it"): the page asserted value but never *quantified* it. This section is
 * the missing attractiveness lever, leading all three worth-it devices the
 * owner picked:
 *   1. Value stack / anchoring — total the typical standalone cost of every
 *      tool a vendor gets, then reveal it's all included far below that.
 *   2. ROI — one booking covers the year; at 0% commission every peso is theirs.
 *   3. 8-tools → 1 cost-replace — reinforced here, fully shown in StackCloseVendor.
 *
 * Prices are DB-driven via getVendorPrices() (never hardcoded — owner
 * 2026-06-08). The standalone tool costs are labelled "typical" estimates
 * (anchoring), not competitor quotes.
 */
import Link from 'next/link';
import { getVendorPrices } from '@/lib/v2-catalog';

// Typical standalone monthly cost of running each capability on a separate
// tool — illustrative PH market estimates used for value-stack anchoring.
const VALUE_STACK: { label: string; sub: string; php: number }[] = [
  { label: 'Verified profile + microsite', sub: 'directory listing + branded page', php: 1500 },
  { label: 'Portfolio gallery', sub: 'Pixieset-class hosting', php: 500 },
  { label: 'Booking calendar + scheduling', sub: 'Calendly-class consults', php: 600 },
  { label: 'Client CRM + bid pipeline', sub: 'lead → quote → booked', php: 1200 },
  { label: 'Proposal builder', sub: 'branded quotes in minutes', php: 900 },
  { label: 'Contracts + e-signature', sub: 'RA 8792 e-sign flow', php: 700 },
  { label: 'Invoicing + bookkeeping', sub: 'Bukku-class billing', php: 500 },
  { label: 'Analytics + category benchmarks', sub: 'know your numbers', php: 800 },
];

const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`;

export async function VendorWorthIt() {
  const p = await getVendorPrices();
  const stackTotal = VALUE_STACK.reduce((s, r) => s + r.php, 0);

  return (
    <section
      style={{
        padding: 'clamp(64px, 11vw, 120px) clamp(20px, 5vw, 56px)',
        background: 'var(--m-paper-2)',
      }}
    >
      {/* Heading */}
      <div style={{ maxWidth: 760, marginBottom: 'clamp(32px, 5vw, 56px)' }}>
        <div className="m-eyebrow">For vendors · what it&apos;s worth</div>
        <h2
          className="m-serif"
          style={{
            fontSize: 'clamp(40px, 6.5vw, 76px)',
            lineHeight: 1.04,
            margin: '18px 0 16px',
            letterSpacing: '-0.025em',
            color: 'var(--m-ink)',
            fontWeight: 400,
          }}
        >
          Add it up.{' '}
          <em style={{ fontStyle: 'italic', color: 'var(--m-blush-deep)' }}>
            Then look at the price.
          </em>
        </h2>
        <p style={{ fontSize: 17, color: 'var(--m-slate)', lineHeight: 1.55 }}>
          Every tool a vendor cobbles together — a listing here, a portfolio
          there, a scheduler, a CRM, a contract app — has its own bill and its
          own login. On Setnayan it&apos;s one subscription, one dashboard, and
          you keep 100% of every booking.
        </p>
      </div>

      <div className="m-worth-grid" style={{ display: 'grid', gap: 16, alignItems: 'start' }}>
        {/* LEFT — value stack */}
        <div className="m-card" style={{ padding: 'clamp(20px, 3vw, 32px)', background: 'var(--m-paper)' }}>
          <div className="m-label-mono">Bought separately · typical monthly cost</div>
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column' }}>
            {VALUE_STACK.map((r, i) => (
              <div
                key={r.label}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 16,
                  padding: '12px 0',
                  borderTop: i === 0 ? 'none' : '1px solid var(--m-line-soft)',
                }}
              >
                <div>
                  <div style={{ fontSize: 14.5, color: 'var(--m-ink)', lineHeight: 1.3 }}>
                    {r.label}
                  </div>
                  <div className="m-mono" style={{ fontSize: 11, color: 'var(--m-slate-2)', marginTop: 2 }}>
                    {r.sub}
                  </div>
                </div>
                <div
                  className="m-mono"
                  style={{ fontSize: 13, color: 'var(--m-slate)', whiteSpace: 'nowrap' }}
                >
                  {peso(r.php)}/mo
                </div>
              </div>
            ))}
          </div>

          {/* Total + reveal */}
          <div
            style={{
              marginTop: 20,
              paddingTop: 18,
              borderTop: '2px solid var(--m-ink)',
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <span className="m-label-mono">Their stack, every month</span>
            <span
              className="m-display"
              style={{
                fontSize: 'clamp(26px, 4vw, 34px)',
                color: 'var(--m-slate-2)',
                textDecoration: 'line-through',
                textDecorationColor: 'var(--m-blush-deep)',
              }}
            >
              {peso(stackTotal)}+
            </span>
          </div>
          <div
            style={{
              marginTop: 14,
              padding: '16px 18px',
              borderRadius: 'var(--m-r-sm)',
              background: 'var(--m-ink)',
              color: 'var(--m-paper)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div className="m-mono" style={{ fontSize: 10.5, color: 'var(--m-orange-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                All of it, included
              </div>
              <div className="m-display" style={{ fontSize: 'clamp(22px, 3.5vw, 28px)', color: 'var(--m-paper)', marginTop: 2 }}>
                from {p.soloMonthly}/28 days
              </div>
            </div>
            <div className="m-mono" style={{ fontSize: 11, color: 'var(--m-slate-4)', maxWidth: 180, lineHeight: 1.4 }}>
              Pro adds Advanced Proposal Drafting, benchmarks &amp; wider reach at {p.proMonthly}/28d.
            </div>
          </div>
          <p className="m-mono" style={{ fontSize: 10.5, color: 'var(--m-slate-3)', marginTop: 12, lineHeight: 1.5 }}>
            Standalone figures are typical PH market estimates for comparable
            tools — illustrative, not competitor quotes.
          </p>
        </div>

        {/* RIGHT — ROI + 0% commission */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ROI card */}
          <div
            className="m-card"
            style={{
              padding: 'clamp(22px, 3vw, 32px)',
              background: 'var(--m-paper)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div className="m-label-mono">The math that matters</div>
            <div
              className="m-serif"
              style={{
                fontSize: 'clamp(28px, 4.5vw, 44px)',
                lineHeight: 1.05,
                color: 'var(--m-ink)',
                fontWeight: 400,
              }}
            >
              One booking pays for{' '}
              <em style={{ fontStyle: 'italic', color: 'var(--m-blush-deep)' }}>
                the whole year.
              </em>
            </div>
            <p style={{ fontSize: 14.5, color: 'var(--m-slate)', lineHeight: 1.55 }}>
              A single wedding booking almost always covers your entire year on
              Setnayan — and because commission is <strong style={{ color: 'var(--m-ink)' }}>0%</strong>, every
              peso of that booking is yours. The couple pays you directly. We
              never touch the money.
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                marginTop: 4,
              }}
            >
              <div style={{ padding: '14px 16px', borderRadius: 'var(--m-r-sm)', background: 'var(--m-paper-2)' }}>
                <div className="m-display" style={{ fontSize: 28, color: 'var(--m-orange-2)' }}>
                  {p.proAnnual}
                </div>
                <div className="m-mono" style={{ fontSize: 10.5, color: 'var(--m-slate-2)', marginTop: 2 }}>
                  Pro · a full year
                </div>
              </div>
              <div style={{ padding: '14px 16px', borderRadius: 'var(--m-r-sm)', background: 'var(--m-paper-2)' }}>
                <div className="m-display" style={{ fontSize: 28, color: 'var(--m-orange-2)' }}>
                  0%
                </div>
                <div className="m-mono" style={{ fontSize: 10.5, color: 'var(--m-slate-2)', marginTop: 2 }}>
                  kept on every booking
                </div>
              </div>
            </div>
          </div>

          {/* Cost-replace strip — ties back to StackCloseVendor */}
          <div
            className="m-card"
            style={{
              padding: 'clamp(22px, 3vw, 28px)',
              background: 'var(--m-ink)',
              color: 'var(--m-paper)',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div className="m-mono" style={{ fontSize: 10.5, color: 'var(--m-orange-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              8 tools → 1 login
            </div>
            <div className="m-display" style={{ fontSize: 'clamp(22px, 3.5vw, 30px)', color: 'var(--m-paper)', lineHeight: 1.05 }}>
              Cancel the Frankenstein stack.
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--m-slate-4)', lineHeight: 1.55 }}>
              Kasal, Bridestory, Pixieset, Calendly, Bukku, Drive, a calendar,
              and a dozen WhatsApp groups — replaced by one dashboard. One bill.
              One inbox. Nothing slips between apps.
            </p>
            <div style={{ marginTop: 4 }}>
              <Link
                href="/signup?as=vendor"
                className="m-btn m-btn-orange"
                style={{ justifyContent: 'center', width: '100%' }}
              >
                Register your business — free
              </Link>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .m-worth-grid { grid-template-columns: 1.15fr 1fr; }
        }
        @media (max-width: 1023px) {
          .m-worth-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  );
}
