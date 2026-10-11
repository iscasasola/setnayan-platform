/**
 * THE SAVE-THE-DATE FILM PLAYS IN FULL ONCE PER PHONE — and while it plays, "See our page" can be pressed.
 *
 * A guest's walk, 2026-10-11 (faults N08 · N09): the film stood in front of the page on every visit; its "See our
 * page" was 117×37 on a 375 phone and 93×32 on a 320 one; and on an event with no date the page under the film
 * was nearly empty. Owner the same day ("ok all").
 *
 * WHAT IS HELD:
 *   (1) ONCE PER PHONE, THE WALK: first visit → the film plays; the guest leaves it → this phone remembers; second
 *       visit → lifted at landing, and that lift does NOT count as watching it; a different event is not
 *       remembered; a phone whose storage throws (private mode) sees the film every time and nothing breaks.
 *   (2) WHAT COUNTS: only an exit the guest or the film made — never the page's own lift, never the Maker's canvas.
 *   (3) BEFORE PAINT: the one line of script marks the document only for the remembered key, survives a storage that
 *       throws, and cannot be broken out of by a key.
 *   (4) THE WIRING: the hand-over reads and writes through those rules, hides the film by the mark until the
 *       script has loaded, and "Watch our film again" takes the mark off; the guest tree hands it the EVENT's id
 *       (never in the Maker's canvas).
 *   (5) "SEE OUR PAGE" IS 44px ON THE GLASS at every screen the film scales to, on both of its controls, and is
 *       there from the film's first second (mounted the moment the film starts).
 *   (6) NO DATE: the film's closing card — the Save the Date's own still view — is the top of the page; with a date
 *       nothing is added; rendered, it is whole (the names, "Save the date", no hole where a date would be).
 *
 * NOT PROVEN HERE: a real phone's storage across visits, and Safari's private mode. A real Chromium run is in the
 * builder's evidence folder.
 *
 * SABOTAGE RUN 2026-10-11 (committed first, put back by `git checkout`): `exitCountsAsSeen` made to answer true
 * always → (1) (2) red; `stagePressPx` made to return 44 → (5) red; the `closing` slot's condition dropped
 * (`!event.event_date`) → (6) red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  STD_FILM_SEEN_ATTR,
  exitCountsAsSeen,
  filmLiftAtLanding,
  markStdFilmSeen,
  stdFilmSeen,
  stdFilmSeenBootScript,
  stdFilmSeenKey,
} from './std-film-seen';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** A phone's storage. */
function phone(broken = false) {
  const kept = new Map<string, string>();
  return {
    kept,
    getItem(k: string) { if (broken) throw new Error('SecurityError'); return kept.get(k) ?? null; },
    setItem(k: string, v: string) { if (broken) throw new Error('QuotaExceededError'); kept.set(k, v); },
  };
}

/** One visit, as the hand-over runs it: returns whether the film played, and lets the guest leave it. */
function visit(storage: ReturnType<typeof phone> | null, eventKey: string, landedDownThePage = false) {
  const key = stdFilmSeenKey(eventKey);
  const lift = filmLiftAtLanding({ asSlide: false, landedDownThePage, seen: stdFilmSeen(storage, key) });
  let liftedAtLanding = lift !== null;
  const exit = () => {
    if (exitCountsAsSeen({ asSlide: false, liftedAtLanding })) markStdFilmSeen(storage, key);
    liftedAtLanding = false;
  };
  if (lift) exit(); // the page's own lift is heard as an exit
  return { filmPlays: lift === null, lift, leaveTheFilm: exit };
}

test('(1) once per phone: the film plays, the guest leaves it, and the next visit is the page', () => {
  const p = phone();
  const first = visit(p, 'S89E-MARCOMARGA');
  assert.equal(first.filmPlays, true, 'the first visit does not play the film');
  assert.equal(p.kept.size, 0, 'the film is called seen before anyone left it');
  first.leaveTheFilm();
  assert.equal(stdFilmSeen(p, stdFilmSeenKey('S89E-MARCOMARGA')), true, 'leaving the film is not remembered');
  const second = visit(p, 'S89E-MARCOMARGA');
  assert.equal(second.filmPlays, false, 'the film stands in front of the page again');
  assert.equal(second.lift, 'seen-before');
  // Another event on the same phone is its own film.
  assert.equal(visit(p, 'S89E-ANOTHER0001').filmPlays, true);
  // A film abandoned half-way (nobody left it) plays again.
  const q = phone();
  visit(q, 'S89E-MARCOMARGA');
  assert.equal(visit(q, 'S89E-MARCOMARGA').filmPlays, true);
  // Landing part-way down lifts the film — and is NOT watching it.
  const r = phone();
  const back = visit(r, 'S89E-MARCOMARGA', true);
  assert.equal(back.lift, 'landed-down-the-page');
  assert.equal(r.kept.size, 0, 'a guest who came back to a section is recorded as having watched the film');
  assert.equal(visit(r, 'S89E-MARCOMARGA').filmPlays, true);
  // A phone that will not remember: the film every time, nothing thrown.
  const broken = phone(true);
  const b1 = visit(broken, 'S89E-MARCOMARGA');
  assert.doesNotThrow(() => b1.leaveTheFilm());
  assert.equal(visit(broken, 'S89E-MARCOMARGA').filmPlays, true);
  assert.equal(visit(null, 'S89E-MARCOMARGA').filmPlays, true);
});

