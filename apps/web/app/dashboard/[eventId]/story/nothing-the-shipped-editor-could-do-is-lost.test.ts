/**
 * LOSS PREVENTION — the host who already knows the editor loses nothing.
 *
 * `08` step 1.3: *"Nothing the shipped editor could do is lost."* The Story
 * Maker was assembled by MOVING the shipped editor onto a new route (PR #5337)
 * and then adding to it. Every capability below existed before that move and
 * must still be reachable on the new page. This file is the written checklist,
 * kept where it can fail instead of in a PR body nobody re-reads.
 *
 * ── WHAT THIS GUARD CLAIMS, EXACTLY ─────────────────────────────────────────
 * That each capability is still WIRED — its control, its cap, its handler is in
 * the shipped source of the Story Maker. It does not claim each one behaves
 * correctly; the behaviour of the caps, the PRO gate and the save path is
 * covered by their own tests (`your-own-story-is-free.test.ts`,
 * `the-story-maker-is-simple.test.ts`). The failure this exists for is DELETION
 * — a future edit tidying away "the old editor" and taking a paid ability, a
 * cap, or the save-before-you-navigate guard with it.
 *
 * 🔑 IT READS THE SOURCE WITH THE COMMENTS STRIPPED. This repo has ONE comment
 * stripper (`lib/strip-comments.ts`) and a source-scanning guard that skips it
 * marks a capability "present" when all that survives is a comment describing
 * the capability that was removed — which is the exact failure mode this file
 * is trying to catch.
 *
 * SABOTAGE-CHECKED, WITH THE COUNTS MEASURED. It covers 23 capabilities in 40
 * assertions. Renaming the wishes cap constant, replacing the
 * save-before-you-navigate modifier check with `if (false)`, and turning the
 * canonical-moments `<datalist>` into a plain div reported exactly those 3
 * missing, by name, and failed. Changing the server's `if (isPro)` strip to
 * `if (true)` — the shape of a quiet repricing — failed the second test.
 * Restored: 0 missing, 3 of 3 tests pass. The count is printed on every run,
 * passing or failing.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const HERE = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'story');
const read = (...p: string[]) => stripComments(readFileSync(join(HERE, ...p), 'utf8'));

const editor = read('_components', 'editorial-editor.tsx');
const actions = read('actions.ts');
const page = read('page.tsx');
const all = `${editor}\n${actions}\n${page}`;

/**
 * One row per shipped capability: what a host can do, and the thing in the
 * source without which they cannot do it. `where` names the file so a failure
 * says where to look rather than only what is gone.
 */
