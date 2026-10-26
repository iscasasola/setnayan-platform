/**
 * four-level-model.test.ts — the four-level map's pure rules (🌳 ③b; corpus interactive-v4.html, PLAN § 7):
 * the Parts column narrows to a picked service, search reaches all four levels with a path (a part by a
 * linked service's name, "via …"), Needs a look counts gaps + held cards + "filed under Other", old
 * addresses resolve, and Download ▾'s CSV keeps every gap.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cardWord,
  flatHits,
  hitTarget,
  needsCount,
  partLinkSummary,
  partsShown,
  resolveSel,
  withDesktopDefaults,
} from './four-level-model';
import { FIXTURE as D } from './four-level-fixture';
import { treeCsv, treePdf, treeRows } from './tree-export';

test('the Parts column: every part of the category (home first); a picked service narrows it', () => {
  const all = partsShown(D, { g: 'venue', c: 'reception', sel: 'c:reception' });
  assert.deepEqual(all.list.map((p) => p.key), ['overall', 'reception_venue']);
  assert.equal(all.service, null);
  // Ceremony's only service feeds "Venue & decor", whose home is Reception — listed, as a foreign part.
  assert.deepEqual(partsShown(D, { g: 'venue', c: 'ceremony', sel: 'c:ceremony' }).list.map((p) => p.key), ['overall']);
  const fh = partsShown(D, { g: 'venue', c: 'reception', sel: 's:function_hall' });
  assert.equal(fh.service?.key, 'function_hall');
  assert.deepEqual(fh.list.map((p) => p.key), ['overall', 'reception_venue']);
  const church = partsShown(D, { g: 'venue', c: 'ceremony', sel: 's:church' });
  assert.deepEqual(church.list.map((p) => p.key), ['overall']);
});

test('a part row says which services it links', () => {
  const groom = D.parts.find((p) => p.key === 'groom')!;
  assert.deepEqual(partLinkSummary(D, groom), { text: 'all 2 services', gap: false });
  const overall = D.parts.find((p) => p.key === 'overall')!;
  assert.equal(partLinkSummary(D, overall).text, '3 of 3 here · + 1 other category');
  assert.deepEqual(partLinkSummary(D, D.parts.find((p) => p.key === 'entourage')!), { text: 'no service', gap: true });
});

test('search reaches all four levels, each hit with its path; a part matches through a linked service', () => {
  const hits = flatHits(D, 'barong', '');
  assert.ok(hits.some((h) => h.kind === 'category' && h.id === 'filipiniana_barongs'));
  assert.ok(hits.some((h) => h.kind === 'service' && h.id === 'barong_tagalog_custom' && h.path === "Attire, hair & make-up › Groom's Attire"));
  const viaPart = hits.find((h) => h.kind === 'part' && h.id === 'groom');
  assert.equal(viaPart?.note, 'via Barong Tagalog (custom)');
  assert.deepEqual(flatHits(D, 'zzz', ''), []);
  // Accents fold: "Filipiniána" finds Filipiniana & Barongs.
  assert.ok(flatHits(D, 'Filipiniána', '').some((h) => h.id === 'filipiniana_barongs'));
  // A hit jumps to its category with the item open.
  assert.deepEqual(hitTarget(D, viaPart!), { in: 'c:grooms_attire', open: 'p:groom' });
});

test('Needs a look = categories with no service + parts with no service + held cards + categories filed under Other', () => {
  // filipiniana_barongs (no service · no filing → counted once per reason), entourage, one held card.
  assert.equal(needsCount(D), 1 + 1 + 1 + 1);
  const needs = flatHits(D, '', 'needs');
  assert.ok(needs.some((h) => h.kind === 'card' && h.id === 'fx-2' && h.note === 'Held · shop hidden'));
  assert.ok(needs.some((h) => h.kind === 'part' && h.id === 'entourage'));
  // A gap category is listed once, not again as "filed under Other".
  assert.equal(needs.filter((h) => h.id === 'filipiniana_barongs').length, 1);
  assert.deepEqual(flatHits(D, '', 'hidden').map((h) => h.id), ['entourage']);
});

test('card words stand in for the card checks: Live / Held · off / Held · shop hidden', () => {
  const base = D.cards[0]!;
  assert.equal(cardWord(base), 'Live');
  assert.equal(cardWord({ ...base, active: false }), 'Held · off');
  assert.equal(cardWord({ ...base, shopPublic: false }), 'Held · shop hidden');
});

test('old addresses resolve: ?open=s:… stands on its category; ?open=p:… on its home; desktop defaults fill in', () => {
  assert.deepEqual(resolveSel(D, { open: 's:function_hall' }), { g: 'venue', c: 'reception', sel: 's:function_hall' });
  assert.deepEqual(resolveSel(D, { open: 'p:groom' }), { g: 'look', c: 'grooms_attire', sel: 'p:groom' });
  assert.deepEqual(resolveSel(D, { open: 'k:fx-1' }), { g: 'venue', c: 'reception', sel: 'k:fx-1' });
  // A part opened from a category that is not its home keeps that category (`in` wins).
  assert.deepEqual(resolveSel(D, { in: 'c:ceremony', open: 'p:overall' }), { g: 'venue', c: 'ceremony', sel: 'p:overall' });
  assert.deepEqual(withDesktopDefaults(D, { g: '', c: '', sel: '' }), { g: 'venue', c: 'reception', sel: '' });
  // A stale id resolves to nothing rather than to a wrong place.
  assert.deepEqual(resolveSel(D, { open: 's:gone' }), { g: '', c: '', sel: 's:gone' });
});

test('Download ▾ CSV: the header, one row per service × part link, and every gap survives', () => {
  const csv = treeCsv(D, treeRows(D, '', ''));
  assert.ok(csv.startsWith('﻿group,category,service,service_key,part,part_key,home,hidden\n'));
  const lines = csv.trim().split('\n');
  assert.ok(lines.includes('Venues & churches,Reception,Function Hall,function_hall,Reception venue,reception_venue,yes,no'));
  // The category with no service is one row with empty service columns.
  assert.ok(lines.some((l) => l.startsWith('"Attire, hair & make-up",Filipiniana & Barongs,,,')), 'the empty category vanished from the CSV');
  // The part with no service still has its row.
  assert.ok(lines.some((l) => l.includes(',Entourage attire,entourage,yes,yes')), 'the part with no service vanished');
  // It follows the search.
  const only = treeCsv(D, treeRows(D, 'barong', '')).trim().split('\n');
  assert.ok(only.length > 1 && only.slice(1).every((l) => l.includes('Attire')), only.join('\n'));
});

test('Download ▾ PDF: a real A4 document', async () => {
  const bytes = await treePdf(D, treeRows(D, '', ''), { filter: 'Everything', date: '26 Oct 2026' });
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString('latin1'), '%PDF-');
  assert.ok(bytes.length > 1000);
});
