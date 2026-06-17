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
 *   - "₱499/wk Pro" → "₱1,999/28 days Pro Vendor"
 *   - "Setnayan Concierge" → "Setnayan AI"
 *   - Vendor verification FREE during launch ("₱1,499 one-time" + "₱499 refresh" fee removed 2026-06-13 — stale)
 *
 * Per [[feedback_setnayan_button_preservation]] all CTAs match template
 * placement + concept verbatim.
 */

import Link from 'next/link';
import { Wordmark } from '@/app/_components/brand-marks';
import { Reveal, Blob } from './_motion';
import { HeroVideoScrub } from './HeroVideoScrub';
import { fetchPublishedHeroVideo } from '@/lib/hero-video';
import { fetchV2BundleCatalog, fetchV2CustomerCatalog, formatPeso, getCustomerSkuPrice } from '@/lib/v2-catalog';
import {
  PILOT_EVENT,
  PILOT_VENDORS,
  PILOT_TIMELINE,
  COUPLE_FEATURES,
  LIVE_TODAY,
  FAQ_ITEMS,
} from './_fixtures';

// ─────────────────────────────────────────────────────────────────────
// 1. PromoBar + 2. Nav — the shared marketing top chrome moved to
//    ./site-nav (2026-06-14) so every public page renders the SAME nav
//    instead of forking. The homepage imports them from there directly.
// ─────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────
// 3. Hero — "Set na 'yan." + HeroCollage dashboard mock
// ─────────────────────────────────────────────────────────────────────
export async function Hero() {
  // Owner-uploaded scroll-scrub video (admin /admin/hero-video). When a video
  // is published, it REPLACES the default hero; otherwise we fall back to the
  // headline + dashboard mock below. Homepage is force-static — publishing
  // calls revalidatePath('/') to rebuild with the new frames.
  const heroVideo = await fetchPublishedHeroVideo();
  if (heroVideo) {
    return (
      <HeroVideoScrub
        frameUrls={heroVideo.frameUrls}
        ctaText={heroVideo.ctaText}
        ctaHref={heroVideo.ctaHref}
      />
    );
  }
  return (
    <section className="relative overflow-hidden px-5 pt-10 pb-12 sm:px-8 sm:pt-14 lg:px-14 lg:pt-20 lg:pb-14">
      <Blob top={-80} left={-80} size={620} color="var(--m-orange)" opacity={0.06} />
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-center relative">
        <Reveal>
          <div className="m-mono text-xs tracking-[0.18em] text-[var(--m-slate-2)] mb-4 sm:mb-7">
            SET NA ‘YAN · /sɛt na jan/
          </div>
          <h1
            className="font-[var(--font-serif-marketing,var(--font-serif))] italic text-[var(--m-ink)] m-0"
            style={{
              // Responsive: clamp keeps the headline above the fold on phones
              // (owner 2026-06-08 "large texts ate up the whole screen, we
              // lost the sale").
              fontSize: 'clamp(2.6rem, 9.5vw, 104px)',
              lineHeight: 0.98,
              letterSpacing: '-0.03em',
              fontWeight: 400,
            }}
          >
            Every guest leaves with their own memories of your wedding.
          </h1>
          <div className="mt-2 sm:mt-3.5">
            <span
              className="m-display text-[var(--m-ink)]"
              style={{
                fontSize: 'clamp(2.2rem, 8vw, 88px)',
                fontWeight: 800,
                letterSpacing: '-0.005em',
                lineHeight: 1.02,
              }}
            >
              Hello, <span className="text-[var(--m-orange)]">Set na ‘yan.</span>
            </span>
          </div>
          <div className="mt-4 flex items-center gap-3.5">
            <svg width="100" height="20" viewBox="0 0 100 20" className="shrink-0">
              <path d="M2 10 Q25 -2 50 10 T98 10" stroke="var(--m-orange)" strokeWidth="1.5" fill="none" />
              <circle cx="50" cy="10" r="2" fill="var(--m-orange)" />
            </svg>
            <span className="m-serif italic text-[22px] text-[var(--m-slate)]">
              <span className="text-[var(--m-ink)]">&ldquo;Set na &apos;yan.&rdquo;</span> You plan the day. Every guest keeps their piece of it.
            </span>
          </div>
          <p
            className="m-serif italic text-[var(--m-slate)] mt-5 sm:mt-8 max-w-[560px]"
            style={{ fontSize: 21, lineHeight: 1.65, textWrap: 'pretty' as 'pretty' }}
          >
            You&rsquo;re giving your guests a personalized keepsake.{' '}
            <span className="not-italic font-[var(--font-sans-marketing,var(--font-sans))] text-[17px] text-[var(--m-ink)]">
              Plan for free — guest list, verified vendors, seating, QR invitations. On your day, every
              guest&rsquo;s phone becomes a crew. Photos appear tagged. Personal reels are ready to share before
              the night is over.
            </span>
          </p>
          <div className="mt-4 hidden sm:inline-flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] bg-[var(--m-ivory)] border border-[var(--m-line)] max-w-[560px]">
            <span className="w-[7px] h-[7px] rounded-full bg-[var(--m-orange)] shrink-0" />
            <div className="text-[13px] text-[var(--m-ink)] leading-snug">
              <strong className="font-medium">The reel they share tonight is your best referral tomorrow.</strong>{' '}
              <span className="text-[var(--m-slate)]">
                Word-of-mouth, built into every wedding — no boosted posts required.
              </span>
            </div>
          </div>
          {/* Couple-centric hero (owner 2026-06-13): the vendor doorway moved
              to the high-contrast VendorBand above the footer + nav/footer
              links, so the hero sells one thing — start planning. */}
          <div className="flex gap-3 mt-6 sm:mt-8 flex-wrap">
            <Link href="/onboarding/wedding" className="m-btn m-btn-primary m-btn-lg">
              Start planning <span className="text-[var(--m-orange-3)]">· free</span>
            </Link>
            <Link href="#bakit-setnayan" className="m-btn m-btn-ghost m-btn-lg">
              See how it works ↓
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
  // The "chaos" layer — tilted, washed-out artifacts of pre-Setnayan planning
  // peeking out from behind the clean dashboard card (brief 2026-06-13:
  // "messy screenshots vs clean dashboard" split visual).
  const chaos = [
    { tag: 'Viber · Day-of', body: '”sino nag-foto sa table namin??”', rot: -7, top: '6%', left: -28 },
    { tag: 'Photos · 3 months later', body: 'still waiting for the link', rot: 5, top: '38%', left: -44 },
    { tag: 'Guest camera roll', body: '”we got nothing from that night”', rot: -4, top: '72%', left: -20 },
  ];
  return (
    <div className="relative h-[480px] sm:h-[560px] lg:h-[600px] flex items-stretch lg:ml-6">
      <Blob top={-40} right={-40} size={520} color="var(--m-orange)" opacity={0.14} />
      <Blob bottom={-60} left={-40} size={420} color="var(--m-blush)" opacity={0.2} />

      {/* Chaos layer — behind the clean card, hidden on small phones */}
      <div className="hidden sm:block" aria-hidden>
        {chaos.map((c, i) => (
          <Reveal
            key={c.tag}
            delay={240 + i * 120}
            className="absolute z-0"
            style={{ top: c.top, left: c.left }}
          >
            <div
              className="px-3.5 py-2.5 rounded-lg border border-[var(--m-line)] bg-[var(--m-paper-2)] opacity-80"
              style={{ transform: `rotate(${c.rot}deg)`, boxShadow: 'var(--m-shadow-sm)' }}
            >
              <div className="m-mono text-[9px] text-[var(--m-slate-3)] uppercase tracking-[0.08em] line-through decoration-[var(--m-blush-deep)]/50">
                {c.tag}
              </div>
              <div className="text-[12px] text-[var(--m-slate-2)] mt-0.5">{c.body}</div>
            </div>
          </Reveal>
        ))}
      </div>

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

      <Reveal delay={420} className="absolute right-2 lg:-right-4 bottom-8 z-[2]">
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
    <section id="bakit-setnayan" className="m-section bg-[var(--m-paper-2)] scroll-mt-20">
      <div className="m-eyebrow">Bakit Setnayan?</div>
      <h2 className="m-serif m-h-xl text-[var(--m-ink)] my-7" style={{ maxWidth: 1200 }}>
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
              <div className="m-card grid grid-cols-[110px_1fr] sm:grid-cols-[150px_1fr] gap-3.5 items-center px-4 py-3">
                <span className="m-mono text-[10px] text-[var(--m-slate-2)] tracking-[0.08em] uppercase">{s.tag}</span>
                <span className="text-[13px] text-[var(--m-ink)]">{s.body}</span>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="flex flex-col items-center gap-2.5 py-2 lg:py-0">
          {/* rotate-90 keeps the svg's 120×24 layout box, so reserve the
              rotated height with margins on mobile */}
          <svg
            width="120"
            height="24"
            viewBox="0 0 120 24"
            style={{ overflow: 'visible' }}
            className="rotate-90 lg:rotate-0 my-14 lg:my-0"
          >
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
// 5. ForCouples — couple-centric feature showcase (owner 2026-06-13:
//    homepage is strictly couple-centric; the vendor pitch moved to the
//    VendorBand above the footer + /for-vendors)
// ─────────────────────────────────────────────────────────────────────
export function ForCouples() {
  return (
    <section className="m-section">
      <div className="m-eyebrow">Everything couples need</div>
      <h2 className="m-serif m-h-xl text-[var(--m-ink)] mt-5 mb-4" style={{ maxWidth: 1200 }}>
        Plan it once. <em className="italic text-[var(--m-blush-deep)]">Together.</em>
      </h2>
      <p className="text-[17px] text-[var(--m-slate)] max-w-[720px] leading-relaxed">
        One QR scan seats your guests. One marketplace books your vendors — 0% commission. One gallery collects every
        photo your guests take. The pieces talk to each other, so nothing falls through the cracks.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-14">
        {COUPLE_FEATURES.map((t, i) => (
          <Reveal key={i} delay={i * 60}>
            <div className="m-card m-card-lift p-6 h-full">
              <span className="m-mono text-[11px] text-[var(--m-orange)]">{String(i + 1).padStart(2, '0')}</span>
              <p className="text-[15px] text-[var(--m-slate)] leading-normal mt-3">{t}</p>
            </div>
          </Reveal>
        ))}
      </div>
      <div className="mt-10">
        <Link href="/onboarding/wedding" className="m-btn m-btn-primary m-btn-lg">
          Start planning — free
        </Link>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 6. MarketplacePreview — vendor card grid
// ─────────────────────────────────────────────────────────────────────
export function MarketplacePreview() {
  return (
    <section className="m-section bg-[var(--m-paper-2)]">
      <div className="m-eyebrow">The marketplace</div>
      <h2 className="m-serif m-h-lg text-[var(--m-ink)] mt-5 mb-7" style={{ maxWidth: 1200 }}>
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
        <Link href="/explore" className="m-btn m-btn-primary m-btn-lg">
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
    <section className="m-section">
      <div className="m-eyebrow">On the day</div>
      <h2 className="m-serif m-h-lg text-[var(--m-ink)] mt-5 mb-7" style={{ maxWidth: 1200 }}>
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
    <section className="m-section bg-[var(--m-ivory)]">
      <div className="grid lg:grid-cols-2 gap-16 items-center">
        <Reveal>
          <div className="m-eyebrow">Your wedding, online</div>
          <h2 className="m-serif m-h-md text-[var(--m-ink)] mt-5 mb-6">
            One personal site.{' '}
            <em className="italic text-[var(--m-blush-deep)]">Every guest, every detail.</em>
          </h2>
          <p className="text-[17px] text-[var(--m-slate)] leading-relaxed mb-7 max-w-[520px]">
            Couples get a personal microsite at <span className="m-mono text-[14px]">setnayan.com/your-names</span>.
            Guests scan their QR, see their seat, RSVP, drop a guestbook note. No login, no friction — and always
            free for your guests.
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
export async function DashboardPreview() {
  // SETNAYAN_AI is the live ₱3,999 planner SKU (owner-locked 2026-06-07
  // 4-tier reprice). TODAYS_FOCUS — the retired ₱1,499 planner row — was
  // wrongly referenced here and leaked the stale price. Fallback matches
  // the locked tier price; the DB read wins whenever reachable.
  const plannerPrice = await getCustomerSkuPrice('SETNAYAN_AI');
  return (
    <section className="m-section">
      <div className="m-eyebrow">In the app</div>
      <h2 className="m-serif m-h-lg text-[var(--m-ink)] mt-5 mb-7" style={{ maxWidth: 1200 }}>
        Setnayan AI. <em className="italic text-[var(--m-blush-deep)]">Today&rsquo;s decisions.</em>
      </h2>
      <p className="text-[17px] text-[var(--m-slate)] max-w-[720px] leading-relaxed mb-12">
        Setnayan AI is the AI-assisted wedding planner that pulls the right vendors, drafts your timeline, and
        answers your questions in your own language. One purchase at {plannerPrice ? `₱${plannerPrice}` : '₱3,999'}, full access through your wedding day.
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
              <div className="m-label-mono text-[10px] text-[var(--m-orange-2)]">Setnayan AI</div>
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
export async function PricingSection() {
  // De-hardcoded (owner 2026-06-08 "all values must not be hardcoded · verify
  // from the DB created by admin"). Prices come from the admin-managed catalog
  // tables — the same source /pricing reads — so /admin/pricing edits propagate
  // here automatically. The homepage is force-dynamic for this reason.
  //
  // 2026-06-13: re-cut to the owner-locked 2026-06-07 4-tier model
  // (Pricing.md § 00.A): Free–Explore ₱0 · Setnayan AI · Essentials ·
  // Complete. The old "Free to plan / 18 free tools / free personal site"
  // card promised paid SKUs as free (owner reversals § 00.D). Essentials +
  // Complete are purchasable only during onboarding (owner 2026-06-08), so
  // their CTAs point at the plan-start flow.
  const [bundles, catalog] = await Promise.all([
    fetchV2BundleCatalog(),
    fetchV2CustomerCatalog(),
  ]);
  const svc = (code: string) => catalog.find((s) => s.service_code === code);
  const setnayanAi = svc('SETNAYAN_AI');
  const sortedBundles = [...bundles].sort((a, b) => a.retail_price_php - b.retail_price_php);
  const essentials = sortedBundles.find((b) => b.package_code === 'GUIDED_PACK');
  const complete = sortedBundles.find((b) => b.package_code === 'MEDIA_PACK');

  return (
    <section className="m-section bg-[var(--m-paper-2)]">
      <div className="m-eyebrow">Pricing</div>
      <h2 className="m-serif m-h-lg text-[var(--m-ink)] mt-5 mb-7" style={{ maxWidth: 1200 }}>
        Start free. <em className="italic text-[var(--m-blush-deep)]">0% on vendor bookings.</em>
      </h2>
      <p className="text-[17px] text-[var(--m-slate)] max-w-[720px] leading-relaxed mb-12">
        Setnayan never touches the money between you and your vendor. They quote, you pay them directly. The platform
        earns only from the Setnayan software you choose — never from what you pay your vendor. Every service is also
        sold à la carte on the pricing page.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          {
            title: 'Free — Explore',
            price: '₱0',
            sub: 'No card required',
            items: [
              'Schedule · budget · guest list',
              'Seat plan + mood board',
              'Browse the vendor marketplace',
              'Your match, previewed',
            ],
            cta: 'Start planning',
            ctaHref: '/signup',
            tone: 'paper' as const,
          },
          {
            title: 'Setnayan AI',
            price: setnayanAi ? `₱${formatPeso(setnayanAi.retail_price_php)}` : 'See pricing',
            sub: 'One purchase per event',
            items: [
              'Full vendor matchmaking',
              'Date · budget · venue · pax · faith cross-referenced',
              'Guided planning workspace',
            ],
            cta: 'See pricing',
            ctaHref: '/pricing',
            tone: 'orange' as const,
          },
          {
            title: 'Essentials',
            price: essentials ? `₱${formatPeso(essentials.retail_price_php)}` : 'See pricing',
            sub: 'Offered when you start your plan',
            items: [
              'Setnayan AI + Animated Monogram',
              'Custom QR + Pro RSVP + Papic Guest',
              'Event + Editorial Website',
            ],
            cta: 'Start your plan',
            ctaHref: '/onboarding/wedding',
            tone: 'paper' as const,
          },
          {
            title: 'Complete',
            price: complete ? `₱${formatPeso(complete.retail_price_php)}` : 'See pricing',
            sub: 'Offered when you start your plan',
            items: [
              'Every paid Setnayan service',
              'Papic · Panood · SDE · Pakanta',
              'One package, one price',
            ],
            cta: 'Start your plan',
            ctaHref: '/onboarding/wedding',
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
    <section className="m-section">
      <div className="m-eyebrow">FAQ</div>
      <h2 className="m-serif m-h-md text-[var(--m-ink)] mt-5 mb-12" style={{ maxWidth: 1200 }}>
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
    <section className="m-section bg-[var(--m-ink)] text-[var(--m-paper)]">
      <div className="text-center">
        <div className="m-eyebrow text-[var(--m-orange-3)]">Set na &lsquo;yan</div>
        <h2
          className="m-serif mt-5 mb-7 text-[var(--m-paper)]"
          style={{ fontSize: 'clamp(2.75rem, 8vw, 96px)', lineHeight: 1.0, letterSpacing: '-0.025em', fontWeight: 400 }}
        >
          Let&rsquo;s do this <em className="italic text-[var(--m-orange)]">together.</em>
        </h2>
        <p className="text-[18px] text-[var(--m-slate-4)] max-w-[640px] mx-auto leading-relaxed mb-10">
          Start your wedding plan in 90 seconds — free, no card required. No commission on vendor bookings, ever.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link href="/onboarding/wedding" className="m-btn m-btn-orange m-btn-lg">
            Start planning — free
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 12b. VendorBand — the single vendor doorway on the couple-centric
//     homepage (owner 2026-06-13 brief: bold, high-contrast redirect
//     above the footer instead of vendor pitches mid-page)
// ─────────────────────────────────────────────────────────────────────
export function VendorBand() {
  return (
    <section className="bg-[var(--m-mulberry)] text-white">
      <Link
        href="/for-vendors"
        className="m-section !py-14 sm:!py-16 flex flex-col sm:flex-row sm:items-center justify-between gap-6 group"
      >
        <div>
          <div className="m-label-mono text-[var(--m-mulberry-3)]">For event vendors</div>
          <div
            className="m-serif text-white mt-2"
            style={{ fontSize: 'clamp(1.75rem, 4.5vw, 48px)', lineHeight: 1.08, letterSpacing: '-0.02em' }}
          >
            Are you an event vendor?{' '}
            <em className="italic text-[var(--m-orange-3)]">Run your business here</em>
            <span aria-hidden className="inline-block ml-2 transition-transform group-hover:translate-x-1.5">→</span>
          </div>
          <div className="m-mono text-[12px] text-[var(--m-mulberry-3)] mt-4 flex gap-3.5 flex-wrap">
            <span>0% commission — keep 100%</span>
            <span>·</span>
            <span>Free verified badge</span>
            <span>·</span>
            <span>One calendar, zero double-bookings</span>
          </div>
        </div>
        <span className="m-btn m-btn-orange m-btn-lg shrink-0 self-start sm:self-center">
          Register your business — free
        </span>
      </Link>
    </section>
  );
}

export function Footer() {
  const cols: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
    {
      title: 'Product',
      links: [
        { label: 'Explore services', href: '/explore' },
        { label: 'What you get', href: '/features' },
        { label: 'Real Stories', href: '/weddings' },
        { label: 'Planning guides', href: '/blog' },
        { label: 'Wedding venues', href: '/venues' },
        { label: 'Pricing', href: '/pricing' },
      ],
    },
    {
      title: 'Vendors',
      links: [
        { label: 'Why Setnayan for vendors', href: '/for-vendors' },
        { label: 'Register your business', href: '/for-vendors' },
        { label: 'Price tiers', href: '/for-vendors' },
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
    <footer
      className="px-5 sm:px-8 lg:px-14 bg-[var(--m-paper-2)] border-t border-[var(--m-line-soft)]"
      style={{ paddingTop: 'clamp(56px, 8vw, 80px)', paddingBottom: 56 }}
    >
      <div className="grid grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10 lg:gap-12">
        <div className="col-span-2 lg:col-span-1">
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
