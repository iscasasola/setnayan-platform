'use client';

/**
 * SettingsShell — shows ONE group of "Profile & settings" at a time.
 *
 * Owner-approved prototype (2026-09-21): desktop gets a left rail of the six
 * groups with the chosen group on the right; a phone gets a list of the groups
 * and opens one at a time behind a "‹ Settings" back link.
 *
 * 🔑 EVERY GROUP IS ALREADY IN THE DOM. The page renders all six on the server
 * and hands them in as `panes`; this component only decides which one is not
 * `hidden`. So every form and server action works exactly as it did on the
 * long page, and every old anchor (`#url-slug`, `#privacy`, `#settings`,
 * `#slug`) still exists — it now also OPENS the group that holds it.
 *
 * Which group is open (see lib/profile-settings-groups.ts):
 *   `?tab=` → the group holding `#hash` → a flash param → the default.
 * The server resolves the first and last of those into `initialGroup`; the
 * hash is only visible here, so it is applied on mount, and only when the URL
 * carried no `?tab=`.
 *
 * Switching groups rewrites the URL with history.replaceState — no server
 * round trip — and drops the flash params, so a refresh does not replay an
 * old "Saved." banner.
 */

import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  IdCard,
  LockKeyhole,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Utensils,
} from 'lucide-react';
import {
  isSettingsGroup,
  SETTINGS_GROUPS,
  SETTINGS_GROUP_META,
  type SettingsGroup,
} from '@/lib/profile-settings-groups';

const ICONS: Record<SettingsGroup, typeof UserRound> = {
  profile: UserRound,
  'guest-details': Utensils,
  privacy: ShieldCheck,
  security: LockKeyhole,
  preferences: SlidersHorizontal,
  account: IdCard,
};

/** The five groups above the divider; Account sits quietly below it. */
const MAIN_GROUPS = SETTINGS_GROUPS.filter((g) => g !== 'account');

/** The group whose pane holds the element named by the URL hash, if any. */
function groupFromHash(): { group: SettingsGroup; targetId: string } | null {
  const raw = window.location.hash.slice(1);
  if (!raw) return null;
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    /* keep the raw hash */
  }
  const el = document.getElementById(id);
  const group = el?.closest('[data-settings-group]')?.getAttribute('data-settings-group');
  return isSettingsGroup(group) ? { group, targetId: id } : null;
}

