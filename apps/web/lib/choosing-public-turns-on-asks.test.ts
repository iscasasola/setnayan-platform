/**
 * 🌐 CHOOSING PUBLIC TURNS ON "ASK TO JOIN" — on the switch, never again.
 *
 * Owner, 2026-09-29 (DECISION_LOG "DISCOVER BUILD — TWO LAST ANSWERS", item 1:
 * *"yes to both"*): switching an event's visibility TO `public` sets
 * `rsvp_ask_config.whoCanRsvp = 'anyone'` ("Accept"); the host can
 * still turn it off afterwards — it is set on the switch, never re-forced on a
 * later save.
 *
 * Held here:
 *   1. the decision — only a move INTO public turns it on; every other key the
 *      couple set rides through; public → public changes nothing;
 *   2. the Maker draft follows, so an older draft cannot switch it back off at
 *      Apply;
 *   3. 🔒 the host's EXPLICIT switch asks the decision, and the Save-the-Date
 *      launch — which also writes 'public' — must NOT (owner 2026-09-29,
 *      DECISION_LOG "PUBLIC EVENTS (PR #6159) — TWO OWNER ANSWERS": "no").
 *      Found by scanning the tree for the write, so a new writer is classified
 *      rather than forgotten.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { rsvpAskConfigOnGoingPublic, readWhoCanRsvp } from './rsvp-ask';
import { draftAskToJoinOnGoingPublic } from './going-public';
import { emptyHubDraft, type HubDraft } from './hub-draft';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');

test('moving INTO public turns on "Accept" and keeps every other choice', () => {
  for (const previousVisibility of ['private', 'unlisted', 'invited_accounts', null]) {
    const next = rsvpAskConfigOnGoingPublic({
      previousVisibility,
      nextVisibility: 'public',
      rawConfig: { meal: false, oneAtATime: true, guestReminders: false, junk: 'dropped' },
    });
    assert.ok(next, `${previousVisibility} → public did not turn requests on`);
    assert.equal(readWhoCanRsvp(next), 'anyone');
    assert.equal(next.meal, false, 'a question the couple switched off was switched back on');
    assert.equal(next.oneAtATime, true);
    assert.equal(next.guestReminders, false);
    assert.ok(!('junk' in next), 'the config is written through the one sanitizer');
  }
  // A never-touched event (NULL config) gets the one key.
  assert.deepEqual(
    rsvpAskConfigOnGoingPublic({ previousVisibility: 'unlisted', nextVisibility: 'public', rawConfig: null }),
    { whoCanRsvp: 'anyone' },
  );
});

test('🔑 a later save of a PUBLIC event never re-forces it — the host may have turned it off', () => {
  assert.equal(
    rsvpAskConfigOnGoingPublic({
      previousVisibility: 'public',
      nextVisibility: 'public',
      rawConfig: { whoCanRsvp: 'guest_list' },
    }),
    null,
  );
});

test('only public turns it on; already-on writes nothing', () => {
  for (const nextVisibility of ['unlisted', 'invited_accounts', 'private']) {
    assert.equal(
      rsvpAskConfigOnGoingPublic({ previousVisibility: 'private', nextVisibility, rawConfig: {} }),
      null,
      `moving to ${nextVisibility} changed who can ask`,
    );
  }
  assert.equal(
    rsvpAskConfigOnGoingPublic({ previousVisibility: 'private', nextVisibility: 'public', rawConfig: { whoCanRsvp: 'anyone' } }),
    null,
  );
});

test('the Maker draft follows the switch — an older draft cannot turn requests back off at Apply', () => {
  const withDraftedAsk: HubDraft = {
    ...emptyHubDraft(),
    events: { rsvp_ask_config: { whoCanRsvp: 'guest_list', note: false } },
  };
  const next = draftAskToJoinOnGoingPublic(withDraftedAsk);
  assert.ok(next);
  assert.deepEqual(next.events.rsvp_ask_config, { whoCanRsvp: 'anyone', note: false });

  // A draft that never touched the RSVP questions has nothing to overwrite the live value with.
  assert.equal(draftAskToJoinOnGoingPublic({ ...emptyHubDraft(), events: { special_message: 'Hi' } } as HubDraft), null);
  assert.equal(draftAskToJoinOnGoingPublic(null), null);
  // Already "Accept" in the draft: nothing to write.
  assert.equal(
    draftAskToJoinOnGoingPublic({ ...emptyHubDraft(), events: { rsvp_ask_config: { whoCanRsvp: 'anyone' } } }),
    null,
  );
});

/** Every .ts/.tsx under app/ and lib/, tests excluded. */
function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('🔒 the explicit switch to Public asks the decision — the Save-the-Date launch never does', () => {
  /* Every write of `landing_page_visibility` whose value is 'public' or a
     variable (the privacy action's validated choice). An INSERT's initial
     visibility (`initialLandingVisibility`) is 'unlisted' or 'private' by its own
     test, never 'public'. Each writer found must be one of the two below — a new
     one fails here until someone decides which it is. */
  const EXPLICIT_SWITCH = join('app', 'dashboard', '[eventId]', 'website', 'privacy', 'actions.ts');
  const STD_LAUNCH = join('lib', 'launch-save-the-date.ts');
  const writers: string[] = [];
  for (const file of [...sources(join(WEB, 'app')), ...sources(join(WEB, 'lib'))]) {
    const src = stripComments(readFileSync(file, 'utf8'));
    if (!/\.update\(/.test(src)) continue;
    if (!/landing_page_visibility:\s*('public'|visibility\b)/.test(src)) continue;
    writers.push(relative(WEB, file));
  }
  // The scan must actually find both known writers — an empty scan proves nothing.
  assert.deepEqual(writers.sort(), [EXPLICIT_SWITCH, STD_LAUNCH].sort(),
    `a writer that can make an event public is unclassified: ${writers.join(', ')}`);

  const action = stripComments(readFileSync(join(WEB, EXPLICIT_SWITCH), 'utf8'));
  assert.match(action, /rsvpAskConfigOnGoingPublic\(/,
    'the explicit switch to Public no longer turns on "Accept"');

  /* ⚖ "no" (owner 2026-09-29): launching a Save-the-Date leaves the RSVP
     setting exactly as it was — it neither reads nor writes it. */
  const launch = stripComments(readFileSync(join(WEB, STD_LAUNCH), 'utf8'));
  assert.doesNotMatch(launch, /rsvp_ask_config|rsvpAskConfigOnGoingPublic|whoCanRsvp/,
    'the Save-the-Date launch must leave rsvp_ask_config untouched');
  for (const caller of [
    join('app', 'dashboard', '[eventId]', 'studio', 'save-the-date', 'actions.ts'),
    join('app', '[slug]', 'page.tsx'),
  ]) {
    const src = stripComments(readFileSync(join(WEB, caller), 'utf8'));
    assert.doesNotMatch(src, /carryAskToJoinIntoDraft/,
      `${caller} carries "Ask to join" into the draft on a Save-the-Date launch`);
  }
});

test('🔒 the Maker panel tells the host, on the switch, that requests turn on', () => {
  const panel = readFileSync(
    join(WEB, 'app', 'dashboard', '[eventId]', 'website', 'editor', '_components', 'media-panels.tsx'),
    'utf8',
  );
  assert.match(panel, /data-public-turns-on-asks/);
  assert.match(panel, /Public turns on &ldquo;Accept&rdquo;/);
});
