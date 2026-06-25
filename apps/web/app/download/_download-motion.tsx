'use client';

/**
 * Client motion island for /download — the page stays a Server Component (ISR);
 * all data (DESKTOP_RELEASE, nav label) is fetched server-side and passed in as
 * props. This island owns the only motion and adds NOTHING load-bearing to the IA:
 * the wrappers render server-passed children verbatim, and the AppWindowHero is a
 * purely decorative illustration (aria-hidden) — every real fact (download link,
 * version, size, notarization) lives in accessible text in the server component.
 *
 * Signature (the page's ONE moment): a floating macOS app window "opens" on entry
 * — it scales up + lifts from rest while a calm in-palette Setnayan dashboard sits
 * inside, and the Setnayan icon in the Dock beneath does the classic macOS launch
 * bounce. That literally illustrates the page's promise: "its own window, with its
 * own dock icon." Everything else on the page is a quiet Reveal. a11y: the whole
 * illustration is aria-hidden; prefers-reduced-motion rests it in its final state;
 * useGSAP cleanup, SSR-safe under Next 15 / React 19.
 */

import { Compass, Download, Home, Sparkles, Users, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Logo } from '@/app/_components/logo';
import { useReveal, useLineReveal, useMagnetic } from '@/app/_components/marketing/_premium';

/** Quiet staggered rise of [data-reveal-item] children. */
export function RevealGroup({
  children,
  className,
  stagger = 0.08,
  y = 16,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  y?: number;
}) {
  const ref = useReveal({ stagger, y });
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className={className}>
      {children}
    </div>
  );
}

/** Serif line-reveal on the hero <h1> (above the fold → fires on mount). */
export function LineRevealH1({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useLineReveal({ trigger: 'mount' });
  return (
    <h1 ref={ref as React.RefObject<HTMLHeadingElement>} className={className}>
      {children}
    </h1>
  );
}

/**
 * MagneticDownloadButton — the primary CTA with a desktop-only magnetic pull
 * (the existing premium touch from the retired ProvisionCard). SSR-renders a
 * plain `<a href>` so the download works with no JS; magnetic no-ops on touch /
 * reduced-motion and never intercepts the click.
 */
export function MagneticDownloadButton({
  label,
  sizeLabel,
}: {
  label: string;
  sizeLabel: string;
}) {
  const ref = useMagnetic();
  return (
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a
      ref={ref as React.RefObject<HTMLAnchorElement>}
      href="/api/download/mac"
      className="button-primary inline-flex items-center gap-2"
    >
      <Download aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      {label}
      <span className="text-cream/55">· {sizeLabel}</span>
    </a>
  );
}

/**
 * useWindowIntro — the page's single orchestrated moment. On mount (above the
 * fold) the window opens, the inner rows settle, the Dock fades up, and the
 * Setnayan dock icon does one launch bounce. Reduced-motion rests everything in
 * its final state; useGSAP runs in a layout effect so the hidden start state is
 * set before paint (no flash). transform/opacity only.
 */
function useWindowIntro() {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const win = root.querySelector<HTMLElement>('[data-window]');
      const dock = root.querySelector<HTMLElement>('[data-dock]');
      const dockIcon = root.querySelector<HTMLElement>('[data-dock-icon]');
      const items = gsap.utils.toArray<HTMLElement>('[data-window-item]', root);
      if (!win) return;

      gsap.set(win, { opacity: 0, scale: 0.965, y: 16, transformOrigin: '50% 80%' });
      if (items.length) gsap.set(items, { opacity: 0, y: 8 });
      if (dock) gsap.set(dock, { opacity: 0, y: 12 });

      const tl = gsap.timeline({ delay: 0.18 });
      tl.to(win, { opacity: 1, scale: 1, y: 0, duration: 0.9, ease: 'power3.out' });
      if (items.length) {
        tl.to(
          items,
          { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.06, clearProps: 'transform' },
          '-=0.52',
        );
      }
      if (dock) tl.to(dock, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, '-=0.34');
      if (dockIcon) {
        tl.to(dockIcon, { y: -11, duration: 0.26, ease: 'power2.out' }, '-=0.05').to(dockIcon, {
          y: 0,
          duration: 0.6,
          ease: 'bounce.out',
        });
      }
    },
    { scope },
  );

  return scope;
}

/* ── Dashboard mock + Dock ───────────────────────────────────────────────────
   The window frames a high-fidelity ILLUSTRATION of the couple dashboard — the
   real nav (Home · Guests · Explore · Studio · Budget), countdown, a "today's
   focus" card, the real overview stats and an upcoming-schedule list. It is NOT
   a live embed: the dashboard is auth-gated, so it can't be shown live to a
   logged-out visitor (owner-chosen "polished mock" 2026-06-26). Faithful to the
   real surface, on the locked --m-* palette, never goes stale, fully responsive.
   Entirely aria-hidden — every real fact lives in the accessible server hero. */

const NAV: Array<{ icon: typeof Home; label: string; active?: boolean }> = [
  { icon: Home, label: 'Home', active: true },
  { icon: Users, label: 'Guests' },
  { icon: Compass, label: 'Explore' },
  { icon: Sparkles, label: 'Studio' },
  { icon: Wallet, label: 'Budget' },
];

