/**
 * the-theme-is-drafted.test.ts — the theme is a Maker edit like any other
 * (owner 2026-09-28: *"we want the theme picker to be there actively
 * editable"*): a pick goes into the DRAFT, Undo steps it back, and Apply puts
 * it live — Classic free, every other theme Event Hub Pro, weddings only.
 *
 * The draft's rules are pure (`lib/hub-draft.ts`) and exercised as functions.
 * Apply's write is read as source, because its whole claim is ORDER: the theme
 * has no session UPDATE grant (20271219583821), so it must leave the session
 * patch, and its own admin write must sit after the host check, the Pro gate
 * and the wedding fence, and must count the rows it changed.
 *
 * 🛡 MUTATION-CHECKED: theme left in the session patch → RED; Pro theme
 * classed free → RED; alias accepted by the sanitizer → RED; row count dropped
 * from the admin write → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import {
  HUB_DRAFT_EVENT_LABEL,
  HUB_DRAFT_LOOK_COLUMNS,
  emptyHubDraft,
  mergeHubDraft,
  overlayHubDraftEvent,
  planHubDraftApply,
  sanitizeHubDraftEventValue,
  undoHubDraft,
  type HubLiveState,
} from './hub-draft';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const live = (invite_theme: string | null): HubLiveState => ({ events: { invite_theme }, widgets: [] });
const pickTheme = (id: string) => mergeHubDraft(emptyHubDraft(), { events: { invite_theme: id } });

test('the draft holds only a live id of a shipped theme', () => {
  assert.equal(sanitizeHubDraftEventValue('invite_theme', 'vintage'), 'vintage');
  assert.equal(sanitizeHubDraftEventValue('invite_theme', 'house'), 'house');
  assert.equal(sanitizeHubDraftEventValue('invite_theme', 'capiz'), undefined, 'a retired alias is never written');
  assert.equal(sanitizeHubDraftEventValue('invite_theme', 'VINTAGE'), undefined);
  assert.equal(sanitizeHubDraftEventValue('invite_theme', 42), undefined);
  assert.equal(HUB_DRAFT_EVENT_LABEL.invite_theme, 'Your theme');
  // The host canvas re-dresses itself whenever the draft holds a theme.
  assert.ok((HUB_DRAFT_LOOK_COLUMNS as readonly string[]).includes('invite_theme'));
});

test('a pick is seen on the host canvas, and Undo takes it back', () => {
  const d = pickTheme('vintage');
  assert.equal(overlayHubDraftEvent({ invite_theme: 'house' }, d).invite_theme, 'vintage');
  const undone = undoHubDraft(d);
  assert.equal(overlayHubDraftEvent({ invite_theme: 'house' }, undone).invite_theme, 'house');
});

test('a Pro theme is held without Pro; a free one (Classic, Modern, Cyber Neon) applies — and going back is always free', () => {
  // Owner 2026-09-29, "Okay use modern and cyber FREE": they apply like Classic.
  for (const free of ['galeriya', 'cyber']) {
    const plan = planHubDraftApply(pickTheme(free), live('house'), false);
    assert.equal(plan.apply.length, 1, `${free} was held for Pro at Apply`);
    assert.equal(plan.refused.length, 0);
  }

  const toPro = planHubDraftApply(pickTheme('vintage'), live('house'), false);
  assert.equal(toPro.apply.length, 0);
  assert.equal(toPro.refused.length, 1, 'a Pro theme went live without Event Hub Pro');
  assert.equal(toPro.remaining.events.invite_theme, 'vintage', 'the held theme left the draft');

  const owned = planHubDraftApply(pickTheme('vintage'), live('house'), true);
  assert.equal(owned.apply.length, 1, 'an owning couple could not apply their theme');

  const back = planHubDraftApply(pickTheme('house'), live('vintage'), false);
  assert.equal(back.apply.length, 1, 'going back to Classic was held');
  assert.equal(back.refused.length, 0);

  // Never chosen and Classic are the same page; a retired id is its alias.
  assert.equal(planHubDraftApply(pickTheme('house'), live(null), false).apply.length, 0);
  assert.equal(planHubDraftApply(pickTheme('vintage'), live('capiz'), false).apply.length, 0);
  assert.equal(planHubDraftApply(pickTheme('vintage'), live('capiz'), false).refused.length, 0);
});

test('Apply writes the theme on its own — after the host check, the Pro gate and the fence — and counts the row', () => {
  const src = read('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  const host = src.indexOf('await requireHostMembershipOrThrow(eventId');
  const gate = src.indexOf('planHubDraftApply(current, live, ownsPro)');
  const fence = src.indexOf('resolveWeddingOnlyParts(p).save_the_date_film');
  const peel = src.indexOf('delete eventsPatch.invite_theme;');
  const session = src.indexOf(".from('events')\n        .update(eventsPatch)");
  const write = src.indexOf('.update({ invite_theme: themeWrite })');
  for (const [name, at] of Object.entries({ host, gate, fence, peel, session, write })) {
    assert.ok(at > 0, `${name} is gone — re-anchor this guard`);
  }
  assert.ok(host < gate && gate < fence && fence < write, 'the theme is written before it is allowed');
  assert.ok(peel < session, 'the theme rides the session UPDATE, which has no grant for it — every column would be refused');
  const tail = src.slice(write, write + 400);
  assert.match(tail, /\.eq\('event_id', eventId\)\s*\.select\('event_id'\)/, 'the theme write does not ask for its row back');
  assert.match(tail, /themeRows\.length === 0/, 'a zero-row theme write would report success');
  assert.match(src, /createAdminClient\(\)\s*\.from\('events'\)\s*\.update\(\{ invite_theme: themeWrite \}\)/);
  // A Pro theme on a celebration that may not wear one is held, never written.
  assert.match(src, /held\.push\(\{ item, reason: 'not_for_this_celebration' \}\)/);
  assert.match(src, /resolveWeddingOnlyParts\(p\)\.save_the_date_film\)\s*\.catch\(\(\) => false\)/, 'an unreadable profile opens a paid theme');
});
