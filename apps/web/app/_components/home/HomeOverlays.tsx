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
 * Real navigation: every CTA points at a real route — sign-in → /login, start
 * planning → /onboarding/wedding, full pricing → /pricing, register → /for-vendors.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useModalA11y } from '@/lib/use-modal-a11y';
import type { PricingData, PriceRow } from './pricing-data';
import { VENDOR_HERO_CARDS, VENDOR_GROUPS } from './vendor-benefits';

// 'signin' is intentionally NOT here — the homepage "Sign in" links straight to
// the real /login (Google + Apple + email), never a mockup overlay.
export type OverlayId = 'prices' | 'download' | 'vendors' | null;

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
        Planuhan, Likhaan and Ala Ala are free, end to end. Add the planning brain when you want it,
        and pick up any service à la carte. 0% vendor commission, always.
      </p>

      <div className="hr-pr-tiers">
        <div className="hr-pr-tier">
          <div className="hr-t">Free</div>
          <div className="hr-p">₱0</div>
          <div className="hr-d">
            The full Planuhan planner, the free Likhaan studio, a live event page, and Ala Ala basics
            — enough to plan a real event, end to end, and start keeping it.
          </div>
        </div>
        <div className="hr-pr-tier hr-hot">
          <div className="hr-t">Setnayan AI</div>
          <div className="hr-p">
            {pricing.aiPrice}
            <span className="hr-per">{pricing.aiPeriod}</span>
          </div>
          <div className="hr-d">
            Adds Surian — the planning brain that filters the vendors that fit you, paces your
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
        livestream and the full Planuhan planner always stay free. Curated bundles (Essentials &amp;
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


function VendorsOverlay({ current, onClose }: { current: OverlayId; onClose: () => void }) {
  return (
    <OverlayShell id="vendors" current={current} onClose={onClose} label="For vendors">
      <div className="hr-ov-eyebrow">Setnayan for vendors</div>
      <h2 className="hr-ov-title">Get found by couples planning right now.</h2>
      <p className="hr-ov-sub">
        List your business, get matched to the couples who actually fit, and run every booking, chat,
        and calendar in one place. Free while we launch — and 0% commission, always.
      </p>
      <div className="hr-vd-grid">
        {VENDOR_HERO_CARDS.map((c) => (
          <div className="hr-vd-card" key={c.title}>
            <div className="hr-ic">{c.ic}</div>
            <div className="hr-t">
              {c.title}
              {c.soon && <span className="hr-soon">Soon</span>}
            </div>
            <div className="hr-d">{c.body}</div>
          </div>
        ))}
      </div>
      <div className="hr-vb-stat">
        <b>45+ ways we help you win.</b> 0% commission and free listing + verification are live today;
        the rest is in active build and marked “Soon” until it ships.{' '}
        <span className="hr-soonkey">The “Soon” tags clear as features go live.</span>
      </div>

      {VENDOR_GROUPS.map((group) => (
        <div className="hr-vb-group" key={group.h}>
          <div className="hr-vb-h">{group.h}</div>
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

export function HomeOverlays({
  current,
  onClose,
  pricing,
}: {
  current: OverlayId;
  onClose: () => void;
  pricing: PricingData;
}) {
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
      <VendorsOverlay current={current} onClose={onClose} />
    </>
  );
}
