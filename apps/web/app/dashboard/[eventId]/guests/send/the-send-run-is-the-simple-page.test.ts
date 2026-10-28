/**
 * the-send-run-is-the-simple-page.test.ts — THE SEND RUN, REDRAWN SIMPLE (owner 2026-10-28: "invitation page still not the
 * design we did"; DECISION_LOG "THE SEND RUN, REDRAWN SIMPLE" · "APPROVED — THE SIMPLE SEND RUN, PLUS SWIPE" · "CLOSING THE
 * SEND RUN ALWAYS RETURNS TO THE GUEST LIST" · "THE SEND RUN ALSO SERVES A ONE-QR EVENT" · "THE SEND RUN'S HINT LINE …
 * FADES AFTER 10 S"; prototype `prototypes/send_run_simple_2026-10-27/`).
 *
 * Executed on the RENDERED run (the real `SendRun`, static markup) and on its pure words (`lib/send-run-page.ts`):
 *   1. one guest as a page — "Invite N of M", the name, the role as the neutral pill, side · group, +1s, the mobile;
 *      "N sent · M more to invite"; ONE Send + Invite later; ✕ and Done for now; no "Who to send to" picker, no
 *      "Send in an app ▾" / "Copy message" buttons standing beside Send;
 *   2. a one-link event: every guest is walked with the event's ONE QR, never a personal QR route; the hint says so;
 *   3. the words: status, bar, hint, swipe verdicts, the +1 lines (an unnamed seat is "+1 · no name yet");
 *   4. ✕ and Done for now both go to the Guest list; Sent stamps through the one writer and moves on; a swipe stamps nothing.
 *
 * SABOTAGE (seen red): draw a second "Copy message" ActionButton beside Send → test 1; make `swipeStep` treat a right drag
 * as 'next' → test 3; point ✕ at another href → test 4.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { runGuestPage, sendRunHint, sendRunProgress, sendRunStatus, swipeStep, SEND_RUN_HINT_MS } from '@/lib/send-run-page';

(globalThis as unknown as { React: unknown }).React = React;
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const CjsModule = (createRequire(import.meta.url)('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_send_run__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return STUB;
    return original.call(this, request, ...rest);
  };
}
const HERE = dirname(fileURLToPath(import.meta.url));
const RUN = stripComments(readFileSync(join(HERE, '_components', 'send-run.tsx'), 'utf8'));
const ROUTER = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };
const FACTS = { hostsName: 'Cale & Ice', eventWord: 'wedding', eventDate: '2026-12-12', datePrecision: 'day' } as const;

const guest = (id: string, over: Record<string, unknown> = {}) => ({
  guestId: id,
  formalName: `${id} Ramos`,
  firstName: id,
  fullName: `${id} Ramos`,
  inviteUrl: `https://www.setnayan.com/cale-and-ice/i/${id}`,
  sentAt: null as string | null,
  page: { roleWord: 'Principal Sponsor (Ninang)', place: 'Bride’s side · Family', plusOnes: ['+1 · Juan Ramos'], mobile: '0917 822 4410' },
  ...over,
});

async function paint(props: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { ToastProvider } = await import('@/app/_components/toast/toast-provider');
  const { SendRun } = await import('./_components/send-run');
  return renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: ROUTER as never },
      React.createElement(
        ToastProvider as React.FC<{ children: React.ReactNode }>,
        null,
        React.createElement(SendRun as unknown as React.FC<Record<string, unknown>>, { eventId: 'e1', measured: true, facts: FACTS, template: null, ...props }),
      ),
    ),
  );
}

test('1 · the RENDERED run: the guest as a page, the status, ONE Send + Invite later, ✕ and Done for now', async () => {
  const html = await paint({ guests: [guest('Sent', { sentAt: '2026-10-20T00:00:00Z' }), guest('Cita'), guest('Dan')] });
  assert.match(html, /data-send-run=""/);
  assert.match(html, /<b[^>]*>1<\/b> sent · <b[^>]*>2<\/b> more to invite/, 'the status line');
  assert.match(html, /Invite 2 of 3/, 'the eyebrow counts on from those already sent');
  assert.match(html, /data-send-run-name="">Cita Ramos</);
  assert.match(html, /data-send-run-role="">Principal Sponsor \(Ninang\)</);
  assert.doesNotMatch(html.slice(html.indexOf('data-send-run-role')), /^[^>]*terracotta/, 'the role pill is tinted');
  assert.match(html, /data-send-run-place="">Bride’s side · Family</);
  assert.match(html, /data-send-run-plus="">\+1 · Juan Ramos</);
  assert.match(html, /0917 822 4410/);
  assert.match(html, /src="\/api\/website\/qr\/guest\/Cita"/, 'their own QR');
  assert.match(html, /data-testid="send-run-send"/);
  assert.match(html, /aria-label="Send Cita Ramos’s invitation"/);
  assert.match(html, />Invite later</);
  assert.match(html, /aria-label="Close — back to the Guest list"/);
  assert.match(html, />Done for now</);
  assert.doesNotMatch(html, /Who to send to|Not sent yet \(|Send invites one by one/, 'the old picker or title is back');
  assert.doesNotMatch(html, /data-send-run-apps=/, 'the app list draws before Send is pressed');
  assert.equal((html.match(/>Copy message</g) ?? []).length, 0, 'Copy message stands beside Send');
  assert.match(html, /data-send-run-hint="on"[^>]*>Each guest gets their own link and QR, sent from your phone\.</);
});

test('2 · a one-link event walks the same guests with the event’s ONE QR and link', async () => {
  const html = await paint({
    guests: [guest('Cita', { inviteUrl: null }), guest('Dan', { inviteUrl: null })],
    oneLink: { url: 'https://www.setnayan.com/cale-and-ice/invite', qrSvg: '<svg data-one-qr="1"></svg>' },
  });
  assert.match(html, /Invite 1 of 2/, 'a guest with no personal link is left out of a one-link run');
  assert.match(html, /data-one-qr="1"/, 'the event’s QR is not drawn');
  assert.doesNotMatch(html, /\/api\/website\/qr\/guest\//, 'a personal QR is drawn on a one-link event');
  assert.match(html, /Everyone gets the same link and QR, sent from your phone\./);
});

test('3 · the words: status, bar, hint, swipe, the +1 lines', () => {
  assert.equal(sendRunStatus(12, 153), '12 sent · 153 more to invite');
  assert.equal(sendRunProgress(12, 153), 12 / 165);
  assert.equal(sendRunProgress(0, 0), 0);
  assert.equal(SEND_RUN_HINT_MS, 10_000);
  assert.equal(sendRunHint(false), 'Each guest gets their own link and QR, sent from your phone.');
  assert.equal(sendRunHint(true), 'Everyone gets the same link and QR, sent from your phone.');
  assert.equal(swipeStep(-120), 'next', 'swipe left = next');
  assert.equal(swipeStep(120), 'prev', 'swipe right = previous');
  assert.equal(swipeStep(-30), null, 'a short drag snaps back');
  assert.equal(swipeStep(-80, 200), null, 'a scroll is not a swipe');
  const host = { guest_id: 'h', role: 'guest', side: 'groom', group_category: 'family', mobile: ' 0917 ', plus_one_count: 2, plus_one_of_guest_id: null, first_name: 'Ana', last_name: 'R', plus_one_name_confirmed_at: null } as const;
  const named = { guest_id: 's1', role: 'guest', side: 'groom', group_category: 'other', mobile: null, plus_one_of_guest_id: 'h', first_name: 'Juan', last_name: 'Ramos', plus_one_name_confirmed_at: '2026-10-01', created_at: '1' } as const;
  const page = runGuestPage(host as never, [host, named] as never, null, true);
  assert.deepEqual(page.plusOnes, ['+1 · Juan Ramos', '+1 · no name yet']);
  assert.equal(page.place, 'Groom’s side · Family'.replace('’', "'"));
  assert.equal(page.mobile, '0917');
  assert.equal(runGuestPage(host as never, [host] as never, null, false).place, 'Family', 'a sideless event says a side');
});

test('4 · ✕ and Done for now ALWAYS land on the Guest list; Sent is the one writer and moves on; a swipe stamps nothing', () => {
  assert.match(RUN, /const home = guestsHref \?\? `\/dashboard\/\$\{eventId\}\/guests`;/);
  assert.match(RUN, /icon=\{X\} label="Close — back to the Guest list" href=\{home\}/);
  assert.match(RUN, /label="Done for now" href=\{home\}/);
  assert.match(RUN, /label="Back to the Guest list" href=\{home\}/);
  assert.doesNotMatch(RUN, /router\.back\(\)/);
  assert.match(RUN, /setGuestInvitationSent\(eventId, id, sent\)/, 'Sent left the one writer');
  assert.match(RUN, /onSent=\{\(\) => \{[\s\S]*?mark\(true, true\);/, 'Sent does not move on');
  const swipe = RUN.slice(RUN.indexOf('const onUp ='), RUN.indexOf('const status ='));
  assert.doesNotMatch(swipe, /mark\(/, 'a swipe stamps');
  assert.match(RUN, /const out = await shareInvite\(/, 'Send left the one share');
  assert.match(RUN, /prefers-reduced-motion: reduce/, 'the card moves under reduced motion');
});
