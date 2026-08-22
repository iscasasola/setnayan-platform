/**
 * Guard — who can see your story.
 *
 * This is the suite standing between a couple's "only me" and the open internet,
 * so it asserts the REFUSALS first and the permissions second.
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  STORY_AUDIENCES,
  STORY_AUDIENCE_LABEL,
  STORY_AUDIENCE_NOTE,
  STRANGER,
  storyAudienceAdmits,
  storyAudienceOf,
  storyIsShared,
} from './who-can-see-your-story';

const HOST = { isHost: true, belongsToEvent: true };
const GUEST = { isHost: false, belongsToEvent: true };

test('a stranger is refused everything except "everyone"', () => {
  assert.equal(storyAudienceAdmits('draft', STRANGER), false);
  assert.equal(storyAudienceAdmits('event', STRANGER), false);
  assert.equal(storyAudienceAdmits('published', STRANGER), true);
});

test('one of the day\'s people reads a celebration story, never a private one', () => {
  assert.equal(storyAudienceAdmits('draft', GUEST), false, 'a guest read the couple\'s private draft');
  assert.equal(storyAudienceAdmits('event', GUEST), true);
  assert.equal(storyAudienceAdmits('published', GUEST), true);
});

test('the host always reads their own story, at every audience', () => {
  for (const a of STORY_AUDIENCES) {
    assert.equal(storyAudienceAdmits(a, HOST), true, `the host was locked out of their own "${a}" story`);
  }
});

test('the default viewer is a STRANGER — forgetting the argument cannot leak', () => {
  // Every public surface that omits the viewer must get the safest answer.
  assert.equal(storyAudienceAdmits('draft'), false);
  assert.equal(storyAudienceAdmits('event'), false);
});

test('an unreadable stored value fails CLOSED, to only-me', () => {
  // The opposite of the Live Photo Wall's narrowing, on purpose: there, an
  // unknown value silently deleting a paid feature was the worse outcome. Here
  // the other side is somebody's wedding read by strangers.
  for (const junk of [null, undefined, '', 'PUBLISHED', 'public', 'live', 7, {}]) {
    assert.equal(storyAudienceOf(junk), 'draft', `${JSON.stringify(junk)} was not failed closed`);
    assert.equal(storyAudienceAdmits(storyAudienceOf(junk), STRANGER), false);
  }
});

test('every audience has a label and a note that says what it does', () => {
  for (const a of STORY_AUDIENCES) {
    assert.ok(STORY_AUDIENCE_LABEL[a]?.trim(), `"${a}" has no label`);
    assert.ok(
      (STORY_AUDIENCE_NOTE[a] ?? '').length > 30,
      `"${a}" has no real explanation — three buttons with no words is not a choice`,
    );
  }
  assert.match(
    STORY_AUDIENCE_NOTE.draft,
    /not even your guests/i,
    '"Only me" must say it hides the story from the couple\'s OWN guests, or ' +
      'somebody picks it to be safe and shows it to nobody.',
  );
});

test('storyIsShared is the one definition of "somebody else can read it"', () => {
  assert.equal(storyIsShared('draft'), false);
  assert.equal(storyIsShared('event'), true);
  assert.equal(storyIsShared('published'), true);
});

// ── the surfaces ────────────────────────────────────────────────────────────

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/** Comments AND import lines stripped. An `import { storyAudienceAdmits }` at
 *  the top of a file satisfies a naive /storyAudienceAdmits/ match while the
 *  actual call site has been deleted — which is exactly what a mutation run
 *  caught these assertions doing. */
const body = (s: string) => code(s).replace(/^import[\s\S]*?from '[^']+';$/gm, '');

test('the public story component refuses before it composes a single word', () => {
  // Gating a BLOCK leaves the words one fetch away. The refusal has to happen
  // before the copy is built, which is what returning early achieves.
  const s = body(read('app/[slug]/_components/editorial/editorial-content.tsx'));
  // ⚠ PIN THE WHOLE STATEMENT, not the function name. A mutation that disabled
  // the gate with `if (false && …)` left the name in place and this assertion
  // passed — the guard matched a string instead of the act.
  const GATE =
    /if \(data\.audience && !storyAudienceAdmits\(data\.audience, viewer\)\) \{\s*return <GracefulFallback words=\{w\} \/>;/;
  assert.match(
    s,
    GATE,
    'EditorialContent no longer refuses a story its viewer may not read — or ' +
      'the refusal was weakened (an added condition, a different fallback).',
  );
  const gate = s.search(GATE);
  const compose = s.indexOf('composeCopy(data)');
  assert.ok(
    gate > 0 && gate < compose,
    'The audience check runs AFTER the story is composed — the words are built ' +
      'for a person who may not read them.',
  );
  assert.match(
    s,
    /viewer = STRANGER/,
    'The viewer no longer defaults to a stranger, so a surface that forgets the ' +
      'prop leaks a private story instead of hiding it.',
  );
});

test('the printable keepsake asks the same question as the page', () => {
  // It reads the SAME loader directly rather than rendering the component, so
  // gating only the component would leave /<slug>/print wide open.
  // ⚠ `body()`, not `code()`: the import line alone satisfied a bare
  // /storyAudienceAdmits/ match with the call site deleted. Measured.
  const s = body(read('app/[slug]/print/page.tsx'));
  assert.match(
    s,
    /if \(data && data\.audience && !storyAudienceAdmits\(data\.audience, printViewer\)\) \{[\s\S]{0,80}redirect\(/,
    'The print route stopped refusing a story its viewer may not read — it ' +
      'takes the loader directly, so it is the way around the page\'s gate.',
  );
});

test('the social card still refuses anything not shared with everyone', () => {
  // It gates on `published`, which is why putting the audience INSIDE status
  // matters: this file was never edited and cannot leak a celebration-only story.
  const s = body(read('app/api/og/realstory-slug/[slug]/route.ts'));
  assert.match(
    s,
    /data\?\.published/,
    'The OG card no longer gates on published, so a story kept to the ' +
      'celebration can be rendered into a public social preview.',
  );
});
