'use client';

/**
 * admin-tab-rows.tsx — the two rows every admin page wears under the five tabs.
 *
 * Owner, 13 Nov 2026: *"admin has been ok'ed"* (`Setnayan-specs/prototypes/admin_pub/`, BUILDER-NOTES T2 · T6).
 *
 *  · T2 — THE PINNED ROW, at the top: `Page · View ▾` (the one selector — every view of this tab, its count on the
 *    right) and the tab's ⚙ at the right end, which opens that tab's settings. Drawn by the app's ONE pinned row
 *    (`PinnedRow`), its ONE picker (`PickMenu`) and the ONE ⚙ (`MenuSettingsButton menu="admin"`) — never a copy.
 *  · T6 — THE THUMB ROW, at the phone's foot: the glass search naming what this tab looks through (it opens the
 *    console's existing search — the same panel as ⌘K), and ONE ＋ beside it only where this tab creates something.
 *    Drawn by the app's ONE thumb row (`ThumbRow` in `ThumbDock`). Phone and tablet only: from 1024 the top bar
 *    already carries the same search box.
 *
 * Where a page lives comes from `lib/admin/admin-tabs.ts` and nowhere else.
 *
 * ⚖ HONEST STATES (T28/T29). The row's note says what the view's queue holds, in words, and never a 0 over a failed
 * read: a count → "3 waiting"; zero → "Nothing waiting"; a refused read → "Couldn't count — not the same as none";
 * a view with no queue says nothing at all.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';

import { PinnedRow } from '@/app/_components/pinned-row/pinned-row';
import { MenuSettingsButton } from '@/app/_components/menu-settings-button';
import { ThumbRow } from '@/components/thumb-row';
import { ThumbDock } from '@/components/thumb-dock';
import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { AdminQueueCounts } from '@/lib/admin/queue-counts';
import { formatCount } from '@/lib/format-number';
import {
  ADMIN_AVATAR_ROWS,
  adminPlaceFor,
  type AdminPlace,
  type AdminTab,
  type AdminView,
} from '@/lib/admin/admin-tabs';

import { ADMIN_SEARCH_OPEN_EVENT } from './admin-search-open-event';
import { useAdminAddress } from './admin-address';
import css from './admin-tab-rows.module.css';

/** A read that failed is never a 0. */
export const COUNT_REFUSED = 'Couldn’t count — not the same as none';

/** What a view's queue holds, in words — or nothing, when the view counts nothing. */
export function viewNote(view: AdminView, counts: AdminQueueCounts | undefined): string | null {
  if (!view.queue) return null;
  if (!counts || !(view.queue in counts)) return COUNT_REFUSED;
  const n = counts[view.queue];
  if (n === null || n === undefined) return COUNT_REFUSED;
  return n > 0 ? `${formatCount(n)} waiting` : 'Nothing waiting';
}

/** The count beside a view in the open list. Unread = "—", never a 0. */
function viewTrail(view: AdminView, counts: AdminQueueCounts | undefined): PickOption['trail'] {
  if (!view.queue) return undefined;
  const n = counts?.[view.queue];
  if (n === null || n === undefined) return { text: '—', tone: 'muted', label: COUNT_REFUSED };
  if (n === 0) return undefined;
  return { text: formatCount(n), tone: 'left', label: `${formatCount(n)} waiting` };
}

function useAdminPlace(at?: string): AdminPlace | null {
  const { pathname, params } = useAdminAddress(at);
  return adminPlaceFor(pathname, params);
}

