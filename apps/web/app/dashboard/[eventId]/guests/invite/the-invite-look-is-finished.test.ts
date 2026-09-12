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
import { WEBSITE_PRO_ITEMS } from '@/lib/website-pro-items';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const PICKER = 'app/dashboard/[eventId]/guests/invite/_components/invite-theme-picker.tsx';
const PAGE = 'app/dashboard/[eventId]/guests/invite/page.tsx';
const ACTIONS = 'app/dashboard/[eventId]/guests/invite/actions.ts';

/* ══════════════════════════════════════════════════════════════════════════
   1 · WHERE TO CHANGE THE LOOK
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * THE THREE ARE THREE DIFFERENT PAGES, WHICH IS THE WHOLE PROBLEM. The picker
 * described a background, a colour and (since Q2) a button colour, and pointed
 * at none of them — so the only way to change how the invite looks was to
 * already know which other page owned which.
 *
 * Each destination is checked to EXIST on disk as well as to be linked: a link
 * to a route that has been moved is a 404 dressed as help, and this repo has
 * shipped exactly that.
 */
const LOOK_LINKS: ReadonlyArray<{ what: string; href: string; route: string }> = [
  {
    what: 'the reveal background the Pro themes are painted on (events.std_background)',
    href: '/studio/save-the-date',
    route: 'app/dashboard/[eventId]/studio/save-the-date/page.tsx',
  },
  {
    what: 'the mark and its colour (events.monogram_text / monogram_color)',
    href: '/invitation',
    route: 'app/dashboard/[eventId]/invitation/page.tsx',
  },
  {
    what: 'the button colour (events.site_button_color — Q2 made this a SECOND colour)',
    href: '/website/colors',
    route: 'app/dashboard/[eventId]/website/colors/page.tsx',
  },
];

test('the picker links each thing it names to the page that owns it', () => {
  const src = read(PICKER);
  for (const { what, href, route } of LOOK_LINKS) {
    assert.match(
      src,
      new RegExp(`href=\\{\`/dashboard/\\$\\{eventId\\}${href.replace(/\//g, '\\/')}\``),
      `the picker names ${what} but does not link it — a couple is told what their ` +
        'invite shows and left to find the page themselves',
    );
    assert.ok(existsSync(join(WEB, route)), `${href} is linked but ${route} does not exist — a dead link dressed as help`);
  }
});

