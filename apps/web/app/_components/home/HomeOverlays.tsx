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
import type { PricingData, PriceRow } from './pricing-data';
import { VENDOR_TIER_SECTIONS, VENDOR_CUSTOM_TIER } from './vendor-benefits';

export type OverlayId = 'prices' | 'download' | 'vendors' | 'signin' | null;

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

function OverlayShell({
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

export function HomeOverlays({
  current,
  onClose,
  pricing,
}: {
  current: OverlayId;
  onClose: () => void;
  pricing: PricingData;
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
      <DownloadOverlay current={current} onClose={onClose} detected={detected} match={match} />
      <VendorsOverlay current={current} onClose={onClose} pricing={pricing} />
      <SignInOverlay current={current} onClose={onClose} oauth={oauth} />
    </>
  );
}
