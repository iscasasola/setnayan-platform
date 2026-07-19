/**
 * VendorGrow* — the narrative sections of the rebuilt /vendors page, a faithful
 * port of the owner-approved prototype (vendors_page_v2_final.html). The flow:
 *   thesis strip → free business hub → Setnayan AI (dark signature) →
 *   only-pay-when-it-works → free website that ranks → analytics + inquiries →
 *   trust earned not bought → no-fakes → reach that compounds → the tools →
 *   get paid your way.
 *
 * All Clean Editorial tokens (--m-*). Radii route through --m-r-* per the
 * radius-token lint guard (no hardcoded px radius). Prices are NOT rendered in
 * these sections — the tier prices live in the DB-sourced matrix; this narrative
 * speaks the "free" thesis, never a number. Server components (no hooks).
 */
import Link from 'next/link';

/* ── shared primitives ─────────────────────────────────────────────────── */

function Eyebrow({ children, center, onDark }: { children: React.ReactNode; center?: boolean; onDark?: boolean }) {
  return (
    <span
      className="m-mono"
      style={{
        fontSize: 11,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: onDark ? 'var(--m-orange)' : 'var(--m-orange-2)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        justifyContent: center ? 'center' : undefined,
      }}
    >
      <span aria-hidden style={{ width: 24, height: 1, background: onDark ? 'var(--m-orange)' : 'var(--m-orange)' }} />
      {children}
    </span>
  );
}

function H2({ children, onDark }: { children: React.ReactNode; onDark?: boolean }) {
  return (
    <h2
      className="m-serif"
      style={{
        fontSize: 'clamp(28px, 4.6vw, 50px)',
        lineHeight: 1.04,
        letterSpacing: '-0.01em',
        margin: '14px 0',
        fontWeight: 500,
        color: onDark ? '#fff' : 'var(--m-ink)',
        textWrap: 'balance',
      }}
    >
      {children}
    </h2>
  );
}

function Lede({ children, onDark, style }: { children: React.ReactNode; onDark?: boolean; style?: React.CSSProperties }) {
  return (
    <p style={{ fontSize: 17, color: onDark ? 'var(--m-mulberry-3)' : 'var(--m-slate)', margin: 0, lineHeight: 1.6, ...style }}>
      {children}
    </p>
  );
}

const SECTION: React.CSSProperties = {
  maxWidth: 1120,
  margin: '0 auto',
  padding: 'clamp(56px, 8vw, 104px) clamp(20px, 5vw, 56px)',
};

const SPLIT: React.CSSProperties = {
  display: 'grid',
  gap: 'clamp(28px, 5vw, 64px)',
  alignItems: 'center',
};

/** A soft feature-list row (icon chip + title + line). */
function FeatureLI({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <li style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <span
        aria-hidden
        style={{
          width: 34,
          height: 34,
          borderRadius: 'var(--m-r-sm)',
          background: 'var(--m-orange-4)',
          color: 'var(--m-orange-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 15,
        }}
      >
        {icon}
      </span>
      <span style={{ fontSize: 15 }}>
        <b style={{ fontWeight: 700, color: 'var(--m-ink)' }}>{title}</b>
        <span style={{ color: 'var(--m-slate)', display: 'block', fontSize: 14, marginTop: 2, lineHeight: 1.5 }}>{body}</span>
      </span>
    </li>
  );
}

/** A card in a 3-up grid. */
function GridCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="m-card m-card-lift" style={{ padding: 24 }}>
      <div
        aria-hidden
        style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--m-r-sm)',
          background: 'var(--m-ink)',
          color: 'var(--m-orange-3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          marginBottom: 14,
        }}
      >
        {icon}
      </div>
      <h3 className="m-serif" style={{ fontSize: 21, fontWeight: 600, margin: '0 0 7px', color: 'var(--m-ink)' }}>
        {title}
      </h3>
      <p style={{ fontSize: 13.5, color: 'var(--m-slate)', margin: 0, lineHeight: 1.55 }}>{body}</p>
    </div>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="m-vgrid" style={{ display: 'grid', gap: 16, marginTop: 36 }}>
      {children}
    </div>
  );
}

