/**
 * the-invite-look-is-finished.test.ts — the couple can find the look, and the
 * app counts what it sells.
 *
 * Three of the owner's 2026-09-11 answers land on this one page and the list
 * behind it:
 *   · (no decision needed) the picker names three things and now LINKS each to
 *     the page that owns it;
 *   · Q3 = A — the invite theme is the EIGHTH Event Hub Pro item;
 *   · Q7 = A — Pro themes are offered, and saved, only where the event type may
 *     carry the Save-the-Date film.
 *
 * 🛡 MUTATION-CHECKED. Each rule was broken on purpose and this file confirmed
 * RED before being trusted.
 *
 * ⚠ IT READS SOURCE RATHER THAN RENDERING. These are server components and a
 * server action; what is being defended is that the sentence carries a link and
 * that the refusal sits before the write, both of which are properties of the
 * file. The parts that CAN be exercised as functions are, in
 * `lib/invite-themes.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { PRO_THEMES_ITEM, WEBSITE_PRO_ITEMS } from '@/lib/website-pro-items';
import { hubProPitchFor } from '@/lib/event-hub-pro';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const PICKER = 'app/dashboard/[eventId]/guests/invite/_components/invite-theme-picker.tsx';
// 🎨 The theme is chosen here since 2026-09-28, drafted and applied by the one draft action.
const MAKER_PICKER = 'app/dashboard/[eventId]/launch/_components/maker-theme-picker.tsx';
const LAUNCH = 'app/dashboard/[eventId]/launch/page.tsx';
const APPLY = 'app/dashboard/[eventId]/website/hub-draft-actions.ts';
const PAGE = 'app/dashboard/[eventId]/guests/invite/page.tsx';
// 🪤 The invite page's reads and markup MOVED (2026-09-21) into a panel both
// doors render — the invite page and the guest list's Share the link tab. The
// assertions that were about what the page COMPUTES now read the panel; the
// ones about what reaches the picker read every door that renders it.
const PANEL = 'app/dashboard/[eventId]/guests/invite/_components/invite-panel.tsx';
const GUESTS = 'app/dashboard/[eventId]/guests/page.tsx';
const ACTIONS = 'app/dashboard/[eventId]/guests/invite/actions.ts';

/* ══════════════════════════════════════════════════════════════════════════
   1 · WHERE THE LOOK IS CHOSEN — MOVED (owner 2026-09-28)
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * 🪤 RE-ANCHORED 2026-09-28. This section held the Guest list picker's
 * sentence, which linked the reveal background, the mark colour and the button
 * colour. The owner moved the theme choice out of the Guest list and into Event
 * Hub Maker → Details (*"it should not be inside guestlist, it should be on
 * event hub maker on details"*), where each theme is shown as the couple's own
 * page — so the page itself shows the background, the mark and the button, and
 * the sentence that described them from afar is gone with the picker. What the
 * Guest list keeps is one line and one link, held by
 * `../the-guest-list-holds-no-theme-picker.test.ts`.
 */
test('the Guest list points at the one place the theme is chosen', () => {
  const panel = read(PANEL);
  assert.match(panel, /href=\{`\/dashboard\/\$\{eventId\}\/launch\?tool=details&item=theme`\}/);
  assert.ok(!existsSync(join(WEB, PICKER)), 'the Guest list picker is back');
  assert.ok(existsSync(join(WEB, MAKER_PICKER)), 'the Maker picker is gone — the theme can be chosen nowhere');
});

/* ══════════════════════════════════════════════════════════════════════════
   2 · THE EIGHTH PRO ITEM (Q3 = A)
   ══════════════════════════════════════════════════════════════════════════ */

// The count is the registry's (owner 2026-09-29: Modern and Cyber Neon went
// free), so the item is read, never typed here.
const INVITE_ITEM = PRO_THEMES_ITEM;