test('(2) what counts as seen: the guest’s or the film’s own exit — never the page’s lift, never the canvas', () => {
  assert.equal(exitCountsAsSeen({ asSlide: false, liftedAtLanding: false }), true);
  assert.equal(exitCountsAsSeen({ asSlide: false, liftedAtLanding: true }), false);
  assert.equal(exitCountsAsSeen({ asSlide: true, liftedAtLanding: false }), false);
  assert.equal(filmLiftAtLanding({ asSlide: true, landedDownThePage: true, seen: true }), null, 'the Maker’s slide is lifted');
  assert.equal(stdFilmSeenKey(''), null);
  assert.equal(stdFilmSeenKey(null), null);
  assert.equal(stdFilmSeen(phone(), null), false);
});

test('(3) before paint: the mark is set only for the remembered key, and nothing a key holds can break out', () => {
  const run = (script: string, storage: { getItem(k: string): string | null }) => {
    const marks: string[] = [];
    const doc = { documentElement: { setAttribute: (name: string) => marks.push(name) } };
    new Function('localStorage', 'document', script)(storage, doc);
    return marks;
  };
  const key = stdFilmSeenKey('S89E-MARCOMARGA')!;
  const p = phone();
  assert.deepEqual(run(stdFilmSeenBootScript(key), p), [], 'a phone that has not seen the film is marked');
  markStdFilmSeen(p, key);
  assert.deepEqual(run(stdFilmSeenBootScript(key), p), [STD_FILM_SEEN_ATTR]);
  assert.deepEqual(run(stdFilmSeenBootScript(stdFilmSeenKey('S89E-ANOTHER0001')), p), []);
  assert.doesNotThrow(() => run(stdFilmSeenBootScript(key), phone(true)));
  assert.equal(stdFilmSeenBootScript(null), '');
  // A key is quoted as data, whatever it holds.
  const hostile = stdFilmSeenBootScript('sn:x"});alert(1);({"');
  assert.doesNotThrow(() => run(hostile, phone()));
  const closer = stdFilmSeenBootScript('sn:</script><script>alert(1)');
  assert.doesNotMatch(closer, /</, 'a key can close the script tag it is written into');
  assert.doesNotThrow(() => run(closer, phone()));
  // …and it still reads the right key.
  const odd = phone();
  markStdFilmSeen(odd, 'sn:</script><script>alert(1)');
  assert.deepEqual(run(closer, odd), [STD_FILM_SEEN_ATTR]);
});

