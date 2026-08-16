'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  ChevronRight,
  ExternalLink,
  Lock,
  Monitor,
  PanelsTopLeft,
  Play,
  QrCode,
  Smartphone,
} from 'lucide-react';

/**
 * EditorShell — the unified website editor's two-pane client shell
 * (Unified Website Editor · design 2026-07-25 · PR-1).
 *
 * LEFT: the controls rail, grouped the way a couple thinks about their site
 * (① Site · ② Sections · ③ Chapters). In PR-1 every row is a header + status
 * chip + deep-link to its existing editor; PR-3/PR-4 convert them to inline
 * panels calling the same server actions.
 * RIGHT: the couple's REAL public page in a same-origin iframe, with the four
 * lifecycle phase tabs (host-only `?phase=` override) plus the "RSVP'd" tab
 * (host-only `?as=replied`, a fabricated sample guest) — so they always see what
 * they are editing, including the one state their own site can't show them.
 *
 * Two-way sync with the site's EditorBridge (app/[slug]/_components/
 * editor-bridge.tsx), both directions origin-checked:
 *   rail row selected  → postMessage {t:'scrollTo'} → preview scrolls+highlights
 *   section tapped in preview → {t:'edit'} → the matching rail row activates
 */

export type RailRow = {
  key: string;
  label: string;
  blurb?: string;
  href: string;
  status?: string;
  /** Which preview section this row points at (EditorBridge SECTION_IDS key). */
  anchor?: string;
  /** Website Pro item — gold tag; `locked` adds the lock affordance. */
  pro?: boolean;
  locked?: boolean;
  /** Inline edit panel (PR-3) — rendered by the SERVER component with the
   *  feature's own bound server action, so this client shell only toggles its
   *  visibility and never owns a write path. When absent the row stays a
   *  deep-link to the editor that owns the setting. */
  panel?: React.ReactNode;
};

export type RailGroup = {
  key: string;
  title: string;
  hint?: string;
  rows: RailRow[];
};

type PhaseKey = 'save_the_date' | 'rsvp' | 'event' | 'editorial';

/**
 * Preview tabs = the four lifecycle phases PLUS one simulated-viewer tab.
 *
 * "RSVP'd" is not a fifth phase — the public route's `?phase=` allow-list is
 * closed at four, and the RSVPed keepsake is a per-GUEST fork INSIDE `rsvp`. So
 * that tab renders the same `rsvp` phase with `?as=replied`, which substitutes a
 * fabricated sample guest (host-gated server-side; see
 * lib/simulated-guest-preview.ts). It is the one state a host could otherwise
 * never see on their own site, because they have no guest row of their own.
 */
type PreviewTabKey = PhaseKey | 'rsvp_replied';

type PreviewTab = {
  key: PreviewTabKey;
  label: string;
  /** The lifecycle phase this tab actually renders. */
  phase: PhaseKey;
  /** `?as=` value — set only by simulated-viewer tabs. */
  as?: 'replied';
  /** Whose view this tab is. REQUIRED in practice: a tab with no caption
   *  silently implies "this is your page", and four of the five render the
   *  page as a stranger sees it. */
  caption?: string;
};

/**
 * Preview device (2026-07-25 owner ask). The preview is a real iframe, so
 * changing its WIDTH makes the guest site's own responsive breakpoints respond —
 * this shows the actual mobile and desktop layouts, not a mock-up of them.
 * Phone = 430px (the common PH handset width the site is designed against);
 * Desktop = the full pane, which on a laptop clears the site's `lg:` breakpoint.
 */
type DeviceKey = 'mobile' | 'desktop';
const DEVICES: Array<{ key: DeviceKey; label: string; Icon: typeof Smartphone }> = [
  { key: 'mobile', label: 'Phone', Icon: Smartphone },
  { key: 'desktop', label: 'Desktop', Icon: Monitor },
];
/** Also the fall-back when an unknown tab key somehow lands in state. */
// EVERY TAB NOW SAYS WHOSE VIEW IT IS (2026-08-05).
//
// Four of the five tabs render the page as a STRANGER sees it — someone who
// followed the link with no invitation. Only the RSVP'd tab simulates a guest,
// and it was the only one that said so, so the silence on the others read as
// "this is just your page". A couple could style their Invitation tab for weeks
// without once seeing the thing an invited guest actually opens: their name,
// their seat, their own QR. The `?as=` machinery that would show it exists but
// covers one phase; until it covers these, the honest move is to stop implying
// otherwise. A caption is not a substitute for the view — it is a substitute
// for the wrong impression.
const INVITATION_TAB: PreviewTab = {
  key: 'rsvp',
  label: 'Invitation',
  phase: 'rsvp',
  caption: 'as a visitor with no invitation sees it — an invited guest also sees their name, seat and QR',
};

