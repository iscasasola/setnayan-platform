/**
 * home-has-no-go-elsewhere-links.test.ts — H5 of the Home redraw (owner
 * 2026-09-28 "no go-edit-elsewhere links", 2026-10-07 HOME_AND_GUESTS H5; Maker
 * PR 4e). The Home's controls sit in place or are a button that opens the
 * thing: no "→" / "↗" link copy, no "View your full checklist →", no "Open the
 * list ↗", no "Edit in X". Checked on the RENDER, in every state, and on the
 * source of the files that draw the Home.
 *
 * RE-AIMED 2026-10-24 (owner-approved `home_control_center_2026-10-24_fable.html`): What's next is gone; the control
 * row's tiles and cards are doors BY RULING ("the upper parts are the ones that open to another page"), and the
 * Event Hub card carries the owner's own second button, "Edit in Maker" (24 Oct: *"Event Hub Maker / Event Hub itself,
 * two buttons"*) — the one "Edit in" this guard allows, by name.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { pickHomeNext, type HomeNextInput } from '@/lib/home-first-screen';
import { fixtureControl, fixtureControlUnread } from '@/lib/home-control-fixture';
import { drawHome, loadHome } from './home-render.harness';

test.before(loadHome);
const HERE = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => stripComments(readFileSync(join(HERE, ...rel.split('/')), 'utf8'));

const READ: HomeNextInput = { guide: null, hasDate: true, guests: { total: 14, unsent: 3 }, noun: 'wedding', papicReady: false, aiOffer: false };

/** The Home as the page draws it — `unread` = every read failed. */
function draw(unread: boolean, input: HomeNextInput = READ): string {
  const next = pickHomeNext(unread ? { ...input, guests: null } : input);
  return drawHome({ next, control: unread ? fixtureControlUnread('e1', { next }) : fixtureControl('e1', { next }) });
}
/** What a person reads: the markup's text plus every aria-label / title. */
const words = (html: string) =>
  [html.replace(/<[^>]+>/g, ' '), ...(html.match(/(?:aria-label|title)="[^"]*"/g) ?? [])].join(' ');

// "›" is allowed: a door's chevron marks the door, it does not send you to edit elsewhere. "Edit in Maker" is the owner's
// own button on the Event Hub widget (24 Oct) — allowed by name, and only that one.
const ARROWS = /[→↗»]|&rarr;|&#x2197;|\bEdit in\b(?! Maker\b)/;

test('no arrow link copy on the rendered Home — read, failed, and every Today', () => {
  const kinds: HomeNextInput[] = [
    READ,
    { ...READ, guide: { done: 9, total: 20, stageTitle: 'Invitation', stageDone: 4, stageTotal: 8 } },
    { ...READ, hasDate: false },
    { ...READ, guests: { total: 0, unsent: 0 } },
    { ...READ, guests: { total: 14, unsent: 0 }, papicReady: true },
    { ...READ, guests: { total: 14, unsent: 0 }, aiOffer: true },
    { ...READ, guests: { total: 14, unsent: 0 } },
  ];
  for (const k of kinds) {
    for (const unread of [false, true]) {
      const html = draw(unread, k);
      assert.doesNotMatch(words(html), ARROWS, `${pickHomeNext(k).kind}${unread ? ' (unread)' : ''}: a go-elsewhere arrow`);
    }
  }
  // "Edit in Maker" is on the Event Hub widget and nowhere else.
  const html = draw(false);
  // Once on the phone's Event Hub tile (its pen) and once on the md+ Event Hub card.
  assert.equal(html.split('aria-label="Edit in Maker"').length - 1, 2, 'Edit in Maker is drawn somewhere other than the Event Hub widget');
  for (const at of [...html.matchAll(/aria-label="Edit in Maker"/g)].map((m) => m.index!)) {
    const before = html.slice(0, at);
    const owner = Math.max(before.lastIndexOf('data-home-tile="'), before.lastIndexOf('data-home-card-key="'));
    assert.match(html.slice(owner, owner + 30), /="hub"/, 'Edit in Maker sits on a widget other than the Event Hub');
  }
});

test('the Home\'s source draws no arrow link copy', () => {
  for (const file of ['home-first-screen.tsx', 'home-parts.tsx', 'home-control-row.tsx', 'home-tile.tsx', 'home-control-faces.ts']) {
    const text = src(`_components/${file}`);
    // String and JSX text only — not `=>` arrows in code.
    const copy = (text.match(/(['"`])(?:(?!\1)[^\\]|\\.)*\1|>[^<{}]+</g) ?? []).join(' ');
    assert.doesNotMatch(copy, ARROWS, `${file}: go-elsewhere copy`);
  }
});

test('every control on the Home is a button with icon + word, or a widget door', () => {
  const html = draw(false);
  const tags = html.match(/<(?:a|button) [^>]*>/g) ?? [];
  // The widgets are whole-tile / whole-card doors; their tiny actions and dots are named; everything else is an
  // ActionButton (class "ab …") with its word in aria-label. The ⓘ is InfoTip's own button.
  const plain = tags.filter(
    (t) => !/class="ab |class="hc-door"|class="hc-card-door"|class="hc-fig|class="hc-pay hc-more|class="hc-tiny|class="hc-dot|class="hc-today|class="home-tile|class="home-card|aria-label="About /.test(t),
  );
  assert.deepEqual(plain, [], 'a control that is neither an ActionButton nor a Home widget door');
  for (const t of tags.filter((x) => /class="(ab |hc-door|hc-card-door|hc-tiny|hc-dot|hc-today)/.test(x))) assert.match(t, /aria-label="[^"]+"/, `an unnamed control: ${t}`);
});
