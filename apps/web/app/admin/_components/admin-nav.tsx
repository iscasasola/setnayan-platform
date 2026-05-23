'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Leaf = { kind: 'leaf'; href: string; label: string };
type Group = { kind: 'group'; label: string; items: { href: string; label: string }[] };
type Entry = Leaf | Group;

// URL-only admin routes (intentionally NOT in this nav — reached via parent list pages):
//   /admin/force-majeure/[flagId]            — opened from /admin/force-majeure row link
//   /admin/vendors/[vendorProfileId]/edit    — opened from /admin/vendors row link
//   /admin/venues/[id]                       — opened from /admin/venues row link
//   /admin/venues/new                        — opened from /admin/venues "New venue" CTA
// These are detail/create surfaces with no standalone entry point — listing them in nav
// would 404 (dynamic params) or duplicate the parent CTA (venues/new).
const NAV: Entry[] = [
  { kind: 'leaf', href: '/admin', label: 'Overview' },
  {
    kind: 'group',
    label: 'Queues',
    items: [
      { href: '/admin/verify', label: 'Verification' },
      { href: '/admin/payments', label: 'Payments' },
      // Disputes lives between Payments and Reviews on purpose — a dispute
      // typically opens against an order/payout (Payments adjacency) and may
      // resolve into a review override (Reviews adjacency). Keeps the queue
      // group reading as the "money + trust + recourse" cluster.
      { href: '/admin/disputes', label: 'Disputes' },
      { href: '/admin/reviews', label: 'Reviews' },
      { href: '/admin/help', label: 'Help inbox' },
      { href: '/admin/force-majeure', label: 'Force majeure' },
      { href: '/admin/concierge-abuse', label: 'Concierge abuse' },
    ],
  },
  {
    kind: 'group',
    label: 'Directory',
    items: [
      { href: '/admin/users', label: 'Users' },
      { href: '/admin/events', label: 'Events' },
      { href: '/admin/vendors', label: 'Vendors' },
      { href: '/admin/venues', label: 'Venues' },
      { href: '/admin/demo-vendors', label: 'Demo vendors' },
    ],
  },
  {
    kind: 'group',
    label: 'Money',
    items: [
      { href: '/admin/payouts', label: 'Payouts' },
      // /admin/pricing — read-only catalog view of `service_catalog`.
      // Placed between Payouts and Receipts per iteration 0023 § 3.5 spec.
      { href: '/admin/pricing', label: 'Pricing' },
      { href: '/admin/receipts', label: 'Receipts' },
      { href: '/admin/bir/2307', label: 'BIR 2307' },
      { href: '/admin/ads', label: 'Ads' },
      { href: '/admin/settings/payment-methods', label: 'Payment methods' },
    ],
  },
  {
    kind: 'group',
    label: 'Content',
    items: [
      { href: '/admin/taxonomy', label: 'Taxonomy' },
      // 2026-05-23 — Add-on Management (iteration 0023 § 3.12 · CLAUDE.md
      // 2026-05-17 row 5 lock). Lives in Content because admins curate
      // which SKUs surface to which audience — closer to content management
      // than to Money or Settings. Read-only V1.
      { href: '/admin/addons', label: 'Add-ons' },
      { href: '/admin/website', label: 'Website' },
      // Concierge brain sits in Content (not Queues / not Money) because
      // it's curated knowledge feeding the Concierge LLM — closer to
      // taxonomy/website/moodboard than to operational queues. Order
      // chosen so /admin/brain sits between Website + Moodboard library
      // per the 2026-05-23 admin-surface alignment brief.
      { href: '/admin/brain', label: 'Concierge brain' },
      { href: '/admin/moodboard-library', label: 'Moodboard library' },
    ],
  },
  {
    kind: 'group',
    label: 'Operations',
    items: [
      { href: '/admin/operations-hiring', label: 'Hiring & Growth' },
    ],
  },
  { kind: 'leaf', href: '/admin/funnels', label: 'Funnels' },
  {
    kind: 'group',
    label: 'Settings',
    items: [
      { href: '/admin/settings', label: 'Platform settings' },
      // Payment methods is also reachable from the Money group above —
      // surfaced here too because it's a Settings surface conceptually.
      { href: '/admin/settings/payment-methods', label: 'Payment methods' },
      { href: '/admin/settings/demo-mode', label: 'Demo mode' },
    ],
  },
];

