/**
 * 📞 EVERY CHAT HEAD HAS ITS CALLS (owner, 9 Nov: "where are the voice and video call buttons?").
 *
 * `BookedCallButtons` (Call · Video call, booked shops only — its own gate) sat in the ROUTED chat head of the two thread
 * pages only. Inside a picked page the routed head is not drawn: the pinned row + the host strip ARE the head, so the
 * buttons were simply gone there. Now:
 *
 *   1. every chat surface that draws the host strip (a `<ChatMessageStream>` handed `hosts`) also hands it `headCalls`
 *      — a `<BookedCallButtons …>` — and the two thread pages key it on the ONE booking check (`booked={shopBooked}`);
 *   2. the stream passes `headCalls` to `ChatHostStrip` as `calls`, and the strip draws them in BOTH its states (the
 *      faces, and "Couldn't load who is in this chat").
 *
 * No new gate: an unbooked shop still renders nothing (lib/no-door-out-of-the-app.test.ts).
 *
 * Round 2 (v8.3): inside a picked shell the calls go to the picked head row, not the strip — test 1 holds both homes.
 *
 * Round 3 (Unichat v3, controller ruling 21 Nov 2026 — "follow the approved Unichat drawing, which removes the phone and
 * video icons now that Call · Viber lives in ⋯"; drawing `unichat_live_v3_2026-11-20.html`: "Call · Viber moved under ⋯
 * to make room for search"): inside a picked shell the calls LEFT the head row and live under ⋯ — the supplier's
 * `Call · Viber` row and the host's `Call` · `Video call on Viber` rows, held by
 * `app/vendor-dashboard/clients/[eventId]/the-more-menu-holds-places-to-go.test.ts` rule 10. Test 1 now holds: the
 * head row draws NO calls, the strip draws them only outside a picked shell, and BOTH picked pages hand ⋯ its call rows
 * on the ONE booking check — so the calls moved, they were not dropped.
 *
 * Sabotage (9 Nov 2026): `headCalls` dropped from the supplier thread page → 1 RED; `calls` dropped from the strip's
 * couldn't-load state → 2 RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';
import { ChatHostStrip } from '@/app/_components/chat/chat-host-strip';
import { BookedCallButtons } from '@/app/_components/chat/booked-call-buttons';

(globalThis as unknown as { React: unknown }).React = React;
const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full));
    else if (name.endsWith('.tsx') && !name.includes('.test.')) out.push(relative(WEB, full));
  }
  return out;
}

/** Each `<ChatMessageStream …/>` element's source, up to its own self-closing end. */
function streamMounts(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/<ChatMessageStream\b/g)) {
    const from = m.index ?? 0;
    const end = src.indexOf('\n        />', from);
    const close = src.indexOf('/>\n', from);
    const stop = [end, close].filter((x) => x > from).sort((a, b) => a - b)[0] ?? src.length;
    out.push(src.slice(from, stop));
  }
  return out;
}

