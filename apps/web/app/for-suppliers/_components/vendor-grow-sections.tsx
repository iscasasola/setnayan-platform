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
import { Fragment } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { bookingFeeBandsLine, type BookingFeeSchedule } from '@/lib/booking-fee';
import { BookingFeeLine } from '@/app/_components/booking-fee-line';
import { COMMISSION_PCT } from '@/lib/commission-promise';
import { isBookingFeeEnabled } from '@/lib/booking-fee-gate';
import { FIRST_BOOKING_FREE } from '@/lib/booking-fee-lock';
import { TIER_LABEL } from '@/lib/vendor-tier-caps';
import { ProblemsList } from './for-vendors-motion';
import {
  DEMO_SHOP,
  MARKETING_PHOTOS,
  OPEN_SHOP_HREF,
  capFirst,
  firstRungWith,
  fromPlan,
  ownAddressFrom,
  planLine,
  reachLine,
  seatsLine,
  widerFrom,
} from './supplier-page-words';
import s from './vendor-grow.module.css';

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
          color: 'var(--m-orange-deep)',
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

/**
 * Every section below that quotes the booking fee takes the LIVE schedule the
 * page read (`getLiveBookingFeeSchedule`), never the code default (audit
 * 2026-10-12, item 5). NULL = could not read it: the fee is named, no rate.
 */
type FeeProp = { fee: BookingFeeSchedule | null };

