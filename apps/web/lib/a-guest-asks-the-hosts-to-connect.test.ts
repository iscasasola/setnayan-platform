/**
 * a-guest-asks-the-hosts-to-connect.test.ts — 🤝 "Also connect with <the hosts>", held (owner 2026-10-21,
 * DECISION_LOG "A GUEST WHO KEEPS THEIR INVITATION ASKS THE HOSTS TO CONNECT — ONE TICK, ON BY DEFAULT").
 *
 * The pure half is EXECUTED. The server half and the two link steps import `server-only`, which does not resolve
 * under the unit runner, so their promises are read from the CODE (comments stripped by the repo's one stripper —
 * a rule stated in prose is not a rule that runs). Every anchor is a string, never a line number.
 *
 * The five promises: the tick is drawn ON · unticked (or never drawn) sends nothing · a request goes only through the
 * one writer · no host is asked twice · a refused ask never costs the guest their link. Plus: 📵 no email.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import {
  CONNECT_HOSTS_FIELD,
  CONNECT_HOSTS_SHOWN,
  connectHostsLine,
  connectHostsTicked,
  namesInPlainWords,
} from '@/lib/guest-connects-hosts';

const WEB = join(__dirname, '..');
const code = (rel: string) => {
  const src = readFileSync(join(WEB, rel), 'utf8');
  assert.ok(src.length > 300, `${rel} is missing or a stub`);
  return stripComments(src);
};

const TICK = code('app/[slug]/_components/connect-hosts-tick.tsx');
const SAVE = code('app/[slug]/_components/save-to-account.tsx');
const SLUG_ACTIONS = code('app/[slug]/actions.ts');
const CONFIRM_PAGE = code('app/join/[eventId]/connect/confirm/page.tsx');
const CONFIRM_ACTION = code('app/join/[eventId]/connect/confirm/actions.ts');
const SERVER = code('lib/guest-connects-hosts.server.ts');
const WRITER = code('lib/people-connection-request.server.ts');
const PEOPLE_ACTIONS = code('app/dashboard/(account)/people/actions.ts');

/** The body of `export async function <name>` up to the next top-level `export`. */
function fnBody(src: string, name: string): string {
  const at = src.indexOf(`export async function ${name}(`);
  assert.ok(at >= 0, `${name} is gone — re-anchor this guard`);
  const next = src.indexOf('\nexport ', at + 10);
  return src.slice(at, next < 0 ? undefined : next);
}

// ── the pure half ───────────────────────────────────────────────────────────

test('ticked means: the tick was drawn AND it came back on', () => {
  const form = (pairs: Array<[string, string]>) => {
    const f = new FormData();
    for (const [k, v] of pairs) f.append(k, v);
    return f;
  };
  assert.equal(connectHostsTicked(form([[CONNECT_HOSTS_SHOWN, '1'], [CONNECT_HOSTS_FIELD, '1']])), true);
  assert.equal(connectHostsTicked(form([[CONNECT_HOSTS_SHOWN, '1']])), false, '🔴 unticked asked somebody');
  assert.equal(
    connectHostsTicked(form([[CONNECT_HOSTS_FIELD, '1']])),
    false,
    '🔴 a form that never drew the tick asked somebody',
  );
  assert.equal(connectHostsTicked(form([[CONNECT_HOSTS_SHOWN, '1'], [CONNECT_HOSTS_FIELD, 'on']])), false);
  assert.equal(connectHostsTicked(form([])), false);
  assert.equal(connectHostsTicked(undefined), false);
  assert.equal(connectHostsTicked(null), false);
});

test('the tick says who, in plain words — and says nothing when there is nobody', () => {
  assert.equal(connectHostsLine(['Claire']), 'Also connect with Claire');
  assert.equal(connectHostsLine(['Ice', 'Claire']), 'Also connect with Ice and Claire');
  assert.equal(connectHostsLine(['Ice', 'Claire', 'Rosa']), 'Also connect with Ice, Claire and Rosa');
  assert.equal(connectHostsLine([]), '');
  assert.equal(connectHostsLine(['  ', '']), '');
  assert.equal(namesInPlainWords([' Ice ', 'Claire']), 'Ice and Claire');
});

// ── 1 · the default is ticked ──────────────────────────────────────────────

