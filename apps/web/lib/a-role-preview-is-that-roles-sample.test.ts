/**
 * 🎭 A ROLE PREVIEW IS THAT ROLE'S SAMPLE — owner 2026-10-17: *"i want to see how the palette changes depending on the
 * guest?"* … *"for example i want to view it as a father of the bride"*.
 *
 * See as ▾ › Role ▾ dresses the fabricated seat-holder in one role of the event's guest list. Held here, each by
 * executing it:
 *
 *   1. Role ▾ lists THIS event's guest-list vocabulary (its role set) — the owner's roles, a man / woman half where
 *      the role does not say it, never the couple — and every row it offers is one the guest page will honour;
 *   2. `?asrole=` is read strictly — a role outside the set, a half the role contradicts, an array: no role;
 *   3. a role preview renders THAT ROLE's own dress code — a mixed pair (Father vs Mother of the Bride) each read
 *      their own pick and colours, never the other's; the Dress Code scene on the canvas answers for the sample;
 *   4. no real guest's row is read — the sample is named for its role, never a person's name, and the guest page
 *      loads the preview person only when NO role is picked;
 *   5. the Maker holds the role as draw-time state: never written, never on the canvas address unless See as is a
 *      guest.
 *
 * Run from `apps/web`: `npx tsx --test lib/a-role-preview-is-that-roles-sample.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { previewRoleOf, previewRoleOptions } from './preview-role';
import { MUSLIM_ROLE_SET, WEDDING_ROLE_SET } from './role-sets';
import { buildSimulatedGuestIdentity, SIMULATED_GUEST_ID } from './simulated-guest-preview';
import { guestAttireOf } from './attire-rows';
import { SEE_AS_ANY_ROLE, SEE_AS_ROLE_PARAM, seeAsRoleQuery } from './see-as';
import { stripComments } from './strip-comments';
import type { RolePalette } from './mood-board';

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
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const OFFERED = WEDDING_ROLE_SET.offeredRoles;

/* cale-ice-shaped: the VIP family dressed as two picks — the men in a barong in the row's own colours, the women in a
   Filipiniana in their OWN colours (`dress_code_config.women`); the sponsors one Wear for both; the guests two picks. */
const MEN = ['#351115', '#646B38'];
const WOMEN = ['#E6C0B3', '#F3E5B9'];
const CONFIG = {
  title: 'Formal',
  groups: { vip_family: { style: 'barong_tagalog' }, principal_sponsors: { style: 'barong_tagalog' }, bridesmaids: { style: 'filipiniana' } },
  roles: { guest: { style: 'barong_tagalog' } },
  women: { groups: { vip_family: { style: 'filipiniana', colours: WOMEN }, principal_sponsors: { style: 'long_gown' } }, roles: { guest: { style: 'cocktail_dress' } } },
};
const BOARD: RolePalette = {
  reception: ['#5C0700', '#669C35'],
  parents_immediate_family: MEN,
  principal_sponsors: ['#8B7E74', '#6C6C6C'],
  bridesmaids: ['#B51A00'],
  guest: ['#2B1D14', '#8E3B5B'],
  touched_roles: ['parents_immediate_family', 'principal_sponsors', 'bridesmaids', 'guest'],
} as RolePalette;
const words = { eventWord: 'wedding', solemn: false, twoPeople: true } as never;

/** The sample, dressed in a role — exactly as the guest page builds it. */
function sampleAs(key: string) {
  const role = previewRoleOf(key, OFFERED);
  assert.ok(role, `${key}: not a role the preview honours`);
  return buildSimulatedGuestIdentity({ slug: 'cale-ice', seeAs: 'pending', role }).guest;
}

/** Me › What to wear, for that sample — the part the guest's Me tab draws. */
async function whatToWear(key: string): Promise<string> {
  const { DressCodeWidget } = await import('../app/[slug]/_components/dress-code-widget');
  const g = sampleAs(key);
  return renderToStaticMarkup(
    React.createElement(DressCodeWidget as never, { words, config: CONFIG, rolePalette: BOARD, guestRole: g.role, guestAttire: guestAttireOf(g), part: 'wear' }),
  );
}

/** Every colour a render paints, upper-cased (`background-color:#…`, `data-colour="#…"`). */
const colours = (html: string) => new Set([...html.matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => m[0].toUpperCase()));

