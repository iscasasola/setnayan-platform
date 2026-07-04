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
 * /onboarding/wedding, full pricing → /pricing, register → /vendors.
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

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { SubmitButton } from '@/app/_components/submit-button';
import { ANY_OAUTH_ENABLED, OAuthButtonRow } from '@/app/_components/oauth-button-row';
import { DesktopOAuthButtons } from '@/app/_components/desktop-oauth-buttons';
import { signInWithPassword } from '@/app/login/actions';
import { TurnstileField } from '@/app/_components/auth/turnstile-field';
import type { PricingData } from './pricing-data';
import { VENDOR_TIER_SECTIONS } from './vendor-benefits';
import { PapicDemoOverlay } from './papic-demo-overlay';
import { PanoodDemoOverlay } from './panood-demo-overlay';
import { Plan3DDemoOverlay } from './plan3d-demo-overlay';
import { AlaalaEditorialOverlay } from './alaala-editorial-overlay';

export type OverlayId =
  | 'prices'
  | 'download'
  | 'vendors'
  | 'signin'
  | 'setnayan-ai'
  | 'papic-demo'
  | 'panood-demo'
  | 'plan3d-demo'
  | 'alaala-editorial'
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
  cardClassName,
  children,
}: {
  id: Exclude<OverlayId, null>;
  current: OverlayId;
  onClose: () => void;
  label: string;
  cardStyle?: React.CSSProperties;
  /**
   * Extra class(es) on the overlay card. The slim free-only nav popups (Prices /
   * Vendors) pass `hr-ov-card-glass` to switch the card from the opaque greige
   * panel to a translucent FROSTED-GLASS surface that matches the nav's
   * blur(16px) exactly (owner 2026-07-04 nav-popup redesign).
   */
  cardClassName?: string;
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
      <div className={`hr-ov-card${cardClassName ? ` ${cardClassName}` : ''}`} style={cardStyle}>
        <button className="hr-ov-x" onClick={onClose} aria-label="Close">
          ✕
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Count of free-tier (Free · Verified) vendor benefits — computed at build time
 * from the canonical VENDOR_TIER_SECTIONS so the Vendors-popup line-link ("See
 * all N free vendor benefits →") never goes stale when benefits are added or
 * removed. 49 today (7 groups); the number tracks the array, not a literal.
 */
const FREE_VENDOR_BENEFIT_COUNT = (() => {
  const free = VENDOR_TIER_SECTIONS.find((s) => s.tier === 'free');
  return free ? free.groups.reduce((n, g) => n + g.items.length, 0) : 0;
})();

/**
 * PricesOverlay — the FROSTED-GLASS nav popup (owner 2026-07-04 redesign).
 *
 * A SUMMARY: the free planning offering + a one-line Setnayan AI price intro +
 * ONE line-link out to /pricing. The full tier ladder, live estimator and
 * à-la-carte catalog live on the /pricing page. Renders in the translucent
 * glass card (`hr-ov-card-glass`) that matches the nav's blur(16px) exactly.
 *
 * `pricing` is OPTIONAL — the free summary + link render instantly with no
 * pricing; the AI price line (₱799/28d · ₱499 first cycle, both catalog-resolved
 * via PricingData) fills in the moment the lazy pricing fetch lands, matching
 * the marketing-chrome pattern. Never hardcodes a price.
 */
function PricesOverlay({
  current,
  onClose,
  pricing,
}: {
  current: OverlayId;
  onClose: () => void;
  pricing: PricingData | null;
}) {
  return (
    <OverlayShell
      id="prices"
      current={current}
      onClose={onClose}
      label="Pricing"
      cardClassName="hr-ov-card-glass"
    >
      <div className="hr-ov-eyebrow">Free to plan</div>
      <h2 className="hr-ov-title">Everything to start — free.</h2>
      <p className="hr-ov-sub">Plan the whole day and share it, without paying a peso.</p>
      <ul className="hr-glist">
        <li>Schedule, Budget, Guest List, Seat Plan &amp; Mood Board</li>
        <li>
          Your 4-in-1 wedding website
          <span>Save-the-Date · RSVP · Event · Editorial</span>
        </li>
        <li>Unlimited RSVP collection</li>
        <li>Browse vendors + a match preview</li>
        <li>Single-camera livestream &amp; free Custom QR</li>
      </ul>
      {/* Quick paid-tier intro — Setnayan AI, priced live from the catalog. */}
      {pricing ? (
        <div className="hr-gintro">
          <span className="hr-gintro-h">Setnayan AI</span>
          <span className="hr-gintro-b">
            the planning brain that filters your vendors — {pricing.aiPrice}
            {pricing.aiPeriod}, {pricing.aiIntroPrice} your first cycle.
          </span>
        </div>
      ) : null}
      <div className="hr-gline">
        <span className="hr-gline-t">Want more features?</span>
        <Link className="hr-gline-a" href="/pricing" onClick={onClose}>
          See all free features &amp; prices <span className="hr-gline-arw">→</span>
        </Link>
      </div>
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


/**
 * VendorsOverlay — the FROSTED-GLASS nav popup (owner 2026-07-04 redesign).
 *
 * Slimmed to ONLY the free-business offering + ONE line-link out to
 * /vendors. The full tier ladder + ~90-benefit guide moved OFF the popup
 * onto the /vendors page. Renders in the translucent glass card
 * (`hr-ov-card-glass`) matching the nav's blur(16px). No `pricing` dependency —
 * opens instantly.
 */
function VendorsOverlay({ current, onClose }: { current: OverlayId; onClose: () => void }) {
  return (
    <OverlayShell
      id="vendors"
      current={current}
      onClose={onClose}
      label="For vendors"
      cardClassName="hr-ov-card-glass"
    >
      <div className="hr-ov-eyebrow">Free for vendors</div>
      <h2 className="hr-ov-title">A whole business — free.</h2>
      <p className="hr-ov-sub">
        Get found, get booked, keep 100%. Free while we launch.
      </p>
      <ul className="hr-glist">
        <li>
          Get found by matched couples
          <span>by faith, region &amp; the dates you&rsquo;re open</span>
        </li>
        <li>Verified badge + an auto-built public page</li>
        <li>Run every booking — contracts, calendar &amp; proposals</li>
        <li>
          Get paid direct — <b>0% commission</b>, we never hold your money
        </li>
        <li>Reviews, earned badges &amp; your track record</li>
      </ul>
      {/* Quick tier-stack intro — one line, a summary not the wall. */}
      <div className="hr-gintro">
        <span className="hr-gintro-h">How the tiers stack</span>
        <span className="hr-gintro-b">
          Free is the whole ops spine · Solo adds your business analytics · Pro
          adds a team, wider reach &amp; market intel · Enterprise lifts every
          limit.
        </span>
      </div>
      <div className="hr-gline">
        <span className="hr-gline-t">Want to upgrade your business?</span>
        <Link className="hr-gline-a" href="/vendors" onClick={onClose}>
          See all {FREE_VENDOR_BENEFIT_COUNT} free vendor benefits{' '}
          <span className="hr-gline-arw">→</span>
        </Link>
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
          Create one, free
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
/**
 * Owner-set MAXIMA (2026-07-03): each compare mode is anchored to a fixed
 * ceiling — the alternative's value at the slider's 26-month end — and every
 * position on the slider is that ceiling × months/26. Both bars draw against
 * this fixed scale, so dragging the slider makes BOTH values (and both bars)
 * visibly rise instead of the alternative sitting at a static full bar.
 * Hire ≈ ₱46,667/28d (a 2–3-person team at typical PH rates, prorated);
 * apps ≈ ₱3,846/28d (planning AIs abroad, top of range); DIY upper ≈ 47 h/28d.
 * The DIY mode answers "what is your hour worth?": the person sets their OWN
 * hourly rate, the DIY hours are valued in pesos at that rate, and — like the
 * other two modes — the result reads "you save ₱X" against Setnayan AI's price
 * (owner 2026-07-03). All three modes are peso-to-peso; only the alternative's
 * ceiling differs.
 */
const AI_COMPARE_MAX_MONTHS = 26;
const AI_COMPARE_TEAM_MAX_PHP = 1_213_333;
const AI_COMPARE_APPS_MAX_PHP = 100_000;
const AI_COMPARE_DIY_MAX_HOURS = 1_213;
const AI_COMPARE_RATE_DEFAULT_PHP = 150; // ₱/hr starting point; user-adjustable

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
  // "What is your hour worth?" — the DIY mode values your own time in pesos.
  const [rate, setRate] = useState(AI_COMPARE_RATE_DEFAULT_PHP);

  const peso = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`;
  // Setnayan AI over the window: the ₱499 intro cycle + ₱799 × the rest —
  // raw numbers straight from the catalog resolve (pricing-data.ts).
  const mine = pricing.aiIntroPhp + pricing.aiRegularPhp * Math.max(0, months - 1);
  // Every mode scales linearly toward its owner-set ceiling at 26 months.
  const frac = months / AI_COMPARE_MAX_MONTHS;
  const yearsNote = months === 13 ? ' · 1 year' : months === 26 ? ' · 2 years' : '';

  const CHIPS: Array<['hire' | 'apps' | 'diy', string]> = [
    ['hire', 'vs hiring it'],
    ['apps', 'vs other AI apps'],
    ['diy', 'vs doing it yourself'],
  ];
  const teamPhp = AI_COMPARE_TEAM_MAX_PHP * frac;
  const appsPhp = AI_COMPARE_APPS_MAX_PHP * frac;
  const diyHours = AI_COMPARE_DIY_MAX_HOURS * frac;
  const diyWorth = diyHours * rate; // your DIY hours valued at your own rate
  const compare =
    mode === 'hire'
      ? {
          sub: 'A 2–3 person team doing this until your day (typical PH rates, illustrative):',
          save: `you save ${peso(teamPhp - mine)}`,
          themLabel: `Hired team · ${peso(teamPhp)}`,
          themPct: frac * 100,
          usLabel: `Setnayan AI · ${peso(mine)}`,
          usPct: Math.max((mine / AI_COMPARE_TEAM_MAX_PHP) * 100, 1.2),
          foot: 'Bars drawn to one scale. Both grow with your timeline. Setnayan AI ends on your wedding day.',
        }
      : mode === 'apps'
        ? {
            sub: `A planning AI abroad until your day (${peso(AI_COMPARE_APPS_MAX_PHP / AI_COMPARE_MAX_MONTHS)}/mo, top of range):`,
            save: `you save ${peso(Math.max(0, appsPhp - mine))}`,
            themLabel: `Other AI apps · ${peso(appsPhp)}`,
            themPct: frac * 100,
            usLabel: `Setnayan AI · ${peso(mine)}`,
            usPct: Math.max((mine / AI_COMPARE_APPS_MAX_PHP) * 100, 1.2),
            foot: 'Drawn to one scale, and theirs waits for your questions; it doesn’t watch your vendors.',
          }
        : {
            // "What is your hour worth?" — value the DIY hours at the rate the
            // person sets, then read "you save ₱X" like the other two modes.
            // Both bars share one peso scale (ceiling = the hours' worth at the
            // 26-month end), so raising the rate visibly shrinks Setnayan's bar.
            sub: 'Keeping every vendor, price and deadline current by hand:',
            save: `you save ${peso(Math.max(0, diyWorth - mine))}`,
            themLabel: `Your time · ${peso(diyWorth)}`,
            themPct: frac * 100,
            usLabel: `Setnayan AI · ${peso(mine)}`,
            usPct: Math.max((mine / (AI_COMPARE_DIY_MAX_HOURS * rate)) * 100, 1.2),
            foot: `${Math.round(diyHours).toLocaleString()} h by hand × ${peso(rate)}/hr, illustrative. Setnayan AI runs it in the background instead.`,
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
        It watches the vendors you’re eyeing and the ones you’ve booked, and taps you only when something needs you.
        Most weeks, it stays quiet.
      </p>

      {/* ── the savings comparator ── */}
      {/* Value-first order (owner 2026-07-03): the calculator + savings come
          FIRST; the price + CTA move to the bottom as the "offer," so you see
          what you save before what it costs — and the ₱ total in the bar sits
          right next to the /28-day price it's built from. */}
      <div style={{ marginTop: 14 }}>
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
          className="sn-range"
          style={{ '--sn-p': `${((months - 1) / 25) * 100}%` } as CSSProperties}
        />
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: '#6c675e' }}>Compared to</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
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
        <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#6c675e' }}>{compare.sub}</p>
        {/* "What is your hour worth?" — the person sets their own rate; the DIY
            hours are valued at it (owner 2026-07-03). DIY-only control. */}
        {mode === 'diy' && (
          <div style={{ margin: '6px 0 4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, color: '#6c675e' }}>
              <span>My time is worth</span>
              <span style={{ fontFamily: 'var(--hr-serif)', fontStyle: 'italic', fontSize: 19, color: '#2a2925' }}>
                {peso(rate)}/hr
              </span>
            </div>
            <input
              type="range"
              min={100}
              max={1000}
              step={50}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              aria-label="What your time is worth per hour"
              className="sn-range"
              style={{ '--sn-p': `${((rate - 100) / 900) * 100}%` } as CSSProperties}
            />
          </div>
        )}
        <p style={{ margin: '2px 0 0', fontFamily: 'var(--hr-serif)', fontStyle: 'italic', fontSize: 26, color: '#3f6b3f' }}>
          {compare.save}
        </p>
        {/* One shared label-column width, sized for the longest label at the
            26-month max ("Hired team · ₱1,213,333"), and no wrapping — both
            rows stay single-line and their bars start at the same x. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <span style={{ flex: '0 0 152px', whiteSpace: 'nowrap', fontSize: 11, color: '#6c675e' }}>{compare.themLabel}</span>
          <div style={{ flex: 1, height: 9, background: 'rgba(42,43,46,.1)', borderRadius: 'var(--m-r-full)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${compare.themPct}%`, background: '#c5a059', borderRadius: 'var(--m-r-full)', transition: 'width .35s ease' }} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <span style={{ flex: '0 0 152px', whiteSpace: 'nowrap', fontSize: 11, fontWeight: 600, color: '#2a2925' }}>{compare.usLabel}</span>
          <div style={{ flex: 1, height: 9, background: 'rgba(42,43,46,.1)', borderRadius: 'var(--m-r-full)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${compare.usPct}%`, background: '#2a2925', borderRadius: 'var(--m-r-full)', transition: 'width .35s ease' }} />
          </div>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 10.5, color: '#a8a4a0' }}>{compare.foot}</p>
      </div>

      {/* The offer — price + act, LAST (owner 2026-07-03). The muted total ties
          the /28-day price to the ₱ figure in the Setnayan AI bar just above. */}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(42,43,46,.1)', display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 24, fontWeight: 600, color: '#2a2925' }}>{pricing.aiPrice}</span>
        <span style={{ fontSize: 14, color: '#6c675e' }}>{pricing.aiPeriod}</span>
        <span style={{ background: 'rgba(166,124,61,.14)', color: '#8a6a2e', fontSize: 12, fontWeight: 500, padding: '4px 11px', borderRadius: 'var(--m-r-full)' }}>
          {pricing.aiIntroPrice} your first 28 days
        </span>
        <span style={{ fontSize: 12, color: '#a8a4a0' }}>· {peso(mine)} across your {months} {months === 1 ? 'month' : 'months'}</span>
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
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
  // Nullable so the persistent marketing chrome (SiteChrome) can mount this
  // BEFORE its lazy /api/home-pricing fetch resolves — the pricing-free
  // overlays (Download / Sign in / the demos) then work instantly, and the
  // pricing-dependent ones (Prices / Setnayan AI / Vendors) render as soon as
  // pricing lands. The homepage always passes a resolved value, so its
  // behavior is unchanged.
  pricing: PricingData | null;
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
      {/* Pricing-dependent overlays — mount only once pricing has resolved (on
          the homepage that's always; on marketing pages it's after the lazy
          fetch). A press before pricing lands is a brief no-op that resolves
          itself the instant the fetch completes. */}
      {/* Prices + Vendors popups are free-summary + a quick tier intro + one
          line-link out. They mount + open instantly; the Prices popup's AI price
          line fills in when the lazy `pricing` fetch lands (owner 2026-07-04). */}
      <PricesOverlay current={current} onClose={onClose} pricing={pricing} />
      <VendorsOverlay current={current} onClose={onClose} />
      {pricing && (
        <SetnayanAiOverlay current={current} onClose={onClose} pricing={pricing} onOpenStory={onOpenStory} />
      )}
      {/* Pricing-free overlays — always mounted, so Download / Sign in / the
          demos work immediately regardless of the pricing fetch. */}
      <DownloadOverlay current={current} onClose={onClose} detected={detected} match={match} />
      <SignInOverlay current={current} onClose={onClose} oauth={oauth} />
      <PapicDemoOverlay current={current} onClose={onClose} />
      <PanoodDemoOverlay current={current} onClose={onClose} />
      <Plan3DDemoOverlay current={current} onClose={onClose} />
      <AlaalaEditorialOverlay current={current} onClose={onClose} />
    </>
  );
}
