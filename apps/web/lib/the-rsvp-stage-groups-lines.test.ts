/**
 * 🫧 THE RSVP STAGE GROUPS LINES — step 7 of the per-element work (owner's ruling 2026-10-09; approved prototype
 * `prototypes/maker_rsvp_add_drag_group_2026-10-09.html` § 3; record
 * `Maker_RSVP_Per_Element_Add_Drag_Group_LOCKED_2026-10-09.md` § 3).
 *
 *   1. PICKING — Edit's last row asks; the lower third becomes the picking bar ("Group · pick the lines", how, "N
 *      picked", Done · Cancel); a tap on the page ticks a line instead of picking it; a group cannot be ticked, nor a
 *      line already in one; nothing is held or framed while picking; Done asks the panel for ONE edit;
 *   2. THE BAR, DRAWN — the prototype's words; the count is plain words (a frame only round what is pressed —
 *      owner 2026-10-11) and goes through `formatCount`; Done with fewer than two is grey and says why;
 *   3. A GROUP IS A PART — its last row is ↑ Earlier · ↓ Later · Ungroup; a line inside one cannot start a group, and
 *      a screen with four says so at the button;
 *   4. ITS TOOLS — Edit and Background only: Style and Animate are grey and say the prototype's two sentences; the
 *      panel draws a group's Edit (what it holds) and Background (None · Plain · Frosted, the card's own tiles); a
 *      line inside one says whose background it sits on, and "Open the group" opens it;
 *   5. 🔒 A REPLY IS NEVER LOST TO A GROUP — the real card, drawn for a guest, with Yes and No grouped, apart, in two
 *      groups, moved: one "attending" and one "declined", in the reply's one fieldset, which still has its name;
 *   6. THE CARD STANDS ASIDE — None when a group is made, back as it was at the last Ungroup (the pure rule is held
 *      in `the-rsvp-list-is-edited-whole` § 4; here: that every door to a group goes through that one edit);
 *   7. COLOUR TOKENS ONLY in the marks; the Maker's first load learns nothing.
 *
 * SEEN IN A BROWSER (the lab, 375 × 812 and 375 × 667, touch — the commit's contact sheet).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import { formatCount } from './format-number';
import { BASE, doorAction, renderReplyCard } from './reply-card.fixture';
import { RSVP_GROUPS_MAX, readRsvpLook, rsvpScreenLayout, rsvpStyleHasRows } from './rsvp-look';
import { RSVP_GROUP_PICK_EVENT, RSVP_LIST_PICK_EVENT, RSVP_LIST_WORDS, rsvpLayoutEdit, rsvpPlaceOf, type RsvpLayoutEdit } from './rsvp-layout-edit';

(globalThis as unknown as { React: unknown }).React = React;
const h = React.createElement;
const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const src = (rel: string) => stripComments(raw(rel));
const list = async () => import('../app/dashboard/[eventId]/launch/_components/rsvp-line-list');
const after = (config: unknown, ...edits: RsvpLayoutEdit[]): Record<string, unknown> => {
  let now = config as Record<string, unknown>;
  for (const edit of edits) {
    const res = rsvpLayoutEdit(now, edit);
    assert.ok(res.ok, `the fixture's own edit was refused: ${JSON.stringify(edit)}`);
    now = { ...now, look: res.look };
  }
  return now;
};

test('1 · picking: asked from the last row, ticked on the page, one edit on Done — nothing held or framed meanwhile', () => {
  const STAGE = src(`${L}/rsvp-list-stage.tsx`);
  const PANEL = src(`${L}/maker-rsvp-ask.tsx`);
  /* The last row's Group asks the toolbar (it writes nothing). */
  assert.match(PANEL, /\(\) => window\.dispatchEvent\(new CustomEvent\(RSVP_GROUP_PICK_EVENT, \{ detail: \{ part: listPart, line: picked\.line \} \}\)\)/);
  assert.match(STAGE, /if \(part && typeof d\?\.line === 'string'\) setMulti\(\{ part, names: \[d\.line\] \}\);/, 'picking does not start from the line it was asked on');
  assert.match(STAGE, /window\.addEventListener\(RSVP_GROUP_PICK_EVENT, onGroup\);/);
  assert.notEqual(RSVP_GROUP_PICK_EVENT, RSVP_LIST_PICK_EVENT);
  /* A tap on the page is heard on the frame's WINDOW, first, and goes no further: it ticks, it never picks a part. */
  assert.match(STAGE, /const onTap = \(e: Event\) => \{\s*e\.preventDefault\(\);\s*e\.stopImmediatePropagation\(\);/);
  assert.match(STAGE, /win\.addEventListener\('click', onTap, true\);/);
  assert.match(raw('app/[slug]/_components/rsvp-canvas-bridge.tsx'), /document\.addEventListener\('click', onClick, true\);/, 'anti-vacuity: the page’s own tap is no longer heard on its document (a window listener would not be first)');
  /* A group cannot go inside a group; a line already in one cannot be picked — each says the prototype's line. */
  assert.match(STAGE, /if \(rsvpGroupId\(hit\.name\)\) return say\.current\(target\.closest\('\[data-rsvp-line\]'\) \? RSVP_LIST_WORDS\.inGroupPick : RSVP_LIST_WORDS\.isGroup\);/);
  assert.equal(RSVP_LIST_WORDS.isGroup, 'A group cannot go inside another group.');
  assert.equal(RSVP_LIST_WORDS.inGroupPick, 'That line is already in a group — ungroup it first.');
  /* Tapped again, a line is let go. */
  assert.match(STAGE, /names: m\.names\.includes\(hit\.name\) \? m\.names\.filter\(\(n\) => n !== hit\.name\) : \[\.\.\.m\.names, hit\.name\]/);
  /* The marks: only on what has a place in the screen's top row; a group stands back. */
  assert.match(STAGE, /row\.setAttribute\(RSVP_PICK_ATTR, rsvpGroupId\(name\) \? 'cant' : multi\.names\.includes\(name\) \? 'tick' : 'can'\);/);
  /* …and all of it leaves the page when picking ends. */
  assert.match(STAGE, /style\.remove\(\);\s*for \(const \{ row \} of rows\) row\.removeAttribute\(RSVP_PICK_ATTR\);/);
  /* Nothing is held, and no frame is drawn, while picking. */
  assert.match(STAGE, /subject: \(target\) => \(multiNow\.current \? null : rsvpDragSubject\(doc, part, target, lineNow\.current\)\),/);
  assert.match(STAGE, /away: held \|\| multi !== null,/);
  /* Done is ONE edit, asked of the panel; made, picking is over and the group is picked on Background; refused (a
     fifth group), picking stays and the reason is said. */
  assert.match(STAGE, /if \(m\) askRsvpListEdit\(\{ do: 'group', part: m\.part, lines: m\.names \}\);/);
  assert.match(STAGE, /if \(done\.ok && done\.edit\.do === 'group'\) setMulti\(null\);/);
  assert.match(STAGE, /done\.edit\.do === 'add' \? 'edit' : done\.edit\.do === 'group' \? 'bg' : undefined, done\.edit\.part\)/);
  /* Another screen, the stage closed, Escape, Cancel: picking is over and nothing was changed. */
  assert.match(STAGE, /useEffect\(\(\) => setMulti\(null\), \[on, frameSel\]\);/);
  assert.match(STAGE, /if \(e\.key === 'Escape'\) setMulti\(null\);/);
  assert.match(STAGE, /onCancel=\{\(\) => setMulti\(null\)\}/);
  assert.doesNotMatch(STAGE, /draftAction\(|hubDraftAction|rsvp_ask_config/, 'the toolbar’s half writes the config itself');
});