test('1 · every chat that draws the host strip also hands it the booked call buttons', () => {
  const strips: string[] = [];
  for (const rel of tsxFiles(join(WEB, 'app'))) {
    const src = read(rel);
    for (const el of streamMounts(src)) {
      if (!/\bhosts\b/.test(el)) continue;
      strips.push(rel);
      // 💬 An event GROUP books no one: Call · Video call belong to ONE booked supplier, in that supplier's own chat
      // (owner 12 Nov — money and bookings never in a group). The group view hands its strip no calls, on purpose.
      if (rel === 'app/samahan/chat/[threadId]/_components/group-chat-view.tsx') continue;
      assert.match(el, /headCalls(?:=\{|: )<BookedCallButtons\b/, `${rel} draws the host strip with no Call · Video call`);
    }
  }
  // The two thread pages (their picked embeds) and the lab — never fewer.
  for (const rel of [
    'app/dashboard/[eventId]/messages/[threadId]/page.tsx',
    'app/vendor-dashboard/messages/[threadId]/page.tsx',
    'app/dev/_components/lab-picked-chat.tsx',
  ]) {
    assert.ok(strips.includes(rel), `${rel} no longer draws the host strip — this guard lost its subject`);
  }
  // The real pages key the buttons on the ONE booking check, the same as their routed head.
  for (const rel of ['app/dashboard/[eventId]/messages/[threadId]/page.tsx', 'app/vendor-dashboard/messages/[threadId]/page.tsx']) {
    const calls = read(rel).match(/headCalls: <BookedCallButtons\b[^>]*>/);
    assert.ok(calls, `${rel}: the picked chat has no call buttons`);
    assert.match(calls[0], /\bbooked=\{shopBooked\}/, `${rel}: the picked chat's calls are not keyed on the booking check`);
  }
  // The stream hands them to the strip.
  // The stream hands them on: to the picked head row inside a picked shell (v8.3 — title · 📞 · 🎥 · 📎 · ⚙ · ✕, held by
  // lib/the-picked-head-carries-the-chat-actions.test.ts), to the strip everywhere else. Never dropped.
  const stream = read('app/_components/chat-message-stream.tsx');
  assert.match(stream, /<ChatHostStrip\b[^>]*\bcalls=\{inPicked \? null : headCalls\}/, 'the stream drops the head calls off a picked page');
  const portal = stream.slice(stream.indexOf('createPortal('), stream.indexOf('headSlot,', stream.indexOf('createPortal(')));
  assert.doesNotMatch(portal, /\{headCalls\}/, 'the picked head row draws 📞 🎥 again — the Unichat v3 drawing moved them under ⋯');
  // …and they did move, not vanish: both picked pages hand ⋯ its call rows on the ONE booking check.
  const client = read('app/vendor-dashboard/clients/[eventId]/page.tsx');
  assert.match(client, /shopIsBookedOnEvent\(eventId, profile\.vendor_profile_id\)/, 'the supplier’s ⋯ lost its booking check');
  assert.match(client, /call: bookedCallReachable\(bookedCall\.booked, bookedCall\.phone\) \? \(\s*<BookedCallChoices\b/, 'the supplier’s ⋯ lost Call · Viber');
  const host = read('app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx');
  assert.match(host, /shopIsBookedOnEvent\(eventId, shopId\)/, 'the host’s ⋯ lost its booking check');
  assert.match(host, /call=\{\{ tel: bookedTelHref\(bookedCall\.booked, bookedCall\.phone\), viber: bookedViberHref\(bookedCall\.booked, bookedCall\.phone\) \}\}/, 'the host’s ⋯ lost Call · Viber');
});

test('2 · the strip draws the calls with the faces AND when who-is-here could not load', () => {
  const calls = React.createElement(BookedCallButtons, { booked: true, phone: '0917 000 0000', who: 'Lumière' });
  const base = { presentIds: new Set<string>(), youId: 'u-maria', threadId: 't1', calls };
  const faces = renderToStaticMarkup(
    React.createElement(ChatHostStrip, { ...base, hosts: [{ userId: 'u-jose', firstName: 'Jose', name: 'Jose', role: 'groom', label: null }] }),
  );
  assert.match(faces, /data-chat-head-calls=""[\s\S]*href="tel:\+639170000000"/, 'the strip lost its Call');
  assert.match(faces, /viber:\/\/chat/, 'the strip lost its Video call');
  const refused = renderToStaticMarkup(React.createElement(ChatHostStrip, { ...base, hosts: null }));
  assert.match(refused, /Couldn.{1,8}t load who is in this chat/);
  assert.match(refused, /data-chat-head-calls=""/, 'a refused hosts read took the calls with it');
  // Unbooked: the slot is handed nothing to draw.
  const none = renderToStaticMarkup(
    React.createElement(ChatHostStrip, { ...base, calls: React.createElement(BookedCallButtons, { booked: false, phone: '0917 000 0000', who: 'x' }), hosts: [] }),
  );
  assert.doesNotMatch(none, /tel:|viber:/);
});