test('the sentence still reads as a sentence — the links are IN the copy, not a row of buttons', () => {
  const src = read(PICKER);
  assert.match(
    src,
    /What guests see when they open your link\. It opens on your\b/,
    'the opening sentence was rewritten — it is the one line a couple reads here, and ' +
      'the owner’s own framing ("it opens on your reveal background, in your colour")',
  );
  // Anti-vacuity: three links, not one reused three times.
  const hrefs = [...src.matchAll(/href=\{`\/dashboard\/\$\{eventId\}([^`]*)`\}/g)].map((m) => m[1]);
  for (const { href } of LOOK_LINKS) {
    assert.ok(hrefs.includes(href), `${href} is missing from the picker’s links`);
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   2 · THE EIGHTH PRO ITEM (Q3 = A)
   ══════════════════════════════════════════════════════════════════════════ */

const INVITE_ITEM = 'Invite link theme';

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
  const resolver = read('lib/event-hub-pro.ts');
  const pitch = new RegExp(`'${INVITE_ITEM}': \\{\\s*headline: '([^']*)',\\s*blurb:\\s*'([^']*)'`);
  const m = pitch.exec(resolver);
  assert.ok(m, `${INVITE_ITEM} has no headline/blurb — PITCH is a total Record, so this is a compile error too, ` +
    'but the SHAPE of the copy is what a couple reads');
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
      /\bsevens?\b/i,
      `${rel} still says "seven" about a list of ${WEBSITE_PRO_ITEMS.length}`,
    );
  }
  assert.match(read('lib/event-hub-pro.ts'), /ctaLabel: 'Unlock all eight'/, 'the one button says the wrong number');
  assert.match(
    read('app/dashboard/[eventId]/website/editor/_components/pro-panels.tsx'),
    /One unlock covers all eight:/,
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
      /(seven Pro items|for all seven)/,
      `${rel} still says "seven" about a list of ${WEBSITE_PRO_ITEMS.length}`,
    );
    assert.match(raw, /(eight Pro items|for all eight)/, `${rel} stopped naming the count at all`);
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
   3 · WEDDINGS ONLY (Q7 = A) — the picker offers it, the action refuses it
   ══════════════════════════════════════════════════════════════════════════ */

test('the picker MEASURES the fence and hands it down — it is never assumed', () => {
  const page = read(PAGE);
  assert.match(
    page,
    /resolveWeddingOnlyParts\(p\)\.save_the_date_film/,
    'the page no longer asks the reveal’s own fence',
  );
  /*
    🪤 ANCHORED TO THIS CHAIN, NOT TO THE FILE. This page holds TWO
    `.catch(() => false)` — the ownership read has one too — and a bare match on
    the string was satisfied by the OTHER one: the sabotage that turns THIS
    fallback into `true` left the guard green. Measured, then narrowed.
  */
  assert.match(
    page,
    /resolveWeddingOnlyParts\(p\)\.save_the_date_film\)\s*\.catch\(\(\) => false\)/,
    'an unreadable profile must fall to the free door, not open a paid one',
  );
  assert.match(page, /mayShowStdFilm=\{mayShowStdFilm\}/, 'the answer is measured and then not passed');
  const picker = read(PICKER);
  assert.match(picker, /pickableInviteThemes\(\{ mayShowStdFilm \}\)/, 'the picker offers themes without asking the fence');
});

test('🔒 the SAVE refuses a Pro theme there — after the couple check, before the write', () => {
  /*
    The picker hiding a radio is a courtesy; a crafted post is not. The order is
    the claim: an auth check that runs after the write protects nothing, and the
    fence must precede the write for the same reason. `themes-stay-skins.test.ts`
    pins couple → ownership → write; this adds the wedding fence to that spine
    WITHOUT restating the other two.
  */
  const src = read(ACTIONS);
  const start = src.indexOf('export async function setInviteTheme(');
  assert.notEqual(start, -1, 'setInviteTheme is gone or renamed');
  const body = src.slice(start);
  const couple = body.indexOf('assertCouple(eventId)');
  const fence = body.indexOf('resolveWeddingOnlyParts(');
  const refusal = body.indexOf('if (!mayShowStdFilm) redirect(');
  const write = body.indexOf('.update({ invite_theme');
  assert.ok(couple > -1, 'the couple check is gone');
  assert.ok(fence > -1, 'setInviteTheme does not ask whether this celebration may have a Pro theme at all');
  assert.ok(refusal > -1, 'the fence is measured and then not acted on');
  assert.ok(couple < fence, 'the fence runs before the caller is known to be the couple');
  assert.ok(refusal < write, 'a Pro theme could be written onto a celebration that can never show it');
  assert.match(
    body,
    /resolveWeddingOnlyParts\(p\)\.save_the_date_film\)\s*\.catch\(\(\) => false\)/,
    'a refused profile read must refuse the save — an unmeasured type is not a wedding',
  );
});

test('the DOOR asks the fence too — the only one that protects an already-saved value', () => {
  /*
    The picker refusing and the action refusing both act BEFORE a write. Neither
    can help a couple who saved Capiz as a wedding and then had the celebration's
    type changed — the row is already there. This read is the one that turns it
    back into House with no write, and it is the one a guest actually meets.
  */
  const look = read('app/[slug]/invite/_lib/load-invite-look.ts');
  assert.match(look, /resolveWeddingOnlyParts\(p\)\.save_the_date_film/, 'the door no longer asks the fence');
  assert.match(
    look,
    /resolveWeddingOnlyParts\(p\)\.save_the_date_film\)\s*\.catch\(\(\) => false\)/,
    'an unreadable profile opens a paid theme on the door — an unmeasured type is not a wedding',
  );
  assert.match(
    look,
    /resolveInviteTheme\(\{ saved, ownsPro, mayShowStdFilm \}\)/,
    'the measurement is taken and then not used',
  );
  // …and it costs a House event nothing: both reads sit behind `wantsPro`.
  assert.match(look, /\? await Promise\.all\(\[/, 'the fence read is no longer skipped for a House event');
});

test('the fence is the reveal’s, not a second copy of it', () => {
  // 🛑 The reveal's WHEN is one rule (cinematicRevealPlays). Nothing here may
  // restate it: this is the TYPE question, asked of the same profile answer.
  for (const rel of [ACTIONS, PAGE, 'app/[slug]/invite/_lib/load-invite-look.ts']) {
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
  const COLUMNS = /export const INVITE_LOOK_COLUMNS =\s*\n?\s*'([^']*)'/.exec(
    read('app/[slug]/invite/_lib/load-invite-look.ts'),
  );
  assert.ok(COLUMNS, 'INVITE_LOOK_COLUMNS is gone or reshaped');
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

test('🔑 setInviteTheme counts the rows it wrote — a zero-row UPDATE is not a save', () => {
  /*
    A PostgREST UPDATE matching ZERO rows returns NO error. Without `.select()`
    the action cannot tell a real write from a write that hit nothing, so it
    redirected to `?theme=saved` and the couple was told their invite link now
    opens in a look that was never stored. Success and silence rendered
    identically.

    The sibling `regenerateInviteQr` IN THIS SAME FILE already counted rows; this
    pins that `setInviteTheme` does too, and that the count is what decides.
  */
  const src = read(ACTIONS);
  const start = src.indexOf('export async function setInviteTheme(');
  assert.notEqual(start, -1, 'setInviteTheme is gone or renamed');
  const body = src.slice(start);

  const write = body.indexOf('.update({ invite_theme');
  assert.ok(write > -1, 'the theme write is gone or reshaped');
  // The window is the write's own chain and the decision that follows it — not
  // the whole file, where `regenerateInviteQr`'s correct row-count would satisfy
  // every one of these on its own.
  const tail = body.slice(write);

  assert.match(
    tail,
    /\.update\(\{ invite_theme: theme \}\)\s*\.eq\('event_id', eventId\)\s*\.select\(/,
    'the theme UPDATE does not ask for the rows back — a zero-row write is indistinguishable from a save',
  );
  assert.match(
    tail,
    /data\.length === 0/,
    'the rows come back and are never counted',
  );
  assert.match(
    tail,
    /if \(error \|\| !data \|\| data\.length === 0\) \{\s*redirect\(`\/dashboard\/\$\{eventId\}\/guests\/invite\?theme=error`\)/,
    'a write that changed nothing must not redirect to ?theme=saved',
  );
  // …and the happy path is still reachable, so the assertions above are not
  // satisfied by an action that can only ever fail.
  assert.match(tail, /\?theme=saved`\)/, 'the successful save no longer reports itself');
});

