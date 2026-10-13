/**
 * 🎭 THE REVEAL PANEL'S "DEFAULT OPENING" IS THE ONE THAT REALLY PLAYS — and the
 * list of openings it offers is the Reveal Studio's, on purpose.
 *
 * Owner's live Maker, 2026-10-08 (Stages › Invitation › Welcome › Reveal › Look):
 * ONE opening card, "Sheer veil ◆" — `openings` held one entry, `current`
 * "veil-sheer", `defaultOpening` "two-flap-horizontal", theme "Cyber Neon".
 *
 * ── WHY ONE OPENING (by design — nothing here changes it) ──────────────────
 * `MakerRevealPanel` (`maker-made-once.tsx`) offers `REVEAL_LIBRARY` less what
 * the Reveal Studio's map switches off (`reveal_studio_config.templates`,
 * `/admin/reveal-studio`; DECISION_LOG 2026-06-17 "Reveal Studio — admin
 * customizes + activates/deactivates the Save-the-Date reveal from Setnayan
 * HQ"). The guest page obeys the SAME map (`revealAllowedFor` rule 4), so an
 * opening the map switched off could not play — offering it would be a card
 * that does nothing. The code's own default is all five ON; which are off is
 * the stored row, i.e. an owner switch, not a filter to "fix".
 *
 * ── WHAT WAS WRONG, AND IS HELD HERE ───────────────────────────────────────
 * The panel was told the default opening was the THEME's own
 * (`two-flap-horizontal`) even though the map had switched that opening off —
 * the guest page would play the house default instead. So for a couple who had
 * chosen nothing, the strip ringed no card at all and a stage switch turned on
 * "from None" could take an opening that is not on the strip.
 *
 *   1 · BEHAVIOUR: the guest page's own rule answers "what plays when nothing
 *       is chosen" — a switched-off theme opening falls back to the house
 *       default, else the first opening still on;
 *   2 · the panel asks THAT rule (one derivation), and calls a card "your
 *       theme's opening" only when the theme's opening is what plays;
 *   3 · so the default is always a card on the strip (for every theme × every
 *       map that leaves at least one opening on);
 *   4 · the strip is the library less the map — and nothing else filters it.
 *
 * 🛡 Sabotaged, each red then restored (2026-10-08, builder EH):
 *   • the panel handed the theme's opening again, past the map       → 2 red;
 *   • "your theme's opening" said whatever plays                     → 2 red;
 *   • the strip filtered by something besides the map                → 4 red.
 *
 * Run from apps/web:  npx tsx --test lib/the-reveal-default-is-what-plays.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INVITE_THEMES } from './invite-themes';
import { REVEAL_NONE, revealAllowedFor } from './reveal-access';
import { DEFAULT_REVEAL_CONFIG, REVEAL_TEMPLATE_IDS, type RevealTemplateId } from './reveal-config-pure';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const flat = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8')).replace(/\s+/g, ' ');
const PANEL = 'app/dashboard/[eventId]/launch/_components/maker-made-once.tsx';

type Map = Record<RevealTemplateId, boolean>;
const only = (...on: RevealTemplateId[]): Map => Object.fromEntries(REVEAL_TEMPLATE_IDS.map((id) => [id, on.includes(id)])) as Map;

/** The panel's question, as it asks it. */
const playsByDefault = (themeOpening: string, adminDefault: RevealTemplateId | null, allowed: Map | null) =>
  revealAllowedFor({
    ownsPro: true,
    chosenTemplate: themeOpening === REVEAL_NONE ? null : (themeOpening as RevealTemplateId),
    adminDefault,
    isStaffPreview: false,
    allowed,
  });