function NavItem({ icon: Icon, label, active }: (typeof NAV)[number]) {
  return (
    <div
      data-window-item
      className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 ${active ? 'bg-terracotta/12' : ''}`}
    >
      <Icon
        aria-hidden
        className={`h-3 w-3 ${active ? 'text-terracotta-700' : 'text-ink/40'}`}
        strokeWidth={1.75}
      />
      <span className={`text-[8px] font-medium ${active ? 'text-ink' : 'text-ink/55'}`}>{label}</span>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div data-window-item className="rounded-md border border-ink/8 bg-cream px-1.5 py-1.5 text-center">
      <p className="font-serif text-[13px] font-semibold leading-none text-ink">{value}</p>
      <p className="mt-1 font-mono text-[6px] uppercase tracking-[0.1em] text-ink/45">{label}</p>
    </div>
  );
}

function UpcomingRow({ title, when }: { title: string; when: string }) {
  return (
    <div data-window-item className="flex items-center justify-between rounded-md bg-ink/[0.02] px-2 py-1">
      <span className="flex items-center gap-1.5">
        <span className="h-1 w-1 rounded-full bg-terracotta" aria-hidden />
        <span className="text-[8px] text-ink/70">{title}</span>
      </span>
      <span className="font-mono text-[6.5px] uppercase tracking-[0.1em] text-ink/40">{when}</span>
    </div>
  );
}

function DockApp({ tone }: { tone: string }) {
  return <span className={`h-7 w-7 rounded-[8px] ${tone}`} aria-hidden />;
}

/**
 * AppWindowHero — the floating macOS app window + Dock. The window frames a
 * high-fidelity illustration of the couple dashboard (real nav, countdown,
 * today's focus, overview stats, upcoming schedule); the Setnayan icon "runs"
 * in the Dock below. Entirely aria-hidden — the accessible download affordance
 * + every spec live in the server hero.
 */
export function AppWindowHero() {
  const scope = useWindowIntro();

  return (
    <div ref={scope} aria-hidden className="relative mx-auto w-full max-w-[480px] select-none">
      {/* champagne glow */}
      <div
        className="pointer-events-none absolute -inset-10 -z-10"
        style={{
          background: 'radial-gradient(60% 55% at 50% 38%, rgba(197,160,89,0.18), transparent 70%)',
        }}
      />

      {/* the window */}
      <div
        data-window
        className="overflow-hidden rounded-2xl border border-ink/10 bg-[#FCFBF8] shadow-[0_44px_120px_-50px_rgba(30,34,41,0.5)]"
      >
        {/* titlebar */}
        <div className="flex items-center gap-2 border-b border-ink/8 bg-ink/[0.025] px-4 py-2.5">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#e9695a]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#e3b341]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#7fb069]" />
          </span>
          <span className="mx-auto flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-ink/40">
            <Logo height={11} />
            Setnayan
          </span>
          <span className="w-[42px]" />
        </div>

        {/* body: the couple dashboard — sidebar nav + overview */}
        <div className="flex">
          {/* sidebar */}
          <aside className="w-[33%] border-r border-ink/8 bg-ink/[0.02] px-2 py-2.5">
            <div data-window-item className="mb-2 px-1">
              <Logo height={13} />
            </div>
            <div className="space-y-0.5">
              {NAV.map((item) => (
                <NavItem key={item.label} {...item} />
              ))}
            </div>
          </aside>

          {/* main: overview */}
          <div className="flex-1 px-3.5 py-3">
            <div data-window-item className="flex items-start justify-between">
              <div>
                <p className="font-serif text-[14px] font-semibold leading-tight text-ink">
                  Maria &amp; Jose
                </p>
                <p className="mt-0.5 font-mono text-[7px] uppercase tracking-[0.16em] text-ink/40">
                  December 12, 2026
                </p>
              </div>
              <span className="rounded-full bg-terracotta/12 px-2 py-0.5 font-mono text-[7px] uppercase tracking-[0.12em] text-terracotta-700">
                284 days to go
              </span>
            </div>

            <div
              data-window-item
              className="mt-2.5 rounded-lg border border-ink/8 bg-gradient-to-br from-terracotta/10 to-transparent px-3 py-2"
            >
              <p className="font-mono text-[6.5px] uppercase tracking-[0.16em] text-terracotta-700">
                Today&rsquo;s focus
              </p>
              <p className="mt-0.5 font-serif text-[11px] text-ink">Send your save-the-date</p>
            </div>

            <div className="mt-2.5 grid grid-cols-3 gap-1.5">
              <StatCard value="168" label="Guests" />
              <StatCard value="124" label="RSVP'd" />
              <StatCard value="₱420k" label="Budget" />
            </div>

            <p
              data-window-item
              className="mt-2.5 font-mono text-[7px] uppercase tracking-[0.16em] text-ink/40"
            >
              Upcoming
            </p>
            <div className="mt-1 space-y-1">
              <UpcomingRow title="Venue walkthrough" when="Sat" />
              <UpcomingRow title="Cake tasting" when="Mar 14" />
            </div>
          </div>
        </div>
      </div>

      {/* the Dock */}
      <div
        data-dock
        className="mx-auto mt-5 flex w-fit items-end gap-2.5 rounded-2xl border border-ink/10 bg-[#FCFBF8]/80 px-3 py-2 shadow-[0_18px_40px_-24px_rgba(30,34,41,0.4)] backdrop-blur-sm"
      >
        <DockApp tone="bg-gradient-to-b from-ink/15 to-ink/25" />
        <DockApp tone="bg-gradient-to-b from-terracotta/30 to-terracotta/45" />
        {/* the Setnayan app — running, and the one that bounces */}
        <span className="relative flex flex-col items-center">
          <span
            data-dock-icon
            className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-gradient-to-b from-[#2a2f38] to-ink shadow-[0_6px_16px_-4px_rgba(30,34,41,0.65),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-white/5"
          >
            <Logo height={22} />
          </span>
          <span className="mt-1 h-1 w-1 rounded-full bg-ink/50" />
        </span>
        <DockApp tone="bg-gradient-to-b from-ink/10 to-ink/20" />
        <DockApp tone="bg-gradient-to-b from-mulberry/20 to-mulberry/35" />
      </div>
    </div>
  );
}