test('1 · Role ▾ lists this event’s guest-list roles — the owner’s, halves where needed, never the couple', () => {
  const rows = previewRoleOptions(OFFERED);
  const labels = rows.map((r) => r.label);
  assert.equal(rows[0]!.key, SEE_AS_ANY_ROLE, 'the first row is the plain sample');
  for (const want of [
    'Father of the Bride', 'Mother of the Bride', 'Father of the Groom', 'Mother of the Groom',
    'Grandfather of the Bride', 'Grandmother of the Bride', 'Principal Sponsor (Ninong)', 'Principal Sponsor (Ninang)',
    'Candle Sponsor · man', 'Veil Sponsor · woman', 'Maid of Honor', 'Best Man', 'Bridesmaid', 'Groomsman',
    'Ring Bearer', 'Flower Girl', 'Guest · man', 'Guest · woman',
  ]) assert.ok(labels.includes(want), `Role ▾ is missing "${want}"`);
  assert.ok(!rows.some((r) => /^(bride|groom|celebrant)-/.test(r.key)), 'the couple is offered as a guest');
  assert.equal(new Set(rows.map((r) => r.key)).size, rows.length, 'a row is listed twice');
  /* Every row offered is one the page honours — a list and a reader that disagree is a dead pick. */
  for (const r of rows.slice(1)) assert.equal(previewRoleOf(r.key, OFFERED)?.key, r.key, `${r.key} is offered but refused`);
  /* The vocabulary is the EVENT's: a Nikah has its principals, and no ninang. */
  const nikah = previewRoleOptions(MUSLIM_ROLE_SET.offeredRoles).map((r) => r.key);
  assert.ok(nikah.includes('wali-m') && !nikah.some((k) => k.startsWith('principal_sponsor_ninang')));
  /* The couple's own word for a role is the row's word. */
  const renamed = previewRoleOptions(OFFERED, { bridesmaid: { one: 'Bride’s Crew' } } as never).map((r) => r.label);
  assert.ok(renamed.includes('Bride’s Crew'), 'Role ▾ ignores the couple’s rename');
});

test('2 · `?asrole=` is read strictly', () => {
  assert.equal(previewRoleOf('bride_parents-m', OFFERED)?.attire, 'suit');
  assert.equal(previewRoleOf('BRIDE_PARENTS-F ', OFFERED)?.attire, 'gown');
  for (const bad of ['principal_sponsor_ninang-m', 'flower_girl-m', 'groomsman-f', 'bride-f', 'groom-m', 'wali-m', 'nobody-f', 'guest', 'guest-x', '', ['guest-f', 'guest-m'], null, undefined]) {
    assert.equal(previewRoleOf(bad, OFFERED), null, `${JSON.stringify(bad)} was honoured`);
  }
});

test('3 · a role preview renders THAT role’s own dress code — Father vs Mother of the Bride', async () => {
  const father = await whatToWear('bride_parents-m');
  const mother = await whatToWear('bride_parents-f');
  assert.match(father, /Barong Tagalog/, 'the father is not told the men’s Wear');
  assert.match(mother, /Filipiniana/, 'the mother is not told the women’s Wear');
  assert.doesNotMatch(father, /Filipiniana/, 'the father is told the women’s Wear');
  assert.doesNotMatch(mother, /Barong/, 'the mother is told the men’s Wear');
  const his = colours(father);
  const hers = colours(mother);
  for (const c of MEN) assert.ok(his.has(c) && !hers.has(c), `${c}: the men’s colour is not the father’s alone`);
  for (const c of WOMEN) assert.ok(hers.has(c) && !his.has(c), `${c}: the women’s colour is not the mother’s alone`);
  assert.match(father, /data-person="m"/, 'the father is drawn as somebody else');
  assert.match(mother, /data-person="f"/, 'the mother is drawn as somebody else');
  /* A role that says who needs no half: the ninang reads the women's pick, the bridesmaid her own row. */
  assert.match(await whatToWear('principal_sponsor_ninang-f'), /Long gown/i);
  assert.match(await whatToWear('principal_sponsor_ninong-m'), /Barong Tagalog/);
  assert.ok(colours(await whatToWear('bridesmaid-f')).has('#B51A00'));
});

async function dressScene(guest: Record<string, unknown>): Promise<string> {
  const { HideableWidgetRender } = await import('../app/[slug]/_components/hideable-widget-render');
  const Render = HideableWidgetRender as unknown as React.FunctionComponent<Record<string, unknown>>;
  return renderToStaticMarkup(
    React.createElement(Render, {
      widget: { widget_id: 'W1', event_id: 'E1', widget_type: 'dress_code', is_always_on: false, is_visible: true, config_json: {} },
      guestView: false,
      event: { event_id: 'E1', public_id: 'S89E-TESTTESTTE', dress_code_config: CONFIG, role_palette: BOARD, ceremony_type: 'catholic' },
      words,
      guest,
      sideLabel: 'Bride',
      scheduleBlocks: [],
      isLive: false,
      isLimitedPlusOne: false,
      ourPhotoUrls: [],
    }),
  );
}