test('the invite theme is one of the Pro items, and the list is the only copy of it', () => {
  assert.ok(WEBSITE_PRO_ITEMS.length >= 8, 'the Pro item list scanned short — the import may be resolving empty');
  assert.ok(
    (WEBSITE_PRO_ITEMS as readonly string[]).includes(INVITE_ITEM),
    'Event Hub Pro withholds the invite link’s theme from non-buyers ' +
      '(app/[slug]/invite/_lib/load-invite-look.ts gates it) and no longer names it',
  );
  // It is a LIST, not a second list: the controller and the editor both read it.
  assert.match(read('lib/event-hub-pro.ts'), /WEBSITE_PRO_ITEMS/);
  assert.match(
    read('app/dashboard/[eventId]/website/editor/_components/pro-panels.tsx'),
    /from '@\/lib\/website-pro-items'/,
  );
});

test('the eighth item has copy of its own, grounded in what ships', () => {
  // Read EXECUTED, not by regex over the source: the blurb names the Pro themes
  // from the registry (a template string), so the source no longer holds it.
  const pitch = hubProPitchFor(INVITE_ITEM);
  assert.ok(pitch, `${INVITE_ITEM} has no headline/blurb — PITCH is a total Record, so this is a compile error too, ` +
    'but the SHAPE of the copy is what a couple reads');
  const m = [null, pitch.headline, pitch.blurb] as const;
  assert.ok(m[1]!.length > 10 && m[1]!.endsWith('.'), 'the headline is one short sentence, ending in a full stop');
  assert.ok(m[2]!.length > 60, 'the blurb is too short to say anything');
  // ⛔ NO PRICE, EVER, IN THE RENDER PATH — the figure is read live from
  // platform_retail_catalog_v2. Three figures for one product once lived in one file.
  assert.doesNotMatch(m[2]!, /₱|\d{3,}/, 'a price or a count was written into the copy');
  assert.doesNotMatch(
    m[2]!,
    /\b(four|five|4|5)\s+themes?\b/i,
    'the copy counts the themes — there were three ready skins the day it was written and ' +
      'there will be five when sessions 2–4 land. A number in copy is the thing that rots.',
  );
});

test('nothing still calls them "the seven"', () => {
  /*
    🔑 THE COUNT LIVES IN FIVE PLACES AND ONLY ONE OF THEM IS THE ARRAY. The
    others are sentences — including one a couple READS ("One unlock covers all
    …") and one they PRESS ("Unlock all …"). A list that grew while its sentences
    did not is a product describing itself wrongly, and every one of these files
    passes its own suite either way.
  */
  const SPEAKS_FOR_THE_LIST = [
    'lib/website-pro-items.ts',
    'lib/event-hub-pro.ts',
    'app/dashboard/[eventId]/website/editor/_components/pro-panels.tsx',
  ];
  for (const rel of SPEAKS_FOR_THE_LIST) {
    const src = read(rel);
    assert.ok(src.length > 200, `${rel} scanned nearly empty — the guard is looking at nothing`);
    assert.doesNotMatch(
      src,
      /\b(sevens?|eights?)\b/i,
      `${rel} still says an old count about a list of ${WEBSITE_PRO_ITEMS.length}`,
    );
  }
  // Nine since 2026-09-24 — the animated logo joined (owner "A then"). Ten on
  // 2026-09-28 — the Pro QR joined ("Your logo on every QR code") — and nine
  // again the same day: the free-vs-Pro redraw took both colours off the list
  // and put "Photo and video backgrounds" on it.
  assert.equal(WEBSITE_PRO_ITEMS.length, 9, 'the list and the sentences below disagree on the count');
  assert.match(read('lib/event-hub-pro.ts'), /ctaLabel: 'Unlock all nine'/, 'the one button says the wrong number');
  assert.match(
    read('app/dashboard/[eventId]/website/editor/_components/pro-panels.tsx'),
    /One unlock covers all nine:/,
    'the editor tells the couple the wrong number',
  );

  /*
    🪤 AND TWO MORE THE SWEEP ABOVE COULD NOT SEE. `read()` STRIPS COMMENTS, and
    the remaining stale counts were both comments — one in the controller's
    docblock ("the seven Pro items are ONE purchase"), one beside the rail's own
    CTA ("One CTA for all seven"). Neither renders, so neither could fail a test;
    the sweep that was written to catch "seven" was reading source with exactly
    that text removed. These two are read RAW.
  */
  for (const rel of [
    'app/dashboard/[eventId]/launch/page.tsx',
    'app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx',
  ]) {
    const raw = readFileSync(join(WEB, rel), 'utf8');
    assert.ok(raw.length > 200, `${rel} scanned nearly empty — the guard is looking at nothing`);
    assert.doesNotMatch(
      raw,
      /(seven Pro items|for all seven|eight Pro items|for all eight|ten Pro items|for all ten)/,
      `${rel} still says an old count about a list of ${WEBSITE_PRO_ITEMS.length}`,
    );
    assert.match(raw, /(nine Pro items|for all nine)/, `${rel} stopped naming the count at all`);
  }
});