export function AdminPinnedRow({
  queueCounts,
  at,
  focus = false,
}: {
  queueCounts?: AdminQueueCounts;
  /** Lab only. */ at?: string;
  /** ➕ Focus mode (owner 14 Nov 2026): `/admin` is the Focus list, which has its own head — no "Work · All ▾" over it. */
  focus?: boolean;
}) {
  const place = useAdminPlace(at);
  const { pathname } = useAdminAddress(at);
  const router = useRouter();
  const [gearOpen, setGearOpen] = useState(false);
  if (!place) return null;
  if (focus && pathname === '/admin') return null;

  if (place.kind === 'avatar') {
    // Admin-of-admin: the same row, listing the avatar's pages that exist today.
    const rows = ADMIN_AVATAR_ROWS.filter((r) => r.href);
    return (
      <div className={css.stick} data-admin-pin="avatar">
        <PinnedRow
          picker={{
            label: 'Admin settings page',
            value: place.row.key,
            buttonText: `Admin · ${place.row.label}`,
            options: rows.map((r) => ({ key: r.key, label: r.label })),
            onPick: (key) => {
              const row = rows.find((r) => r.key === key);
              if (row?.href) router.push(row.href);
            },
          }}
          doors={[]}
          gear={null}
          data={{ 'data-admin-pinned-row': 'avatar' }}
        />
      </div>
    );
  }

  const { tab, view, isSetting } = place;
  return (
    <div className={css.stick} data-admin-pin={tab.key}>
      <PinnedRow
        picker={{
          label: `${tab.label} view`,
          value: isSetting ? '' : view.key,
          buttonText: isSetting ? `${tab.label} · ⚙ ${view.label}` : `${tab.label} · ${view.label}`,
          options: tab.views.map((v) => ({ key: v.key, label: v.label, group: v.group, trail: viewTrail(v, queueCounts) })),
          onPick: (key) => {
            const v = tab.views.find((x) => x.key === key);
            if (v) router.push(v.href);
          },
        }}
        doors={[]}
        note={isSetting ? null : viewNote(view, queueCounts)}
        gear={
          tab.settings.length > 0 ? (
            <MenuSettingsButton
              menu="admin"
              open={gearOpen}
              onOpenChange={setGearOpen}
              line={{
                line: `${tab.label}: ${tab.settings.map((s) => s.label).join(' · ')}.`,
                tip: `The settings behind ${tab.label}. Each opens its own page; nothing changes until you save it there.`,
              }}
            >
              <TabSettingsRows tab={tab} current={isSetting ? view.key : null} onGo={() => setGearOpen(false)} />
            </MenuSettingsButton>
          ) : null
        }
        data={{ 'data-admin-pinned-row': tab.key }}
      />
    </div>
  );
}

function TabSettingsRows({ tab, current, onGo }: { tab: AdminTab; current: string | null; onGo: () => void }) {
  return (
    <nav aria-label={`${tab.label} settings`} className="px-2 pb-4 pt-2">
      {tab.settings.map((s) => (
        <Link
          key={s.key}
          href={s.href}
          onClick={onGo}
          data-admin-setting={s.key}
          aria-current={current === s.key ? 'page' : undefined}
          className={css.settingRow}
        >
          <span className="min-w-0 flex-1 truncate">{s.label}</span>
          <span aria-hidden className={css.chev}>
            ›
          </span>
        </Link>
      ))}
    </nav>
  );
}

export function AdminThumbRow({ at }: { /** Lab only. */ at?: string } = {}) {
  const place = useAdminPlace(at);
  if (!place || place.kind !== 'tab') return null;
  const { tab } = place;
  return (
    // From 1024 the top bar's own search box is the search; the dock would draw a second one in the page.
    <div className="lg:hidden" data-admin-thumb={tab.key}>
      <ThumbDock>
        <ThumbRow
          name={`admin-${tab.key}`}
          field={{
            node: (
              /* It LOOKS like the field and IS a button: the console's search is one panel (⌘K on a computer), and
                 a real input here would be a second box whose first keystroke lands somewhere about to vanish. */
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent(ADMIN_SEARCH_OPEN_EVENT))}
                className={css.field}
                aria-label={tab.searchPlaceholder}
                data-admin-search={tab.key}
              >
                <Search aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.9} />
                <span className="min-w-0 flex-1 truncate text-left">{tab.searchPlaceholder}</span>
              </button>
            ),
          }}
          action={tab.create ? { icon: Plus, label: tab.create.label, href: tab.create.href } : null}
        />
      </ThumbDock>
    </div>
  );
}