/*
 * ── 0 · THE THESIS STRIP WAS HERE (₱0 · 0% commission · first booking free) ──
 * Retired 2026-11-04 by the For Suppliers prototype port: the hero's truths line
 * now says "Free to join · Full dashboard free · … · Booking fee only on the
 * couples Setnayan brings ⓘ", and the plan lines say the fee in full — a strip
 * repeating both right under the hero was the third telling.
 */

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
    { n: '1', t: 'Strategic computation', p: 'We compute where you’re the strongest match — by date, budget, faith, location and the other suppliers they’re choosing.' },
    // ⚠ THIS STEP USED TO PROMISE VENDORS A DARK PATTERN, and one we don't build.
    // It read: "When a new couple EYES a date you're already shortlisted for, we
    // tell your client that schedule is in demand — SO THEY MOVE." Two lies in one
    // sentence. (1) Merely saving a vendor writes `event_vendors.status =
    // 'considering'`, and the owner ruled on 2026-06-02 that demand "starts at the
    // inquiry (Stage 2), NEVER at search (Stage 1) … counting it as competition =
    // manufactured scarcity (a fineable dark pattern)" — so the shipped signal is
    // inquiry-only (`lib/same-date-demand.ts` discriminates on `chat_threads`
    // existence) and floored at MIN_DEMAND_COUPLE_COUNT = 3, because "don't show a
    // '1'". (2) "So they move" sells engineered urgency; the product states a
    // measured fact and stops — no "only N left", no "booking fast", because there
    // is no capacity counter behind any of it. Copy now describes what ships.
    { n: '2', t: 'Real demand, stated plainly', p: 'When other couples actually inquire with you for the same date, your client sees that count — the measured fact, nothing dressed up. It takes at least three, so one enquiry never becomes pressure.' },
    { n: '3', t: 'Compatibility lock-in', p: 'When you’re the best fit alongside their other services, we nudge them to lock you in too.' },
  ];
  return (
    <div style={{ background: 'var(--m-ink)', color: 'var(--m-mulberry-3)' }}>
      <section style={{ ...SECTION, paddingTop: 'clamp(56px, 8vw, 100px)', paddingBottom: 'clamp(56px, 8vw, 100px)' }}>
        <div className="m-ai-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 'clamp(28px, 5vw, 56px)', alignItems: 'center' }}>
          <div>
            <Eyebrow onDark>Setnayan AI · free for suppliers</Eyebrow>
            <H2 onDark>It doesn&rsquo;t just list you. It sells for you — free.</H2>
            <Lede onDark>
              Setnayan AI is free for every supplier. It helps couples plan, and it steers the right ones toward locking their booking with <em>you</em>. Here&rsquo;s the lever most suppliers miss:{' '}
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

/*
 * 🔴 "0% COMMISSION WHILE WE LAUNCH" WAS FALSE ON 2026-09-20. The owner drove a
 * real booking as the supplier Saysay and was billed ₱837.50 —
 * `NEXT_PUBLIC_BOOKING_FEE_ENABLED` is ON in production and
 * `booking_fee_charges` holds a pending charge. Two public supplier pages were
 * still promising a launch-period 0%.
 *
 * The launch line is now GATED on the same flag that decides whether anybody is
 * billed, so the promise and the charge can never disagree again. It is one
 * function call, deliberately: a hand-edited sentence is what went stale.
 */
export function VendorGrowFairPay({ fee }: FeeProp) {
  const feeLive = isBookingFeeEnabled();
  return (
    <section style={SECTION}>
      <div style={{ maxWidth: '60ch', margin: '0 auto', textAlign: 'center' }}>
        <Eyebrow center>Fair by design</Eyebrow>
        <H2>Never spend a peso that doesn&rsquo;t grow your business.</H2>
        <Lede>
          Most platforms charge you big just to hand you data. We don&rsquo;t. Joining is free, running your whole business is free, and bringing your own clients is always free.{' '}
          {feeLive ? null : (
            <>
              While we launch, commission is <b style={{ color: 'var(--m-ink)' }}>{COMMISSION_PCT}%</b>.{' '}
            </>
          )}
          <BookingFeeLine fee={fee} leadStyle={{ color: 'var(--m-ink)' }} />{' '}
          Your imported and repeat clients stay free, forever.
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
          <FeatureLI icon="🌐" title="A free, search-ready Setnayan page" body="We build it for you — live the moment you set an address." />
          <FeatureLI icon="📈" title="SEO + GEO marketing analytics" body="Ranks on Google, discoverable near your couples, tracked." />
          <FeatureLI icon="🔎" title="Discovered without spending" body="Setnayan is already search-optimized — that reach is yours." />
        </ul>
        <div style={{ maxWidth: '60ch' }}>
          <Eyebrow>Get discovered</Eyebrow>
          <H2>A page that ranks — no spend, all reach.</H2>
          <Lede>
            You shouldn&rsquo;t pay to be found. We give you a search-optimized Setnayan page with SEO and GEO analytics built in, so the market discovers you on Google and inside Setnayan from day one — free.
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
        <GridCard icon="⚖" title="Fair rating for new suppliers" body="A Bayesian score means stars are earned, never bought — you're not buried for being new." />
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
          Ranking is merit-only — you can&rsquo;t buy your way up, ever. Any supplier caught faking results to inflate their own standing loses all their data and is permanently banned. In return, we ask one thing: your best work, and honest communication with couples.
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
          We extend your reach across event types <em>and</em> religion. And with trusted-shop recommendations up to the 3rd degree, the more you serve people well, the more we recommend you to their nearest friends and family — reach that grows itself. It&rsquo;s always earned, never bought.
        </Lede>
      </div>
      <CardGrid>
        <GridCard icon="⛪" title="Events + faith reach" body="Matched by the event types you serve and the rites you specialize in." />
        <GridCard icon="👪" title="Trusted-shop recommendations" body="Serve people well and we recommend you to their circle — up to the 3rd degree." />
        <GridCard icon="🧭" title="Appear where couples plan" body="Show up inside the planner and budget couples actually use — matched to what they're building, never paid placement." />
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
        <GridCard icon="₱" title="Price your way" body="Build services priced by fixed package, per guest, or per hour — with inclusions, add-ons and custom payment schedules." />
        <GridCard icon="📞" title="In-app video & audio calls" body="Meet couples face-to-face right in the thread. Peer-to-peer and never recorded." />
        <GridCard icon="★" title="Printable review QR" body="Print it, place it at the event — collect real reviews from real guests on the day." />
        <GridCard icon="✎" title="Contracts on record" body="Every agreement timestamped to a per-event paper trail." />
        <GridCard icon="👥" title="Your team" body="Add crew with their own scoped logins — no shared passwords." />
        <GridCard icon="📇" title="Client CRM & pipeline" body="Every couple, inquiry and booking tracked from first message to signed." />
        <GridCard icon="＋" title="…and more" body="Calendar, quotes, payments, recaps — the whole business, in one place." />
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
          <FeatureLI icon="₱" title="Direct to your GCash / bank" body="Couples pay you directly, and we never hold a peso of yours." />
          <FeatureLI icon="◷" title="PH-style milestone tracking" body="Reservation → progress → balance, with proof — the way couples pay here." />
          <FeatureLI icon="🛡" title="No-show first payment protection" body="A frozen, agreed cancellation policy makes a forfeited payment defensible." />
          <FeatureLI icon="📆" title="Money in calendar" body="Every upcoming due-date across all your bookings, on one timeline." />
        </ul>
      </div>
    </section>
  );
}

/* ══ THE 4 NOV 2026 PROTOTYPE PORT ═════════════════════════════════════════
 * `prototypes/for_suppliers_2026-11-04.html` (Setnayan-specs), owner-approved
 * with his own photos the same night (DECISION_LOG 2026-11-04, "THE THREE
 * MARKETING PAGES GO TO CLOUD BUILD"). The top of the page, in its order:
 * hero (vendor-grow-hero.tsx) → Verified only → twelve problems → plans in one
 * line each … → close. Styles: vendor-grow.module.css.
 *
 * 🔑 NO ALLOWANCE IS TYPED. Reach, team seats, waitlists and the own web
 * address are read off `TIER_CAPS` — the table the product enforces — so the
 * day the owner's 4 Nov allowances land there, this page says them without an
 * edit. No peso figure is typed either: plan prices are `getVendorPrices()`
 * (the live `vendor_billing_catalog`), the fee is the live schedule.
 * ═════════════════════════════════════════════════════════════════════════ */

/* ── 1b · VERIFIED ONLY — only real businesses can be found ───────────────── */

export function VendorGrowVerifiedOnly() {
  return (
    <section className={`${s.sec} ${s.vo}`} id="verified-only" aria-labelledby="fs-h-vo">
      <div className={s.voIn}>
        <p className={s.kicker}>Verified only</p>
        <h2 id="fs-h-vo" className={s.h2}>
          Couples only find businesses that have shown their papers.
        </h2>
        <p className={s.lede}>
          We take pride in this. Any shop can use Setnayan free — but only a Verified business can be seen.
        </p>
        <div className={s.voTwo}>
          <div className={`${s.voCol} ${s.voOff}`}>
            <p className={s.voTag}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7a9.6 9.6 0 0 0 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2" />
              </svg>
              Free · not yet Verified
            </p>
            <h3 className={s.voH3}>Every tool, free. Hidden from search.</h3>
            <ul className={s.voList}>
              <li>Your shop, dashboard, quotes and calendar</li>
              <li>Bring and serve your own clients</li>
              <li>Not shown in search, no public page</li>
            </ul>
          </div>
          <div className={`${s.voCol} ${s.voOn}`}>
            <p className={s.voTag}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M12 2l2.4 2.1 3.2-.3.9 3.1 2.8 1.6-1 3 1 3-2.8 1.6-.9 3.1-3.2-.3L12 22l-2.4-2.1-3.2.3-.9-3.1L2.7 15.5l1-3-1-3 2.8-1.6.9-3.1 3.2.3z" />
                <path d="M8.5 12.2l2.4 2.4 4.6-4.8" />
              </svg>
              Verified · still free
            </p>
            <h3 className={s.voH3}>Seen by couples planning near you.</h3>
            <ul className={s.voList}>
              <li>Shown in search, within your reach</li>
              <li>Your public Setnayan page, found by search engines</li>
              <li>The Verified badge on your shop and every card</li>
            </ul>
          </div>
        </div>
        <p className={s.voPapers}>
          <b>The papers:</b> DTI or SEC · BIR 2303 · business permit · bank proof. Upload once; our team checks them.
        </p>
        <div className={s.ctas}>
          <Link href="/vendor-dashboard/profile#docs" className={`${s.btn} ${s.btnPrimary}`}>
            Get Verified — free
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── 2 · TWELVE PROBLEMS SUPPLIERS FACE ───────────────────────────────────── */

type Problem = {
  /** The photo's key in public/marketing/2026-11-04 (the prototype's data-p). */
  photo: string;
  alt: string;
  title: string;
  pain: string;
  ans: string;
  /** The demo shop's anchor for this tool, and the words on the link. */
  demo: { hash: string; label: string };
  /** The plan that has it. */
  plan: string;
};

function problems(fee: BookingFeeSchedule | null): Problem[] {
  const address = ownAddressFrom();
  const waitFrom = firstRungWith((c) => c.waitlistAcceptances > 0);
  const seatsFrom = firstRungWith((c) => c.agentAccounts > 0);
  const wider = widerFrom();
  return [
    {
      photo: 'supplier-01-no-website',
      alt: 'A supplier’s Facebook page on a laptop, buried in search results',
      title: 'Nobody finds you',
      // The prototype said "no website"; the house word is never "website" (public-copy-says-the-house-words).
      pain: 'You have no web page of your own, or a Facebook page that Google never shows.',
      ans: `Once you’re Verified — still free — your Setnayan page is shown to couples and found by search engines.${address ? ` Your own web address ${address}.` : ''}`,
      demo: { hash: '', label: 'See a shop page' },
      plan: 'Free',
    },
    {
      photo: 'supplier-02-inquiries',
      alt: 'A phone with dozens of unread Messenger inquiries',
      title: 'Inquiries lost in Messenger',
      pain: 'Inquiries come from everywhere and get lost. Half are not even serious.',
      ans: 'One inbox, with each couple’s event, date and budget attached, and only the inquiries that match what you do.',
      demo: { hash: '#inquiries', label: 'Open the inbox' },
      plan: 'Free',
    },
    {
      photo: 'supplier-03-quotes',
      alt: 'A supplier typing a long price list into a chat',
      title: 'Quotes typed into chats',
      pain: 'Prices are typed into chats, changed three times, and nobody knows which version was agreed.',
      ans: 'Build the quote in the chat — package, per guest or per hour, with inclusions, add-ons and the payment schedule — and send one clear proposal.',
      demo: { hash: '#quotes', label: 'Build a quote' },
      plan: 'Free',
    },
    {
      photo: 'supplier-04-double-booked',
      alt: 'A wall calendar with two bookings written on the same Saturday',
      title: 'Double-booked dates',
      pain: 'Two couples, one Saturday. The calendar is in a notebook, a chat and your head.',
      ans: 'One calendar for every booking. A date you block is blocked everywhere, and a waitlist holds the next couple in line.',
      demo: { hash: '#calendar', label: 'Open the calendar' },
      plan: waitFrom ? `Free · waitlist ${fromPlan(waitFrom)}` : 'Free',
    },
    {
      photo: 'supplier-05-payments',
      alt: 'A caterer checking a bank app for a deposit that has not arrived',
      title: 'Chasing deposits and balances',
      pain: 'You chase the reservation fee, then the progress payment, then the balance — by chat, every time.',
      ans: 'Reservation, progress and balance on one timeline, with proof. Couples pay straight to your GCash or bank; we never hold your money.',
      demo: { hash: '#payments', label: 'See the payment timeline' },
      plan: 'Free',
    },
    {
      photo: 'supplier-06-forms',
      alt: 'A printed questionnaire filled in by hand, next to a phone',
      title: 'Forms on paper or Google Forms',
      pain: 'The details you need from the couple — names, pronunciations, songs, timings — live in a form they never finish.',
      ans: 'Ask your questions once; they travel with you to every event, and the couple answers on their own schedule page.',
      demo: { hash: '#questions', label: 'See the client questions' },
      plan: 'Free',
    },
    {
      photo: 'supplier-07-contracts',
      alt: 'A folder of permits and a signed contract on a desk',
      title: 'Contracts and permits',
      pain: 'Agreements are screenshots. Your DTI, BIR and permit papers are somewhere in a drawer.',
      ans: 'Every contract on record, timestamped per event. Upload your papers once and earn the Verified badge couples look for.',
      demo: { hash: '#contracts', label: 'See contracts' },
      plan: 'Free · Verified',
    },
    {
      photo: 'supplier-08-copied-photos',
      alt: 'A supplier finding her own photos on a stranger’s page',
      title: 'Fake reviews, copied photos',
      pain: 'A page with stolen photos and bought stars outranks you.',
      ans: 'Reviews carry a real “booked through Setnayan” mark, you can reply to any of them, new shops are rated fairly, and we watch for your photos on other pages.',
      demo: { hash: '#reviews', label: 'See reviews' },
      plan: 'Free',
    },
    {
      photo: 'supplier-09-team-one-login',
      alt: 'A crew of three sharing one phone to check a booking',
      title: 'A team on one login',
      pain: 'Your crew shares your password, or asks you for every detail on the day.',
      ans: `Each person gets their own login, seeing only what their job needs. ${seatsLine()}`,
      demo: { hash: '#team', label: 'See team logins' },
      plan: seatsFrom ? capFirst(fromPlan(seatsFrom)) : 'Free',
    },
    {
      photo: 'supplier-10-beyond-city',
      alt: 'A photographer looking at a map of the Philippines',
      title: 'Couples beyond your city',
      pain: 'The couples who would book you are planning in another city, and never see you.',
      ans: `You are shown to couples within your reach — ${reachLine()} — matched to the events and rites you serve.`,
      demo: { hash: '#reach', label: 'See your reach' },
      plan: wider ? `Free · wider ${fromPlan(wider)}` : 'Free',
    },
    {
      photo: 'supplier-11-cut-of-everything',
      alt: 'A supplier counting earnings at a desk',
      title: 'A cut of every booking',
      pain: 'Platforms take a cut of every booking — even the clients you brought yourself.',
      ans: `Your own clients are free, always. ${FIRST_BOOKING_FREE} After that, ${fee ? bookingFeeBandsLine(fee) : 'a booking fee'}.`,
      demo: { hash: '', label: 'See the fees' },
      plan: 'Free to join',
    },
    {
      photo: 'supplier-12-time-changes',
      alt: 'A supplier crew arriving at a venue checking the time',
      title: 'Time changes nobody told you about',
      pain: 'The host moves the program and nobody tells you until you arrive.',
      ans: 'You see the event’s schedule live, confirm your times and ask for changes in one place.',
      demo: { hash: '', label: 'See the live schedule' },
      plan: 'Free',
    },
  ];
}

export function VendorGrowProblems({ fee }: FeeProp) {
  const list = problems(fee);
  const total = list.length;
  return (
    <section className={s.sec} id="solves" aria-labelledby="fs-h-solves">
      <div className={s.wrap}>
        <div className={s.secHead}>
          <p className={s.kicker}>What it solves</p>
          <h2 id="fs-h-solves" className={s.h2}>
            Twelve problems suppliers face. And what Setnayan does instead.
          </h2>
          <p className={s.lede}>
            Every one of these is a real tool in the supplier dashboard today.
            {DEMO_SHOP.open ? ' See each one on the demo shop.' : null}
          </p>
          {DEMO_SHOP.open ? (
            <Link href={DEMO_SHOP.href} className={s.more}>
              Open the demo shop
            </Link>
          ) : null}
        </div>
        <ProblemsList>
          {list.map((p, i) => (
            <Fragment key={p.photo}>
              <figure className={s.scene}>
                <Image
                  src={`${MARKETING_PHOTOS}/${p.photo}.webp`}
                  alt={p.alt}
                  width={960}
                  height={720}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className={s.sceneImg}
                />
                <figcaption className={s.cap}>
                  <span className={s.n}>
                    {String(i + 1).padStart(2, '0')} / {total}
                  </span>
                  <span className={s.t}>{p.title}</span>
                  <p className={s.pain}>{p.pain}</p>
                </figcaption>
              </figure>
              <div className={s.turn}>
                <p className={s.with}>With Setnayan</p>
                <p className={s.ans}>{p.ans}</p>
                <div className={s.act}>
                  {DEMO_SHOP.open ? (
                    <Link href={`${DEMO_SHOP.href}${p.demo.hash}`} className={s.actLink}>
                      {p.demo.label} <i aria-hidden>›</i>
                    </Link>
                  ) : null}
                  <span className={s.plan}>{p.plan}</span>
                </div>
              </div>
            </Fragment>
          ))}
        </ProblemsList>
      </div>
    </section>
  );
}

/* ── 3 · PLANS, IN ONE LINE EACH ──────────────────────────────────────────── */

/** The live plan prices, as `getVendorPrices()` formats them; `null` = unreadable. */
export type PlanLinePrices = {
  soloMonthly: string | null;
  proMonthly: string | null;
  enterpriseMonthly: string | null;
};

export function VendorGrowPlanLines({ prices, fee }: { prices: PlanLinePrices; fee: BookingFeeSchedule | null }) {
  // Free and Verified are free by what they are, not by a price row; the three paid plans read the catalog.
  const rows: { name: string; line: string; price: string | null }[] = [
    { name: TIER_LABEL.free, line: 'Every tool, free. Hidden from search until Verified.', price: '₱0' },
    {
      name: 'Verified',
      line: 'Papers approved: DTI or SEC, BIR 2303, permit, bank proof. Now couples can find you.',
      price: '₱0',
    },
    { name: TIER_LABEL.solo, line: planLine('solo', 'verified'), price: prices.soloMonthly },
    { name: TIER_LABEL.pro, line: planLine('pro', 'solo'), price: prices.proMonthly },
    { name: TIER_LABEL.enterprise, line: planLine('enterprise', 'pro'), price: prices.enterpriseMonthly },
  ];
  return (
    <section className={s.sec} id="plans" aria-labelledby="fs-h-plans">
      <div className={s.wrap}>
        <div className={s.secHead}>
          <p className={s.kicker}>Plans</p>
          <h2 id="fs-h-plans" className={s.h2}>
            Free to join. Paid plans open once you’re Verified.
          </h2>
          <p className={s.lede}>
            Per 4 weeks. The full table, with reach, categories, service cards and team seats, is{' '}
            <a href="#plan-table" className={s.more}>
              further down this page
            </a>
            .
          </p>
        </div>
        <dl className={s.tiers}>
          {rows.map((r) => (
            <div key={r.name}>
              <dt>{r.name}</dt>
              <dd>{r.line}</dd>
              {r.price ? <span className={s.price}>{r.price}</span> : <span className={`${s.price} ${s.priceNone}`}>Price unavailable</span>}
            </div>
          ))}
        </dl>
        <p className={`${s.fine} ${s.feeFine}`}>
          <BookingFeeLine fee={fee} /> Your own clients are free, always.
        </p>
      </div>
    </section>
  );
}

/* ── CLOSING CTA — "Set na ’yan. Your shop, open today." ─────────────────── */

export function VendorGrowCTA() {
  return (
    <section className={s.close} aria-labelledby="fs-h-close">
      <h2 id="fs-h-close" className={s.closeH2}>
        Set na ’yan.<em>Your shop, open today.</em>
      </h2>
      <div className={s.closeCtas}>
        <Link href={OPEN_SHOP_HREF} className={`${s.btn} ${s.btnPrimary}`}>
          Open a shop — free
        </Link>
        {DEMO_SHOP.open ? (
          <Link href={DEMO_SHOP.href} className={`${s.btn} ${s.btnSecondary}`}>
            See the demo shop first
          </Link>
        ) : null}
      </div>
      <p className={s.fine}>Free to join · Full dashboard free · Your own clients never carry a fee</p>
    </section>
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
