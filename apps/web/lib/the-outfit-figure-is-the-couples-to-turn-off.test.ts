/**
 * 👗 THE OUTFIT FIGURE IS THE COUPLE'S TO TURN OFF — owner 2026-09-30, looking
 * at the guest's dress-code scene: *"they can opt not to add this"* and *"Do's
 * and Don'ts should be fixable also"*; then, reading his own page as the groom,
 * *"both host of the event can input it and the supplier"*.
 *
 * What is held here, each by RENDERING it (not by reading the source):
 *   · the figure shows by default — a config saved before the switch has no
 *     key — in the reader's own panel AND in every role row;
 *   · `show_figure: false` hides it in BOTH places and nothing else: the chips
 *     and the lists stay;
 *   · the editor's switch posts an answer either way (hidden 'off', then 'on'
 *     when ticked), and the parser reads a missing key as ON;
 *   · an unset outfit blames nobody, and a host is told it is theirs to add;
 *   · a guest never reads a raw hex code under a colour;
 *   · a form that cannot list the roles (the Maker's panel) still posts every
 *     saved outfit back, so a Save there no longer wipes them.
 *
 * Run from `apps/web`: `npx tsx --test lib/the-outfit-figure-is-the-couples-to-turn-off.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import type { RolePalette } from './mood-board';
import { legacyRedirectTarget } from './legacy-redirects';

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

const BOARD: RolePalette = {
  reception: ['#7A1F2B', '#C9A24B', '#F4E9DC', '#2B1D14', '#8E3B5B'],
  bride: ['#FAF7F2', '#F4E9DC'],
  groom: ['#1F2A44'],
  principal_sponsors: ['#C9A24B', '#F4E9DC'],
  guest: ['#2B1D14', '#8E3B5B', '#C9A24B'],
  touched_roles: ['bride', 'groom', 'principal_sponsors', 'guest'],
};
const words = { eventWord: 'wedding', solemn: false, twoPeople: true } as never;

async function scene(props: Record<string, unknown>): Promise<string> {
  const { DressCodeWidget } = await import('../app/[slug]/_components/dress-code-widget');
  return renderToStaticMarkup(
    React.createElement(DressCodeWidget as never, { words, config: {}, rolePalette: BOARD, ...props }),
  );
}
const figures = (html: string) => (html.match(/data-role-figure="/g) ?? []).length;
const youPanel = (html: string) => {
  const at = html.indexOf('data-dress-code="you"');
  return at < 0 ? '' : html.slice(at, html.indexOf('</div>', html.indexOf('aria-label="Your colours"', at)) + 6);
};

test('👗 by default the figure is drawn — in every role row and in the reader’s own panel', async () => {
  const general = await scene({ config: {} });
  assert.ok(figures(general) >= 4, `every dressed role row draws its person (saw ${figures(general)})`);
  const ninang = await scene({ config: {}, guestRole: 'principal_sponsor_ninang' });
  assert.equal(figures(youPanel(ninang)), 1, 'the ninang’s own panel draws her');
  // An explicit `true` is the same as no key.
  assert.equal(figures(await scene({ config: { show_figure: true } })), figures(general));
});

test('🙈 show_figure: false hides the figure everywhere in the scene — and only the figure', async () => {
  const on = await scene({ config: { dos: ['A little sparkle'] } });
  const off = await scene({ config: { dos: ['A little sparkle'], show_figure: false } });
  assert.equal(figures(off), 0, 'no role row draws a person');
  const chips = (html: string) => (html.match(/class="pahina-swatch/g) ?? []).length;
  assert.equal(chips(off), chips(on), 'every colour chip is still there');
  assert.match(off, /A little sparkle/, 'and the Do list is untouched');

  const mine = await scene({ config: { show_figure: false }, guestRole: 'principal_sponsor_ninang' });
  assert.equal(figures(mine), 0, 'the reader’s own panel draws nobody either');
  assert.match(mine, /aria-label="Your colours"/, 'but still shows her colours');
});

test('🔘 the editor posts the switch either way, and a missing key reads as ON', async () => {
  const { DressCodeFields, normalizeDressCodeConfig } = await import(
    '../app/dashboard/[eventId]/studio/mood-board/_components/dress-code-fields'
  );
  assert.equal(normalizeDressCodeConfig({}).show_figure, true, 'no key → on (today’s look)');
  assert.equal(normalizeDressCodeConfig({ show_figure: false }).show_figure, false);
  assert.equal(normalizeDressCodeConfig({ show_figure: 'no' }).show_figure, true, 'only a real false turns it off');

  const draw = (show: boolean) =>
    renderToStaticMarkup(
      React.createElement(DressCodeFields, {
        config: { ...normalizeDressCodeConfig({}), show_figure: show },
        eventNoun: 'wedding',
        compact: true,
      }),
    );
  const off = draw(false);
  const on = draw(true);
  assert.match(off, /<input type="hidden" name="show_figure" value="off"\/>/, 'the hidden “off” always posts');
  const box = (html: string) => /<input type="checkbox" role="switch"[^>]*>/.exec(html)?.[0] ?? '';
  assert.match(box(on), /name="show_figure"/, 'the switch posts to the same field');
  assert.match(box(on), /value="on"/);
  assert.match(box(on), /\schecked=""/, 'ticked → “on” posts after the hidden “off”');
  assert.ok(on.indexOf('value="off"') < on.indexOf('role="switch"'), 'the “off” comes first');
  assert.doesNotMatch(box(off), /\schecked=""/, 'unticked → only “off” posts');
  assert.match(on, /Show the outfit figure/, 'the switch is named on the page');

  const action = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/studio/mood-board/dress-code-actions.ts'), 'utf8'));
  assert.match(
    action,
    /figureValues\.length === 0 \|\| figureValues\.includes\('on'\)/,
    'the writer reads nothing posted as ON, and “on” as on',
  );
});

test('🛟 a form that cannot list the roles still posts every saved outfit back', async () => {
  const { DressCodeFields, normalizeDressCodeConfig } = await import(
    '../app/dashboard/[eventId]/studio/mood-board/_components/dress-code-fields'
  );
  const config = normalizeDressCodeConfig({
    roles: { principal_sponsor_ninong: { style: 'barong_tagalog', note: 'ecru', callTime: '14:30' } },
    groups: { principal_sponsors: { style: 'filipiniana' } },
  });
  assert.ok(Object.keys(config.roles).length === 1 && Object.keys(config.groups).length === 1, 'fixture parsed');
  const html = renderToStaticMarkup(React.createElement(DressCodeFields, { config, eventNoun: 'wedding', compact: true }));
  for (const [name, value] of [
    ['role_key', 'principal_sponsor_ninong'],
    ['role_style', 'barong_tagalog'],
    ['role_note', 'ecru'],
    ['role_call_time', '14:30'],
    ['group_key', 'principal_sponsors'],
    ['group_style', 'filipiniana'],
  ]) {
    assert.match(html, new RegExp(`<input type="hidden" name="${name}" value="${value}"/>`), `${name}=${value} rides along`);
  }
});

test('👔 the Maker’s Dress code scene lists this guest list’s roles, so a host sets each outfit right there', async () => {
  const { foldEventRoles } = await import('../app/dashboard/[eventId]/studio/mood-board/_components/dress-code-fields');
  const roles = foldEventRoles([
    { role: 'principal_sponsor_ninang' },
    { role: 'principal_sponsor_ninang' },
    { role: 'guest' },
    { role: null },
    { role: 'not_a_role' },
  ]);
  assert.deepEqual(roles.map((r) => [r.role, r.count]), [['principal_sponsor_ninang', 2]], 'counted; guests and unknowns left out');
  const page = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/website/editor/page.tsx'), 'utf8'));
  assert.match(page, /const dressCodeRoles = foldEventRoles\(/, 'the Maker reads the roles');
  assert.match(page, /<DressCodePanel[\s\S]*?eventRoles=\{dressCodeRoles\}/, 'and hands them to the Dress code scene');
});

test('🙅 an unset outfit blames nobody; a host is told it is theirs to add', async () => {
  const guest = await scene({ config: {}, guestRole: 'principal_sponsor_ninang' });
  const groom = await scene({ config: {}, guestRole: 'groom' });
  for (const html of [guest, groom]) {
    assert.match(html, /Outfit to be confirmed/, 'the unset state is still said');
    assert.doesNotMatch(html, /couple hasn(’|&#x27;|')t said/i, 'and never pinned on the couple');
  }
  assert.match(guest, /data-dress-code="unset"[^>]*>\s*Not set yet — your hosts or their stylist will add it here\./);
  assert.match(groom, /data-dress-code="unset"[^>]*>\s*Not set yet — add it in your Event Hub Maker, under Dress code\./);
});

test('🏷 a guest reads a colour’s name, never its hex code', async () => {
  const hexText = />\s*#[0-9A-Fa-f]{6}\s*</;
  const general = await scene({ config: { palette: [{ name: '#842334', hex: '#842334' }] } });
  const mine = await scene({ config: {}, guestRole: 'bride' });
  assert.doesNotMatch(general, hexText, 'no chip in the general view prints a hex');
  assert.doesNotMatch(mine, hexText, 'no chip in the reader’s own panel prints a hex');
  assert.doesNotMatch(general, /title="#[0-9A-Fa-f]{6}"/, 'nor hides one in a tooltip');
  assert.match(mine, /aria-label="Your colours"[\s\S]*?<span class="mt-2[^"]*">[A-Z][^<#]+<\/span>/, 'her chips carry a name');
});

test('✍ the Do’s and Don’ts are one list, fixable in the Dress code scene and on the Mood Board', () => {
  const list = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/studio/mood-board/_components/list-field.tsx'), 'utf8'));
  assert.match(list, /key=\{r\.id\}/, 'a row is keyed by its own id, so removing one never drops another’s edit');
  assert.doesNotMatch(list, /key=\{i\}/);

  const form = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/studio/mood-board/_components/dress-code-lists-form.tsx'), 'utf8'));
  assert.match(form, /action=\{updateDressCodeLists\.bind\(null, eventId\)\}/, 'the Mood Board saves through the lists writer');
  assert.match(form, /name="dos"/);
  assert.match(form, /name="donts"/);
  assert.match(form, /inMaker \? \(\s*<HubDraftField \/>/, 'in the Maker it saves to the draft, beside the scene');

  const action = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/studio/mood-board/dress-code-actions.ts'), 'utf8'));
  assert.match(action, /return \{ \.\.\.base, dos, donts \}/, 'only the two lists are replaced; the rest of the dress code is kept');
  assert.match(action, /draftedEventColumn\(eventId, 'dress_code_config'\)/, 'a draft save builds on the drafted dress code');

  const board = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/studio/mood-board/_components/mood-board-editor.tsx'), 'utf8'));
  assert.match(board, /<MoodPart part="palette">\{parts\.dressLists\}<\/MoodPart>/, 'the Maker’s Mood Board shows the lists');
  assert.match(board, /\{parts\.dressLists\}<\/div>/, 'and so does its own page');
  // 👗 THE DRESS CODE IS SET IN THE MOOD BOARD (2026-10-01; replace means remove,
  // 2026-10-04): the form and its writer live with the Mood Board, a live save
  // lands back on it, and the old page is gone — its address forwards here.
  assert.match(form, /import \{ updateDressCodeLists \} from '\.\.\/dress-code-actions';/, 'the lists form no longer saves through the Mood Board’s own writer');
  assert.match(board, /import \{ DressCodeListsForm \} from '\.\/dress-code-lists-form';/, 'the Mood Board no longer mounts its own lists form');
  assert.match(action, /const back = `\/dashboard\/\$\{eventId\}\/studio\/mood-board`;[\s\S]*?return landAfterWrite\(formData, `\$\{back\}\?saved=1`/, 'a live save no longer lands on the Mood Board');
  assert.doesNotMatch(action, /website\/dress-code/, 'a save still names the removed dress-code page');
  assert.ok(!existsSync(join(WEB, 'app/dashboard/[eventId]/website/dress-code')), 'the old dress-code page is back');
  assert.equal(legacyRedirectTarget('/dashboard/E1/website/dress-code'), '/dashboard/E1/studio/mood-board', 'the old address does not forward to the Mood Board');
});