/* ── 0 · THESIS STRIP ──────────────────────────────────────────────────── */

export function VendorGrowThesis() {
  const items = [
    { b: '0%', s: 'commission, always — you keep 100% of every sale' },
    { b: '₱0', s: 'to run your whole business, import your clients & get discovered' },
    { b: 'Pay only', s: 'when a booking comes through us — never just for data' },
  ];
  return (
    <div style={{ background: 'var(--m-ink)', color: 'var(--m-mulberry-3)' }}>
      <div
        className="m-thesis-in"
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          padding: 'clamp(34px, 5vw, 52px) clamp(20px, 5vw, 56px)',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 22,
        }}
      >
        {items.map((t) => (
          <div key={t.b} style={{ padding: 0 }}>
            <b className="m-serif" style={{ fontSize: 'clamp(24px, 3vw, 32px)', color: 'var(--m-orange-3)', display: 'block', lineHeight: 1.1, fontWeight: 600 }}>
              {t.b}
            </b>
            <span style={{ fontSize: 13.5, color: 'var(--m-mulberry-3)', display: 'block', marginTop: 8, lineHeight: 1.5 }}>{t.s}</span>
          </div>
        ))}
      </div>
      <style>{`@media(max-width:720px){ .m-thesis-in{grid-template-columns:1fr !important} }`}</style>
    </div>
  );
}

/* ── 1 · FREE BUSINESS HUB ─────────────────────────────────────────────── */

export function VendorGrowHub() {
  return (
    <section id="model" style={SECTION}>
      <div className="m-split" style={SPLIT}>
        <div style={{ maxWidth: '60ch' }}>
          <Eyebrow>Your business, one home</Eyebrow>
          <H2>Run your entire business here — free.</H2>
          <Lede>
            Setnayan is already where couples come to keep a lifetime of memories — an independent hotspot for the people you want to reach. Connect every creation to your account and get one solid, trackable view of your business: easier to manage, and always yours.
          </Lede>
          <Lede style={{ marginTop: 16 }}>
            Use our network and services, or don&rsquo;t — build your business around them, entirely free.
          </Lede>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 22 }}>
            {['Import clients — free', 'One dashboard', 'Contracts on record', 'Add your team'].map((p) => (
              <span
                key={p}
                className="m-mono"
                style={{
                  fontSize: 10.5,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: 'var(--m-orange-2)',
                  border: '1px solid var(--m-orange)',
                  borderRadius: 'var(--m-r-full)',
                  padding: '6px 12px',
                  background: 'var(--m-paper)',
                }}
              >
                {p}
              </span>
            ))}
          </div>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: '24px 0 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FeatureLI icon="⬇" title="Import your clients — free" body="Pull your whole client list in at no cost. No fee, no catch." />
          <FeatureLI icon="◫" title="Every creation, tracked" body="Connect your work to one account for a clean history of your business." />
          <FeatureLI icon="✎" title="Contracts & team, built in" body="Put contracts on record and give crew their own logins." />
        </ul>
      </div>
    </section>
  );
}

/* ── 2 · SETNAYAN AI (DARK SIGNATURE) ──────────────────────────────────── */