test('the buy page already names the invite link — and must keep naming it', () => {
  // says-what-it-includes.test.ts holds the harder claim (a benefit may only name
  // something a non-buyer is actually refused). This is the other direction: the
  // inclusion is now one of the eight, so the sentence may not quietly go away.
  const benefits = /const BENEFITS = \[([\s\S]*?)\];/.exec(
    read('app/dashboard/[eventId]/studio/website-pro/page.tsx'),
  );
  assert.ok(benefits, 'BENEFITS not found — the scan is blind');
  assert.match(benefits[1]!, /invite link/i, 'the buy page stopped naming the one thing the eighth item is');
});

/* ══════════════════════════════════════════════════════════════════════════
   3 · EVERY EVENT TYPE (DECISION_LOG 2026-10-01 "PRO THEMES OPEN TO EVERY EVENT
   TYPE (STILL PRO)") — the wedding-only fence (Q7 = A) is retired everywhere
   ══════════════════════════════════════════════════════════════════════════ */

test('the picker is handed every theme — no event-type fence is asked', () => {
  // The Maker page still reads `mayShowStdFilm` for the Save-the-Date film's own
  // venue field; the THEME rule takes no event type.
  const page = read(LAUNCH);
  assert.match(page, /const themes = pickableInviteThemes\(\);/);
  assert.match(page, /theme=\{\{\s*themes: themes\.map\(/, 'the list is built and then not passed');
  assert.doesNotMatch(page, /pickableInviteThemes\(\{/, 'the picker is being fenced again');
});

test('🔒 APPLY still checks the host and the Pro gate before the theme write — and no longer the event type', () => {
  const src = read(APPLY);
  const host = src.indexOf('requireHostMembershipOrThrow(eventId');
  const write = src.indexOf('.update({ invite_theme');
  assert.ok(host > -1 && write > host, 'the host check must come before the theme write');
  assert.doesNotMatch(src, /resolveWeddingOnlyParts|not_for_this_celebration/, 'a birthday is being refused a Pro theme again');
});

test('the DOOR asks only for Pro — the one rule that protects an already-saved value', () => {
  // The resolution lives in `app/[slug]/_lib/hub-look.ts` (the invite door and
  // the Event Hub pages share it). A lapse of Event Hub Pro turns a saved Pro
  // theme back into House with no write; the event type is not part of it.
  const look = read('app/[slug]/_lib/hub-look.ts');
  assert.match(look, /resolveInviteTheme\(\{ saved, ownsPro \}\)/);
  assert.doesNotMatch(look, /resolveWeddingOnlyParts|proThemeGate/, 'the resolver asks the wedding fence again');
  // …and it costs a House event nothing: the ownership read sits behind `wantsPro`.
  assert.match(look, /wantsPro \? await websiteProActiveFor\(event\.event_id\)/);
});

test('the theme rule is not a second copy of the reveal’s timing', () => {
  // 🛑 The reveal's WHEN is one rule (cinematicRevealPlays). Nothing here may
  // restate it: this is the TYPE question, asked of the same profile answer.
  for (const rel of [ACTIONS, PAGE, 'app/[slug]/invite/_lib/load-invite-look.ts', 'app/[slug]/_lib/hub-look.ts']) {
    const src = read(rel);
    assert.doesNotMatch(src, /cinematicRevealPlays|getLifecyclePhase/, `${rel} is re-deriving WHEN a reveal plays`);
    assert.doesNotMatch(src, /event_type === 'wedding'|=== 'wedding'/, `${rel} hardcodes the event type instead of asking the profile`);
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   4 · ONE SELECT STRING, ONE COLUMN
   ══════════════════════════════════════════════════════════════════════════ */

test('no invite door names a look column twice in its own select', () => {
  /*
    `INVITE_LOOK_COLUMNS` is interpolated into three `.select()` calls, and it
    now carries `event_type` and `site_button_color`. Two of those doors used to
    name `event_type` themselves; leaving it there would hand Postgrest the same
    column twice. This is a silent-shape defect — nothing throws locally — so it
    is pinned rather than remembered.
  */
  /*
    🪤 `INVITE_LOOK_COLUMNS` IS NOW A RE-EXPORT of `HUB_LOOK_COLUMNS` — the same
    string, not a copy, because the Event Hub pages need the identical set. The
    literal lives in `hub-look.ts`, so that is where this reads it; the
    re-export is asserted separately below so a silent rename cannot leave the
    three doors importing nothing.
  */
  const COLUMNS = /export const HUB_LOOK_COLUMNS =\s*\n?\s*'([^']*)'/.exec(
    read('app/[slug]/_lib/hub-look.ts'),
  );
  assert.ok(COLUMNS, 'HUB_LOOK_COLUMNS is gone or reshaped');
  assert.match(
    read('app/[slug]/invite/_lib/load-invite-look.ts'),
    /export const INVITE_LOOK_COLUMNS = HUB_LOOK_COLUMNS;/,
    'the doors\' own name no longer points at the one column list',
  );
  const carried = COLUMNS[1]!.split(',').map((c) => c.trim());
  assert.ok(carried.length >= 6, `the column list scanned as ${carried.length} — the guard is looking at nothing`);

  const DOORS = [
    'app/[slug]/invite/page.tsx',
    'app/[slug]/invite/reply/page.tsx',
    'app/[slug]/invite/enter/page.tsx',
  ];
  for (const rel of DOORS) {
    const src = read(rel);
    const select = /\.select\(\s*`([^`]*)`/.exec(src);
    assert.ok(select, `${rel} no longer builds its event select from a template string`);
    assert.match(select[1]!, /\$\{INVITE_LOOK_COLUMNS\}/, `${rel} stopped interpolating the shared column list`);
    const own = select[1]!.replace('${INVITE_LOOK_COLUMNS}', '').split(',').map((c) => c.trim());
    for (const col of carried) {
      assert.ok(
        !own.includes(col),
        `${rel} names "${col}" itself AND through INVITE_LOOK_COLUMNS — one select, the same column twice`,
      );
    }
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   5 · THE SAVE MUST PROVE A ROW CHANGED
   ══════════════════════════════════════════════════════════════════════════ */

test('🔑 the theme write counts the rows it wrote — a zero-row UPDATE is not a save', () => {
  /*
    A PostgREST UPDATE matching ZERO rows returns NO error. Without `.select()`
    the writer cannot tell a real write from a write that hit nothing. Since
    2026-09-28 the one writer is Apply (`hub-draft-actions.ts`).
  */
  const src = read(APPLY);
  const write = src.indexOf('.update({ invite_theme');
  assert.ok(write > -1, 'the theme write is gone or reshaped');
  const tail = src.slice(write);
  assert.match(
    tail,
    /\.update\(\{ invite_theme: themeWrite \}\)\s*\.eq\('event_id', eventId\)\s*\.select\(/,
    'the theme UPDATE does not ask for the rows back — a zero-row write is indistinguishable from a save',
  );
  assert.match(tail, /themeRows\.length === 0/, 'the rows come back and are never counted');
});

test('🔑 a failed pick SAYS so on screen, and the tile goes back', () => {
  /*
    A refused save must reach the render: the picker shows the draft action's
    own error and puts the selection back — a log line never changed a pixel.
  */
  const picker = read(MAKER_PICKER);
  assert.match(picker, /role="alert"/, 'a refused pick renders nothing');
  assert.match(picker, /if \(!r\.ok\) \{\s*setPicked\(before\);\s*setError\(r\.error\);/, 'a refused pick keeps showing the theme that did not take');
});
