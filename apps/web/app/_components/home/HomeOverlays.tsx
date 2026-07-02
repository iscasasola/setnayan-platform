'use client';

/**
 * The four top-nav overlays — Prices · Download · Vendors · Sign in — ported
 * from the prototype's `.ov` overlay system. Each renders in a portal at
 * document.body so the greige glass backdrop covers the whole viewport
 * regardless of where the trigger sits in the tree. Backdrop-click + Escape
 * close (via useModalA11y, which also traps focus + locks scroll).
 *
 * The Prices overlay is DATA-DRIVEN: it receives `pricing` resolved server-side
 * from the live catalog (see pricing-data.ts) and a client slider recomputes the
 * per-day / per-guest-day lines off the CATALOG base rate (never hardcoded).
 *
 * Real navigation: every CTA points at a real route — start planning →
 * /onboarding/wedding, full pricing → /pricing, register → /for-vendors.
 *
 * SIGN IN (owner 2026-06-30 "login should be like the rest of the upper menu —
 * a popup"): the glass-nav "Sign in" is now a fourth overlay, consistent with
 * Prices / Download / Vendors, instead of a hard navigation to /login. It is a
 * REAL working login, not a mockup — it renders the SAME OAuth row + email /
 * password form as the /login page, wired to the SAME server actions
 * (signInWithPassword + signInWith{Google,Apple}). On a successful sign-in the
 * server action redirects to the account home; on a credential error it
 * redirects to the full /login page with the error banner (the action's
 * existing contract), so the overlay degrades gracefully rather than swallowing
 * errors. OAuth visibility is shell-gated server-side (web/desktop only) and
 * threaded in via the `oauth` prop, mirroring /login's getClientShell() logic.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { SubmitButton } from '@/app/_components/submit-button';
import { ANY_OAUTH_ENABLED, OAuthButtonRow } from '@/app/_components/oauth-button-row';
import { DesktopOAuthButtons } from '@/app/_components/desktop-oauth-buttons';
import { signInWithPassword } from '@/app/login/actions';
import { TurnstileField } from '@/app/_components/auth/turnstile-field';
import type { PricingData, PriceRow } from './pricing-data';
import { VENDOR_TIER_SECTIONS, VENDOR_CUSTOM_TIER } from './vendor-benefits';
import { PapicDemoOverlay } from './papic-demo-overlay';
import { PanoodDemoOverlay } from './panood-demo-overlay';
import { Plan3DDemoOverlay } from './plan3d-demo-overlay';

export type OverlayId =
  | 'prices'
  | 'download'
  | 'vendors'
  | 'signin'
  | 'setnayan-ai'
  | 'papic-demo'
  | 'panood-demo'
  | 'plan3d-demo'
  | null;

/**
 * Shell-gated OAuth visibility. `show` mirrors /login's `showOAuth` (provider
 * enabled AND not the mobile WebView shell); `desktop` picks the Tauri loopback
 * variant over the web server-action row.
 *
 * Resolved CLIENT-SIDE now (was threaded from page.tsx's getClientShell). This
 * overlay is client-only (mounted via next/dynamic ssr:false), so it can read
 * navigator.userAgent + the client-type cookie directly — which lets page.tsx
 * drop its headers()/cookies() read and become edge-cacheable/ISR'd.
 * (Perf sweep 2026-07-02, homepage ISR.)
 */
export type SignInOAuth = { show: boolean; desktop: boolean };

/**
 * Client-side mirror of lib/request-platform.ts#getClientShell → OAuth gate.
 * Same rules: `SetnayanApp/desktop` UA → desktop; any other SetnayanApp UA or a
 * capacitor/tauri client-type cookie or a live Capacitor bridge → mobile
 * (WebView, OAuth hidden); else web. Safe before mount (returns hidden).
 */
function detectSignInOAuth(): SignInOAuth {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') {
    return { show: false, desktop: false };
  }
  const ua = navigator.userAgent || '';
  let shell: 'web' | 'desktop' | 'mobile';
  if (/SetnayanApp\/desktop/i.test(ua)) {
    shell = 'desktop';
  } else {
    const clientType =
      document.cookie
        .split('; ')
        .find((c) => c.startsWith('setnayan-client-type='))
        ?.split('=')[1] ?? '';
    const capacitor = Boolean(
      (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
        ?.isNativePlatform?.(),
    );
    shell =
      /SetnayanApp/i.test(ua) || clientType === 'capacitor' || clientType === 'tauri' || capacitor
        ? 'mobile'
        : 'web';
  }
  const show = ANY_OAUTH_ENABLED && shell !== 'mobile';
  return { show, desktop: show && shell === 'desktop' };
}