export function SettingsShell({
  initialGroup,
  fromTab,
  panes,
  flash,
  identity,
  accountId,
  indexExtras,
  showDeleteRow,
}: {
  /** `?tab=` or the flash-param group, resolved on the server; null = default. */
  initialGroup: SettingsGroup | null;
  /** True when `initialGroup` came from `?tab=` — then the hash does not override it. */
  fromTab: boolean;
  panes: Record<SettingsGroup, ReactNode>;
  /** Success / error banners from the URL — shown until the person switches group. */
  flash: ReactNode;
  /** What the identity card at the top of the phone's group list shows. */
  identity: {
    displayName: string | null;
    tag: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    initials: string;
  };
  accountId: string | null;
  /** Quiet rows under "Account" on the phone list (Help, Setnayan AI, …). */
  indexExtras: ReactNode;
  showDeleteRow: boolean;
}) {
  // null = nothing chosen: Profile on desktop, the group list on a phone.
  const [active, setActive] = useState<SettingsGroup | null>(initialGroup);
  const [showFlash, setShowFlash] = useState(true);
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);

  const writeUrl = useCallback((group: SettingsGroup | null, hash?: string) => {
    const url = `${window.location.pathname}${group ? `?tab=${group}` : ''}${hash ? `#${hash}` : ''}`;
    window.history.replaceState(null, '', url);
  }, []);

  // Step 2 of the resolution order, on arrival — and on any in-page anchor
  // click afterwards (the @tag's "change" link jumps to the handle in Privacy).
  useEffect(() => {
    if (!fromTab) {
      const hit = groupFromHash();
      if (hit) {
        setActive(hit.group);
        setScrollTarget(hit.targetId);
      }
    }
    const onHashChange = () => {
      const hit = groupFromHash();
      if (!hit) return;
      setActive(hit.group);
      setShowFlash(false);
      setScrollTarget(hit.targetId);
      writeUrl(hit.group, hit.targetId);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [fromTab, writeUrl]);

  // The browser tried to scroll to the anchor while its group was hidden, so
  // scroll again once the group is showing.
  useEffect(() => {
    if (!scrollTarget) return;
    document.getElementById(scrollTarget)?.scrollIntoView({ block: 'start' });
    setScrollTarget(null);
  }, [scrollTarget, active]);

  const go = (group: SettingsGroup | null) => {
    setActive(group);
    setShowFlash(false);
    writeUrl(group);
    window.scrollTo({ top: 0 });
  };

  const shown: SettingsGroup = active ?? 'profile';

  const railLink = (id: SettingsGroup) => {
    const Icon = ICONS[id];
    const current = shown === id;
    return (
      <a
        key={id}
        href={`?tab=${id}`}
        aria-current={current ? 'page' : undefined}
        onClick={(e) => {
          e.preventDefault();
          go(id);
        }}
        className={`flex h-11 items-center gap-3 rounded-md px-3.5 text-[15px] transition-colors ${
          current
            ? 'bg-terracotta/10 font-semibold text-terracotta-700'
            : 'font-medium text-ink hover:bg-ink/5'
        }`}
      >
        <Icon aria-hidden className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
        <span>{SETTINGS_GROUP_META[id].label}</span>
      </a>
    );
  };

  const indexRow = (id: SettingsGroup) => {
    const Icon = ICONS[id];
    return (
      <a
        key={id}
        href={`?tab=${id}`}
        onClick={(e) => {
          e.preventDefault();
          go(id);
        }}
        className="flex items-center gap-3 px-4 py-3.5 text-ink"
      >
        <Icon aria-hidden className="h-5 w-5 shrink-0 text-terracotta-700" strokeWidth={1.8} />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">{SETTINGS_GROUP_META[id].label}</span>
          <span className="block truncate text-xs text-ink/60">{SETTINGS_GROUP_META[id].hint}</span>
        </span>
        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={1.8} />
      </a>
    );
  };

  return (
    <div className="md:grid md:grid-cols-[13.5rem_minmax(0,1fr)] md:gap-10">
      {/* ── Desktop rail ───────────────────────────────────────────────── */}
      <nav
        aria-label="Settings sections"
        className="hidden md:sticky md:top-24 md:flex md:flex-col md:gap-1 md:self-start"
      >
        <p className="mx-3.5 mb-4 mt-1 font-display text-3xl font-semibold leading-none text-ink">
          Settings
        </p>
        {MAIN_GROUPS.map(railLink)}
        <div aria-hidden className="mx-3.5 my-3 h-px bg-ink/10" />
        {railLink('account')}
        {accountId ? (
          <p className="mx-3.5 mt-4 font-mono text-xs text-ink/60">{accountId}</p>
        ) : null}
      </nav>

      <div className="min-w-0">
        {showFlash ? flash : null}

        {/* ── Phone: the list of groups (only when none is chosen) ─────── */}
        <div hidden={active !== null} className={active === null ? 'space-y-5 md:hidden' : undefined}>
          <a
            href="?tab=profile"
            aria-label={`Profile: ${identity.displayName ?? 'add your name'}`}
            onClick={(e) => {
              e.preventDefault();
              go('profile');
            }}
            className="sn-tile flex items-center gap-4 text-ink"
          >
            {identity.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={identity.avatarUrl}
                alt=""
                className="h-14 w-14 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-terracotta/10 font-display text-xl font-semibold text-terracotta-700"
              >
                {identity.initials}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-2xl font-semibold leading-tight">
                {identity.displayName ?? 'Add your name'}
              </span>
              {identity.tag || identity.fullName ? (
                <span className="mt-0.5 block truncate text-xs text-ink/70">
                  {identity.tag ? (
                    <span className="font-semibold text-terracotta-700">{identity.tag}</span>
                  ) : null}
                  {identity.tag && identity.fullName ? ' · ' : null}
                  {identity.fullName}
                </span>
              ) : null}
            </span>
            <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={1.8} />
          </a>
          <nav aria-label="Settings sections" className="sn-row divide-y divide-ink/10 overflow-hidden">
            {MAIN_GROUPS.map(indexRow)}
          </nav>
          <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink/60">Account</p>
          <nav aria-label="Account" className="sn-row divide-y divide-ink/10 overflow-hidden text-sm">
            <a
              href="?tab=account"
              onClick={(e) => {
                e.preventDefault();
                go('account');
              }}
              className="flex items-center justify-between gap-3 px-4 py-3 text-ink"
            >
              <span className="font-medium">Account</span>
              <span className="flex items-center gap-2 font-mono text-xs text-ink/60">
                {accountId}
                <ChevronRight aria-hidden className="h-4 w-4 text-ink/40" strokeWidth={1.8} />
              </span>
            </a>
            {indexExtras}
            {showDeleteRow ? (
              <a
                href="?tab=account"
                onClick={(e) => {
                  e.preventDefault();
                  go('account');
                }}
                className="flex items-center justify-between gap-3 px-4 py-3 text-danger-800"
              >
                <span className="font-medium">Delete account</span>
                <ChevronRight aria-hidden className="h-4 w-4 text-ink/40" strokeWidth={1.8} />
              </a>
            ) : null}
          </nav>
        </div>

        {/* ── Phone: back to the list ──────────────────────────────────── */}
        {active !== null ? (
          <Link
            href="/dashboard/profile"
            onClick={(e) => {
              e.preventDefault();
              go(null);
            }}
            className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-terracotta-700 md:hidden"
          >
            <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
            Settings
          </Link>
        ) : null}

        {/* ── The six groups — all rendered, one shown ─────────────────── */}
        {SETTINGS_GROUPS.map((id) => {
          const isShown = shown === id;
          return (
            <section
              key={id}
              id={`group-${id}`}
              data-settings-group={id}
              aria-label={SETTINGS_GROUP_META[id].label}
              hidden={!isShown}
              // Nothing chosen: Profile shows on desktop, the list on a phone.
              className={isShown && active === null ? 'hidden md:block' : undefined}
            >
              {panes[id]}
            </section>
          );
        })}
      </div>
    </div>
  );
}
