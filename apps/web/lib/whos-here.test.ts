/**
 * whos-here.test.ts — 👀 WHO'S HERE STAYS CHEAP, HONEST AND PRIVATE (owner 2026-10-29: *"so when 2 cohost/helper or
 * coordinator is on the dashboard and which guest is viewing the event hub?"*; the standing rule of 2026-10-28: *"Our
 * priority is not crash any event hub most specially during their event"*).
 *
 *   1 · THE NUMBERS — the card's window is never shorter than the debounce (a shorter one drops a guest who is still
 *       looking), and the migration holds the SAME 30 minutes and the SAME default window as this file.
 *   2 · THE GUEST'S SIDE IS ONE WRITE — the beacon holds no socket, no repeating timer, remembers its half hour in the
 *       browser, posts only the slug, and is mounted once on the hub page — never on the Maker's canvas or a sample.
 *   3 · IT NEVER COSTS THE GUEST THEIR CACHED HUB — the middleware's cache-bust skips the beacon's path.
 *   4 · A NAME ONLY THROUGH THE GUEST'S OWN PASS — the route reads nothing from the body but the slug, and the guest
 *       id it writes is the verified pass's.
 *   5 · THE TEAM'S SIDE IS ONE CHANNEL — joined only by the event layout, private, on the topic the migration's
 *       predicate parses; the card reads ONE function and runs no timer of its own.
 *   6 · THE WORDS ARE HONEST — a failed read is "Couldn't load", an unanswered channel is "Checking…", never "nobody";
 *       an unchanged presence sync hands back the same list (no render).
 *
 * SABOTAGE (each seen red once, then reverted — the PR body lists them): window 15 → test 1 · drop the exemption from
 * the middleware → test 3 · read `guest_id` off the body → test 4 · `private: false` → test 5 · `hubWords(null)` →
 * "No one…" → test 6.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  HUB_SEEN_DEBOUNCE_MIN,
  HUB_SEEN_PATH,
  WHOS_HERE_WINDOW_MIN,
  eventTeamTopic,
  hubSeenDue,
  hubViewsEnabled,
  hubWords,
  nextTeamPeers,
  parseHubViewers,
  teamPresenceEnabled,
  teamRoleWord,
  teamWords,
  type HubViewers,
  type TeamPeer,
} from './whos-here';
import { HUB_BUST_EXEMPT_PATHS } from './hub-view-key';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(WEB, '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const code = (rel: string) => stripComments(read(rel));
const MIGRATION = readFileSync(join(REPO, 'supabase', 'migrations', '20271295895751_hub_viewers.sql'), 'utf8');

test('1 · the window is never shorter than the debounce — and the migration holds the same numbers', () => {
  assert.equal(HUB_SEEN_DEBOUNCE_MIN, 30, 'the owner-set debounce: at most once per guest per 30 minutes');
  assert.ok(WHOS_HERE_WINDOW_MIN >= HUB_SEEN_DEBOUNCE_MIN, `window ${WHOS_HERE_WINDOW_MIN} < debounce ${HUB_SEEN_DEBOUNCE_MIN}: a guest still looking would drop off`);
  assert.match(MIGRATION, new RegExp(`last_seen_at < now\\(\\) - INTERVAL '${HUB_SEEN_DEBOUNCE_MIN} minutes'`), 'the server-side debounce is the same 30 minutes');
  assert.match(MIGRATION, new RegExp(`p_window_minutes INTEGER DEFAULT ${WHOS_HERE_WINDOW_MIN}\\b`), 'the read’s default window is the card’s');
  assert.match(MIGRATION, /date_bin\('15 minutes', now\(\)/, 'strangers are one counter per quarter-hour');
  // The browser half of the debounce.
  const t = 1_800_000_000_000;
  assert.equal(hubSeenDue(null, t), true, 'first open');
  assert.equal(hubSeenDue(t - 60_000, t), false, 'a refresh a minute later');
  assert.equal(hubSeenDue(t - HUB_SEEN_DEBOUNCE_MIN * 60_000 + 1, t), false);
  assert.equal(hubSeenDue(t - HUB_SEEN_DEBOUNCE_MIN * 60_000, t), true, 'half an hour later');
  assert.equal(hubSeenDue(t + 60_000, t), true, 'a clock that went backwards never silences it forever');
  assert.equal(hubSeenDue(Number.NaN, t), true);
});

test('1b · the kill switch: HUB_VIEWS_DISABLED=1 turns the beacon off; unset is on', () => {
  assert.equal(hubViewsEnabled({}), true);
  assert.equal(hubViewsEnabled({ HUB_VIEWS_DISABLED: '1' }), false);
  assert.equal(hubViewsEnabled({ HUB_VIEWS_DISABLED: 'true' }), false);
  assert.equal(hubViewsEnabled({ HUB_VIEWS_DISABLED: 'false' }), true);
  assert.match(code('app/api/hub/seen/route.ts'), /if \(!hubViewsEnabled\(\)\) return done\(\);/, 'the route is a no-op when off');
});

test('2 · the guest’s side is ONE write after the page — no socket, no repeating timer, only the slug', () => {
  const beacon = code('app/[slug]/_components/hub-seen-beacon.tsx');
  for (const live of [/\.channel\(/, /setInterval\(/, /new WebSocket/, /EventSource/, /createClient/]) {
    assert.doesNotMatch(beacon, live, `the beacon must hold no live connection (${live})`);
  }
  assert.match(beacon, /hubSeenDue\(/, 'it asks the shared half-hour rule before sending');
  assert.match(beacon, /localStorage/, 'and remembers the half hour in the browser (not a cookie)');
  assert.doesNotMatch(beacon, /document\.cookie/, 'never a cookie');
  assert.match(beacon, /JSON\.stringify\(\{ slug \}\)/, 'the body is the slug alone — nothing about the guest');
  assert.match(beacon, /requestIdleCallback|setTimeout/, 'fired after the page has drawn');
  assert.doesNotMatch(beacon, /await fetch/, 'fire-and-forget');

  const body = code('app/[slug]/_components/site-body.tsx');
  const mounts = body.match(/<HubSeenBeacon\b[^>]*\/>/g) ?? [];
  assert.equal(mounts.length, 1, `one beacon on the hub page (found ${mounts.length})`);
  assert.match(body, /!isEditorCanvas && !event\.is_sample && hubViewsEnabled\(\) \? <HubSeenBeacon slug=\{event\.slug\} \/>/, 'never on the Maker’s canvas or a sample, and off with the switch');
  // Nowhere else under the guest pages.
  const elsewhere: string[] = [];
  const walk = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(n) && !n.endsWith('.test.ts') && /<HubSeenBeacon\b/.test(readFileSync(p, 'utf8'))) elsewhere.push(relative(WEB, p));
    }
  };
  walk(join(WEB, 'app'));
  assert.deepEqual(elsewhere, ['app/[slug]/_components/site-body.tsx']);
});

test('3 · the beacon never costs the guest their cached hub — the cache-bust skips its path', () => {
  assert.ok(HUB_BUST_EXEMPT_PATHS.includes(HUB_SEEN_PATH), 'the beacon’s path is a write no guest page shows');
  assert.equal(HUB_SEEN_PATH, '/api/hub/seen');
  const mw = code('middleware.ts');
  const bust = mw.slice(mw.indexOf("request.method !== 'GET' &&"), mw.indexOf('name: HUB_BUST_COOKIE'));
  assert.ok(bust.length > 0, 'premise: the cache-bust block is found');
  assert.match(bust, /!HUB_BUST_EXEMPT_PATHS\.includes\(request\.nextUrl\.pathname\)/, 'the bust must skip the exempt paths');
  // The route sets no cookie of its own either (a Set-Cookie on a guest's response is how a key moves).
  assert.doesNotMatch(code('app/api/hub/seen/route.ts'), /cookies\.set|\.cookies\(\)\.set|Set-Cookie/i);
});

test('4 · a name only through the guest’s own pass — the body is the slug, the guest id is the verified pass’s', () => {
  const route = code('app/api/hub/seen/route.ts');
  assert.doesNotMatch(route, /body as \{[^}]*guest/i, 'the body is never asked for a guest');
  const anyGuestId = (route.match(/\.guest_id\b|\[['"]guest_id['"]\]/g) ?? []).length;
  const sessions = (route.match(/\bsession\.guest_id\b/g) ?? []).length;
  assert.ok(sessions > 0, 'premise: the route names the session’s guest id');
  assert.equal(anyGuestId, sessions, 'a guest id is only ever the verified session’s — never the body’s');
  assert.match(route, /readGuestPassStanding\(\{ eventId \}\)/, 'the pass, checked for THIS event');
  assert.match(route, /session && session\.event_id === eventId \? session\.guest_id : null/);
  assert.match(route, /standing === 'host_preview'\) return done\(\)/, 'a host’s "Open as <guest>" is not a guest');
  assert.match(route, /loadHostMembership\(/, 'the team’s own looks are dropped');
  assert.match(route, /rpc\('record_hub_view', \{ p_event_id: eventId, p_guest_id: guestId \}\)/);
});

test('5 · the team’s side is ONE private channel, joined by the layout alone; the card reads one function, no timer', () => {
  const presence = code('app/dashboard/[eventId]/_components/event-team-presence.tsx');
  assert.match(presence, /private: true/, '🔒 the channel is private — the migration’s policies are the door');
  assert.match(presence, /supabase\.channel\(eventTeamTopic\(eventId\)/);
  assert.match(presence, /realtime\.setAuth\(/, 'the socket carries the user’s token, or the private predicate sees no one');
  assert.doesNotMatch(presence, /postgres_changes/, 'presence only — the database evaluates nothing per write');
  assert.match(presence, /if \(!enabled\) return;\s*const supabase = createClient\(\);/, 'switched off (TEAM_PRESENCE_DISABLED), it opens nothing');
  assert.match(presence, /pauseWhileHidden\(/, 'a hidden tab lets the channel go');
  assert.equal(teamPresenceEnabled({}), true);
  assert.equal(teamPresenceEnabled({ TEAM_PRESENCE_DISABLED: '1' }), false);
  assert.equal(teamWords(null, 'off'), 'Team presence is switched off');
  assert.equal(eventTeamTopic('e1'), 'event-team:e1');
  assert.match(MIGRATION, /p_topic NOT LIKE 'event-team:%'/, 'the predicate parses the same prefix');
  assert.match(MIGRATION, /substring\(p_topic FROM 12\)::uuid/, "'event-team:' is 11 characters");

  // Joined ONCE: only the layout mounts it.
  const mounts: string[] = [];
  const walk = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx$/.test(n) && /<EventTeamPresence\b/.test(readFileSync(p, 'utf8'))) mounts.push(relative(WEB, p));
    }
  };
  walk(join(WEB, 'app'));
  assert.deepEqual(mounts, ['app/dashboard/[eventId]/layout.tsx'], 'one channel per event, joined by the layout');

  const card = code('app/dashboard/[eventId]/_components/home-cards/home-whos-here-card.tsx');
  assert.equal((card.match(/\.rpc\(/g) ?? []).length, 1, 'the card asks ONE function');
  assert.match(card, /rpc\('event_hub_viewers'/);
  assert.doesNotMatch(card, /setInterval\(|\.channel\(/, 'no poll loop and no channel of its own');
  assert.match(card, /onTabReturn\(/, 'it re-reads when the tab comes back');
  assert.match(card, /team\?\.pulse/, '…and when someone arrives on or leaves the dashboard');
  assert.match(card, /openGuest = SHIPPED_GUEST_CARD\.home/, 'a guest face opens the shipped guest card (a lab alone hands a stand-in)');
  assert.match(card, /open=\{openGuest\}/);
});

test('6 · the words are honest — a failure is never "nobody"', () => {
  assert.equal(hubWords(null, true), 'Couldn’t load who’s viewing');
  assert.equal(hubWords(null, false), 'Event Hub views are switched off');
  assert.equal(teamWords(null, 'joining'), 'Checking who else is here…');
  assert.equal(teamWords([], 'failed'), 'Couldn’t check who else is here');
  assert.equal(teamWords([], 'live'), 'Just you right now');
  const peer = (id: string, name: string, role: TeamPeer['role']): TeamPeer => ({ id, name, role, photo: null });
  assert.equal(teamWords([peer('a', 'Claire', 'Co-host'), peer('b', 'Jen', 'Coordinator')], 'live'), '2 others here now');

  const v: HubViewers = { team: true, may_name: true, window_minutes: 30, guest_total: 7, visitors: 30, guests: [] };
  assert.equal(hubWords(v, true), '7 guests · 30 other visitors · last 30 min');
  assert.equal(hubWords({ ...v, guest_total: 0, visitors: 0 }, true), 'No one opened it in the last 30 minutes');
  assert.equal(hubWords({ ...v, may_name: false, guest_total: 0, visitors: 0 }, true), 'No other visitors in the last 30 minutes', 'a helper without the guest list is not told "no one"');
  assert.equal(parseHubViewers({ team: true }), null, 'a malformed answer is a failure, not an empty one');
  assert.equal(parseHubViewers(null), null);
  assert.deepEqual(parseHubViewers({ ...v, guests: [{ guest_id: 'g1', seen_at: 'now', display_name: 'Tito Ben' }] })?.guests[0]?.display_name, 'Tito Ben');
});

test('6b · the team list: the viewer is not a face, roles are words, and an unchanged sync is the same list', () => {
  const state = {
    me: [{ name: 'Ice Casasola', role: 'Host' as const, photo: null }],
    c: [{ name: 'Claire Reyes', role: 'Co-host' as const, photo: 'https://x/c.jpg' }],
    j: [{ name: 'Jen', role: 'Coordinator' as const, photo: 'r2://not-a-url' }],
  };
  const first = nextTeamPeers([], state, 'me');
  assert.deepEqual(first.map((p) => [p.name, p.role, p.photo]), [['Claire', 'Co-host', 'https://x/c.jpg'], ['Jen', 'Coordinator', null]]);
  assert.equal(nextTeamPeers(first, state, 'me'), first, 'the same list back — no render for nothing');
  assert.notEqual(nextTeamPeers(first, { ...state, k: [{ name: 'Kim', role: 'Helper', photo: null }] }, 'me'), first);
  assert.equal(teamRoleWord({ kind: 'couple' }), 'Host');
  assert.equal(teamRoleWord({ kind: 'seat', coordinator: true, fullCohost: false }), 'Coordinator');
  assert.equal(teamRoleWord({ kind: 'seat', coordinator: false, fullCohost: true }), 'Co-host');
  assert.equal(teamRoleWord({ kind: 'seat', coordinator: false, fullCohost: false }), 'Helper');
});