const PREVIEW_TABS: PreviewTab[] = [
  {
    key: 'save_the_date',
    label: 'Save-the-Date',
    phase: 'save_the_date',
    caption: 'as anyone who opens your link sees it',
  },
  INVITATION_TAB,
  {
    key: 'rsvp_replied',
    label: "RSVP'd",
    phase: 'rsvp',
    as: 'replied',
    caption: 'what a confirmed guest sees — sample guest, not one of yours',
  },
  {
    key: 'event',
    label: 'Wedding day',
    phase: 'event',
    caption: 'as a visitor with no invitation sees it — an invited guest also sees their table and camera',
  },
  {
    key: 'editorial',
    label: 'After',
    phase: 'editorial',
    caption: 'as anyone who opens your link sees it',
  },
];

export function EditorShell({
  groups,
  publicLandingUrl,
  initialPhase,
  initialOpenRow = null,
  proUnlockHref,
  showProCta = true,
  liveHref,
  goLiveSlot,
}: {
  groups: RailGroup[];
  /** `/[slug]` — null when the couple has no URL yet. */
  publicLandingUrl: string | null;
  initialPhase: PhaseKey;
  /** `?open=<rowKey>` — the row a save redirected back to (PR-3). */
  initialOpenRow?: string | null;
  proUnlockHref: string;
  /** Hide the umbrella CTA once the couple owns Website Pro (PR-4). */
  showProCta?: boolean;
  liveHref: string | null;
  /** The go-live / schedule control (server component passed as a child). */
  goLiveSlot?: React.ReactNode;
}) {
  const [tabKey, setTabKey] = useState<PreviewTabKey>(initialPhase);
  const [activeRow, setActiveRow] = useState<string | null>(initialOpenRow);
  const [openPanel, setOpenPanel] = useState<string | null>(initialOpenRow);
  const [mobilePane, setMobilePane] = useState<'edit' | 'preview'>('edit');
  // Most couples' guests open the site on a phone, so the preview starts there.
  const [device, setDevice] = useState<DeviceKey>('mobile');
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  // The selected tab, with a defensive fall-back to the Invitation tab so an
  // unknown key can never blank the preview.
  const tab = PREVIEW_TABS.find((t) => t.key === tabKey) ?? INVITATION_TAB;
  /** `?as=replied` when the tab simulates a viewer; empty for the four plain
   *  phase tabs, so their URLs are byte-identical to before. */
  const asQuery = tab.as ? `&as=${tab.as}` : '';

  const previewSrc = publicLandingUrl
    ? `${publicLandingUrl}?phase=${tab.phase}&editor=1${asQuery}`
    : null;

  /** Rail → preview. */
  const scrollPreviewTo = useCallback((anchor?: string) => {
    if (!anchor) return;
    frameRef.current?.contentWindow?.postMessage(
      { source: 'setnayan-editor', t: 'scrollTo', key: anchor },
      window.location.origin,
    );
  }, []);

  /** Preview → rail. */
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { source?: string; t?: string; key?: string } | null;
      if (!data || data.source !== 'setnayan-site') return;
      if (data.t !== 'edit' || typeof data.key !== 'string') return;
      const match = groups
        .flatMap((g) => g.rows)
        .find((r) => r.anchor === data.key);
      if (!match) return;
      setActiveRow(match.key);
      setMobilePane('edit');
      document
        .getElementById(`rail-row-${match.key}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [groups]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Topbar — identity, go-live, view-live (absorbs the old Launch hero) */}
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-ink/10 bg-white px-4 py-2.5">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-terracotta">
          Website editor
        </p>
        <p className="min-w-0 truncate text-sm font-semibold text-ink">
          {publicLandingUrl ? `setnayan.com${publicLandingUrl}` : 'Set your Event Hub address'}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobilePane((p) => (p === 'edit' ? 'preview' : 'edit'))}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 lg:hidden"
          >
            {mobilePane === 'edit' ? (
              <>
                <Smartphone aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> Preview
              </>
            ) : (
              <>
                <PanelsTopLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> Edit
              </>
            )}
          </button>
          {liveHref ? (
            <>
              {/* Scan-to-view QR (owner 2026-07-25) — the master event QR the
                  /api/website/qr route already serves; scanning opens the live
                  site on a phone. <details> popover: zero JS, click-away closes. */}
              <details className="relative">
                <summary
                  className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-ink/5 [&::-webkit-details-marker]:hidden"
                  title="Scan with a phone to open your live site"
                >
                  <QrCode aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  Scan to view
                </summary>
                <div className="absolute right-0 top-full z-30 mt-2 w-48 rounded-2xl border border-ink/10 bg-white p-3 shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element -- dynamic same-origin PNG from our QR route */}
                  <img
                    src={`/api/website/qr${liveHref}`}
                    alt="QR code that opens your live website"
                    width={168}
                    height={168}
                    className="h-auto w-full rounded-lg"
                  />
                  <p className="mt-1.5 text-center text-[0.65rem] text-ink/55">
                    Point a phone camera here to open your site.
                  </p>
                </div>
              </details>
              <Link
                href={liveHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-ink/5"
              >
                View live
                <ArrowUpRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
            </>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ── LEFT RAIL ─────────────────────────────────────────────── */}
        <nav
          className={`w-full shrink-0 overflow-y-auto border-r border-ink/10 bg-cream px-3 py-4 lg:block lg:w-[390px] ${
            mobilePane === 'edit' ? 'block' : 'hidden'
          }`}
        >
          {goLiveSlot ? <div className="mb-5">{goLiveSlot}</div> : null}

          {groups.map((group) => (
            <section key={group.key} className="mb-6">
              <p className="flex items-baseline justify-between gap-2 px-1.5 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-terracotta">
                {group.title}
                {group.hint ? (
                  <span className="font-sans text-[0.7rem] normal-case tracking-normal text-ink/40">
                    {group.hint}
                  </span>
                ) : null}
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                {group.rows.map((row) => {
                  const isActive = activeRow === row.key;
                  const isOpen = openPanel === row.key;
                  const meta = (
                    <>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block text-[0.82rem] font-semibold text-ink">
                          {row.label}
                        </span>
                        {row.blurb ? (
                          <span className="block text-[0.7rem] text-ink/50">{row.blurb}</span>
                        ) : null}
                      </span>
                      {row.pro ? (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-amber-800">
                          {row.locked ? (
                            <Lock
                              aria-hidden
                              className="mr-0.5 inline h-2.5 w-2.5"
                              strokeWidth={2.5}
                            />
                          ) : null}
                          Pro
                        </span>
                      ) : row.status ? (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${
                            row.status === 'Not set' ||
                            row.status === 'Off' ||
                            row.status === 'Hidden'
                              ? 'bg-ink/5 text-ink/55'
                              : 'bg-success-100 text-success-800'
                          }`}
                        >
                          {row.status}
                        </span>
                      ) : null}
                    </>
                  );
                  const shellClass = `rounded-xl border bg-white transition-colors ${
                    isActive ? 'border-amber-400 ring-2 ring-amber-200' : 'border-ink/10'
                  }`;

                  // Rows WITH an inline panel expand in place (PR-3); rows
                  // without one still deep-link to the editor that owns them.
                  if (row.panel) {
                    return (
                      <div key={row.key} id={`rail-row-${row.key}`} className={shellClass}>
                        <button
                          type="button"
                          onMouseEnter={() => scrollPreviewTo(row.anchor)}
                          onClick={() => {
                            setActiveRow(row.key);
                            setOpenPanel(isOpen ? null : row.key);
                            scrollPreviewTo(row.anchor);
                          }}
                          aria-expanded={isOpen}
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 hover:bg-cream/40"
                        >
                          {meta}
                          <ChevronRight
                            aria-hidden
                            className={`h-3.5 w-3.5 shrink-0 text-ink/30 transition-transform ${
                              isOpen ? 'rotate-90' : ''
                            }`}
                            strokeWidth={2}
                          />
                        </button>
                        {isOpen ? row.panel : null}
                      </div>
                    );
                  }
                  return (
                    <Link
                      key={row.key}
                      id={`rail-row-${row.key}`}
                      href={row.href}
                      onMouseEnter={() => scrollPreviewTo(row.anchor)}
                      onFocus={() => scrollPreviewTo(row.anchor)}
                      onClick={() => {
                        setActiveRow(row.key);
                        scrollPreviewTo(row.anchor);
                      }}
                      className={`flex items-center gap-2.5 px-3 py-2.5 ${shellClass} hover:border-ink/25`}
                    >
                      {meta}
                      <ExternalLink
                        aria-hidden
                        className="h-3 w-3 shrink-0 text-ink/30"
                        strokeWidth={2}
                      />
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}

          {/* The umbrella unlock (PR-4) — shown only while the couple does NOT
              own Pro, so an owner's rail isn't nagged. One CTA for all seven. */}
          {showProCta ? (
            <div className="mt-2 rounded-2xl bg-ink px-4 py-3.5 text-cream">
              <p className="text-xs font-semibold text-cream">Event Hub PRO</p>
              <p className="mt-0.5 text-[0.7rem] leading-relaxed text-cream/70">
                Seven upgrades, one unlock — Cinematic Reveal · Save-the-Date video ·
                Photo gallery · Background music · Editorial editing · Background color ·
                Button color. Also removes the “Powered by Setnayan” mark.
              </p>
              <Link
                href={proUnlockHref}
                className="mt-2.5 inline-flex items-center rounded-full bg-amber-400 px-4 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-amber-300"
              >
                Unlock Event Hub PRO · ₱3,500
              </Link>
            </div>
          ) : null}
        </nav>

        {/* ── RIGHT PREVIEW ─────────────────────────────────────────── */}
        <main
          className={`min-w-0 flex-1 flex-col bg-cream-200/60 lg:flex ${
            mobilePane === 'preview' ? 'flex' : 'hidden'
          }`}
        >
          <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5">
            {PREVIEW_TABS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setTabKey(p.key)}
                title={p.caption}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  tabKey === p.key
                    ? 'border-ink bg-ink text-cream'
                    : 'border-ink/15 bg-white text-ink/60 hover:border-ink/30'
                }`}
              >
                {p.label}
              </button>
            ))}
            {publicLandingUrl ? (
              /* Pre-experience (owner 2026-07-25): open the CURRENT phase full-
                 screen in a new tab — the veil reveal, the film, the day-of page,
                 the After — exactly as a guest meets it, uncramped by the pane.
                 Carries `?as=` too, so "Experience" on the RSVP'd tab opens the
                 same simulated view rather than silently dropping back to the ask. */
              <Link
                href={`${publicLandingUrl}?phase=${tab.phase}${asQuery}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-cream transition-colors hover:bg-ink/90"
                title="Open this page full-screen, exactly as guests experience it"
              >
                <Play aria-hidden className="h-3 w-3" strokeWidth={2} />
                Experience
              </Link>
            ) : null}
            <span className="ml-auto hidden font-mono text-[0.6rem] uppercase tracking-[0.16em] text-ink/35 xl:inline">
              Tap a section to edit
            </span>
            <div
              role="group"
              aria-label="Preview device"
              className="ml-auto flex items-center gap-1 rounded-full border border-ink/15 bg-white p-0.5 xl:ml-2"
            >
              {DEVICES.map((d) => {
                const Icon = d.Icon;
                const on = device === d.key;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setDevice(d.key)}
                    aria-pressed={on}
                    title={`Preview as ${d.label.toLowerCase()}`}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-medium transition-colors ${
                      on ? 'bg-ink text-cream' : 'text-ink/55 hover:text-ink'
                    }`}
                  >
                    <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span className="hidden sm:inline">{d.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {/* Simulated-viewer caption. Only the RSVP'd tab has one, so the four
              plain phase tabs render exactly the chrome they always did. The
              owner ribbon on the page itself already says the host is previewing
              — this names WHICH preview, and never competes with it. */}
          {tab.caption ? (
            <p className="px-4 pb-1.5 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-terracotta">
              Preview · {tab.caption}
            </p>
          ) : null}
          <div className="flex min-h-0 flex-1 justify-center px-4 pb-4">
            {previewSrc ? (
              <iframe
                ref={frameRef}
                key={tabKey}
                src={previewSrc}
                title="Your Event Hub preview"
                className={`h-full w-full rounded-t-2xl border border-ink/10 bg-white shadow-lg transition-[max-width] duration-300 ${
                  device === 'mobile' ? 'max-w-[430px]' : 'max-w-none'
                }`}
              />
            ) : (
              <div
                className={`flex h-full w-full items-center justify-center rounded-t-2xl border border-dashed border-ink/20 bg-white/60 p-8 text-center ${
                  device === 'mobile' ? 'max-w-[430px]' : 'max-w-none'
                }`}
              >
                <p className="text-sm text-ink/55">
                  Set your Event Hub address to see a live preview here.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
