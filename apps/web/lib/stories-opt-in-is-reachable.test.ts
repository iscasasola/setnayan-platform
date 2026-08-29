import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
  ============================================================================
  THE STORIES SWITCH MUST REACH EVERY KIND OF DAY — AND MUST NAME THE REAL
  REMEDY WHEN IT WON'T APPEAR
  ============================================================================

  Owner, 2026-08-15: "each event they create will have an editorial not just
  wedding", and on the most intimate kinds: "making it public will be the
  user's decision … so yes." That ruling deleted five `event_type='wedding'`
  filters from the gallery and the sitemap (lib/editorial-event-types.ts holds
  the one remaining home of the kind question).

  🔴 TWO DOORS DID NOT MOVE WITH IT, and a real celebration paid for it: a
  published `date` story on 2026-08-29 whose owner asked why it never reached
  the home page. The editorial editor rendered the "Feature our story in
  Stories" switch behind a wedding-only boolean, and `setStoryShowcase`
  refused a non-wedding opt-in server-side — quoting a filter that no longer
  existed. Fifteen of the sixteen kinds could write and publish a story and
  were never shown the control that lets anyone see it.

  🔑 A GATE WHOSE HANDLE WAS REMOVED IS INVISIBLE FROM BOTH SIDES: the gallery
  looks correctly empty, and the couple looks like somebody who never opted in.

  🔴 AND THE ONE CAVEAT THAT DID RENDER NAMED THE WRONG FIX. It said "Make it
  Public or Unlisted" — while the gallery had been tightened the same
  2026-08-15 to `landing_page_visibility = 'public'`, because "unlisted" is
  what the privacy screen sells as LINK ONLY. Following our own advice left
  you invisible, silently. A caveat that names the wrong remedy is worse than
  no caveat: it gets followed.

  Every assertion below was mutation-checked by restoring the old shape and
  confirming this file goes red.
*/

const WEB = join(import.meta.dirname, '..');
const ACTION = join(WEB, 'app/dashboard/[eventId]/website/editorial/actions.ts');
const EDITOR = join(
  WEB,
  'app/dashboard/[eventId]/website/editorial/_components/editorial-editor.tsx',
);
const EDITOR_PAGE = join(WEB, 'app/dashboard/[eventId]/website/editorial/page.tsx');
const PRIVACY_PAGE = join(WEB, 'app/dashboard/[eventId]/website/privacy/page.tsx');

/**
 * Strip comments before matching. Every file touched here carries a docblock
 * QUOTING the wedding-only test it removed, so a raw scan reports the defect it
 * just fixed — the exact false positive `doors-are-designed.test.ts` records.
 */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const read = (p: string) => codeOnly(readFileSync(p, 'utf8'));

test('the opt-in action asks the KIND module, not a hardcoded wedding test', () => {
  const code = read(ACTION);

  const hardcoded =
    code.match(/event_type[^\n]*!==\s*['"]wedding['"]/g) ??
    code.match(/['"]wedding['"]\s*!==[^\n]*event_type/g) ??
    [];
  assert.equal(
    hardcoded.length,
    0,
    'setStoryShowcase refuses a kind by comparing to "wedding" itself. ' +
      'The kind question has one home (editorialAllowsEventType); a copy here ' +
      'is what outlived the 2026-08-15 ruling for two weeks.',
  );

  assert.match(
    code,
    /editorialAllowsEventType\s*\(/,
    'setStoryShowcase must ask editorialAllowsEventType — otherwise a newly ' +
      'added celebration type inherits nothing and is silently refused.',
  );

  // Fail CLOSED on an unread event: an unknown kind is not a consented one.
  assert.match(
    code,
    /evError\s*\|\|\s*!ev/,
    'an unreadable event must refuse the opt-in, not fall through to the write',
  );
});

test('the editor shows the Stories switch on every kind it is allowed on', () => {
  const code = read(EDITOR);

  assert.equal(
    /\bisWedding\b/.test(code),
    false,
    'the editor still gates the Stories switch on a wedding boolean',
  );
  assert.match(
    code,
    /editorialAllowsEventType\s*\(/,
    'the editor must derive the switch from the kind module',
  );
  assert.match(
    code,
    /\{showcaseKindAllowed\s*\?/,
    'the Stories panel must render behind the derived kind test',
  );

  // The call site must hand over the KIND, not a pre-decided boolean — a
  // boolean computed at a call site is where the old rule hid.
  const page = read(EDITOR_PAGE);
  assert.match(
    page,
    /eventType=\{/,
    'the editorial page must pass the event type through to the editor',
  );
  assert.equal(
    /isWedding=\{/.test(page),
    false,
    'the editorial page still hands the editor a wedding boolean',
  );
});

/**
 * The Stories panel only — NOT the whole file.
 *
 * 🪤 The first cut of this guard scanned the privacy page whole and went red on
 * a sentence that is CORRECT: "Choose Public or Unlisted to let them in", which
 * is about guests reaching a launched Save-the-Date and has nothing to do with
 * the gallery. A guard that cries wolf teaches you to skim past the one time it
 * is right, so the region is cut at the Stories panel's own anchor.
 */
function storiesPanel(file: string, anchor: RegExp): string {
  const code = read(file);
  const at = code.search(anchor);
  assert.ok(at > 0, `could not find the Stories panel in ${file}`);
  return code.slice(at);
}

test('no screen offers "Unlisted" as a way into Stories', () => {
  const panels: Array<[string, string]> = [
    ['editorial editor', storiesPanel(EDITOR, /showcaseKindAllowed\s*\?/)],
    ['privacy page', storiesPanel(PRIVACY_PAGE, /href="\/realstories"/)],
  ];
  for (const [name, panel] of panels) {
    assert.equal(
      /Public or Unlisted/i.test(panel),
      false,
      `the ${name} tells people Unlisted qualifies for Stories. Only ` +
        `landing_page_visibility = 'public' does (lib/showcase-db.ts), and ` +
        `Unlisted is the setting sold as "link only".`,
    );
  }
});

test('the editor states the visibility caveat whether or not the switch is on', () => {
  const code = read(EDITOR);
  // The caveat used to require `featured &&`, so the person who had not yet
  // opted in — the one deciding — was told nothing at all.
  assert.match(
    code,
    /\{landingVisibility !== 'public' \?/,
    'the caveat must depend on the page visibility alone, not on the switch',
  );
});

test('the privacy page never calls a blocked celebration "eligible"', () => {
  const code = read(PRIVACY_PAGE);

  assert.match(
    code,
    /showcaseBlocker/,
    'the privacy page must compute why a consented celebration still cannot ' +
      'appear (visibility, or no address) before printing a green badge',
  );

  // The success wording must sit behind that test, not beside it.
  const idx = code.indexOf('eligible to be featured');
  assert.ok(idx > 0, 'expected the eligible badge wording on the privacy page');
  const before = code.slice(0, idx);
  assert.ok(
    before.lastIndexOf('showcaseBlocker') > before.lastIndexOf('showcaseOptedIn'),
    'the "eligible" badge is not guarded by the blocker test — consent alone ' +
      'is not eligibility, and this page is where the visibility that blocks ' +
      'it was chosen',
  );
});