export function OverlayShell({
  id,
  current,
  onClose,
  label,
  cardStyle,
  children,
}: {
  id: Exclude<OverlayId, null>;
  current: OverlayId;
  onClose: () => void;
  label: string;
  cardStyle?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const open = current === id;
  const ref = useRef<HTMLDivElement>(null);
  useModalA11y({ open, onClose, containerRef: ref });
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!open || !mounted) return null;
  return createPortal(
    <div
      className="home-reskin-ov"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      ref={ref}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="hr-ov-card" style={cardStyle}>
        <button className="hr-ov-x" onClick={onClose} aria-label="Close">
          ✕
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ── Live slider recompute (off the catalog base rate) ───────────────── */
function computeRowValue(row: PriceRow, guests: number, days: number): string {
  if (!row.model || row.model === 'flat' || row.rate == null) return row.v;
  const peso = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`;
  if (row.model === 'perGuestDay') {
    const cap = row.cap ?? Infinity;
    const floor = row.floor ?? 0;
    const raw = row.rate * guests;
    const pd = Math.max(floor, Math.min(raw, cap));
    const tag = raw >= cap ? 'daily max' : raw < floor ? 'min' : `${guests} guests`;
    return `${peso(pd * days)} · ${tag}${days > 1 ? ` × ${days}d` : ''}`;
  }
  // perDay
  return days > 1 ? `${peso(row.rate * days)} · ${days}d` : `${peso(row.rate)}/day`;
}

function PricesOverlay({
  current,
  onClose,
  pricing,
}: {
  current: OverlayId;
  onClose: () => void;
  pricing: PricingData;
}) {
  const [guests, setGuests] = useState(150);
  const [days, setDays] = useState(1);

  return (
    <OverlayShell id="prices" current={current} onClose={onClose} label="Pricing">
      <div className="hr-ov-eyebrow">Pricing · in Philippine pesos</div>
      <h2 className="hr-ov-title">Plan free. Pay only for what you add.</h2>
      <p className="hr-ov-sub">
        Plano, Likha and Ala Ala are free, end to end. Add the planning brain when you want it,
        and pick up any service à la carte. 0% vendor commission, always.
      </p>

      <div className="hr-pr-tiers">
        <div className="hr-pr-tier">
          <div className="hr-t">Free</div>
          <div className="hr-p">₱0</div>
          <div className="hr-d">
            The full Plano planner, the free Likha studio, a live event page, and Ala Ala basics
            — enough to plan a real event, end to end, and start keeping it.
          </div>
        </div>
        <div className="hr-pr-tier hr-hot">
          <div className="hr-t">Setnayan AI</div>
          <div className="hr-p">
            {pricing.aiPrice}
            <span className="hr-per">{pricing.aiPeriod}</span>
          </div>
          <div style={{ fontSize: '13px', fontWeight: 500, opacity: 0.72, marginTop: '2px' }}>
            {pricing.aiIntroPrice} on your first 28 days
          </div>
          <div className="hr-d">
            Adds Suri — the planning brain that filters the vendors that fit you, paces your
            checklist, and guides your budget.
          </div>
        </div>
      </div>

      <div className="hr-pr-alh">Free — yours, always</div>
      <div className="hr-pr-free">
        {pricing.freeChips.map((c) => (
          <span key={c} className="hr-pr-f">
            {c}
          </span>
        ))}
      </div>

      <div className="hr-pr-est">
        <div className="hr-grp">
          <div className="hr-top">
            <span className="hr-lab">Guests</span>
            <span className="hr-val">{guests}</span>
          </div>
          <input
            type="range"
            min={5}
            max={500}
            step={5}
            value={guests}
            onChange={(e) => setGuests(+e.target.value)}
            aria-label="Number of guests"
          />
        </div>
        <div className="hr-grp">
          <div className="hr-top">
            <span className="hr-lab">Event days</span>
            <span className="hr-val">{days === 1 ? '1 day' : `${days} days`}</span>
          </div>
          <input
            type="range"
            min={1}
            max={7}
            step={1}
            value={days}
            onChange={(e) => setDays(+e.target.value)}
            aria-label="Number of event days"
          />
        </div>
        <div className="hr-hint">
          Per-guest and per-day lines update live; flat items don’t change. Papic is per guest,
          capped at ₱15,000/day. Rough estimate — set exact pax, days &amp; options in the app.
        </div>
      </div>

      {pricing.groups.map((g) => (
        <div key={g.title}>
          <div className="hr-pr-alh">{g.title}</div>
          <div className={`hr-pr-grid${g.tinted ? ' hr-pr-papic' : ''}`}>
            {g.rows.map((row) => (
              <div className="hr-pr-row" key={row.n}>
                <span className="hr-n">
                  {row.n}
                  {row.note && (
                    <span style={{ color: '#4F6B4A', fontWeight: 500 }}> {row.note}</span>
                  )}
                </span>
                <span className={`hr-v${row.free ? ' hr-vfree' : ''}`}>
                  {computeRowValue(row, guests, days)}
                </span>
              </div>
            ))}
          </div>
          {g.title.startsWith('Couple Website') && (
            <div className="hr-pr-hubnote">
              Your site is a hub —{' '}
              <strong>
                Papic gallery · Live Photo Wall · livestream · Pakanta · Animated Monogram · 3D Plan
              </strong>{' '}
              auto-appear on it, free or paid. Bought on their own; the website just gathers them.
            </div>
          )}
        </div>
      ))}

      <p className="hr-pr-foot">
        Prices render live from the Setnayan catalog and are admin-managed. The free single-camera
        livestream and the full Plano planner always stay free. Curated bundles (Essentials &amp;
        Complete) are on the way.
      </p>
      <Link className="hr-pr-seefull" href="/pricing" onClick={onClose}>
        See full pricing →
      </Link>
    </OverlayShell>
  );
}

function DownloadOverlay({
  current,
  onClose,
  detected,
  match,
}: {
  current: OverlayId;
  onClose: () => void;
  detected: string;
  match: 'mac' | 'win' | null;
}) {
  return (
    <OverlayShell
      id="download"
      current={current}
      onClose={onClose}
      label="Download"
      cardStyle={{ maxWidth: 640 }}
    >
      <div className="hr-ov-eyebrow">Download · {detected}</div>
      <h2 className="hr-ov-title">Setnayan, on every screen.</h2>
      <p className="hr-ov-sub">
        One account, everywhere. Grab the desktop app, install the web app, or get it on your phone.
      </p>
      <div className="hr-dl-grid">
        <Link className={`hr-dl-card${match === 'mac' ? ' hr-match' : ''}`} href="/download" onClick={onClose}>
          <div className="hr-ic">⌘</div>
          <div className="hr-t">macOS</div>
          <div className="hr-s">Apple silicon &amp; Intel · .dmg</div>
        </Link>
        <Link className={`hr-dl-card${match === 'win' ? ' hr-match' : ''}`} href="/download" onClick={onClose}>
          <div className="hr-ic">⊞</div>
          <div className="hr-t">Windows</div>
          <div className="hr-s">64-bit · .msi</div>
        </Link>
        <Link className="hr-dl-card" href="/download" onClick={onClose}>
          <div className="hr-ic">◍</div>
          <div className="hr-t">Web app · PWA</div>
          <div className="hr-s">Install from your browser</div>
        </Link>
      </div>
      <div className="hr-dl-stores">
        {/* App-store listings are not live yet — kept as a labelled "soon" tile
            rather than a dead link. Swap for the real store URLs once published. */}
        <span className="hr-dl-store hr-soon">
          <span className="hr-ic">↧</span>App Store · iPhone &amp; iPad · soon
        </span>
        <span className="hr-dl-store hr-soon">
          <span className="hr-ic">▶</span>Google Play · Android · soon
        </span>
      </div>
    </OverlayShell>
  );
}


/** DB-driven price block for a vendor tier section (28-day + annual secondary),
 *  resolved from the live catalog via PricingData.vendor — never hardcoded. */
function tierPriceBlock(tier: string, v: PricingData['vendor']) {
  const p =
    tier === 'solo'
      ? { a: v.soloMonthly, u: '/ 28 days', y: v.soloAnnual }
      : tier === 'pro'
        ? { a: v.proMonthly, u: '/ 28 days', y: v.proAnnual }
        : tier === 'enterprise'
          ? { a: v.enterpriseMonthly, u: '/ 28 days', y: v.enterpriseAnnual }
          : { a: '₱0', u: 'free while we launch', y: null as string | null };
  return (
    <div className="hr-vt-price">
      {p.a}
      <span className="hr-vt-unit"> {p.u}</span>
      {p.y ? <span className="hr-vt-annual">or {p.y} / yr</span> : null}
    </div>
  );
}

function VendorsOverlay({
  current,
  onClose,
  pricing,
}: {
  current: OverlayId;
  onClose: () => void;
  pricing: PricingData;
}) {
  return (
    <OverlayShell id="vendors" current={current} onClose={onClose} label="For vendors">
      <div className="hr-ov-eyebrow">Setnayan for vendors</div>
      <h2 className="hr-ov-title">Get found by couples planning right now.</h2>
      <p className="hr-ov-sub">
        List your business, get matched to the couples who actually fit, and run every booking, chat,
        and calendar in one place. Free while we launch — and 0% commission, always.
      </p>
      <div className="hr-vb-stat">
        <b>Everything below, by account type.</b> A free verified account is already a whole
        business — 0% commission, direct payouts, matchmaking, your dashboard, and analytics. The
        paid tiers add more as you grow, and each one includes everything in the tier before it.{' '}
        <span className="hr-soonkey">“Soon” = in active build; it clears as features ship.</span>
      </div>

      <div className="hr-vb-legend">
        <b>How the tiers stack.</b> <b>Free</b> is the whole ops spine. <b>Solo</b> adds your
        business analytics. <b>Pro</b> adds a team, wider reach, and premium market intel.{' '}
        <b>Enterprise</b> lifts every limit — seats, photos, events, nationwide reach.{' '}
        <Link className="hr-vb-legend-link" href="/for-vendors" onClick={onClose}>
          See the full comparison →
        </Link>
      </div>

      {VENDOR_TIER_SECTIONS.map((section) => (
        <div className={`hr-vt-section hr-vt-${section.tier}`} key={section.tier}>
          <div className="hr-vt-head">
            <div className="hr-vt-name">{section.name}</div>
            {tierPriceBlock(section.tier, pricing.vendor)}
          </div>
          <p className="hr-vt-tagline">{section.tagline}</p>
          {section.groups.map((group, gi) => (
            <div className="hr-vt-group" key={group.h ?? gi}>
              {group.h && <div className="hr-vt-subh">{group.h}</div>}
              <div className="hr-vb-grid">
                {group.items.map((it) => (
                  <div className="hr-vb-item" key={it.n}>
                    <div className="hr-n">
                      {it.n}
                      {it.soon && <span className="hr-soon">Soon</span>}
                    </div>
                    <div className="hr-b">{it.b}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      <div className="hr-vt-section hr-vt-custom">
        <div className="hr-vt-head">
          <div className="hr-vt-name">{VENDOR_CUSTOM_TIER.name}</div>
        </div>
        <p className="hr-vt-tagline">{VENDOR_CUSTOM_TIER.tagline}</p>
      </div>

      <div className="hr-vd-cta">
        <Link className="hr-vd-btn" href="/for-vendors" onClick={onClose}>
          Register your business · free
        </Link>
        <button className="hr-vd-link" onClick={onClose}>
          Maybe later
        </button>
      </div>
    </OverlayShell>
  );
}

function SignInOverlay({
  current,
  onClose,
  oauth,
}: {
  current: OverlayId;
  onClose: () => void;
  oauth: SignInOAuth;
}) {
  // No explicit `next`: '/' lets signInWithPassword route to the account home
  // by account_type (couple → /dashboard, vendor → /vendor-dashboard, …) —
  // same default the /login page passes when arrived at without a ?next.
  const next = '/';
  return (
    <OverlayShell
      id="signin"
      current={current}
      onClose={onClose}
      label="Sign in"
      cardStyle={{ maxWidth: 460 }}
    >
      <div className="hr-ov-eyebrow">Welcome back</div>
      <h2 className="hr-ov-title">Sign in to Setnayan.</h2>
      <p className="hr-ov-sub">
        One account for couples and vendors. Pick up right where you left off.
      </p>

      {/* OAuth above the email form — same placement + components as /login.
          Shell-gated server-side; desktop gets the loopback variant. */}
      {oauth.show ? (
        <div className="hr-si-oauth">
          {oauth.desktop ? <DesktopOAuthButtons next={next} /> : <OAuthButtonRow next={next} />}
        </div>
      ) : null}

      {oauth.show ? (
        <div className="hr-si-or">
          <span>or continue with email</span>
        </div>
      ) : null}

      <form action={signInWithPassword} className="hr-si-form">
        <input type="hidden" name="next" value={next} />
        <TurnstileField action="login" />
        <div className="hr-si-field">
          <label htmlFor="hr-si-email" className="hr-si-label">
            Email
          </label>
          <input
            id="hr-si-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@setnayan.com"
            required
            className="hr-si-input"
          />
        </div>
        <div className="hr-si-field">
          <label htmlFor="hr-si-password" className="hr-si-label">
            Password
          </label>
          <input
            id="hr-si-password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            className="hr-si-input"
          />
        </div>
        {/* "Stay signed in" defaults CHECKED — explicit opt-out only (matches
            /login; the server action downgrades sb-* cookies to session-only
            when unchecked). */}
        <div className="hr-si-row">
          <label htmlFor="hr-si-remember" className="hr-si-remember">
            <input id="hr-si-remember" name="remember" type="checkbox" defaultChecked />
            <span>Stay signed in</span>
          </label>
          <Link href="/forgot-password" className="hr-si-link" onClick={onClose}>
            Forgot password?
          </Link>
        </div>
        <SubmitButton className="hr-si-submit" pendingLabel="Signing in…">
          Continue
        </SubmitButton>
      </form>

      <div className="hr-si-foot">
        No account yet?{' '}
        <Link href="/signup" className="hr-si-link" onClick={onClose}>
          Create one — free
        </Link>
      </div>
    </OverlayShell>
  );
}

/**
 * SetnayanAiOverlay — the glass-nav pop-up for Setnayan AI (owner 2026-07-02).
 * Relief-forward, SHIPPED-ONLY per the GTM content framework
 * (Setnayan_AI_GTM_Content_2026-07-02.md §4): does-the-legwork / stands-guard /
 * reassures — no personalization ("learns your taste") or cohort ("couples like
 * you") teasers (those are dormant pending privacy sign-off). Price reads live
 * from the catalog via `pricing` (₱799/28d, ₱499 first). Cadence stated so
 * turning it on never reads as inviting spam.
 */
/**
 * The Setnayan AI pop-up = the interactive SAVINGS COMPARATOR (owner
 * 2026-07-03: "the widget you showed is the pop up. the text on hero is the
 * benefits"). The hero story carries the benefits; this pop-up carries the
 * burden-and-cost comparison — a "my wedding is in N months" slider (1–24)
 * plus three compare modes (hire it · other AI apps · do it yourself), with
 * bars drawn to honest scale. Setnayan's side of the math comes from the RAW
 * catalog prices on `pricing` (intro + regular × cycles — never re-hardcoded);
 * the alternatives are labeled illustrative estimates, category-level only
 * (never a named competitor). Desktop fits without scrolling; the overlay
 * wrapper (.home-reskin-ov, overflow-y auto) scrolls on small screens.
 */
const AI_COMPARE_TEAM_PHP_MO = 50_000; // 2–3-person team · typical PH rates (illustrative)
const AI_COMPARE_APPS_PHP_MO = 2_900; // planning AIs abroad · top of range
const AI_COMPARE_DIY_HOURS_MO: [number, number] = [25, 50]; // hands-on checking (illustrative)

function SetnayanAiOverlay({
  current,
  onClose,
  pricing,
  onOpenStory,
}: {
  current: OverlayId;
  onClose: () => void;
  pricing: PricingData;
  /** Opens the one-page Setnayan AI story takeover (owner 2026-07-03) — the
   *  in-world replacement for the old-chrome /setnayan-ai bounce. */
  onOpenStory?: () => void;
}) {
  // A "month" here = the house 28-DAY cycle (13 ≈ 1 year — owner 2026-07-03).
  const [months, setMonths] = useState(13);
  const [mode, setMode] = useState<'hire' | 'apps' | 'diy'>('hire');

  const peso = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`;
  // Setnayan AI over the window: the ₱499 intro cycle + ₱799 × the rest —
  // raw numbers straight from the catalog resolve (pricing-data.ts).
  const mine = pricing.aiIntroPhp + pricing.aiRegularPhp * Math.max(0, months - 1);
  // Alternatives are quoted per CALENDAR month → prorate to the 28-day window so
  // we never overstate them (13 cycles ≈ 12.1 calendar months).
  const calMonths = (months * 28) / 30;
  const yearsNote = months === 13 ? ' · 1 year' : months === 26 ? ' · 2 years' : '';

  const CHIPS: Array<['hire' | 'apps' | 'diy', string]> = [
    ['hire', 'vs hiring it'],
    ['apps', 'vs other AI apps'],
    ['diy', 'vs doing it yourself'],
  ];
  const compare =
    mode === 'hire'
      ? {
          sub: 'A 2–3 person team doing this until your day (typical PH rates, illustrative):',
          save: `you save ${peso(AI_COMPARE_TEAM_PHP_MO * calMonths - mine)}`,
          themLabel: `Hired team · ${peso(AI_COMPARE_TEAM_PHP_MO * calMonths)}`,
          usPct: Math.max((mine / (AI_COMPARE_TEAM_PHP_MO * calMonths)) * 100, 1.2),
          foot: 'Bars drawn to scale. Setnayan AI ends on your wedding day.',
        }
      : mode === 'apps'
        ? {
            sub: `A planning AI abroad until your day (${peso(AI_COMPARE_APPS_PHP_MO)}/mo, top of range):`,
            save: `you save ${peso(Math.max(0, AI_COMPARE_APPS_PHP_MO * calMonths - mine))}`,
            themLabel: `Other AI apps · ${peso(AI_COMPARE_APPS_PHP_MO * calMonths)}`,
            usPct: Math.max((mine / (AI_COMPARE_APPS_PHP_MO * calMonths)) * 100, 1.2),
            foot: 'Drawn to scale — and theirs waits for your questions; it doesn’t watch your vendors.',
          }
        : {
            sub: 'Keeping every vendor, price and deadline current by hand:',
            save: `you get back ${Math.round(AI_COMPARE_DIY_HOURS_MO[0] * calMonths).toLocaleString()}–${Math.round(AI_COMPARE_DIY_HOURS_MO[1] * calMonths).toLocaleString()} hours`,
            themLabel: `Your hours · ${Math.round(AI_COMPARE_DIY_HOURS_MO[1] * calMonths).toLocaleString()} h`,
            usPct: 2,
            foot: '≈ 25–50 hours of checking per month, illustrative — it runs in the background instead.',
          };

  return (
    <OverlayShell
      id="setnayan-ai"
      current={current}
      onClose={onClose}
      label="Setnayan AI"
      // Fitted card (owner 2026-07-03 "does not stretch on popup well"): the
      // comparator is a single-column story — cap the card at its content
      // width instead of the 880px default that left a dead right half.
      cardStyle={{ maxWidth: 620 }}
    >
      <div className="hr-ov-eyebrow">Setnayan AI · your planning brain</div>
      <h2 className="hr-ov-title">Stop remembering to check on everything.</h2>
      <p style={{ marginTop: 10, fontSize: 15, lineHeight: 1.55, color: '#2a2925' }}>
        It watches the vendors you’re eyeing and the ones you’ve booked — and taps you only when something needs you.
        Most weeks, it stays quiet.
      </p>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 24, fontWeight: 600, color: '#2a2925' }}>{pricing.aiPrice}</span>
        <span style={{ fontSize: 14, color: '#6c675e' }}>{pricing.aiPeriod}</span>
        <span style={{ background: 'rgba(166,124,61,.14)', color: '#8a6a2e', fontSize: 12, fontWeight: 500, padding: '4px 11px', borderRadius: 'var(--m-r-full)' }}>
          {pricing.aiIntroPrice} your first 28 days
        </span>
      </div>

      {/* ── the savings comparator ── */}
      <div style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, color: '#6c675e' }}>
          <span>My wedding is in</span>
          <span style={{ fontFamily: 'var(--hr-serif)', fontStyle: 'italic', fontSize: 19, color: '#2a2925' }}>
            {months} {months === 1 ? 'month' : 'months'}{yearsNote}
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={26}
          step={1}
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
          aria-label="Months until your wedding"
          style={{ width: '100%', marginTop: 2, accentColor: '#a67c3d' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#a8a4a0' }}>
          <span>1 month · a month = 28 days</span>
          <span>2 years</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
        {CHIPS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setMode(k)}
            aria-pressed={mode === k}
            style={{
              border: `1px solid ${mode === k ? '#2a2925' : 'rgba(42,43,46,.25)'}`,
              background: mode === k ? '#2a2925' : 'transparent',
              color: mode === k ? '#f2f2f0' : '#54514d',
              fontSize: 12.5,
              padding: '7px 14px',
              borderRadius: 'var(--m-r-full)',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div>
        <p style={{ margin: '12px 0 0', fontSize: 12.5, color: '#6c675e' }}>{compare.sub}</p>
        <p style={{ margin: '2px 0 0', fontFamily: 'var(--hr-serif)', fontStyle: 'italic', fontSize: 26, color: '#3f6b3f' }}>
          {compare.save}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <span style={{ flex: '0 0 118px', fontSize: 11, color: '#6c675e' }}>{compare.themLabel}</span>
          <div style={{ flex: 1, height: 9, background: 'rgba(42,43,46,.1)', borderRadius: 'var(--m-r-full)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '100%', background: '#c5a059', borderRadius: 'var(--m-r-full)' }} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <span style={{ flex: '0 0 118px', fontSize: 11, fontWeight: 600, color: '#2a2925' }}>Setnayan AI · {peso(mine)}</span>
          <div style={{ flex: 1, height: 9, background: 'rgba(42,43,46,.1)', borderRadius: 'var(--m-r-full)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${compare.usPct}%`, background: '#2a2925', borderRadius: 'var(--m-r-full)', transition: 'width .35s ease' }} />
          </div>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 10.5, color: '#a8a4a0' }}>{compare.foot}</p>
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 20, flexWrap: 'wrap' }}>
        <Link
          href="/onboarding/wedding?from=setnayan-ai"
          onClick={onClose}
          style={{ background: '#211f1b', color: '#f4f1ea', fontSize: 14, fontWeight: 500, padding: '11px 20px', borderRadius: 'var(--m-r-full)', textDecoration: 'none' }}
        >
          Turn on Setnayan AI
        </Link>
        {onOpenStory ? (
          // In-world story takeover — never bounce to the old-chrome route.
          <button
            onClick={onOpenStory}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 14, color: '#57534b' }}
          >
            See the full story →
          </button>
        ) : (
          <Link href="/setnayan-ai" onClick={onClose} style={{ fontSize: 14, color: '#57534b', textDecoration: 'none' }}>
            See the full story →
          </Link>
        )}
      </div>
    </OverlayShell>
  );
}