export function VendorGrowAI() {
  const steps = [
    { n: '1', t: 'Strategic computation', p: 'We compute where you’re the strongest match — by date, budget, faith, location and the other vendors they’re choosing.' },
    { n: '2', t: 'Sales Nudge', p: 'When a new couple eyes a date you’re already shortlisted for, we tell your client that schedule is in demand — so they move.' },
    { n: '3', t: 'Compatibility lock-in', p: 'When you’re the best fit alongside their other services, we nudge them to lock you in too.' },
  ];
  return (
    <div style={{ background: 'var(--m-ink)', color: 'var(--m-mulberry-3)' }}>
      <section style={{ ...SECTION, paddingTop: 'clamp(56px, 8vw, 100px)', paddingBottom: 'clamp(56px, 8vw, 100px)' }}>
        <div className="m-ai-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 'clamp(28px, 5vw, 56px)', alignItems: 'center' }}>
          <div>
            <Eyebrow onDark>Setnayan AI · free for vendors</Eyebrow>
            <H2 onDark>It doesn&rsquo;t just list you. It sells for you — free.</H2>
            <Lede onDark>
              Setnayan AI is free for every vendor. It helps couples plan, and it steers the right ones toward locking their booking with <em>you</em>. Here&rsquo;s the lever most vendors miss:{' '}
              <b style={{ color: '#fff' }}>the more of your couples who activate it, the harder we can push.</b>
            </Lede>
            <ul style={{ listStyle: 'none', padding: 0, margin: '24px 0 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {steps.map((s) => (
                <li
                  key={s.n}
                  style={{
                    background: 'rgba(255,255,255,.04)',
                    border: '1px solid rgba(197,160,89,.24)',
                    borderRadius: 'var(--m-r-md)',
                    padding: '18px 20px',
                  }}
                >
                  <b style={{ fontWeight: 700, fontSize: 15, color: '#fff', display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span
                      className="m-mono"
                      aria-hidden
                      style={{
                        fontSize: 11,
                        color: 'var(--m-ink)',
                        background: 'var(--m-orange)',
                        width: 22,
                        height: 22,
                        borderRadius: 'var(--m-r-full)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {s.n}
                    </span>
                    {s.t}
                  </b>
                  <p style={{ fontSize: 14, color: 'var(--m-mulberry-3)', margin: '8px 0 0', paddingLeft: 31, lineHeight: 1.5 }}>{s.p}</p>
                </li>
              ))}
            </ul>
          </div>
          {/* Phone nudge mock */}
          <div
            style={{
              background: 'linear-gradient(160deg, #211a26, #151019)',
              border: '1px solid rgba(197,160,89,.3)',
              borderRadius: 'var(--m-r-lg)',
              padding: 22,
              boxShadow: '0 30px 70px -30px rgba(0,0,0,.7)',
            }}
          >
            <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: '16px 16px 16px 5px', padding: '15px 17px', marginBottom: 11 }}>
              <small className="m-mono" style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--m-orange-2)', display: 'block', marginBottom: 5 }}>
                Setnayan AI · to the couple
              </small>
              <p style={{ margin: 0, fontSize: 13.5, color: '#e4dac7' }}>
                Heads up — another couple is looking at <b>Blossom &amp; Co.</b> for your date (Jun 14). They book fast.
              </p>
            </div>
            <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: '16px 16px 16px 5px', padding: '15px 17px', marginBottom: 11 }}>
              <small className="m-mono" style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--m-orange-2)', display: 'block', marginBottom: 5 }}>
                Setnayan AI
              </small>
              <p style={{ margin: 0, fontSize: 13.5, color: '#e4dac7' }}>
                They&rsquo;re also your strongest match with the venue &amp; caterer you picked. Lock the date?
              </p>
            </div>
            <div style={{ background: 'var(--m-orange)', borderRadius: '16px 16px 5px 16px', padding: '15px 17px', marginLeft: 'auto', maxWidth: '80%' }}>
              <small className="m-mono" style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(30,34,41,.6)', display: 'block', marginBottom: 5 }}>
                Andrea &amp; Miguel
              </small>
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--m-ink)', fontWeight: 600 }}>Okay — let&rsquo;s lock it in ✓</p>
            </div>
          </div>
        </div>

        {/* Your-move flywheel callout */}
        <div
          className="m-ai-move"
          style={{
            marginTop: 36,
            background: 'rgba(197,160,89,.1)',
            border: '1px solid rgba(197,160,89,.36)',
            borderRadius: 'var(--m-r-md)',
            padding: '24px 26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 22,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 260 }}>
            <p className="m-mono" style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--m-orange)', margin: '0 0 7px' }}>
              Your move
            </p>
            <h3 className="m-serif" style={{ fontSize: 24, color: '#fff', margin: '0 0 7px', fontWeight: 600 }}>
              Get your couples on Setnayan AI.
            </h3>
            <p style={{ fontSize: 14, color: 'var(--m-mulberry-3)', margin: 0, maxWidth: '54ch', lineHeight: 1.5 }}>
              A couple who&rsquo;s activated it is a couple we can nudge, create urgency for, and lock in on your behalf. Invite yours in one tap — it costs you nothing, and it lets us push your bookings far harder.
            </p>
          </div>
          <Link href="/open-shop" className="m-btn m-btn-orange m-btn-lg">
            Get your invite link
          </Link>
        </div>
      </section>
      <style>{`@media(max-width:820px){ .m-ai-grid{grid-template-columns:1fr !important} }`}</style>
    </div>
  );
}