test('1 · what plays when nothing is chosen: the theme’s opening, unless the Reveal Studio switched it off', () => {
  /* The owner's screen: Cyber Neon's opening is switched off; the house default (Sheer veil) plays. */
  const live = only('veil-sheer');
  assert.equal(playsByDefault('two-flap-horizontal', 'veil-sheer', live), 'veil-sheer');
  /* With every opening on (the code's own default), the theme's opening plays. */
  assert.equal(playsByDefault('two-flap-horizontal', 'veil-sheer', DEFAULT_REVEAL_CONFIG.templates), 'two-flap-horizontal');
  /* The house default switched off too: the first opening still on. */
  assert.equal(playsByDefault('two-flap-horizontal', 'veil-sheer', only('church-doors')), 'church-doors');
  /* A theme with no opening of its own: the house default, then the library's first. */
  assert.equal(playsByDefault(REVEAL_NONE, 'veil-sheer', live), 'veil-sheer');
  assert.equal(playsByDefault(REVEAL_NONE, null, null), 'four-flap');
  /* No map could be read: nothing is second-guessed. */
  assert.equal(playsByDefault('church-doors', null, null), 'church-doors');
});

test('2 · the panel asks the guest page’s own rule — and names the theme only when the theme’s opening plays', () => {
  const s = flat(PANEL);
  const panel = s.slice(s.indexOf('export async function MakerRevealPanel('));
  assert.match(
    panel,
    /const playsByDefault = revealAllowedFor\(\{ ownsPro: true, chosenTemplate: themeOpening === REVEAL_NONE \? null : themeOpening, adminDefault: config\?\.defaultTemplate \?\? null, isStaffPreview: false, allowed: config\?\.templates \?\? null, \}\);/,
  );
  assert.match(panel, /defaultOpening=\{playsByDefault\}/);
  assert.match(panel, /defaultIsTheme=\{themeOpening !== REVEAL_NONE && playsByDefault === themeOpening\}/);
  assert.equal([...panel.matchAll(/defaultOpening=/g)].length, 1);
  assert.doesNotMatch(panel, /defaultOpening=\{[^}]*themeOpening/, 'the panel is handed the theme’s opening past the Reveal Studio’s map');
  /* It is the SAME function the guest page's mount asks. */
  assert.match(flat('app/[slug]/_components/reveal/reveal-mount.tsx'), /const decision = revealAllowedFor\(\{ ownsPro, chosenTemplate: props\.eventTemplate \?\? null, adminDefault: config\.defaultTemplate, isStaffPreview, allowed: config\.templates, \}\);/);
});

test('3 · so the default is always a card on the strip — every theme, every map that leaves an opening on', () => {
  const themes = Object.entries(INVITE_THEMES) as Array<[string, { opening: string }]>;
  assert.ok(themes.length >= 8, 'the scan is not reading the themes');
  let checked = 0;
  /* Every non-empty subset of the five openings, with every house default. */
  for (let mask = 1; mask < 1 << REVEAL_TEMPLATE_IDS.length; mask += 1) {
    const on = REVEAL_TEMPLATE_IDS.filter((_, i) => mask & (1 << i));
    const allowed = only(...on);
    for (const adminDefault of REVEAL_TEMPLATE_IDS) {
      for (const [name, theme] of themes) {
        const plays = playsByDefault(theme.opening, adminDefault, allowed);
        assert.ok(on.includes(plays as RevealTemplateId), `${name}: "${plays}" would be the default, but the strip offers only ${on.join(', ')}`);
        checked += 1;
      }
    }
  }
  console.log(`[reveal-default] ${checked} theme × map × house-default cases`);
  assert.ok(checked > 1000);
});

test('4 · the strip is the library less the Reveal Studio’s map — nothing else filters it', () => {
  const s = flat(PANEL);
  const panel = s.slice(s.indexOf('export async function MakerRevealPanel('));
  assert.match(panel, /const allowed: Partial<Record<string, boolean>> = config\?\.templates \?\? \{\};/);
  assert.match(panel, /const openings = REVEAL_LIBRARY\.filter\(\(t\) => allowed\[t\.id\] !== false\)\.map\(\(t\) => \(\{ id: t\.id, label: t\.label, blurb: t\.blurb, \}\)\);/);
  assert.equal([...panel.matchAll(/REVEAL_LIBRARY\.filter\(/g)].length, 1);
  /* The one other gate is the store shell's (a Pro control is hidden there, not offered). */
  assert.match(panel, /storeShell && !ownsPro \? \[\] : openings/);
  /* The code's own default offers all five: which are off is a stored switch, not a rule here. */
  assert.deepEqual(DEFAULT_REVEAL_CONFIG.templates, only(...REVEAL_TEMPLATE_IDS));
});