test('2 · the picking bar, drawn: the prototype’s words; the count is plain words; Done under two is grey', async () => {
  const { RsvpGroupPickBar } = await list();
  const bar = (count: number) => renderToStaticMarkup(h(RsvpGroupPickBar, { count, onDone: () => {}, onCancel: () => {}, onWhy: () => {} }));
  const two = bar(2);
  assert.match(two, /<p data-rsvp-pick-title=""[^>]*>Group · <b[^>]*>pick the lines<\/b><\/p>/);
  assert.match(two, />Tap each line that should share one background\. Tap it again to let it go\.<\/p>/);
  assert.match(two, /<b data-rsvp-picked="2"[^>]*>2 picked<\/b>/);
  assert.deepEqual([...two.matchAll(/<span class="lbl">([^<]+)<\/span>/g)].map((m) => m[1]), ['Done', 'Cancel']);
  assert.equal(RSVP_LIST_WORDS.picked(1234), `${formatCount(1234)} picked`, 'the count is not read through formatCount');
  assert.match(bar(1234), new RegExp(`<b data-rsvp-picked="1234"[^>]*>${formatCount(1234)} picked</b>`), 'the bar draws a number that did not go through formatCount');
  assert.notEqual(formatCount(1234), '1234', 'anti-vacuity: formatCount leaves 1234 as it is');
  assert.equal(RSVP_LIST_WORDS.pickTitle, 'Group · pick the lines');
  /* 🖼 A FRAME ONLY ROUND WHAT IS PRESSED (owner 2026-10-11): the count is words on the toolbar's own ground. */
  const count = two.match(/<b data-rsvp-picked="2"[^>]*class="([^"]*)"/)?.[1] ?? '';
  assert.ok(count.length > 0, 'anti-vacuity: the count was not found');
  assert.doesNotMatch(count, /\b(border|ring|rounded|shadow|bg-)/, 'the count is boxed');
  /* Done: live at two, grey at one — still a button, and a tap on it says why. */
  const doneOf = (html: string) => html.match(/<span class="contents" data-rsvp-pick-done="">(<button[^>]*>)/)?.[1] ?? '';
  assert.doesNotMatch(doneOf(two), / data-waiting=""/);
  assert.match(doneOf(bar(1)), / data-waiting=""/);
  assert.match(src(`${L}/rsvp-line-list.tsx`), /data-rsvp-pick-done="" onClick=\{ready \? undefined : \(\) => onWhy\(RSVP_LIST_WORDS\.tooFew\)\}/);
  assert.equal(RSVP_LIST_WORDS.tooFew, 'Pick at least two lines.');
  /* It lies over the toolbar's own rows, inside the toolbar, and the stage's panel stands aside by rule. */
  assert.match(two, /^<div data-rsvp-group-picking="" role="group" aria-label="Group" class="absolute inset-0 /);
  assert.match(two, /\[data-maker-shell\]:has\(\[data-rsvp-group-picking\]\) \[data-phone-chrome=(&quot;|")panel(&quot;|")\]\{visibility:hidden!important;pointer-events:none!important\}/);
  /* Colour tokens only (owner 2026-10-11). */
  assert.doesNotMatch(two, /#[0-9a-fA-F]{3,8}\b|\b(bg|text|border)-(white|black)\b/);
});

test('3 · a group is a part: ↑ Earlier · ↓ Later · Ungroup — and who may start a group', async () => {
  const { RsvpLinePlaceRow, rsvpPlaceSteps } = await list();
  const grouped = after({}, { do: 'group', part: 'rsvp', lines: ['yes', 'no'] });
  const steps = (config: unknown, name: string, full = false) => rsvpPlaceSteps('rsvp', name, rsvpPlaceOf(config, 'rsvp', name), () => {}, full);
  /* The group: it moves among the screen's lines; it is ungrouped, never removed, and cannot join a group. */
  const g = steps(grouped, 'g:1');
  assert.deepEqual({ earlier: Boolean(g.earlier), later: Boolean(g.later), group: Boolean(g.group), remove: Boolean(g.remove), ungroup: Boolean(g.ungroup) }, { earlier: true, later: false, group: false, remove: false, ungroup: true });
  const html = renderToStaticMarkup(h(RsvpLinePlaceRow, { steps: g, onWhy: () => {} }));
  assert.deepEqual([...html.matchAll(/<span class="lbl">([^<]+)<\/span>/g)].map((m) => m[1]), ['Earlier', 'Later', 'Ungroup']);
  assert.match(html, /data-rsvp-place="ungroup"/);
  assert.doesNotMatch(html, /data-rsvp-place="(group|remove)"/);
  /* A line: no Ungroup; the four of step 5c. */
  assert.equal(steps({}, 'yes').ungroup, null);
  /* A line INSIDE a group moves inside it and cannot start another. */
  const inside = steps(grouped, 'yes');
  assert.deepEqual({ earlier: Boolean(inside.earlier), later: Boolean(inside.later), group: Boolean(inside.group) }, { earlier: false, later: true, group: false });
  assert.equal(inside.why.group, 'This line is already in a group. Open the group, then Ungroup.');
  assert.equal(inside.why.earlier, 'Already first in its group.');
  /* A screen that holds its four groups says so at the button. */
  const full = steps({}, 'question', true);
  assert.equal(full.group, null);
  assert.equal(full.why.group, `A screen takes up to ${formatCount(RSVP_GROUPS_MAX)} groups. Ungroup one to make another.`);
  assert.match(src(`${L}/maker-rsvp-ask.tsx`), /rsvpScreenCounts\(local, listPart\)\.groups >= RSVP_GROUPS_MAX\)\}/);
  /* 🔒 THE CAP IS THE EDIT'S OWN, not only the button's: a screen that holds four groups refuses a fifth. (Four
     groups of two use every line a screen can have, so a fifth can only be asked once groups have lost lines — built
     here: four groups of [a line of the page's own + an added line], the added lines removed, two new lines added.) */
  let four: Record<string, unknown> = {};
  const own = ['eyebrow', 'question', 'yes', 'no'];
  for (const [i, line] of own.entries()) four = after(four, { do: 'add', part: 'rsvp', kind: 'm', anchor: line, where: 'below' }, { do: 'group', part: 'rsvp', lines: [line, `a:${i + 1}`] });
  for (let i = 1; i <= 4; i++) four = after(four, { do: 'remove', part: 'rsvp', line: `a:${i}` });
  assert.equal(readRsvpLook(four).groups?.rsvp?.length, RSVP_GROUPS_MAX, 'anti-vacuity: the screen does not hold four groups');
  four = after(four, { do: 'add', part: 'rsvp', kind: 'm', anchor: 'g:1', where: 'above' }, { do: 'add', part: 'rsvp', kind: 'm', anchor: 'g:1', where: 'above' });
  const loose = (rsvpScreenLayout(readRsvpLook(four), 'rsvp') ?? []).flatMap((item) => ('line' in item ? [item.line] : []));
  assert.equal(loose.length, 2, 'anti-vacuity: two loose lines to group were not made');
  const fifth = rsvpLayoutEdit(four, { do: 'group', part: 'rsvp', lines: loose });
  assert.deepEqual(fifth, { ok: false, why: 'groups-full' }, 'a fifth group was made');
  /* Ungroup is one edit, asked of the panel. */
  assert.match(src(`${L}/rsvp-line-list.tsx`), /ungroup: isGroup \? \(\) => askRsvpListEdit\(\{ do: 'ungroup', part, group: name \}\) : null,/);
});