function isActiveHref(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(href + '/');
}

export function AdminNav() {
  const pathname = usePathname() ?? '/admin';
  const [open, setOpen] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // The nav strip uses `overflow-x-auto` to stay one row on narrow
  // viewports. That creates a clipping context for any absolutely-
  // positioned descendant — which used to swallow the GroupChip
  // dropdowns whole and made them look broken. The portalRef points
  // to whichever menu is currently rendered into document.body so
  // the click-outside listener still recognises clicks inside it as
  // "inside the nav" (and doesn't close mid-navigation).
  const portalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (portalRef.current?.contains(target)) return;
      setOpen(null);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(null);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  useEffect(() => {
    setOpen(null);
  }, [pathname]);

  return (
    <div
      ref={rootRef}
      className="mx-auto flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl flex-nowrap gap-1 overflow-x-auto px-4 pb-2 text-sm whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:px-6 lg:px-8"
    >
      {NAV.map((entry) =>
        entry.kind === 'leaf' ? (
          <Chip
            key={entry.href}
            href={entry.href}
            label={entry.label}
            active={isActiveHref(pathname, entry.href)}
          />
        ) : (
          <GroupChip
            key={entry.label}
            label={entry.label}
            items={entry.items}
            pathname={pathname}
            isOpen={open === entry.label}
            onToggle={() =>
              setOpen((cur) => (cur === entry.label ? null : entry.label))
            }
            portalRef={portalRef}
          />
        ),
      )}
    </div>
  );
}

function Chip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={
        active
          ? 'shrink-0 rounded-full bg-ink px-3 py-1 text-cream'
          : 'shrink-0 rounded-full bg-ink/5 px-3 py-1 text-ink/70 hover:bg-ink/10 hover:text-ink'
      }
    >
      {label}
    </Link>
  );
}

function GroupChip({
  label,
  items,
  pathname,
  isOpen,
  onToggle,
  portalRef,
}: {
  label: string;
  items: { href: string; label: string }[];
  pathname: string;
  isOpen: boolean;
  onToggle: () => void;
  portalRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  const active = items.some((i) => isActiveHref(pathname, i.href));
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [mounted, setMounted] = useState(false);

  // createPortal needs `document.body`, which is undefined during SSR.
  // Defer the portal render to the first client-side effect.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute the menu position from the button's bounding rect. Run
  // before paint (useLayoutEffect) so the menu never flashes at the
  // origin before its `style` settles.
  useLayoutEffect(() => {
    if (!isOpen) {
      setCoords(null);
      return;
    }
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setCoords({ top: rect.bottom + 4, left: rect.left });
  }, [isOpen]);

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={
          (active
            ? 'bg-ink text-cream'
            : 'bg-ink/5 text-ink/70 hover:bg-ink/10 hover:text-ink') +
          ' inline-flex items-center gap-1 rounded-full px-3 py-1'
        }
      >
        {label}
        <svg
          aria-hidden
          width="10"
          height="10"
          viewBox="0 0 10 10"
          className={isOpen ? 'rotate-180 transition' : 'transition'}
        >
          <path
            d="M2 4l3 3 3-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {isOpen && coords && mounted
        ? createPortal(
            <div
              ref={portalRef}
              role="menu"
              style={{
                position: 'fixed',
                top: coords.top,
                left: coords.left,
              }}
              className="z-50 min-w-[12rem] overflow-hidden rounded-xl border border-ink/10 bg-cream shadow-lg"
            >
              {items.map((item) => {
                const itemActive = isActiveHref(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    aria-current={itemActive ? 'page' : undefined}
                    className={
                      itemActive
                        ? 'block bg-ink/10 px-3 py-2 text-sm text-ink'
                        : 'block px-3 py-2 text-sm text-ink/75 hover:bg-ink/5 hover:text-ink'
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