test('(4) the wiring: the hand-over reads and writes through the rules, and the guest tree hands it the event’s id', () => {
  const h = code('app/[slug]/_components/std-film-handoff.tsx');
  assert.match(h, /const storageKey = asSlide \? null : stdFilmSeenKey\(seenKey\);/);
  assert.match(h, /if \(exitCountsAsSeen\(\{ asSlide, liftedAtLanding: liftedAtLanding\.current \}\)\) markStdFilmSeen\(phoneStorage\(\), storageKey\);/);
  assert.match(h, /const lift = filmLiftAtLanding\(\{[\s\S]{0,400}?seen: stdFilmSeen\(phoneStorage\(\), storageKey\),\s*\}\);\s*if \(lift\) \{\s*liftedAtLanding\.current = true;\s*window\.dispatchEvent\(new CustomEvent\(STD_FILM_EXIT_EVENT\)\);/);
  // Hidden by the mark until the script loads; the film itself is the thing wrapped.
  assert.match(h, /\[\$\{STD_FILM_SEEN_ATTR\}\] \[data-std-film-wrap\]\{display:none\}/);
  assert.match(h, /<div data-std-film-wrap="">\s*\{marker\}\s*\{film\}\s*<\/div>/);
  assert.match(h, /__html: stdFilmSeenBootScript\(storageKey\)/);
  // "Watch our film again" takes the mark off before it shows the film.
  assert.match(h, /document\.documentElement\.removeAttribute\(STD_FILM_SEEN_ATTR\);\s*setShowFilm\(true\);/);
  // Storage is reached only through a try.
  assert.match(h, /function phoneStorage\(\): Storage \| null \{\s*try \{/);
  assert.equal((h.match(/localStorage/g) ?? []).length, 1, 'the hand-over touches storage outside its one guarded reader');
  const body = code('app/[slug]/_components/site-body.tsx');
  assert.match(body, /seenKey=\{isMakerCanvas \|\| !stdFilm \? null : event\.public_id\}/);
});

test('(5) "See our page" is 44px on the glass at every scale, on both controls, from the film’s first second', async () => {
  const { FILM_PRESS_PX, stagePressPx } = await import('../app/[slug]/_components/save-the-date-film');
  assert.equal(FILM_PRESS_PX, 44);
  // The scales a phone gives the stage (BASE 440×780): 320 → 0.727, 375 → 0.852, 390 → 0.886; a tablet scales it up.
  for (const scale of [0.6, 320 / 440, 375 / 440, 390 / 440, 1, 768 / 440, 2.3]) {
    const onGlass = stagePressPx(scale) * scale;
    assert.ok(onGlass >= 44, `at scale ${scale.toFixed(3)} the press is ${onGlass.toFixed(1)}px on the glass`);
    assert.ok(onGlass < 44 + 1.5 * Math.max(1, scale) || scale > 1, `at scale ${scale.toFixed(3)} the press is needlessly large (${onGlass.toFixed(1)}px)`);
  }
  // Anti-vacuity: the fault measured on the walk — 44 stage px at a 375 phone was 37px.
  assert.ok(44 * (375 / 440) < 38);
  assert.equal(stagePressPx(Number.NaN), 44);
  const film = code('app/[slug]/_components/save-the-date-film.tsx');
  const buttons = [...film.matchAll(/<button\s+type="button"\s+onClick=\{\(\) => window\.dispatchEvent\(new CustomEvent\(STD_FILM_EXIT_EVENT\)\)\}[\s\S]*?>/g)].map((m) => m[0]);
  assert.equal(buttons.length, 2, 'the film’s two "See our page" controls were not both found');
  for (const b of buttons) assert.match(b, /minHeight: stagePressPx\(fitScale\)/, 'a "See our page" is sized on the stage, not on the glass');
  // From the first second: the persistent control is mounted the moment the film starts — and the film starts
  // within a second when no opening is playing.
  assert.match(film, /\{canExit && started && !preview && idx !== closeIdx \?/);
  const grace = film.match(/if \(!revealActive\) start\(\);\s*\}, (\d+)\);/);
  assert.ok(grace && Number(grace[1]) <= 1000, 'the film takes more than a second to start with no opening');
  // The scale is known before the slides that use it are built.
  assert.ok(film.indexOf('const [fitScale, setFitScale] = useState(1);') < film.indexOf('const slides: Slide[] = [];'));
});

test('(6) no date: the film’s closing card is the top of the page — and is whole', async () => {
  const body = code('app/[slug]/_components/site-body.tsx');
  assert.match(body, /closing=\{!isMakerCanvas && stdFilm && !event\.event_date \? stdStillView\(\) : null\}/, 'the closing card is not kept for an event with no date (or is drawn with one)');
  assert.match(body, /const stdStillView = \(\) => \(\s*<SaveTheDateView[\s\S]{0,700}?showTextHero\s+film=\{false\}\s*\/>/);
  const h = code('app/[slug]/_components/std-film-handoff.tsx');
  const closing = h.indexOf('{closing ? (');
  assert.ok(closing > 0 && closing < h.indexOf('px-4 py-10 sm:px-6 sm:py-14">{children}</div>', closing), 'the closing card is not above the page');
  // Rendered: the still view of an event with no date.
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SaveTheDateView } = await import('../app/[slug]/_components/save-the-date');
  const html = renderToStaticMarkup(
    React.createElement(SaveTheDateView, { displayName: 'Marco & Marga', dateIso: null, venueName: null, venueAddress: null, publicId: 'S89E-MARCOMARGA', loveStory: null, showTextHero: true, film: false } as never),
  );
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&rsquo;/g, '’').replace(/\s+/g, ' ').trim();
  assert.match(text, /^Save the date Marco & Marga /, `the card does not open on "Save the date" and the names: ${text}`);
  assert.match(text, /Full invitation to follow\./);
  assert.doesNotMatch(text, /\b(?:on|at)\s+[.,·]|·\s*$|\s[.,](?:\s|$)/, `a hole where the date would be: ${text}`);
  assert.doesNotMatch(html, /Add to Google Calendar|\.ics/, 'a calendar button with no date to add');
  assert.doesNotMatch(html, /<(?:a|button)\b/, 'the closing card has something to press');
});