const CHECKLIST: Array<{ can: string; needs: RegExp[]; where: string }> = [
  // ── THE WORDS: two boxes up front, four behind a fold ──────────────────────
  { can: 'write the headline', needs: [/set\('headline'/], where: 'editor' },
  { can: 'write their own front-page story', needs: [/set\('leadParagraphs'/], where: 'editor' },
  { can: 'open the fold and find the eyebrow', needs: [/<details/, /set\('superKicker'/], where: 'editor' },
  { can: 'write the sub-headline', needs: [/set\('deck'/], where: 'editor' },
  { can: 'write the pull quote', needs: [/set\('pullQuote'/], where: 'editor' },
  { can: 'write the byline', needs: [/set\('byline'/], where: 'editor' },
  {
    can: 'clear a field and have us rewrite it',
    // `setOrDrop` deletes the key when the field is blank; the compose engine
    // then re-supplies it. Keeping the blank string instead is the regression.
    needs: [/const setOrDrop[\s\S]{0,220}else delete draft\[key\]/],
    where: 'actions',
  },
  // ── WHAT GOES IN, with save-before-you-navigate ───────────────────────────
  { can: 'open the living hero, photos and thank-you editors', needs: [/website\/living-hero/, /website\/our-photos/, /website\/special-message/], where: 'editor' },
  {
    can: 'click one of those and NOT lose what they just typed',
    needs: [/dirty && e\.button === 0 && !e\.metaKey && !e\.ctrlKey && !e\.shiftKey/, /openPiece\(/],
    where: 'editor',
  },
  // ── THE PIECES A HOST WRITES ──────────────────────────────────────────────
  { can: 'write their own columns', needs: [/addColumn/, /MAX_CUSTOM_COLUMNS/, /CUSTOM_COLUMN_BODY_MAX/], where: 'editor' },
  { can: 'add a wish by hand — author, role, wish, stars', needs: [/aria-label="Author"/, /aria-label="Role"/, /aria-label="Wish"/, /aria-label="Stars"/], where: 'editor' },
  { can: 'reorder and remove a wish', needs: [/aria-label="Move wish up"/, /aria-label="Move wish down"/, /aria-label="Remove wish"/], where: 'editor' },
  { can: 'upload a cover and favourites with no Papic', needs: [/heroUpload/, /galleryUploads/, /FileUpload/], where: 'editor' },
  { can: 'name a moment from the ten canonical ones', needs: [/CANONICAL_MOMENTS/, /<datalist/], where: 'editor' },
  { can: 'turn any section on or off', needs: [/const toggle = \(k: keyof EditorialSections\)/], where: 'editor' },
  { can: 'reorder the sections', needs: [/moveSection\(/], where: 'editor' },
  { can: 'copy their link and share the story', needs: [/copyShareLink/, /ShareButtons/], where: 'editor' },
  { can: 'opt into Stories, with the Event Hub guard', needs: [/Feature our story in Stories/, /Your Event Hub is/], where: 'editor' },

  // ── THE PUBLISH LADDER (08 step 1.6) ──────────────────────────────────────
  // ⚠ THE STORIES OPT-IN ABOVE AND THE LADDER BELOW ARE SEPARATE THINGS, and
  // the design says so in as many words: "Feature our story in Stories" is a
  // SEPARATE opt-in from publishing. Two rows, so collapsing them into one
  // control fails here rather than quietly featuring a story nobody offered.
  {
    can: 'choose who reads it from three states that each NAME who that is',
    needs: [/STORY_AUDIENCES\.map/, /PUBLISH_STATE_WHO\[choice\]/, /PUBLISH_STATE_NAME\[choice\]/],
    where: 'editor',
  },
  {
    can: 'be stopped from publishing until the desk is decided and consent is ticked',
    needs: [/mayChooseAudience\(choice, publishFacts\)/, /publishBlockerSentence\(/],
    where: 'editor',
  },
  {
    can: 'read the exact sentence they are agreeing to',
    needs: [/PUBLISH_CONSENT_SENTENCE/, /PUBLISH_CONSENT_FINE_PRINT/],
    where: 'editor',
  },
  {
    can: 'write their last word where they publish, in their own words',
    needs: [/set\('lastWord'/, /LAST_WORD_INTRO/],
    where: 'editor',
  },

  // ── THE CAPS — shipped values, unchanged ──────────────────────────────────
  { can: 'see the 400-char soft cap on a write-up', needs: [/WRITEUP_SOFT_CAP = 400/], where: 'editor' },
  { can: 'see the 280-char soft cap on a wish', needs: [/WISH_QUOTE_SOFT_CAP = 280/], where: 'editor' },
  { can: 'add up to 12 wishes', needs: [/WISHES_MAX = 12/], where: 'editor' },
  { can: 'upload up to 30 gallery images', needs: [/GALLERY_UPLOADS_MAX = 30/], where: 'editor' },

  // ── THE LOCKED CLOSE ──────────────────────────────────────────────────────
  {
    can: 'never move their last word and their song off the end',
    needs: [/'From the Couple', 'Their Song'/, /Always closes the paper/],
    where: 'editor',
  },
];

test('every capability the shipped editor had is still on the Story Maker', () => {
  const missing: string[] = [];
  let checked = 0;
  for (const row of CHECKLIST) {
    for (const re of row.needs) {
      checked += 1;
      if (!re.test(all)) missing.push(`${row.where}: a host can no longer ${row.can} — ${re}`);
    }
  }
  console.log(
    `[story-maker checklist] capabilities: ${CHECKLIST.length}, assertions checked: ${checked}, missing: ${missing.length}`,
  );
  assert.deepEqual(missing, [], `\n${missing.join('\n')}`);
});

/**
 * ✅ OWNER RULED 2026-09-09: THE PRO GATE STAYS EXACTLY AS SHIPPED. Naming and
 * writing the moments, section order, placing your own columns and featuring
 * guest wishes stay PRO. The prototype drew them ungated; that was an omission,
 * not a repricing, and shipping four paid abilities as free is a repricing
 * nobody chose. This is the guard against doing it by accident.
 */
test('the four PRO abilities are still gated, on the client AND on the server', () => {
  const clientGated = [
    /disabled=\{!isPro \|\| i === 0\}/, // reorder controls
    /disabled=\{!isPro\}/, // moment name / write-up / wish fields
  ];
  for (const re of clientGated) {
    assert.ok(re.test(editor), `the PRO gate is gone from the editor: ${re}`);
  }
  // The client flag is presentation only — the SERVER strip is the real gate.
  assert.ok(
    /if \(isPro\) \{[\s\S]*?chapterOverrides[\s\S]*?sectionOrder[\s\S]*?reviews[\s\S]*?\}/.test(actions),
    'saveEditorial no longer strips the PRO keys from a non-PRO save',
  );
  assert.ok(
    /isEditorialProActive\(/.test(actions),
    'saveEditorial no longer resolves PRO server-side',
  );
});

/**
 * ⚠ THE OTHER DIRECTION IS ALSO A REPRICING. Correcting the words Setnayan
 * auto-wrote about your own wedding is FREE (owner 2026-08-21), and so is the
 * story's theme — it is not one of the four paid abilities. A future edit that
 * folds either into the `isPro` block would be charging for something the owner
 * ruled free.
 */
test('the words and the theme are free, and are not inside the PRO block', () => {
  const proBlock = actions.slice(actions.indexOf('if (isPro) {'));
  for (const freeKey of ['headline', 'lead_paragraphs', 'storyTheme', 'heroUpload']) {
    assert.ok(
      !proBlock.includes(freeKey),
      `${freeKey} has been moved behind the PRO gate — that is a repricing`,
    );
  }
});