test('🔑 a failed save SAYS so on screen — ?theme=error is rendered, not just redirected to', () => {
  /*
    `setInviteTheme` has redirected to `?theme=error` since it shipped, and the
    picker rendered a banner for `saved` and NOTHING for `error`. So a refusal
    came back as a plain page: same radio, same copy, no banner — which reads as
    "my click did not register", and invites the couple to press Save again into
    the same failure. A log line never changed a pixel; the measurement has to
    reach the render.
  */
  const picker = read(PICKER);
  assert.match(picker, /notice === 'saved'/, 'the picker no longer renders the successful save');
  assert.match(picker, /notice === 'error'/, 'a refused save renders nothing — it looks exactly like a page reload');
  assert.match(picker, /role="alert"/, 'the failure is drawn, but not announced as a failure');
  // The words a couple actually reads must not claim the look changed.
  const errorBlock = picker.slice(picker.indexOf("notice === 'error'"));
  assert.match(
    errorBlock,
    /didn’t save/,
    'the failure banner does not say the save failed',
  );

  // …and the page must actually hand both outcomes over. A picker that can draw
  // the alert is worth nothing if the prop is always null.
  const page = read(PAGE);
  assert.match(
    page,
    /notice=\{search\.theme === 'saved' \? 'saved' : search\.theme === 'error' \? 'error' : null\}/,
    'the page drops one of the two outcomes on its way to the picker',
  );
});
