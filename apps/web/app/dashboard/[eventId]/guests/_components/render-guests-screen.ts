/**
 * render-guests-screen.ts — TEST HELPER: Guests › List drawn to static HTML (the
 * REAL `GuestsScreen`, inside the providers its page gives it), so a guard on
 * the counts line measures what renders, not what the source spells. The
 * sibling of `guest-setup/render-setup.ts`.
 */
import React from 'react';
import type { GuestRow } from '@/lib/guests';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  /* The screen imports the shipped server actions, whose modules import `server-only`. */
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
  /* A CSS module is its class names: `styles.countsDoor` → "countsDoor". */
  Mod._extensions['.css'] = (m: { exports: unknown }) => {
    m.exports = new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : String(k)) });
  };
}

const ROUTER = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };

let n = 0;
/** A guest already invited and silent; pass what differs. */
export const guestRow = (over: Partial<GuestRow> = {}): GuestRow =>
  ({
    guest_id: `g${(n += 1)}`,
    first_name: `G${n}`,
    last_name: 'Test',
    role: 'guest',
    extra_roles: [],
    side: 'bride',
    rsvp_status: 'pending',
    entry_source: 'host',
    passed_away: false,
    invitation_sent_at: '2026-10-01T00:00:00Z',
    plus_one_count: 0,
    ...over,
  }) as unknown as GuestRow;

export async function renderGuestsScreen(opts: {
  guests: GuestRow[];
  measured?: boolean;
  gview?: 'list' | 'map' | 'share';
}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { ToastProvider } = await import('@/app/_components/toast/toast-provider');
  const { GuestsScreen } = await import('./guests-screen');
  return renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: ROUTER as never },
      React.createElement(
        ToastProvider,
        null,
        React.createElement(GuestsScreen, {
          eventId: 'e1',
          gview: opts.gview ?? 'list',
          guests: opts.guests,
          measured: opts.measured ?? true,
          hasSides: true,
          groupsByGuest: {},
          groups: [],
          tables: [],
          tableByGuest: {},
          songsByGuest: {},
          linkedGuestIds: [],
          faceByGuest: {},
          requests: 0,
          rootLabel: 'A & B',
          initialQuery: '',
          initialSelect: false,
          setup: null,
          empty: null,
        } as never),
      ),
    ),
  );
}
