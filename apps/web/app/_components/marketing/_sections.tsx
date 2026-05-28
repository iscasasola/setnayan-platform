/**
 * v2.1 homepage sections · faithful port of template's 12 jsx files.
 *
 * WHY: CLAUDE.md 2026-05-28 10th + 11th rows. Owner directive
 * "this is the template we will use" → /tmp/setnayan-keynote-template/
 * components/homepage-*.jsx ported to TSX. Server components by default
 * (no useState/useEffect at section level); only motion primitives
 * (Reveal, Blob) are client.
 *
 * SECTIONS (load order matches Setnayan Site.html Site() composition):
 *   1. PromoBar  · pilot announcement
 *   2. Nav       · sticky top
 *   3. Hero      · ​"Set na 'yan." headline + HeroCollage dashboard mock
 *   4. ProblemSection · "Six apps. Twelve spreadsheets." before/after
 *   5. TwoSides  · For couples / For vendors side-by-side
 *   6. MarketplacePreview · vendor card grid
 *   7. OnTheDay  · day-of livestream + Same-Day Edit
 *   8. PersonalSite · phone mock with guest microsite
 *   9. DashboardPreview · couple dashboard mock
 *   10. PricingSection · publisher posture · 0% commission
 *   11. FAQ      · 5 Q&A
 *   12. ClosingCTA + Footer + Coverage
 *
 * v2.1 DRIFT SCRUBS applied throughout:
 *   - "5% platform fee" / "we take a cut" → "0% commission"
 *   - "₱499/wk Pro" → "₱1,999/month Pro Vendor"
 *   - "Setnayan Concierge" → "Today's Focus"
 *   - "₱1,499 one-time" + "₱499 refresh" preserved (v2.1-correct)
 *
 * Per [[feedback_setnayan_button_preservation]] all CTAs match template
 * placement + concept verbatim.
 */

import Link from 'next/link';
import { Wordmark } from '@/app/_components/brand-marks';
import { Reveal, Blob } from './_motion';
import {
  PILOT_EVENT,
  PILOT_VENDORS,
  PILOT_TIMELINE,
  COUPLE_FEATURES,
  VENDOR_FEATURES,
  LIVE_TODAY,
  FAQ_ITEMS,
} from './_fixtures';