export function HomeOverlays({
  current,
  onClose,
  pricing,
  onOpenStory,
}: {
  current: OverlayId;
  onClose: () => void;
  pricing: PricingData;
  onOpenStory?: () => void;
}) {
  // OAuth visibility, resolved client-side (this overlay is ssr:false). Computed
  // once on mount so the Sign-in overlay shows the right OAuth variant without
  // page.tsx having to read headers()/cookies(). (Perf sweep 2026-07-02.)
  const [oauth] = useState<SignInOAuth>(detectSignInOAuth);
  // Device-detect for the Download overlay (client-only).
  const [detected, setDetected] = useState('your device');
  const [match, setMatch] = useState<'mac' | 'win' | null>(null);
  useEffect(() => {
    const ua = navigator.userAgent || '';
    const mac = /mac/i.test(ua);
    const win = /win/i.test(ua);
    setDetected(mac ? 'macOS' : win ? 'Windows' : 'your computer');
    setMatch(mac ? 'mac' : win ? 'win' : null);
  }, [current]);

  return (
    <>
      <PricesOverlay current={current} onClose={onClose} pricing={pricing} />
      <SetnayanAiOverlay current={current} onClose={onClose} pricing={pricing} onOpenStory={onOpenStory} />
      <DownloadOverlay current={current} onClose={onClose} detected={detected} match={match} />
      <VendorsOverlay current={current} onClose={onClose} pricing={pricing} />
      <SignInOverlay current={current} onClose={onClose} oauth={oauth} />
      <PapicDemoOverlay current={current} onClose={onClose} />
      <PanoodDemoOverlay current={current} onClose={onClose} />
      <Plan3DDemoOverlay current={current} onClose={onClose} />
    </>
  );
}
