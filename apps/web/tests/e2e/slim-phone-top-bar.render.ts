/**
 * Renderer for `slim-phone-top-bar.spec.ts` — prints the REAL shared top bar
 * (`FrontDoorShell`, app variant) as JSON on stdout, carrying the event tree's
 * REAL cluster: `UnreadMessagesBadge` · `UnreadBellBadge` · `AccountSwitcher`,
 * and the real search the bar hands in (`HomeCommandBar`, which on the Guest
 * list is `GuestsTopSearch`). Run by the spec in a `tsx` child process
 * (Playwright's transform cannot server-render imported JSX) — same shape as
 * `event-type-cards-fit.render.ts`.
 *
 * Two places, because the bar carries two different searches:
 *   event   — an event's Home: the palette trigger (a button, no input)
 *   guests  — the Guest list: a real input that drives the roster's `?q=`
 *
 * And the three OTHER trees that hand the same bar their own cluster, because
 * "one row on every page" is only true if every cluster is measured:
 *   board   — the events board / account pages (`(launcher)/layout.tsx`):
 *             bell + account, the palette search
 *   shop    — the supplier app (`vendor-dashboard/layout.tsx`): bell, the
 *             name (sm+ only), account, "+ Create service card"
 *   hq      — the console (`admin/layout.tsx`): its WORST case — the longest
 *             SLA pill ("Queue counts unavailable") AND the longest role tag
 *             ("Setnayan Team"), its own search box. Its pill and tag are
 *             inline markup in that layout, so this copies their classes and
 *             first checks the layout still carries the two hooks the phone
 *             rules key on (`fd-urgency`, `fd-role`) — a renamed hook fails
 *             HERE, not as a quietly overflowing bar.
 */
import Module from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import {
  PathnameContext,
  SearchParamsContext,
} from 'next/dist/shared/lib/hooks-client-context.shared-runtime';

// 🪤 NOT TIDINESS TO REMOVE: tsconfig's `"jsx": "preserve"` makes `tsx` compile
// the components to the CLASSIC runtime (bare `React.createElement`), so React
// must be global BEFORE they load — hence the dynamic imports below.
(globalThis as { React?: typeof React }).React = React;

/*
  The shell's import chain reaches a server module (`lib/auth.ts` → 'server-only')
  through the sign-in panel, and imports stylesheets. Neither runs at render time
  — the bundler resolves both in the app — so outside it they resolve to nothing.
  The spec styles the markup with the app's own compiled CSS instead.
*/
const EMPTY = join(__dirname, 'slim-phone-top-bar.empty.cjs');
type Resolve = (request: string, ...rest: unknown[]) => string;
const M = Module as unknown as { _resolveFilename: Resolve };
const resolve = M._resolveFilename;
M._resolveFilename = function (this: unknown, request: string, ...rest: unknown[]) {
  if (request === 'server-only' || request.endsWith('.css')) return EMPTY;
  return resolve.call(this, request, ...rest);
};
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'dummy-anon-key';

const h = React.createElement;
const EVENT = '/dashboard/S89E-TESTEVENT0';
const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };

void (async () => {
  const { FrontDoorShell } = await import('../../app/_components/frontdoor/front-door-shell');
  const { HomeCommandBar } = await import('../../app/dashboard/(launcher)/_components/home-command-bar');
  const { UnreadMessagesBadge } = await import('../../app/_components/unread-messages-badge');
  const { UnreadBellBadge } = await import('../../app/_components/unread-bell-badge');
  const { AccountSwitcher } = await import('../../app/_components/account-switcher/account-switcher');

  const render = (pathname: string) => {
    // The event layout's own cluster (`app/dashboard/[eventId]/layout.tsx`).
    const cluster = h(
      'div',
      { className: 'flex items-center gap-3' },
      h(UnreadMessagesBadge, { userId: 'u', initialUnread: 3, href: `${EVENT}/messages` }),
      h(UnreadBellBadge, {
        userId: 'u',
        initialUnread: 12,
        href: '/dashboard/notifications',
        ariaBaseLabel: 'Notifications',
        ariaUnreadSuffix: 'unread',
      }),
      h(
        'div',
        null,
        h(AccountSwitcher, {
          data: {
            userId: 'u',
            displayName: 'Ana Reyes',
            email: 'ana@example.com',
            isAnonymous: false,
            photoUrl: null,
            events: [],
            eventsMeasured: true,
            context: { hasVendor: false, vendorName: null, isAdmin: false, canOpenShop: false },
          },
        }),
      ),
    );
    const shell = h(FrontDoorShell, {
      variant: 'app',
      account: { signedIn: true, initials: 'AR', shopName: null, isAdmin: false },
      tools: [],
      navLabels: {},
      topBarSlot: cluster,
      search: h(HomeCommandBar, { items: [], variant: 'rail' }),
      children: h('h1', { 'data-page-title': '' }, 'Guests'),
    });
    return renderToStaticMarkup(
      h(
        AppRouterContext.Provider,
        { value: router as never },
        h(
          PathnameContext.Provider,
          { value: pathname },
          h(SearchParamsContext.Provider, { value: new URLSearchParams() as never }, shell),
        ),
      ),
    );
  };

  const { AdminSearchBox } = await import('../../app/admin/_components/admin-search-box');
  const layout = readFileSync(join(__dirname, '..', '..', 'app', 'admin', 'layout.tsx'), 'utf8');
  const hooks = { urgency: layout.split('fd-urgency ').length - 1, role: layout.split('fd-role ').length - 1 };
  if (hooks.urgency !== 3 || hooks.role !== 1) {
    throw new Error(`admin/layout.tsx lost its phone hooks: fd-urgency ×${hooks.urgency} (want 3), fd-role ×${hooks.role} (want 1)`);
  }

  const account = (context: { hasVendor: boolean; isAdmin: boolean }) =>
    h(AccountSwitcher, {
      data: {
        userId: 'u',
        displayName: 'Ana Reyes',
        email: 'ana@example.com',
        isAnonymous: false,
        photoUrl: null,
        events: [],
        eventsMeasured: true,
        context: { ...context, vendorName: context.hasVendor ? 'Ana Florals' : null, canOpenShop: false },
      },
    });
  const bell = (href: string) =>
    h(UnreadBellBadge, { userId: 'u', initialUnread: 12, href, ariaBaseLabel: 'Notifications', ariaUnreadSuffix: 'unread' });
  const name = h('span', { className: 'hidden text-sm text-ink/70 sm:inline' }, 'Ana Reyes');
  const wrap = (shell: React.ReactElement) =>
    renderToStaticMarkup(
      h(
        AppRouterContext.Provider,
        { value: router as never },
        h(
          PathnameContext.Provider,
          { value: '/x' },
          h(SearchParamsContext.Provider, { value: new URLSearchParams() as never }, shell),
        ),
      ),
    );
  const tree = (topBarSlot: React.ReactNode, search: React.ReactNode, isAdmin: boolean, createSlot?: React.ReactNode) =>
    wrap(
      h(FrontDoorShell, {
        variant: 'app',
        account: { signedIn: true, initials: 'AR', shopName: null, isAdmin },
        tools: [],
        navLabels: {},
        topBarSlot,
        search,
        ...(createSlot === undefined ? {} : { createSlot }),
        children: h('h1', { 'data-page-title': '' }, 'Page'),
      }),
    );
  const palette = h(HomeCommandBar, { items: [], variant: 'rail' });

  const board = tree(h(React.Fragment, null, bell('/dashboard/notifications'), account({ hasVendor: false, isAdmin: false })), palette, false);
  const shop = tree(
    h('div', { className: 'flex items-center gap-2' }, bell('/vendor-dashboard/notifications'), name, account({ hasVendor: true, isAdmin: false })),
    palette,
    false,
    h('a', { href: '/vendor-dashboard/shop', className: 'fd-btn-gold' }, '+ Create service card'),
  );
  const hq = tree(
    h(
      'div',
      { className: 'flex min-w-0 items-center gap-3 sm:gap-2' },
      h(
        'a',
        {
          href: '/admin/work',
          className:
            "fd-urgency relative inline-flex min-w-0 items-center gap-1.5 rounded-full bg-ink/10 px-2.5 py-1 text-xs font-semibold text-ink/70 transition-opacity before:absolute before:-inset-x-1 before:-inset-y-2.5 before:content-['']",
        },
        h('svg', { 'aria-hidden': true, className: 'h-3.5 w-3.5', viewBox: '0 0 24 24' }),
        h('span', { className: 'truncate' }, 'Queue counts unavailable'),
      ),
      bell('/admin/settings?tab=notifications'),
      h(
        'span',
        { className: 'fd-role inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] bg-ink/10 text-ink/70' },
        'Setnayan Team',
      ),
      name,
      account({ hasVendor: false, isAdmin: true }),
    ),
    h(AdminSearchBox),
    true,
    null,
  );

  process.stdout.write(
    JSON.stringify({ event: render(EVENT), guests: render(`${EVENT}/guests`), board, shop, hq }),
  );
})();