/* ── 3 · ONLY PAY WHEN IT WORKS ────────────────────────────────────────── */

export function VendorGrowFairPay() {
  return (
    <section style={SECTION}>
      <div style={{ maxWidth: '60ch', margin: '0 auto', textAlign: 'center' }}>
        <Eyebrow center>Fair by design</Eyebrow>
        <H2>Never spend a peso that doesn&rsquo;t grow your business.</H2>
        <Lede>
          Most platforms charge you big just to hand you data. We don&rsquo;t. If we can&rsquo;t bring you customers, you owe us nothing — keep running your business and importing clients, free. You only ever pay when a real booking comes through us.
        </Lede>
      </div>
    </section>
  );
}

/* ── 4 · FREE WEBSITE + SEO/GEO ────────────────────────────────────────── */

export function VendorGrowWebsite() {
  return (
    <section style={{ ...SECTION, paddingTop: 0 }}>
      <div className="m-split" style={SPLIT}>
        <ul className="m-split-flip" style={{ listStyle: 'none', padding: 0, margin: '24px 0 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FeatureLI icon="🌐" title="A free, search-ready website" body="We build it for you — live the moment you set an address." />
          <FeatureLI icon="📈" title="SEO + GEO marketing analytics" body="Ranks on Google, discoverable near your couples, tracked." />
          <FeatureLI icon="🔎" title="Discovered without spending" body="Our site is already search-optimized — that reach is yours." />
        </ul>
        <div style={{ maxWidth: '60ch' }}>
          <Eyebrow>Get discovered</Eyebrow>
          <H2>A website that ranks — no spend, all reach.</H2>
          <Lede>
            You shouldn&rsquo;t pay to be found. We give you a search-optimized website with SEO and GEO analytics built in, so the market discovers you on Google and inside Setnayan from day one — free.
          </Lede>
        </div>
      </div>
    </section>
  );
}

/* ── 5 · ANALYTICS + INQUIRIES THAT MATTER ─────────────────────────────── */

export function VendorGrowAnalytics() {
  return (
    <section style={{ ...SECTION, paddingTop: 0 }}>
      <div style={{ maxWidth: '60ch' }}>
        <Eyebrow>Know your market · protect your time</Eyebrow>
        <H2>Analytics that go deep — and only the inquiries that matter.</H2>
        <Lede>
          From reply-rate to serious market-reaction data, see exactly how the market responds to your services — so you market smarter, in and out of the app. And because your time is the point, our priority is filling your <em>open</em> dates: matched, intent-qualified inquiries only, never junk.
        </Lede>
      </div>
      <CardGrid>
        <GridCard icon="📊" title="Analytics, simple to serious" body="Basic health metrics up to deep market-reaction data — know the best approach for your business." />
        <GridCard icon="🎯" title="Only inquiries that matter" body="We surface matched, intent-qualified couples — we don't waste your time with junk." />
        <GridCard icon="📅" title="Fill your calendar" body="Booking your open schedules is our job — we work to block out your dates as much as we can." />
      </CardGrid>
    </section>
  );
}

/* ── 5b · TRUST & CREDIBILITY ──────────────────────────────────────────── */

export function VendorGrowTrust() {
  return (
    <section style={{ ...SECTION, paddingTop: 0 }}>
      <div style={{ maxWidth: '60ch' }}>
        <Eyebrow>Trust, earned — not bought</Eyebrow>
        <H2>Credibility you build, and we protect.</H2>
        <Lede>
          New here? You won&rsquo;t be buried. A fair rating gives you a real shot, every review is receipt-backed, and your reputation stays yours to grow — honestly.
        </Lede>
      </div>
      <CardGrid>
        <GridCard icon="⚖" title="Fair rating for new vendors" body="A Bayesian score means stars are earned, never bought — you're not buried for being new." />
        <GridCard icon="✓" title="Receipt-backed reviews" body="Every rating carries a real &ldquo;booked through Setnayan&rdquo; mark. No fakes, no doubt." />
        <GridCard icon="🏅" title="Earned badges & experience tier" body="New / Verified / Top Pick / Most Booked, plus your years-in-business badge." />
        <GridCard icon="💬" title="Right-of-reply on reviews" body="Post one public, professional reply under any review — your side always shows." />
        <GridCard icon="👍" title="&ldquo;Recommended by N couples&rdquo;" body="Real couples vouch for you, counted right on your profile." />
        <GridCard icon="📂" title="Track record by event type" body="Prove you're great at weddings and debuts — each shown on its own." />
      </CardGrid>
    </section>
  );
}

/* ── 6 · FAIR PLAY / ANTI-FAKE ─────────────────────────────────────────── */

export function VendorGrowNoFakes() {
  return (
    <div style={{ background: 'var(--m-orange-4)' }}>
      <section style={{ ...SECTION, textAlign: 'center' }}>
        <Eyebrow center>Merit only</Eyebrow>
        <H2>No fakes. No pay-to-win. Ever.</H2>
        <Lede style={{ maxWidth: '56ch', margin: '0 auto' }}>
          We study and hunt fake results continuously — and it only gets sharper as we grow. Any vendor caught faking to boost themselves loses all their data and is permanently banned. In return, we ask one thing: your best work, and honest communication with couples.
        </Lede>
      </section>
    </div>
  );
}

/* ── 7 · REACH THAT COMPOUNDS ──────────────────────────────────────────── */

export function VendorGrowReach() {
  return (
    <section style={SECTION}>
      <div style={{ maxWidth: '60ch' }}>
        <Eyebrow>Reach that compounds</Eyebrow>
        <H2>Beyond events — into faith, and trusted circles.</H2>
        <Lede>
          We extend your reach across event types <em>and</em> religion. And with trusted-shop recommendations up to the 3rd degree, the more you serve people well, the more we recommend you to their nearest friends and family — reach that grows itself. Booster subscriptions are there when you want to amplify your presence.
        </Lede>
      </div>
      <CardGrid>
        <GridCard icon="⛪" title="Events + faith reach" body="Matched by the event types you serve and the rites you specialize in." />
        <GridCard icon="👪" title="Trusted-shop recommendations" body="Serve people well and we recommend you to their circle — up to the 3rd degree." />
        <GridCard icon="🚀" title="Booster subscriptions" body="Optional boosts to extend your reach and sharpen your brand presentation." />
      </CardGrid>
    </section>
  );
}

/* ── 8 · THE TOOLS ─────────────────────────────────────────────────────── */

export function VendorGrowTools() {
  return (
    <section style={{ ...SECTION, paddingTop: 0 }}>
      <div style={{ maxWidth: '60ch' }}>
        <Eyebrow>Everything to operate &amp; prove</Eyebrow>
        <H2>The tools to run and prove your business.</H2>
        <Lede>Whether a couple found you here or not, bring them in and show your worth.</Lede>
      </div>
      <CardGrid>
        <GridCard icon="▦" title="Custom QR" body="Add your services to anyone — in or out of the app. Dedicated codes whether they've inquired or already paid." />
        <GridCard icon="★" title="Printable review QR" body="Print it, place it at the event — collect real reviews from real guests on the day." />
        <GridCard icon="✎" title="Contracts on record" body="Every agreement timestamped to a per-event paper trail." />
        <GridCard icon="👥" title="Your team" body="Add crew with their own scoped logins — no shared passwords." />
        <GridCard icon="📇" title="Client CRM & pipeline" body="Every couple, inquiry and booking tracked from first message to signed." />
        <GridCard icon="＋" title="…and more" body="Calendar, proposals, payments, recaps — the whole business, in one place." />
      </CardGrid>
    </section>
  );
}

/* ── 8b · GET PAID ─────────────────────────────────────────────────────── */

export function VendorGrowGetPaid() {
  return (
    <section style={{ ...SECTION, paddingTop: 0 }}>
      <div className="m-split" style={SPLIT}>
        <div style={{ maxWidth: '60ch' }}>
          <Eyebrow>Get paid your way</Eyebrow>
          <H2>Paid direct. We never touch your money.</H2>
          <Lede>
            Couples pay you straight to your GCash or bank — Setnayan never holds a peso. Track it the way PH weddings actually pay, and protect yourself when plans change.
          </Lede>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: '24px 0 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FeatureLI icon="₱" title="Direct to your GCash / bank" body="0% commission — and we never hold your money." />
          <FeatureLI icon="◷" title="PH-style milestone tracking" body="Reservation → progress → balance, with proof — the way couples pay here." />
          <FeatureLI icon="🛡" title="No-show downpayment protection" body="A frozen, agreed cancellation policy makes a forfeited deposit defensible." />
          <FeatureLI icon="📆" title="Payday calendar" body="Every upcoming due-date across all your bookings, on one timeline." />
        </ul>
      </div>
    </section>
  );
}

/* ── CLOSING CTA ───────────────────────────────────────────────────────── */

export function VendorGrowCTA() {
  return (
    <div style={{ textAlign: 'center', background: 'var(--m-paper)', borderTop: '1px solid var(--m-line)' }}>
      <section style={SECTION}>
        <Eyebrow center>Start free, grow with us</Eyebrow>
        <H2>Build your business here — free.</H2>
        <Lede style={{ margin: '0 auto 26px', maxWidth: '48ch' }}>
          List your business, import your clients, get discovered — at no cost. We only earn when we grow you.
        </Lede>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/open-shop" className="m-btn m-btn-primary m-btn-lg">
            List your business — free
          </Link>
          <Link href="/vendors#model" className="m-btn m-btn-ghost m-btn-lg">
            See vendor plans
          </Link>
        </div>
        <p style={{ maxWidth: 1120, margin: '26px auto 0', textAlign: 'center', fontSize: 12, color: 'var(--m-slate-3)', fontStyle: 'italic' }}>
          0% commission, always · we never hold your money · merit-only ranking.
        </p>
      </section>
    </div>
  );
}

/* ── responsive helpers (grid columns + split stacking + split flip) ────── */

export function VendorGrowStyles() {
  return (
    <style>{`
      .m-vgrid { grid-template-columns: repeat(3, 1fr); }
      @media (max-width: 820px) { .m-vgrid { grid-template-columns: repeat(2, 1fr); } }
      @media (max-width: 520px) { .m-vgrid { grid-template-columns: 1fr; } }
      .m-split { grid-template-columns: 1fr 1fr; }
      @media (max-width: 800px) {
        .m-split { grid-template-columns: 1fr !important; gap: 32px !important; }
        /* On stack, put the copy above its feature list even when the list is
           the first child in source (the "flip" split). */
        .m-split-flip { order: 2; }
      }
    `}</style>
  );
}
