/**
 * THERE IS NO NAME FIELD ON THE STORY. FOR ANYONE. EVER.
 *
 * ── THE OWNER RULING (2026-09-07) ───────────────────────────────────────────
 * "Were you there?" once had a box: type your first name, and the page told you
 * which minutes you were in and where you sat. It is a friendly-looking guest
 * list. A stranger with the link types "Celine" and learns that a Celine came
 * to this wedding and sat at table 2 — and every wedding has a Celine.
 *
 * The ruling is absolute and it is not "gate the box behind a session": there
 * is no box. The identity is the signed guest session, resolved server-side in
 * `_lib/your-own-day.server.ts`, and the panel says so in words to everybody
 * else.
 *
 * ── WHAT THIS SCANS, AND WHY IT IS SCOPED ───────────────────────────────────
 * The STORY's own render tree — `_components/story` and `_components/editorial`.
 * Not the whole event site: `/[slug]` also serves the invitation, whose RSVP
 * form asks a guest for their name because a guest is telling the couple their
 * own name, which is the opposite transaction. Widening this scan to the site
 * would fail on that and teach the next person to weaken it.
 *
 * ── TWO ARMS, AND THE SECOND ONE IS THE WEAK ONE ────────────────────────────
 * ① **EVERY form control must be argued for by name.** A new `<input>` on the
 *    story fails until somebody adds it here with a reason. This is the arm
 *    that actually holds: it cannot be walked past by wording.
 * ② No control may carry name-shaped wording in its `placeholder`, `name`,
 *    `id` or `aria-label`. On its own this is a SUBSTRING TEST and a substring
 *    test is exactly the cheaper proxy this repo has been bitten by five times
 *    — "Who are you?" would sail through it. It is kept because it catches the
 *    likeliest accident (renaming an allowed control into a name box) without
 *    needing the allow-list to be re-read.
 *
 * ⚠ ADDING AN ENTRY IS A DECISION, NOT A FORMALITY. If the new control takes a
 * person's name, the answer is not an entry here — it is that the design says
 * no.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

/** `app/[slug]/_components`. */
const COMPONENTS_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SCAN_DIRS = ['story', 'editorial'];

/**
 * Every form control the story is allowed to render, by file, and why.
 *
 * Keyed on the repo-relative path plus the control's own identifier — never a
 * directory, never a prefix, so a new file cannot inherit an argument that was
 * made about a different one.
 */
const ALLOWED = new Map<string, string>([
  [
    'story/find-in-this-day.tsx :: input[type=search]',
    'FIND IN THIS DAY (`01` §8). A search over the page a reader is already ' +
      'looking at. Its placeholder names a minute, a shop and a word — never a ' +
      'person — and it can only ever match text that is already rendered, so ' +
      'typing a name into it finds exactly the bylines the page is already ' +
      'showing that reader and nothing else.',
  ],
  [
    'story/your-own-consent.tsx :: select#own-consent-pick',
    'WHICH OF YOUR OWN PHOTOGRAPHS (`01` §3.7). A list of the signed-in ' +
      'guest’s OWN items, built server-side from their session. It offers ' +
      'no way to name or reach anybody else.',
  ],
  [
    'story/your-own-consent.tsx :: textarea[name=note]',
    'THE OPTIONAL SENTENCE ON A TAKEDOWN REQUEST — passed to the shipped ' +
      '`askToTakeMyPhotoDown`, read by a person. It asks about a photograph, ' +
      'not about who somebody is.',
  ],
]);

/** Words that would make a control a person-lookup. */
const NAME_WORDS = [
  'first name',
  'last name',
  'full name',
  'your name',
  'guest name',
  'firstname',
  'lastname',
  'guestname',
  'nickname',
  'who are you',
  'find me',
  'find my name',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/** One `<input …>` / `<textarea …>` / `<select …>` opening tag, whole. */
type Control = { file: string; tag: string; body: string; id: string };

function controlsIn(file: string, rel: string): Control[] {
  // Comments first: this file's own prose, and the components', discuss name
  // fields at length. Scanning the raw text would fail on the explanations.
  const src = stripComments(readFileSync(file, 'utf8'));
  const out: Control[] = [];
  const re = /<(input|textarea|select)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) != null) {
    // Take everything to the end of the opening tag. A `>` inside a JSX
    // expression would truncate it early, which costs a shorter body to search
    // and never a missed control — the control itself is already counted.
    const end = src.indexOf('>', m.index);
    const body = src.slice(m.index, end < 0 ? src.length : end + 1);
    out.push({ file: rel, tag: m[1]!, body, id: identify(m[1]!, body) });
  }
  return out;
}

/** How an entry in ALLOWED names this control. */
function identify(tag: string, body: string): string {
  const attr = (name: string): string | null => {
    const m = body.match(new RegExp(`${name}=(?:"([^"]*)"|\\{'([^']*)'\\}|\\{"([^"]*)"\\})`));
    return m ? (m[1] ?? m[2] ?? m[3] ?? null) : null;
  };
  const id = attr('id');
  if (id) return `${tag}#${id}`;
  const type = attr('type');
  if (type) return `${tag}[type=${type}]`;
  const name = attr('name');
  if (name) return `${tag}[name=${name}]`;
  return tag;
}

test('the story · every form control on it is argued for, and none of them is a name box', () => {
  const controls: Control[] = [];
  for (const dir of SCAN_DIRS) {
    const root = join(COMPONENTS_ROOT, dir);
    for (const file of walk(root)) {
      controls.push(...controlsIn(file, relative(COMPONENTS_ROOT, file)));
    }
  }

  console.log(`form controls on the story render tree: ${controls.length}`);
  /*
    ⚠ THE SCAN MUST HAVE FOUND SOMETHING. Rename a directory, break the walk,
    and a test that only checks a list of offenders is empty goes green on a
    scan that read nothing at all. The story renders three controls today; the
    floor is one, so a legitimate removal does not fail the build.
  */
  assert.ok(
    controls.length > 0,
    'the scan found no form controls at all — it is reading the wrong directory',
  );

  const unargued: string[] = [];
  const nameShaped: string[] = [];

  for (const c of controls) {
    const key = `${c.file} :: ${c.id}`.replace(/\\/g, '/');
    if (!ALLOWED.has(key)) unargued.push(key);
    const lower = c.body.toLowerCase();
    for (const w of NAME_WORDS) {
      if (lower.includes(w)) nameShaped.push(`${key} — says “${w}”`);
    }
  }

  assert.deepEqual(
    nameShaped,
    [],
    'a control on the story is worded as a person lookup. Owner ruling 2026-09-07: ' +
      'there is no name field on this page, for anyone, ever.\n' +
      nameShaped.join('\n'),
  );

  assert.deepEqual(
    unargued,
    [],
    'a new form control appeared on the story and nobody said what it is for.\n' +
      unargued.join('\n') +
      '\n\nAdd it to ALLOWED with a reason — and if the reason is that it takes ' +
      'a person’s name, the answer is no.',
  );
});