// ─────────────────────────────────────────────────────────────────────
// 1. Promo bar — pilot stage default per template homepage-top.jsx
// ─────────────────────────────────────────────────────────────────────
export function PromoBar() {
  return (
    <div className="bg-[var(--m-ink)] text-[var(--m-paper)] text-[13px] px-6 py-2.5 flex justify-center items-center gap-[18px] flex-wrap">
      <span className="inline-flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--m-orange)] m-pulse-dot" />
        <strong className="font-medium">Pilot · December 2026.</strong> First wedding ships Dec 18 — Claire &amp; Ice&apos;s own.
      </span>
      <span className="text-[var(--m-slate-3)]">·</span>
      <Link href="/signup" className="text-[var(--m-orange-3)] underline underline-offset-[3px]">
        Apply to the pilot →
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 2. Nav — sticky top with search button + Sign in + Start planning
// ─────────────────────────────────────────────────────────────────────
export function Nav() {
  const links: Array<{ label: string; href: string }> = [
    { label: 'Marketplace', href: '/vendors' },
    { label: 'How it works', href: '/features' },
    { label: 'Features', href: '/features' },
    { label: 'For vendors', href: '/for-vendors' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Help', href: '/help' },
  ];
  return (
    <nav className="flex items-center justify-between px-14 py-[18px] border-b border-[var(--m-line-soft)] bg-[var(--m-paper)] sticky top-0 z-10">
      <Wordmark size={22} />
      <div className="hidden md:flex gap-7 text-sm text-[var(--m-slate)]">
        {links.map((l) => (
          <Link key={l.label} href={l.href} className="hover:text-[var(--m-ink)] transition-colors">
            {l.label}
          </Link>
        ))}
      </div>
      <div className="flex gap-2.5 items-center">
        <Link
          href="/vendors"
          className="hidden md:inline-flex items-center gap-2.5 px-3 py-2 rounded-full bg-[var(--m-paper-2)] border border-[var(--m-line)] text-[var(--m-slate-2)] text-[13px]"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.7" />
            <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <span className="mr-12">Search vendors, dates, help…</span>
          <kbd className="m-mono text-[10px] px-1.5 py-px rounded bg-[var(--m-paper)] border border-[var(--m-line)] text-[var(--m-slate-3)]">
            ⌘K
          </kbd>
        </Link>
        <Link href="/login" className="text-sm text-[var(--m-slate)] hover:text-[var(--m-ink)]">
          Sign in
        </Link>
        <Link href="/signup" className="m-btn m-btn-primary px-[18px] py-2.5 text-[13px]">
          Start planning
        </Link>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 3. Hero — "Set na 'yan." + HeroCollage dashboard mock
// ─────────────────────────────────────────────────────────────────────
export function Hero() {
  return (
    <section className="relative overflow-hidden px-14 pt-20 pb-14">
      <Blob top={-80} left={-80} size={620} color="var(--m-orange)" opacity={0.06} />
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-16 items-center relative">
        <Reveal>
          <div className="m-mono text-xs tracking-[0.18em] text-[var(--m-slate-2)] mb-7">
            SET NA ‘YAN · /sɛt na jan/
          </div>
          <h1
            className="font-[var(--font-serif-marketing,var(--font-serif))] italic text-[var(--m-ink)] m-0"
            style={{
              fontSize: 152,
              lineHeight: 0.96,
              letterSpacing: '-0.035em',
              fontWeight: 400,
            }}
          >
            Set na ‘yan.
          </h1>
          <div className="mt-3.5">
            <span
              className="m-display text-[var(--m-ink)]"
              style={{ fontSize: 76, fontWeight: 800, letterSpacing: '-0.005em', lineHeight: 1 }}
            >
              Plan your wedding
              <br />
              <span className="text-[var(--m-orange)]">the easy way.</span>
            </span>
          </div>
          <div className="mt-4 flex items-center gap-3.5">
            <svg width="100" height="20" viewBox="0 0 100 20" className="shrink-0">
              <path d="M2 10 Q25 -2 50 10 T98 10" stroke="var(--m-orange)" strokeWidth="1.5" fill="none" />
              <circle cx="50" cy="10" r="2" fill="var(--m-orange)" />
            </svg>
            <span className="m-serif italic text-[22px] text-[var(--m-slate)]">
              <span className="text-[var(--m-ink)]">&ldquo;It&apos;s all set.&rdquo;</span> The whole wedding, in one app.
            </span>
          </div>
          <p
            className="m-serif italic text-[var(--m-slate)] mt-8 max-w-[560px]"
            style={{ fontSize: 21, lineHeight: 1.65, textWrap: 'pretty' as 'pretty' }}
          >
            A love letter, a guest list, a thousand tiny decisions, and a Saturday afternoon you&apos;ll remember forever.{' '}
            <span className="not-italic font-[var(--font-sans-marketing,var(--font-sans))] text-[17px] text-[var(--m-ink)]">
              Setnayan is the Filipino-built platform that holds all of it — guest list, vendors, invitations,
              livestream, same-day highlight reel — so you can spend less time arguing about chair colors and more
              time being engaged.
            </span>
          </p>
          <div className="mt-4 inline-flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] bg-[var(--m-ivory)] border border-[var(--m-line)] max-w-[560px]">
            <span className="w-[7px] h-[7px] rounded-full bg-[var(--m-orange)] shrink-0" />
            <div className="text-[13px] text-[var(--m-ink)] leading-snug">
              <strong className="font-medium">Wedding today. Every celebration tomorrow.</strong>{' '}
              <span className="text-[var(--m-slate)]">
                Debut, birthday, baptism, corporate — opening as our vendor base reaches each event type.
              </span>
            </div>
          </div>
          <div className="flex gap-3 mt-8 flex-wrap">
            <Link href="/signup" className="m-btn m-btn-primary m-btn-lg">
              Start planning <span className="text-[var(--m-orange-3)]">· free</span>
            </Link>
            <Link href="/for-vendors" className="m-btn m-btn-ghost m-btn-lg">
              I&apos;m a vendor →
            </Link>
          </div>
          <div className="m-mono text-xs text-[var(--m-slate-2)] mt-6 flex gap-3.5 flex-wrap items-center">
            <span>Built in the Philippines</span>
            <span>·</span>
            <span>Proper receipts, automatic</span>
            <span>·</span>
            <span>English today, Tagalog soon</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[var(--m-orange-4)] text-[var(--m-orange-2)] rounded-full m-mono text-[11px]">
              <span className="w-[5px] h-[5px] rounded-full bg-[var(--m-orange)]" />
              Pilot · GCash / Maya QR
            </span>
          </div>
        </Reveal>

        <HeroCollage />
      </div>

      {/* What's live today */}
      <div className="mt-20">
        <div className="m-eyebrow mb-4">What&rsquo;s live today</div>
        <div className="flex gap-2.5 flex-wrap">
          {LIVE_TODAY.map((t) => (
            <span key={t} className="m-pill bg-[var(--m-paper)] px-3.5 py-2 text-[13px]">
              <span className="w-[5px] h-[5px] rounded-full bg-[var(--m-sage-deep)] inline-block" />
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function HeroCollage() {
  return (
    <div className="relative h-[600px] flex items-stretch">
      <Blob top={-40} right={-40} size={520} color="var(--m-orange)" opacity={0.14} />
      <Blob bottom={-60} left={-40} size={420} color="var(--m-blush)" opacity={0.2} />

      <Reveal delay={120} className="relative z-[1] w-full h-full">
        <div
          className="m-card w-full h-full p-0 overflow-hidden bg-[var(--m-paper)]"
          style={{ boxShadow: 'var(--m-shadow-lg)' }}
        >
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-[var(--m-line-soft)] bg-[var(--m-paper-2)]">
            <div className="flex gap-[5px]">
              <div className="w-[9px] h-[9px] rounded-full bg-[#E28300]" />
              <div className="w-[9px] h-[9px] rounded-full bg-[#FFC061]" />
              <div className="w-[9px] h-[9px] rounded-full bg-[#C5D2BD]" />
            </div>
            <div className="m-mono text-[10px] text-[var(--m-slate-2)] ml-2">app.setnayan.com / claire-ice</div>
            <span className="m-pill ml-auto text-[10px] px-2 py-0.5 bg-[var(--m-paper)] inline-flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-[var(--m-sage-deep)] inline-block" />
              {PILOT_EVENT.daysOut} days to go
            </span>
          </div>
          {/* Mini dashboard body */}
          <div className="p-5 flex flex-col gap-3.5">
            <div>
              <div className="m-label-mono text-[10px]">Good evening, Maria</div>
              <div className="m-display text-[28px] mt-0.5">CLAIRE &amp; ICE</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { k: 'RSVPs in', v: '166/213' },
                { k: 'Vendors', v: '9/12' },
                { k: 'Budget', v: '62%' },
              ].map((s) => (
                <div key={s.k} className="p-2.5 border border-[var(--m-line)] rounded-lg bg-[var(--m-paper-2)]">
                  <div className="m-label-mono text-[9px]">{s.k}</div>
                  <div
                    className="m-display text-[22px] mt-0.5 text-[var(--m-ink)]"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {s.v}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3.5 bg-[var(--m-ivory)] rounded-[10px]">
              <div className="m-label-mono text-[9px]">Next up</div>
              <div className="font-[var(--font-display,var(--font-sans))] font-bold text-[17px] text-[var(--m-ink)] uppercase mt-1">
                Send invites to 47 pending guests
              </div>
              <div className="flex gap-1.5 mt-2.5">
                <span className="m-pill m-pill-orange text-[10px] px-2.5 py-0.5">Send all</span>
                <span className="m-pill text-[10px] px-2.5 py-0.5">Print QR sheet</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {PILOT_TIMELINE.slice(1, 4).map((t, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[60px_1fr_auto] gap-3 items-center px-2.5 py-2 rounded-md"
                  style={{ background: t.hero ? 'var(--m-orange-4)' : 'transparent' }}
                >
                  <span
                    className="m-mono text-[11px]"
                    style={{ color: t.hero ? 'var(--m-orange-2)' : 'var(--m-slate-2)' }}
                  >
                    {t.date}
                  </span>
                  <span
                    className="text-[12px] text-[var(--m-ink)]"
                    style={{ fontWeight: t.hero ? 500 : 400 }}
                  >
                    {t.label}
                  </span>
                  {t.hot && <span className="w-1.5 h-1.5 rounded-full bg-[var(--m-orange)]" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal delay={420} className="absolute -right-4 bottom-8 z-[2]">
        <div
          className="m-card inline-flex items-center gap-2.5 px-3.5 py-2 bg-[var(--m-ink)] text-[var(--m-paper)] border-0"
          style={{ boxShadow: 'var(--m-shadow-lg)' }}
        >
          <span className="w-[7px] h-[7px] rounded-full bg-[var(--m-orange)]" />
          <span className="m-mono text-[11px]">● Live · 1:24:18 · 218 watching</span>
        </div>
      </Reveal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 4. Problem framing — "Six apps. Twelve spreadsheets."
// ─────────────────────────────────────────────────────────────────────
export function ProblemSection() {
  const fragments = [
    { tag: 'WhatsApp · 11pm', body: '“sino mag-pa-print ng QR?”' },
    { tag: 'Budget.xlsx — v8', body: '₱2M, mostly guessed' },
    { tag: 'Notes · plus-ones', body: 'tito tito tito' },
    { tag: 'Drive · vendor PDFs', body: '14 PDFs, 6 versions' },
    { tag: 'GCash · receipts', body: 'screenshots, somewhere' },
    { tag: 'Pinterest · mood', body: '3 boards, conflicting' },
  ];
  return (
    <section className="px-14 py-30 bg-[var(--m-paper-2)]" style={{ paddingTop: 120, paddingBottom: 120 }}>
      <div className="m-eyebrow">Sounds familiar?</div>
      <h2
        className="m-serif text-[var(--m-ink)] my-7"
        style={{ fontSize: 84, lineHeight: 1.04, maxWidth: 1200, letterSpacing: '-0.025em', fontWeight: 400 }}
      >
        Six apps. Twelve spreadsheets.{' '}
        <em className="italic text-[var(--m-blush-deep)]">Three Viber groups at 11 pm.</em>
      </h2>
      <div className="grid lg:grid-cols-2 gap-14 items-start">
        <p className="text-[17px] text-[var(--m-slate)] leading-relaxed max-w-[540px]">
          That&rsquo;s how most Filipino couples plan a wedding today — bouncing between vendor messages, guest lists,
          budget spreadsheets, mood-board screenshots, and a barangay full of people asking when the dress code drops.
        </p>
        <p className="text-[17px] text-[var(--m-slate)] leading-relaxed max-w-[540px]">
          Vendors aren&rsquo;t any better off. Bookings live in DMs. Calendars live in a notebook. Payments live wherever
          GCash receipts end up. Reviews don&rsquo;t live anywhere.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_auto_1fr] gap-8 items-center mt-14">
        <div className="flex flex-col gap-2">
          {fragments.map((s, i) => (
            <Reveal key={s.tag} delay={i * 60}>
              <div className="m-card grid grid-cols-[150px_1fr] gap-3.5 items-center px-4 py-3">
                <span className="m-mono text-[10px] text-[var(--m-slate-2)] tracking-[0.08em] uppercase">{s.tag}</span>
                <span className="text-[13px] text-[var(--m-ink)]">{s.body}</span>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="flex flex-col items-center gap-2.5">
          <svg width="120" height="24" viewBox="0 0 120 24" style={{ overflow: 'visible' }}>
            <path d="M 0 12 L 108 12" stroke="var(--m-orange)" strokeWidth="2" strokeDasharray="4 4" />
            <path d="M 100 4 L 116 12 L 100 20" fill="none" stroke="var(--m-orange)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <span className="m-label-mono text-[var(--m-orange-2)]">One place</span>
        </div>

        <Reveal delay={120}>
          <div
            className="m-card p-7 bg-[var(--m-ink)] text-[var(--m-paper)] border-0"
            style={{ boxShadow: 'var(--m-shadow-lg)' }}
          >
            <div className="m-label-mono text-[var(--m-orange-3)]">Setnayan</div>
            <div className="m-display text-[42px] mt-2 text-[var(--m-paper)]">
              Everything, <span className="text-[var(--m-orange)]">in one app.</span>
            </div>
            <div className="text-[14px] text-[var(--m-slate-4)] mt-2.5 leading-relaxed">
              Guest list, vendors, budget, invitations, livestream, same-day reel — every moving piece in the same app
              you&rsquo;ll use on the day.
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                ['166', 'RSVPs'],
                ['9', 'Vendors'],
                ['62%', 'Budget'],
              ].map(([v, k]) => (
                <div key={k} className="p-2.5 bg-white/5 rounded-lg">
                  <div
                    className="m-display text-[24px] text-[var(--m-paper)]"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {v}
                  </div>
                  <div className="m-mono text-[10px] text-[var(--m-slate-4)] mt-0.5">{k}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 5. TwoSides — couples / vendors side-by-side
// ─────────────────────────────────────────────────────────────────────
export function TwoSides() {
  return (
    <section className="px-14" style={{ paddingTop: 120, paddingBottom: 120 }}>
      <div className="m-eyebrow">Built for both sides</div>
      <h2
        className="m-serif text-[var(--m-ink)] mt-5 mb-4"
        style={{ fontSize: 84, lineHeight: 1.04, maxWidth: 1200, letterSpacing: '-0.025em', fontWeight: 400 }}
      >
        Most event apps pick a side. <em className="italic text-[var(--m-blush-deep)]">We chose both.</em>
      </h2>
      <p className="text-[17px] text-[var(--m-slate)] max-w-[720px] leading-relaxed">
        Setnayan is the only Filipino events platform with real operating tools on both sides — so what the couple
        plans is what the vendor sees, and vice versa.
      </p>
      <div className="grid lg:grid-cols-2 gap-6 mt-14">
        <Reveal>
          <SideColumn audience="For couples" tone="paper" items={COUPLE_FEATURES} headline="Plan it once. Together." cta="Start planning — free" ctaHref="/signup" />
        </Reveal>
        <Reveal delay={150}>
          <SideColumn
            audience="For vendors"
            tone="ink"
            items={VENDOR_FEATURES}
            headline="Run your business, not your DMs."
            cta="Register your business — free"
            ctaHref="/for-vendors"
          />
        </Reveal>
      </div>
    </section>
  );
}

function SideColumn({
  audience,
  tone,
  items,
  headline,
  cta,
  ctaHref,
}: {
  audience: string;
  tone: 'paper' | 'ink';
  items: string[];
  headline: string;
  cta: string;
  ctaHref: string;
}) {
  const dark = tone === 'ink';
  return (
    <div
      className="relative overflow-hidden px-9 py-10"
      style={{
        background: dark ? 'var(--m-ink)' : 'var(--m-paper)',
        color: dark ? 'var(--m-paper)' : 'var(--m-ink)',
        borderRadius: 'var(--m-r-xl)',
        border: dark ? 'none' : '1px solid var(--m-line)',
      }}
    >
      <div className="m-label-mono" style={{ color: dark ? 'var(--m-orange-3)' : 'var(--m-slate-2)' }}>
        {audience}
      </div>
      <div
        className="m-display mt-2.5"
        style={{
          fontSize: 44,
          color: dark ? 'var(--m-paper)' : 'var(--m-ink)',
          lineHeight: 1.04,
        }}
      >
        {headline}
      </div>
      <ul className="list-none p-0 mt-8 grid gap-4">
        {items.map((t, i) => (
          <li
            key={i}
            className="grid grid-cols-[auto_1fr] gap-3.5 items-start pb-3.5"
            style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'var(--m-line-soft)'}` }}
          >
            <span className="m-mono text-[11px] text-[var(--m-orange)] pt-0.5">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span
              className="text-[15px] leading-normal"
              style={{ color: dark ? 'var(--m-paper)' : 'var(--m-slate)' }}
            >
              {t}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-7">
        <Link href={ctaHref} className={dark ? 'm-btn m-btn-orange' : 'm-btn m-btn-primary'}>
          {cta}
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 6. MarketplacePreview — vendor card grid
// ─────────────────────────────────────────────────────────────────────
export function MarketplacePreview() {
  return (
    <section className="px-14 bg-[var(--m-paper-2)]" style={{ paddingTop: 120, paddingBottom: 120 }}>
      <div className="m-eyebrow">The marketplace</div>
      <h2
        className="m-serif text-[var(--m-ink)] mt-5 mb-7"
        style={{ fontSize: 72, lineHeight: 1.04, maxWidth: 1200, letterSpacing: '-0.025em', fontWeight: 400 }}
      >
        Verified vendors. <em className="italic text-[var(--m-blush-deep)]">Honest pricing.</em>
      </h2>
      <p className="text-[17px] text-[var(--m-slate)] max-w-[720px] leading-relaxed mb-12">
        Every vendor on Setnayan ships a verification badge — ID, DTI, sample work, references. The price you see is the
        price you pay. Setnayan never takes a commission on your booking.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PILOT_VENDORS.map((v, i) => (
          <Reveal key={v.id} delay={i * 60}>
            <div className="m-card m-card-lift p-5 h-full flex flex-col">
              <div className="m-photo-placeholder mb-3.5 aspect-[4/3] rounded-lg" />
              <div className="flex items-center gap-2 mb-1.5">
                <span className="m-label-mono text-[10px]">{v.category}</span>
                {v.verified && (
                  <span className="m-pill m-pill-orange text-[10px] px-2 py-0.5">✓ Verified</span>
                )}
              </div>
              <div className="m-display text-[22px] text-[var(--m-ink)] mb-2">{v.name}</div>
              <div className="text-[13px] text-[var(--m-slate)] flex-1">{v.next}</div>
              <div
                className="mt-3.5 pt-3.5 flex justify-between items-baseline"
                style={{ borderTop: '1px solid var(--m-line-soft)' }}
              >
                <span className="m-mono text-[11px] text-[var(--m-slate-2)]">from</span>
                <span
                  className="m-display text-[var(--m-ink)] text-[20px]"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  ₱{(v.totalPhp / 1000).toFixed(0)}k
                </span>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="mt-10 flex justify-center">
        <Link href="/vendors" className="m-btn m-btn-primary m-btn-lg">
          Browse all vendors →
        </Link>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 7. OnTheDay — day-of livestream + Same-Day Edit
// ─────────────────────────────────────────────────────────────────────
export function OnTheDay() {
  return (
    <section className="px-14" style={{ paddingTop: 120, paddingBottom: 120 }}>
      <div className="m-eyebrow">On the day</div>
      <h2
        className="m-serif text-[var(--m-ink)] mt-5 mb-7"
        style={{ fontSize: 72, lineHeight: 1.04, maxWidth: 1200, letterSpacing: '-0.025em', fontWeight: 400 }}
      >
        The wedding films <em className="italic text-[var(--m-blush-deep)]">itself.</em>
      </h2>
      <div className="grid lg:grid-cols-2 gap-12 items-start">
        <Reveal>
          <div className="m-card p-7">
            <div className="m-label-mono text-[var(--m-orange-2)]">Live Panood</div>
            <div className="m-display text-[34px] mt-2.5">Day-of livestream</div>
            <p className="text-[15px] text-[var(--m-slate)] mt-3.5 leading-relaxed">
              Lolo in Cebu, cousin in Doha, ninang in Manila — everyone watches the ceremony at the same time, no Zoom
              link, no awkward unmute. We handle the streaming, the chyron, the music sync. You just say I do.
            </p>
            <div className="mt-5 p-4 bg-[var(--m-ink)] text-[var(--m-paper)] rounded-lg inline-flex items-center gap-2.5">
              <span className="w-[7px] h-[7px] rounded-full bg-[var(--m-orange)]" />
              <span className="m-mono text-[12px]">● Live · 1:24:18 · 218 watching</span>
            </div>
          </div>
        </Reveal>
        <Reveal delay={150}>
          <div className="m-card p-7">
            <div className="m-label-mono text-[var(--m-orange-2)]">Same-Day Edit</div>
            <div className="m-display text-[34px] mt-2.5">Highlight reel · 30 min</div>
            <p className="text-[15px] text-[var(--m-slate)] mt-3.5 leading-relaxed">
              A 90-second cinematic edit, ready before the reception starts. We capture the ceremony, edit on-site, and
              play it back at the cocktail hour. Guests cheer. You cry. Everyone shares it that night.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {['Capture', 'Edit', 'Play'].map((t, i) => (
                <div
                  key={t}
                  className="text-center p-2.5 rounded-lg"
                  style={{ background: i === 2 ? 'var(--m-orange-4)' : 'var(--m-paper-2)' }}
                >
                  <div
                    className="m-display text-[18px]"
                    style={{ color: i === 2 ? 'var(--m-orange-2)' : 'var(--m-ink)' }}
                  >
                    {t}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 8. PersonalSite — phone mock with guest microsite
// ─────────────────────────────────────────────────────────────────────
export function PersonalSite() {
  return (
    <section className="px-14 bg-[var(--m-ivory)]" style={{ paddingTop: 120, paddingBottom: 120 }}>
      <div className="grid lg:grid-cols-2 gap-16 items-center">
        <Reveal>
          <div className="m-eyebrow">Your wedding, online</div>
          <h2
            className="m-serif text-[var(--m-ink)] mt-5 mb-6"
            style={{ fontSize: 64, lineHeight: 1.04, letterSpacing: '-0.025em', fontWeight: 400 }}
          >
            One personal site.{' '}
            <em className="italic text-[var(--m-blush-deep)]">Every guest, every detail.</em>
          </h2>
          <p className="text-[17px] text-[var(--m-slate)] leading-relaxed mb-7 max-w-[520px]">
            Couples get a personal microsite at <span className="m-mono text-[14px]">setnayan.com/your-names</span> —
            free forever. Guests scan their QR, see their seat, RSVP, drop a guestbook note. No login, no friction.
          </p>
          <ul className="grid gap-3.5 list-none p-0">
            {[
              'Personal QR per guest — one scan, full access',
              'Seat assignment + table number',
              'Day-of schedule with countdown',
              'Photo gallery (auto-curated from Papic)',
              'Honeymoon registry (no fees, no markup)',
            ].map((t, i) => (
              <li key={i} className="grid grid-cols-[auto_1fr] gap-3 items-start">
                <span className="m-mono text-[11px] text-[var(--m-orange)] pt-0.5">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-[15px] text-[var(--m-slate)] leading-normal">{t}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={150}>
          <div className="relative flex justify-center">
            <div
              className="m-card overflow-hidden bg-[var(--m-paper)]"
              style={{
                width: 320,
                height: 640,
                borderRadius: 36,
                boxShadow: 'var(--m-shadow-lg)',
                border: '8px solid var(--m-ink)',
              }}
            >
              <div className="m-photo-placeholder w-full h-[280px]" />
              <div className="p-5">
                <div className="m-label-mono text-[9px]">Welcome, Tita Cora</div>
                <div className="m-display text-[26px] mt-1">CLAIRE &amp; ICE</div>
                <div className="m-serif italic text-[14px] text-[var(--m-slate)] mt-1">{PILOT_EVENT.dateShort}</div>
                <div className="mt-4 p-3 bg-[var(--m-ivory)] rounded-lg">
                  <div className="m-label-mono text-[9px]">Your seat</div>
                  <div className="m-display text-[20px] mt-0.5">TABLE 2 · SEAT 14</div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <span className="m-pill m-pill-orange text-[10px] px-2.5 py-1 justify-center">RSVP yes</span>
                  <span className="m-pill text-[10px] px-2.5 py-1 justify-center">Day-of map</span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 9. DashboardPreview — full dashboard mock
// ─────────────────────────────────────────────────────────────────────
export function DashboardPreview() {
  return (
    <section className="px-14" style={{ paddingTop: 120, paddingBottom: 120 }}>
      <div className="m-eyebrow">In the app</div>
      <h2
        className="m-serif text-[var(--m-ink)] mt-5 mb-7"
        style={{ fontSize: 72, lineHeight: 1.04, maxWidth: 1200, letterSpacing: '-0.025em', fontWeight: 400 }}
      >
        Today&rsquo;s Focus. <em className="italic text-[var(--m-blush-deep)]">Today&rsquo;s decisions.</em>
      </h2>
      <p className="text-[17px] text-[var(--m-slate)] max-w-[720px] leading-relaxed mb-12">
        Today&rsquo;s Focus is the AI-assisted wedding planner that pulls the right vendors, drafts your timeline, and
        answers your questions in your own language. One purchase at ₱1,499, full access through your wedding day.
      </p>

      <div
        className="m-card overflow-hidden"
        style={{ boxShadow: 'var(--m-shadow-lg)' }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] min-h-[480px]">
          {/* Sidebar */}
          <aside className="bg-[var(--m-paper-2)] border-r border-[var(--m-line-soft)] p-5">
            <div className="flex items-center gap-2 mb-6">
              <Wordmark size={18} />
            </div>
            <div className="m-label-mono text-[10px] mb-2.5">Plan</div>
            <ul className="list-none p-0 grid gap-1">
              {['Today', 'Guests', 'Vendors', 'Budget', 'Mood board', 'Personal site', 'On the day'].map((t, i) => (
                <li
                  key={t}
                  className="px-3 py-2 rounded-md text-[13px]"
                  style={{
                    background: i === 0 ? 'var(--m-orange-4)' : 'transparent',
                    color: i === 0 ? 'var(--m-orange-2)' : 'var(--m-slate)',
                    fontWeight: i === 0 ? 500 : 400,
                  }}
                >
                  {t}
                </li>
              ))}
            </ul>
          </aside>
          {/* Main */}
          <div className="p-7">
            <div className="m-label-mono text-[10px]">Good evening, Maria</div>
            <div className="m-display text-[40px] mt-1">CLAIRE &amp; ICE</div>
            <div className="m-serif italic text-[16px] text-[var(--m-slate)] mt-1">
              {PILOT_EVENT.dateShort} · {PILOT_EVENT.venue}
            </div>
            <div className="grid grid-cols-3 gap-3 mt-7">
              {[
                { k: 'RSVPs in', v: '166/213' },
                { k: 'Vendors booked', v: '9/12' },
                { k: 'Budget used', v: '62%' },
              ].map((s) => (
                <div key={s.k} className="p-3.5 border border-[var(--m-line)] rounded-lg bg-[var(--m-paper-2)]">
                  <div className="m-label-mono text-[10px]">{s.k}</div>
                  <div
                    className="m-display text-[28px] mt-1 text-[var(--m-ink)]"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {s.v}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-7 p-5 bg-[var(--m-orange-4)] rounded-lg">
              <div className="m-label-mono text-[10px] text-[var(--m-orange-2)]">Today&rsquo;s Focus</div>
              <div
                className="font-[var(--font-display,var(--font-sans))] font-bold text-[24px] text-[var(--m-ink)] uppercase mt-1.5"
              >
                Send invites to 47 pending guests
              </div>
              <p className="text-[13px] text-[var(--m-slate)] mt-2 max-w-[560px]">
                AI looked at your guest list and noticed 47 still haven&rsquo;t been sent personal QR invitations. Sending
                now means RSVPs arrive in time for the catering headcount lock on Dec 5.
              </p>
              <div className="flex gap-2 mt-3.5">
                <span className="m-pill m-pill-orange text-[12px] px-3 py-1.5">Send all 47</span>
                <span className="m-pill text-[12px] px-3 py-1.5 bg-[var(--m-paper)]">Print QR sheet</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 10. Pricing — publisher posture · 0% commission
// ─────────────────────────────────────────────────────────────────────
export function PricingSection() {
  return (
    <section className="px-14 bg-[var(--m-paper-2)]" style={{ paddingTop: 120, paddingBottom: 120 }}>
      <div className="m-eyebrow">Pricing</div>
      <h2
        className="m-serif text-[var(--m-ink)] mt-5 mb-7"
        style={{ fontSize: 72, lineHeight: 1.04, maxWidth: 1200, letterSpacing: '-0.025em', fontWeight: 400 }}
      >
        Free to plan. <em className="italic text-[var(--m-blush-deep)]">0% on vendor bookings.</em>
      </h2>
      <p className="text-[17px] text-[var(--m-slate)] max-w-[720px] leading-relaxed mb-12">
        Setnayan never touches the money between you and your vendor. They quote, you pay them directly. The platform
        earns from Setnayan Productions services you choose à la carte, and from vendor subscriptions.
      </p>
      <div className="grid lg:grid-cols-3 gap-5">
        {[
          {
            title: 'Couples',
            price: 'Free',
            sub: 'Forever',
            items: [
              '18 planning tools',
              'Personal site + QR invitations',
              'Vendor messaging + bookings',
              '0% commission · always',
            ],
            cta: 'Start planning',
            ctaHref: '/signup',
            tone: 'paper' as const,
          },
          {
            title: 'Productions',
            price: 'À la carte',
            sub: 'Per service',
            items: [
              "Today's Focus AI planner · ₱1,499",
              'Panood livestream · ₱3,499/day',
              'Same-Day Edit · ₱3,499',
              'Animated Monogram · ₱2,499',
            ],
            cta: 'See services',
            ctaHref: '/pricing',
            tone: 'orange' as const,
          },
          {
            title: 'Vendors',
            price: 'Free to list',
            sub: '₱1,999/month Pro',
            items: [
              'Free listing + 100 founder tokens',
              '₱1,499 lifetime verification badge',
              'Pro Vendor ₱1,999/month',
              'Enterprise ₱5,499/month',
            ],
            cta: 'Register your business',
            ctaHref: '/for-vendors',
            tone: 'ink' as const,
          },
        ].map((p, i) => (
          <Reveal key={p.title} delay={i * 100}>
            <div
              className="m-card p-7 h-full flex flex-col"
              style={{
                background:
                  p.tone === 'ink' ? 'var(--m-ink)' : p.tone === 'orange' ? 'var(--m-orange-4)' : 'var(--m-paper)',
                color: p.tone === 'ink' ? 'var(--m-paper)' : 'var(--m-ink)',
                border: p.tone === 'ink' ? 'none' : '1px solid var(--m-line)',
              }}
            >
              <div
                className="m-label-mono"
                style={{ color: p.tone === 'ink' ? 'var(--m-orange-3)' : 'var(--m-orange-2)' }}
              >
                {p.title}
              </div>
              <div className="m-display text-[44px] mt-2.5">{p.price}</div>
              <div
                className="m-serif italic text-[15px]"
                style={{ color: p.tone === 'ink' ? 'var(--m-slate-4)' : 'var(--m-slate)' }}
              >
                {p.sub}
              </div>
              <ul className="list-none p-0 grid gap-2.5 mt-6 flex-1">
                {p.items.map((it, j) => (
                  <li key={j} className="grid grid-cols-[auto_1fr] gap-2.5 items-start">
                    <span className="text-[var(--m-orange)] pt-0.5">·</span>
                    <span className="text-[14px] leading-normal">{it}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-7">
                <Link
                  href={p.ctaHref}
                  className={
                    p.tone === 'ink' ? 'm-btn m-btn-orange' : p.tone === 'orange' ? 'm-btn m-btn-primary' : 'm-btn m-btn-primary'
                  }
                >
                  {p.cta} →
                </Link>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 11. FAQ
// ─────────────────────────────────────────────────────────────────────
export function FAQSection() {
  return (
    <section className="px-14" style={{ paddingTop: 120, paddingBottom: 120 }}>
      <div className="m-eyebrow">FAQ</div>
      <h2
        className="m-serif text-[var(--m-ink)] mt-5 mb-12"
        style={{ fontSize: 64, lineHeight: 1.04, maxWidth: 1200, letterSpacing: '-0.025em', fontWeight: 400 }}
      >
        The honest answers.
      </h2>
      <div className="grid gap-3 max-w-[820px]">
        {FAQ_ITEMS.map((q, i) => (
          <Reveal key={q.q} delay={i * 60}>
            <details className="m-card p-5 group">
              <summary className="cursor-pointer list-none flex justify-between items-center gap-4">
                <span className="m-display text-[20px] text-[var(--m-ink)]">{q.q}</span>
                <span className="m-mono text-[20px] text-[var(--m-orange)] group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="text-[15px] text-[var(--m-slate)] leading-relaxed mt-4">{q.a}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 12. ClosingCTA + Footer + Coverage
// ─────────────────────────────────────────────────────────────────────
export function ClosingCTA() {
  return (
    <section className="px-14 bg-[var(--m-ink)] text-[var(--m-paper)]" style={{ paddingTop: 120, paddingBottom: 120 }}>
      <div className="text-center">
        <div className="m-eyebrow text-[var(--m-orange-3)]">Set na &lsquo;yan</div>
        <h2
          className="m-serif mt-5 mb-7 text-[var(--m-paper)]"
          style={{ fontSize: 96, lineHeight: 1.0, letterSpacing: '-0.025em', fontWeight: 400 }}
        >
          Let&rsquo;s do this <em className="italic text-[var(--m-orange)]">together.</em>
        </h2>
        <p className="text-[18px] text-[var(--m-slate-4)] max-w-[640px] mx-auto leading-relaxed mb-10">
          Start your wedding plan in 90 seconds. Free forever for couples. ₱1,499 verification badge for vendors. No
          commission, ever.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link href="/signup" className="m-btn m-btn-orange m-btn-lg">
            Start planning — free
          </Link>
          <Link href="/for-vendors" className="m-btn m-btn-ghost m-btn-lg" style={{ color: 'var(--m-paper)', borderColor: 'rgba(255,255,255,0.2)' }}>
            I&apos;m a vendor →
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const cols: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
    {
      title: 'Product',
      links: [
        { label: 'Marketplace', href: '/vendors' },
        { label: 'How it works', href: '/features' },
        { label: 'Pricing', href: '/pricing' },
        { label: "Today's Focus", href: '/features' },
      ],
    },
    {
      title: 'Vendors',
      links: [
        { label: 'Register your business', href: '/for-vendors' },
        { label: 'Pro Vendor — ₱1,999/mo', href: '/for-vendors' },
        { label: 'Enterprise — ₱5,499/mo', href: '/for-vendors' },
        { label: 'Vendor handbook', href: '/help' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About', href: '/about' },
        { label: 'Press', href: '/help' },
        { label: 'Help center', href: '/help' },
        { label: 'Privacy', href: '/privacy' },
        { label: 'Terms', href: '/terms' },
      ],
    },
  ];
  return (
    <footer className="px-14 bg-[var(--m-paper-2)] border-t border-[var(--m-line-soft)]" style={{ paddingTop: 80, paddingBottom: 56 }}>
      <div className="grid lg:grid-cols-[1.4fr_1fr_1fr_1fr] gap-12">
        <div>
          <Wordmark size={24} />
          <p className="text-[13px] text-[var(--m-slate)] mt-4 leading-relaxed max-w-[280px]">
            Built in the Philippines for Filipino weddings, debuts, and every celebration that comes next. Set na
            &lsquo;yan.
          </p>
          <div className="m-mono text-[11px] text-[var(--m-slate-2)] mt-5 flex flex-col gap-1">
            <span>NPC PIC-2026-0042</span>
            <span>DTI Business Name · pending</span>
            <span>BIR TIN · pending</span>
          </div>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <div className="m-label-mono text-[10px] mb-3.5">{c.title}</div>
            <ul className="list-none p-0 grid gap-2">
              {c.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-[13px] text-[var(--m-slate)] hover:text-[var(--m-ink)]">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div
        className="mt-12 pt-6 flex justify-between items-center flex-wrap gap-4"
        style={{ borderTop: '1px solid var(--m-line)' }}
      >
        <span className="m-mono text-[11px] text-[var(--m-slate-2)]">© 2026 Setnayan. Made in Manila.</span>
        <span className="m-mono text-[11px] text-[var(--m-slate-2)]">
          Pilot · December 2026 · 0% commission · Always
        </span>
      </div>
    </footer>
  );
}