test('🔴 the tick is drawn ON, as a real checkbox, with the marker that says it was drawn', () => {
  const box = TICK.match(/<input\s[^>]*name=\{CONNECT_HOSTS_FIELD\}[^>]*\/>/);
  assert.ok(box, 'the checkbox is gone from the tick');
  assert.match(box![0], /type="checkbox"/);
  assert.match(box![0], /value="1"/);
  assert.match(box![0], /\bdefaultChecked(?![=\w])/, '🔴 the tick is no longer ON by default');
  assert.match(TICK, /<input type="hidden" name=\{CONNECT_HOSTS_SHOWN\} value="1" \/>/, 'the drawn-marker is gone');
  assert.match(TICK, /if \(!line\) return null;/, 'a tick with no names can be drawn');
});

test('🔴 the tick rides the SAME form as the press that keeps the invitation', () => {
  const seat = SAVE.slice(SAVE.indexOf('<form action={linkThisSeatAction'), SAVE.indexOf('</form>', SAVE.indexOf('<form action={linkThisSeatAction')));
  assert.match(seat, /<ConnectHostsTickFor eventId=\{eventId\} \/>/, 'the signed-in Save lost its tick');
  assert.ok(seat.indexOf('<ConnectHostsTickFor') < seat.indexOf('<SubmitButton'), 'the tick sits after the press');

  const yes = CONFIRM_PAGE.slice(
    CONFIRM_PAGE.indexOf('<form action={confirmSeatLinkAction'),
    CONFIRM_PAGE.indexOf('</form>', CONFIRM_PAGE.indexOf('<form action={confirmSeatLinkAction')),
  );
  assert.match(yes, /<ConnectHostsTick line=\{hosts\.line\} \/>/, 'the "Save this invitation?" Yes lost its tick');
  assert.match(CONFIRM_PAGE, /hostsToAsk\(admin, eventId, user\.id\)/, 'the confirm page no longer decides the hosts on the server');
});

// ── 2 · unticked sends nothing ─────────────────────────────────────────────

test('🔴 every ask is behind the tick — and, on the signed-in Save, behind a link that happened', () => {
  for (const [file, src, extra] of [
    ['app/[slug]/actions.ts', fnBody(SLUG_ACTIONS, 'linkThisSeatAction'), /result\.linked && /],
    ['confirm/actions.ts', fnBody(CONFIRM_ACTION, 'confirmSeatLinkAction'), null],
  ] as const) {
    const calls = src.split('askEventHostsToConnect(').length - 1;
    assert.equal(calls, 1, `${file}: expected exactly one ask, found ${calls}`);
    const at = src.indexOf('askEventHostsToConnect(');
    const guard = src.slice(Math.max(0, src.lastIndexOf('if (', at)), at);
    assert.match(guard, /connectHostsTicked\(formData\)\)\s*\{\s*await $/, `🔴 ${file} asks the hosts without the tick`);
    if (extra) assert.match(guard, extra, `🔴 ${file} asks the hosts when nothing was linked`);
  }
});

// ── 3 · only the one writer ────────────────────────────────────────────────