test('4 · a group’s tools: Edit and Background — Style and Animate are grey and say why', async () => {
  const TOOLS = src(`${L}/stage-tools.tsx`);
  const STAGE = src(`${L}/rsvp-list-stage.tsx`);
  const PANEL = src(`${L}/maker-rsvp-ask.tsx`);
  /* Animate is not offered on a group (controller 2026-10-10); Background is. */
  assert.match(TOOLS, /const ownTool = \(t: MakerPartTool\) => \(rsvpLooks && \(t === 'bg' \|\| \(t === 'animate' && !rsvpList\.groupWhy\)\)\) \|\| \(block !== null && \(t === 'bg' \|\| t === 'animate'\)\);/);
  /* Style has no row for a group (the rule that greys a tool with nothing to set). */
  assert.equal(rsvpStyleHasRows('rsvp', 'g:1'), false);
  assert.equal(rsvpStyleHasRows('yesnote', 'g:1'), false);
  /* What the two grey tools say: the prototype's sentences, before the app's general line. */
  assert.match(TOOLS, /if \(rsvpList\.groupWhy && \(t === 'style' \|\| t === 'animate'\)\) return rsvpList\.groupWhy\[t\];\s*if \(emptyHere\(t\)\) return makerPartToolWhy\(null, t\);/);
  assert.match(STAGE, /const GROUP_WHY = \{ style: RSVP_LIST_WORDS\.groupStyle, animate: RSVP_LIST_WORDS\.groupAnimate \} as const;/);
  assert.match(STAGE, /groupWhy: meta\.group \? GROUP_WHY : null,/);
  assert.equal(RSVP_LIST_WORDS.groupStyle, 'The group’s own look is its background — open Background.');
  assert.equal(RSVP_LIST_WORDS.groupAnimate, 'The group arrives with the page. Its lines each have their own Animate — tap one.');
  /* Its Edit rows are the panel's (the toolbar's own stand aside), and it is called "Group". */
  assert.match(STAGE, /name: isGroup \? 'Group' : added \? RSVP_ADDED_NAME\[added\] : null,/);
  assert.match(STAGE, /own: isGroup \|\| added !== null,/);
  /* THE PANEL — Edit: what it holds, then the last row. Background: the card's own three tiles, the group's sentence. */
  const at = PANEL.indexOf('const groupPlace = ');
  assert.ok(at > 0, 'anti-vacuity: the panel’s group rows were not found');
  const rows = PANEL.slice(at, PANEL.indexOf("if (picked.tool === 'edit' && scene === 'form'", at));
  assert.match(rows, /if \(listPart && picked\.line && groupPlace && \(picked\.tool === 'edit' \|\| picked\.tool === 'bg'\)\) \{/);
  assert.match(rows, /\{RSVP_LIST_WORDS\.groupHolds\(holds\)\}\s*<\/p>\s*\{placeRow\}/);
  assert.match(rows, /<RsvpCardGroundRows now=\{groupPlace\.ground\} label="The group’s background" line=\{RSVP_LIST_WORDS\.groupGround\(holds\)\} onPick=\{\(g\) => askRsvpListEdit\(\{ do: 'ground', part: listPart, group, ground: g \}\)\} \/>/);
  assert.doesNotMatch(rows, /RsvpBuildInRows|StageAnimate/, 'a group is offered Animate');
  assert.equal(RSVP_LIST_WORDS.groupHolds(2), 'This group holds 2 lines. They share one background and move as one. Tap a line inside to change its words.');
  assert.equal(RSVP_LIST_WORDS.groupHolds(1), 'This group holds 1 line. They share one background and move as one. Tap a line inside to change its words.');
  assert.equal(RSVP_LIST_WORDS.groupGround(3), 'One background for all 3 lines in this group. Behind it is the RSVP card.');
  /* The tiles ARE the card's (one drawing): drawn for a group they are the same three, under the group's name. */
  const { RsvpCardGroundRows, RsvpLineGroundRow } = await import('../app/dashboard/[eventId]/launch/_components/rsvp-line-look');
  const tiles = renderToStaticMarkup(h(RsvpCardGroundRows, { now: 'frost', label: 'The group’s background', line: RSVP_LIST_WORDS.groupGround(2), onPick: () => {} }));
  assert.deepEqual([...tiles.matchAll(/data-rsvp-card-tile="([a-z]+)"/g)].map((m) => m[1]), ['none', 'plain', 'frost']);
  assert.match(tiles, /role="group" aria-label="The group’s background"/);
  assert.match(tiles, /aria-pressed="true" aria-label="Frosted"/);
  assert.match(tiles, />One background for all 2 lines in this group\. Behind it is the RSVP card\.<\/p>/);
  /* A LINE INSIDE A GROUP — Background says whose it sits on, and the one button opens the group (on Background). */
  assert.match(PANEL, /if \(picked\.tool === 'bg' && lookLine && listPart && lineGroup\) \{\s*const open: RsvpListPick = \{ part: listPart, name: lineGroup, tool: 'bg' \};/, 'a line in a group is not told whose background it sits on');
  assert.match(PANEL, /<RsvpLineGroundRow words=\{RSVP_LIST_WORDS\.onGroup\} label=\{RSVP_LIST_WORDS\.openGroup\} onOpenCard=\{\(\) => window\.dispatchEvent\(new CustomEvent\(RSVP_LIST_PICK_EVENT, \{ detail: open \}\)\)\} \/>/);
  assert.match(STAGE, /if \(d && typeof d\.name === 'string' && rsvpLookCard\(d\.part\)\) onPick\(d\.name, d\.tool, d\.part\);/);
  const row = renderToStaticMarkup(h(RsvpLineGroundRow, { words: RSVP_LIST_WORDS.onGroup, label: RSVP_LIST_WORDS.openGroup, onOpenCard: () => {} }));
  assert.match(row, />This sits on its group’s background\.<\/p>/);
  assert.match(row, /<span class="lbl">Open the group<\/span>/);
  /* …and its path says so: "RSVP › Form › Group › Question". */
  assert.match(TOOLS, /if \(rsvpList\.inGroup && rsvpLineName && picked\) linePieces\.splice\(linePieces\.length - 1, 0, 'Group'\);/);
});

test('5 · 🔒 a reply is never lost to a group — the real card, drawn for a guest', async () => {
  const card = (config: unknown) => renderReplyCard({ ...BASE, action: doorAction, lines: rsvpScreenLayout(readRsvpLook(config), 'rsvp') });
  const answers = (html: string) => ({ yes: (html.match(/ name="rsvp_status" value="attending"/g) ?? []).length, no: (html.match(/ name="rsvp_status" value="declined"/g) ?? []).length });
  const fieldsets = (html: string) => (html.match(/<fieldset\b/g) ?? []).length;
  const plain = await card({});
  assert.deepEqual(answers(plain), { yes: 1, no: 1 }, 'anti-vacuity: the card as shipped does not hold one Yes and one No');
  const cases: Array<[string, Record<string, unknown>]> = [
    ['Yes and No in one group', after({}, { do: 'group', part: 'rsvp', lines: ['yes', 'no'] })],
    ['Yes and No in two groups', after({}, { do: 'group', part: 'rsvp', lines: ['eyebrow', 'yes'] }, { do: 'group', part: 'rsvp', lines: ['question', 'no'] })],
    ['the group moved first', after({}, { do: 'group', part: 'rsvp', lines: ['yes', 'no'] }, { do: 'place', part: 'rsvp', name: 'g:1', before: 'eyebrow' })],
    ['No moved above Yes inside the group', after({}, { do: 'group', part: 'rsvp', lines: ['yes', 'no'] }, { do: 'step', part: 'rsvp', name: 'no', dir: -1 })],
    ['a line added into the group, the group frosted', after({}, { do: 'group', part: 'rsvp', lines: ['yes', 'no'] }, { do: 'add', part: 'rsvp', kind: 'm', anchor: 'yes', where: 'below' }, { do: 'words', part: 'rsvp', line: 'a:1', text: 'We hope you can come.' }, { do: 'ground', part: 'rsvp', group: 'g:1', ground: 'frost' })],
    ['grouped, then ungrouped', after({}, { do: 'group', part: 'rsvp', lines: ['yes', 'no'] }, { do: 'ungroup', part: 'rsvp', group: 'g:1' })],
  ];
  for (const [label, config] of cases) {
    const html = await card(config);
    assert.deepEqual(answers(html), { yes: 1, no: 1 }, `${label}: the card does not hold one Yes and one No`);
    assert.equal(fieldsets(html), fieldsets(plain), `${label}: the reply's fieldset was split or lost`);
    /* The fieldset still has a name: its legend, or the two lines that name it. */
    assert.ok(/<legend\b/.test(html) || /<fieldset[^>]* aria-labelledby="rsvp-line-eyebrow rsvp-line-question"/.test(html), `${label}: the reply's fieldset has no name`);
    /* The two answers stand inside the fieldset, and neither is hidden. */
    const set = html.slice(html.indexOf('<fieldset'), html.indexOf('</fieldset>'));
    assert.deepEqual(answers(set), { yes: 1, no: 1 }, `${label}: an answer is outside the reply's fieldset`);
    assert.doesNotMatch(set, /<[^>]*\bhidden\b[^>]*name="rsvp_status"|<input[^>]*name="rsvp_status"[^>]*\b(hidden|disabled)\b/, `${label}: an answer is hidden or disabled`);
  }
  /* "Grouped, then ungrouped" is the card as shipped — to the byte (nothing stored = today's page). */
  assert.equal(await card(cases[5]![1]), plain);
  /* A group is drawn for a guest as one wrapper holding its lines. */
  const grouped = await card(cases[0]![1]);
  assert.equal((grouped.match(/ data-rsvp-group="1"/g) ?? []).length, 1);
});

test('6 · the card stands aside for a group — every door to a group is the one edit that does it', () => {
  /* The rule itself (None when made; back as it was at the last Ungroup; a ground picked in between stands) is held
     in `the-rsvp-list-is-edited-whole` § 4. Here: no file makes or unmakes a group any other way. */
  const made = after({ look: { card: { rsvp: { g: 'frost' } } } }, { do: 'group', part: 'rsvp', lines: ['yes', 'no'] });
  assert.deepEqual(readRsvpLook(made).card?.rsvp, { g: 'none', w: 'frost' });
  assert.deepEqual(readRsvpLook(after(made, { do: 'ungroup', part: 'rsvp', group: 'g:1' })).card?.rsvp, { g: 'frost' });
  /* A group emptied by removing its last added line goes the same way. */
  const two = after({}, { do: 'add', part: 'rsvp', kind: 'm', anchor: 'no', where: 'below' }, { do: 'add', part: 'rsvp', kind: 'm', anchor: 'no', where: 'below' }, { do: 'group', part: 'rsvp', lines: ['a:1', 'a:2'] });
  assert.equal(readRsvpLook(two).card?.rsvp?.g, 'none');
  const emptied = after(two, { do: 'remove', part: 'rsvp', line: 'a:1' }, { do: 'remove', part: 'rsvp', line: 'a:2' });
  assert.equal(emptied.look, undefined, 'a group emptied of its lines left something stored');
  for (const file of [`${L}/rsvp-line-list.tsx`, `${L}/rsvp-list-stage.tsx`, `${L}/stage-tools.tsx`, `${L}/maker-rsvp-ask.tsx`, `${L}/rsvp-canvas-arrange.ts`, `${L}/rsvp-canvas-drag.ts`]) {
    assert.doesNotMatch(src(file), /groups\s*:\s*\{|\.groups\s*=|look\.groups\b[^?]/, `${file} writes a group itself`);
  }
});

test('7 · colour tokens only in the marks — and the Maker’s first load learns nothing of groups', () => {
  const STAGE = src(`${L}/rsvp-list-stage.tsx`);
  const at = STAGE.indexOf('const PICK_CSS =');
  assert.ok(at > 0, 'anti-vacuity: the marks’ rules were not found');
  const css = STAGE.slice(at, STAGE.indexOf('const GROUP_WHY', at));
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|\b(white|black)\b|rgba?\(\s*\d/, 'a colour is typed in the marks');
  for (const token of ['--color-ink', '--color-cream', '--sn-accent', '--sn-on-accent']) assert.ok(css.includes(`var(${token})`), `the marks do not wear ${token}`);
  const CSS = raw('app/globals.css');
  for (const token of ['--color-cream:', '--color-ink:', '--sn-accent:', '--sn-on-accent:']) assert.ok(CSS.includes(token), `${token} is not one of the app’s tokens`);
  /* The prototype's marks: the lines step apart, a ring, a tick, a group stands back. */
  assert.match(css, /margin:12px 0 12px 24px!important/);
  assert.match(css, /="tick"\]::after\{content:'✓'/);
  assert.match(css, /="cant"\]\{opacity:\.4\}/);
  const first = ['lib/rsvp-ask.ts', 'lib/hub-draft.ts', 'lib/hub-canvas.ts', 'lib/hub-scenes.ts', 'lib/rsvp-stage-shared.ts', `${L}/maker-shell.tsx`, `${L}/details-workspace.tsx`, `${L}/details-lazy.tsx`];
  for (const file of first) assert.doesNotMatch(src(file), /(from|import\()\s*['"][^'"]*(rsvp-list-stage|rsvp-layout-edit|rsvp-line-list)['"]|RsvpGroupPickBar|RSVP_GROUP_PICK_EVENT/, `${file} loads the group step`);
});
