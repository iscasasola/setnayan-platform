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
 */
import Module from 'node:module';
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

  process.stdout.write(JSON.stringify({ event: render(EVENT), guests: render(`${EVENT}/guests`) }));
})();
