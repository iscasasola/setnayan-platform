'use client';

/**
 * settings-rail-context.tsx — "Profile & settings"' six groups as RAIL ROWS, from 701.
 *
 * Owner-approved plan D5 ("Account/launcher onto the 701 line", 2026-11-13): the settings page's own `md:` sidebar
 * becomes rows of the shell's rail, and the page becomes one reading column. Nothing here is a new destination —
 * every row is a group `SettingsShell` already renders (all six are in the DOM; the shell only un-hides one), with the
 * same words and the same glyphs (`SETTINGS_GROUP_META` · `SETTINGS_GROUP_ICONS`).
 *
 * 🔑 WHY A SEPARATE GROUP, NOT A BRANCH OF `AccountRailContext`. That component is the menu of the FOCUSED pages
 * (Memories, People) and `rail-focus.test.ts` holds its prefixes equal to `ACCOUNT_FOCUS_PATHS`. Settings does not
 * focus — the person's own rows stay above it, the shell's "without `focus`" case — so it is its own group.
 *
 * 🔑 ONE ANSWER FOR WHICH GROUP IS OPEN. The shell owns it (`?tab=` · the hash · a flash param · the default). A row
 * does not navigate: it asks the shell to open its group (`SETTINGS_GO_EVENT`) and the shell answers with what it
 * shows (`SETTINGS_SHOWN_EVENT`) — so the lit row and the open group cannot disagree, and no server round trip is
 * added. Before hydration the row is a plain `?tab=` link, which the server already resolves.
 *
 * 📱 BELOW 701 NOTHING CHANGES: the group is `hidden` there, so the phone's drawer is pixel for pixel what it was and
 * the phone keeps its own list of groups on the page.
 */

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  SETTINGS_GROUPS,
  SETTINGS_GROUP_META,
  isSettingsGroup,
  type SettingsGroup,
} from '@/lib/profile-settings-groups';
import { SETTINGS_GO_EVENT, SETTINGS_GROUP_ICONS, SETTINGS_SHOWN_EVENT } from './settings-groups-ui';

const SETTINGS_PATH = '/dashboard/profile';

export function SettingsRailContext() {
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const fromUrl = searchParams?.get('tab');
  const [shown, setShown] = useState<SettingsGroup>(isSettingsGroup(fromUrl) ? fromUrl : 'profile');

  useEffect(() => {
    const onShown = (e: Event) => {
      const g = (e as CustomEvent<unknown>).detail;
      if (isSettingsGroup(g)) setShown(g);
    };
    window.addEventListener(SETTINGS_SHOWN_EVENT, onShown);
    return () => window.removeEventListener(SETTINGS_SHOWN_EVENT, onShown);
  }, []);

  if (pathname !== SETTINGS_PATH) return null;

  return (
    <div className="hidden tab:contents" data-settings-rail="">
      <div className="fd-rdiv" />
      <div className="fd-rctx">Settings</div>
      {SETTINGS_GROUPS.map((id) => {
        const Icon = SETTINGS_GROUP_ICONS[id];
        const on = shown === id;
        const label = SETTINGS_GROUP_META[id].label;
        return (
          <a
            key={id}
            href={`${SETTINGS_PATH}?tab=${id}`}
            className="fd-row"
            data-on={on ? 'true' : 'false'}
            aria-current={on ? 'page' : undefined}
            onClick={(e) => {
              if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              window.dispatchEvent(new CustomEvent(SETTINGS_GO_EVENT, { detail: id }));
            }}
          >
            <span className="fd-gi" aria-hidden="true">
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="fd-label-text">{label}</span>
            <span className="fd-icon-caption">{label}</span>
          </a>
        );
      })}
    </div>
  );
}