test('🔴 a guest-side request goes only through the one writer', () => {
  const ask = fnBody(SERVER, 'askEventHostsToConnect');
  assert.match(ask, /await requestConnection\(\{/, 'the ask no longer goes through requestConnection');
  for (const [file, src] of [
    ['lib/guest-connects-hosts.server.ts', SERVER],
    ['app/[slug]/actions.ts', SLUG_ACTIONS],
    ['confirm/actions.ts', CONFIRM_ACTION],
  ] as const) {
    assert.doesNotMatch(
      src,
      /from\('person_connections'\)\s*\.(insert|update|upsert|delete)\(/,
      `🔴 ${file} writes person_connections itself — a second writer`,
    );
  }
  // The one writer is where the stamp and the insert live; the People actions import it, never re-declare it.
  assert.match(WRITER, /export async function requestConnection\(/);
  assert.match(WRITER, /\.from\('person_connections'\)\.insert\(\{/);
  assert.doesNotMatch(PEOPLE_ACTIONS, /function requestConnection\(/, 'a second copy of the writer came back');
  assert.match(PEOPLE_ACTIONS, /import \{ requestConnection \} from '@\/lib\/people-connection-request\.server';/);
});

test('🔴 the ask is a REQUEST with no label, stamped with the event — and 📵 sends no email', () => {
  const ask = fnBody(SERVER, 'askEventHostsToConnect');
  const call = ask.slice(ask.indexOf('requestConnection({'), ask.indexOf('})', ask.indexOf('requestConnection({')));
  assert.match(call, /relation: null,/, 'the ask carries a label (owner 2026-08-21: add first, label after)');
  assert.match(call, /fromEvent: \{ eventId: input\.eventId,/, 'the ask no longer names its event');
  assert.match(call, /theirEmail: null,/);
  assert.doesNotMatch(call, /invite:/, '🔴 the guest ask was handed an email sender');
  assert.match(WRITER, /if \(email && input\.invite\) await input\.invite\(/, 'the writer emails without being handed a sender');
  assert.match(WRITER, /status: 'pending',/, 'the writer no longer writes a request');
});

// ── 4 · no duplicate requests ──────────────────────────────────────────────

test('🔴 no host is asked twice — any live row, either direction, any status, skips them', () => {
  const pick = fnBody(SERVER, 'hostsToAsk');
  const edges = pick.slice(pick.indexOf(".from('person_connections')"), pick.indexOf('if (error)', pick.indexOf(".from('person_connections')")));
  assert.match(edges, /and\(from_person_id\.eq\.\$\{guestPersonId\},to_person_id\.in\./, 'the guest→host direction is not checked');
  assert.match(edges, /and\(to_person_id\.eq\.\$\{guestPersonId\},from_person_id\.in\./, 'the host→guest direction is not checked');
  assert.match(edges, /\.is\('deleted_at', null\)/);
  assert.doesNotMatch(edges, /\.(eq|in)\('status'/, '🔴 a status filter lets a declined or pending host be asked again');
  assert.match(pick, /if \(!person \|\| onARow\.has\(person\)\) continue;/);
  // The writer's own check, for the race between two presses.
  assert.match(WRITER, /\.eq\('from_person_id', fromPerson\)\s*\.eq\('to_person_id', toPerson\)\s*\.is\('deleted_at', null\)/);
});

test('🔴 a guest who IS a host asks nobody and sees no tick', () => {
  const pick = fnBody(SERVER, 'hostsToAsk');
  assert.match(pick, /\.eq\('member_type', 'couple'\)/, 'the hosts are no longer the event’s couple members');
  assert.match(pick, /if \(hostIds\.length === 0 \|\| hostIds\.includes\(guestUserId\)\) return null;/);
  assert.match(pick, /if \(!peopleConnectionsEnabled\(\)\) return null;/, 'the tick shows while connections are off');
});

// ── 5 · a failure never blocks the link ────────────────────────────────────

test('🔴 a refused ask never costs the guest their link', () => {
  const ask = fnBody(SERVER, 'askEventHostsToConnect');
  assert.match(ask, /^export async function askEventHostsToConnect\([\s\S]*?\{\s*try \{/, 'the ask is not wrapped');
  assert.match(ask, /\} catch \{\s*return \{ asked: 0 \};\s*\}/, 'a throw in the ask escapes to the link step');
  assert.match(ask, /\.catch\(\(\) => \(\{ ok: false as const/, 'one host’s refusal stops the others');
  const pick = fnBody(SERVER, 'hostsToAsk');
  assert.match(pick, /\} catch \{\s*return null;\s*\}/, 'a throw while deciding the tick breaks the page');

  // In each link step: the ask comes AFTER the bind, its answer decides nothing, and the landing is unchanged.
  for (const [file, src, bind] of [
    ['app/[slug]/actions.ts', fnBody(SLUG_ACTIONS, 'linkThisSeatAction'), 'linkGuestSessionToUser('],
    ['confirm/actions.ts', fnBody(CONFIRM_ACTION, 'confirmSeatLinkAction'), 'connectEventForUser('],
  ] as const) {
    const at = src.indexOf('askEventHostsToConnect(');
    assert.ok(src.indexOf(bind) >= 0 && src.indexOf(bind) < at, `🔴 ${file} asks before the seat is bound`);
    assert.match(src.slice(at - 8, at), /await $/);
    assert.doesNotMatch(src, /=\s*await askEventHostsToConnect\(/, `🔴 ${file} reads the ask’s answer — it may only be fired`);
  }
  const confirm = fnBody(CONFIRM_ACTION, 'confirmSeatLinkAction');
  assert.ok(
    confirm.indexOf("again.set('failed', '1')") < confirm.indexOf('askEventHostsToConnect('),
    'the ask sits before the failed-bind exit',
  );
});
