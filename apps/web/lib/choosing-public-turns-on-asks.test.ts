/**
 * 🌐 CHOOSING PUBLIC TURNS ON "ASK TO JOIN" — on the switch, never again.
 *
 * Owner, 2026-09-29 (DECISION_LOG "DISCOVER BUILD — TWO LAST ANSWERS", item 1:
 * *"yes to both"*): switching an event's visibility TO `public` sets
 * `rsvp_ask_config.whoCanRsvp = 'anyone'` ("Anyone, I approve"); the host can
 * still turn it off afterwards — it is set on the switch, never re-forced on a
 * later save.
 *
 * Held here:
 *   1. the decision — only a move INTO public turns it on; every other key the
 *      couple set rides through; public → public changes nothing;
 *   2. the Maker draft follows, so an older draft cannot switch it back off at
 *      Apply;
 *   3. 🔒 EVERY writer that can move an event to 'public' asks the decision —
 *      found by scanning the tree for the write, not by listing files, so a new
 *      writer cannot be added beside it and forgotten.
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

test('moving INTO public turns on "Anyone, I approve" and keeps every other choice', () => {
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
  // Already "Anyone, I approve" in the draft: nothing to write.
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

test('🔒 every writer that can make an event PUBLIC asks the decision', () => {
  /* A write of `landing_page_visibility` whose value is 'public', or is a
     variable (the privacy action's validated choice). An INSERT's initial
     visibility (`initialLandingVisibility`) is 'unlisted' or 'private' by its own
     test, never 'public', so it is not a switch INTO public. */
  const writers: string[] = [];
  for (const file of [...sources(join(WEB, 'app')), ...sources(join(WEB, 'lib'))]) {
    const src = stripComments(readFileSync(file, 'utf8'));
    if (!/\.update\(/.test(src)) continue;
    if (!/landing_page_visibility:\s*('public'|visibility\b)/.test(src)) continue;
    writers.push(relative(WEB, file));
    assert.match(
      src,
      /rsvpAskConfigOnGoingPublic\(/,
      `${relative(WEB, file)} can switch an event to public without turning on "Ask to join"`,
    );
  }
  // The scan must actually find the two known writers — an empty scan proves nothing.
  assert.ok(writers.includes(join('app', 'dashboard', '[eventId]', 'website', 'privacy', 'actions.ts')), writers.join(', '));
  assert.ok(writers.includes(join('lib', 'launch-save-the-date.ts')), writers.join(', '));
});

test('🔒 the Maker panel tells the host, on the switch, that requests turn on', () => {
  const panel = readFileSync(
    join(WEB, 'app', 'dashboard', '[eventId]', 'website', 'editor', '_components', 'media-panels.tsx'),
    'utf8',
  );
  assert.match(panel, /data-public-turns-on-asks/);
  assert.match(panel, /Public turns on &ldquo;Anyone, I approve&rdquo;/);
});
