/**
 * render-setup.ts — TEST HELPER: Guests › Setup drawn to static HTML, so the
 * row guards measure what renders, not what the source spells.
 */
import React from 'react';
import type { GuestsGetIn as GetIn } from '@/lib/who-can-reply';
import { guestsGetInPatch } from '@/lib/who-can-reply';
import type { HeadcountView } from './guest-setup-rows';

(globalThis as unknown as { React: unknown }).React = React;
/* The rows import the shipped server actions, whose modules import `server-only` — stubbed here, as the repo's other render tests do. */
{
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const ROUTER = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };

export const HEADCOUNT_OFF: HeadcountView = { show: false, mayFinalize: false, locked: false, attending: 3, heads: 3, unread: false };

export async function renderSetup(opts: { getIn?: GetIn; headcount?: Partial<HeadcountView> } = {}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { GuestSetupRows } = await import('./guest-setup-rows');
  return renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: ROUTER as never },
      React.createElement(GuestSetupRows, {
        eventId: 'e1',
        config: guestsGetInPatch(opts.getIn ?? 'list'),
        drafted: false,
        reply: { own: '2027-01-14', pricingMode: 'realtime', fallback: null },
        toInvite: 4,
        passSrc: '/api/hub-print/pass?event=e1&mode=screen&pass_guest=first',
        oneLink: { url: 'https://setnayan.com/cale-ice/invite', qrSvg: '<svg data-qr=""></svg>', notice: null },
        headcount: { ...HEADCOUNT_OFF, ...(opts.headcount ?? {}) },
      }),
    ),
  );
}