test('3 · on the Maker canvas the Dress Code scene answers for the SAMPLE — and stays general for the host', async () => {
  const sample = await dressScene(sampleAs('bride_parents-f') as never);
  assert.match(sample, /You are/, 'the sample’s Dress Code scene speaks to nobody');
  assert.ok(colours(sample).has(WOMEN[0]!.toUpperCase()), 'the sample’s scene is not in her own colours');
  /* The host editing their own canvas holds a real row with the same role — still the general view. */
  const host = await dressScene({ ...sampleAs('bride_parents-f'), guest_id: '7f3c1d2e-0000-4000-8000-000000000001' } as never);
  assert.doesNotMatch(host, /You are/, 'the host editing the canvas is answered as a guest');
});

test('4 · no real guest’s row is read — the sample is named for its role, and the page loads no person for it', () => {
  const real = { first_name: 'Ana', last_name: 'Reyes', display_name: 'Ana Reyes', plus_one_allowed: true, plus_one_count: 2 };
  for (const key of ['bride_parents-m', 'bride_parents-f', 'principal_sponsor_ninang-f', 'bridesmaid-f', 'guest-f']) {
    const g = buildSimulatedGuestIdentity({ slug: 'w', seeAs: 'replied', person: real, role: previewRoleOf(key, OFFERED) }).guest;
    assert.equal(g.guest_id, SIMULATED_GUEST_ID, `${key}: the sample took a real id`);
    assert.doesNotMatch(`${g.first_name} ${g.last_name} ${g.display_name}`, /Ana|Reyes/, `${key}: a real person’s name reached a role preview`);
    assert.match(g.display_name ?? '', /^An? [a-z]/, `${key}: the sample is not named for its role`);
    assert.equal(g.plus_one_allowed, false, `${key}: a real person’s plus-one reached a role preview`);
  }
  assert.equal(buildSimulatedGuestIdentity({ slug: 'w', role: previewRoleOf('bride_parents-m', OFFERED) }).guest.display_name, 'A father of the bride');
  /* The page: inside the See as branch, the ONE preview-person read is skipped whenever a role is picked. */
  const page = read('app/[slug]/page.tsx');
  const from = page.indexOf('const seeAs = resolveSampleViewer(');
  const to = page.indexOf("if (guestViewer.kind === 'anonymous')", from);
  assert.ok(from > 0 && to > from, 'the sample-viewer branch moved — re-anchor this test');
  const branch = page.slice(from, to);
  const calls = [...branch.matchAll(/loadPreviewPerson\(/g)];
  assert.equal(calls.length, 1, 'the branch reads the preview person more (or less) than once');
  assert.match(branch, /person:\s*previewRole\s*\?\s*null\s*:\s*await loadPreviewPerson\(/, 'a role preview still reads a real guest');
  assert.match(branch, /role:\s*previewRole\b/, 'the role is read but never dresses the sample');
  /* The vocabulary module touches nothing. */
  assert.doesNotMatch(read('lib/preview-role.ts'), /\.from\(|createAdminClient|createClient|'use server'|fetch\(/);
});

test('5 · the Maker holds Role as draw-time state — on the canvas address only while See as is a guest', () => {
  assert.equal(seeAsRoleQuery('pending', 'bride_parents-m'), `&${SEE_AS_ROLE_PARAM}=bride_parents-m`);
  assert.equal(seeAsRoleQuery('declined', 'guest-f'), `&${SEE_AS_ROLE_PARAM}=guest-f`);
  for (const off of [null, 'signed-out'] as const) assert.equal(seeAsRoleQuery(off, 'bride_parents-m'), '', `${off}: a role rides a page with no guest`);
  assert.equal(seeAsRoleQuery('replied', SEE_AS_ANY_ROLE), '');
  assert.equal(seeAsRoleQuery('replied', null), '');
  const maker = read('app/dashboard/[eventId]/launch/_components/maker-shell.tsx');
  assert.match(maker, /const \[seeAsRole, setSeeAsRole\] = useState<string \| null>\(null\);/);
  const memory = maker.slice(maker.indexOf('window.sessionStorage.setItem(memoryKey'), maker.indexOf('window.sessionStorage.setItem(memoryKey') + 160);
  assert.ok(memory.length > 0 && !/seeAsRole/.test(memory), 'Role was written into the tab’s memory');
  const canvas = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  assert.match(canvas, /seeAsRoleQuery\(seeAs, maker\?\.seeAsRole\)/, 'the canvas address does not carry the role');
});
