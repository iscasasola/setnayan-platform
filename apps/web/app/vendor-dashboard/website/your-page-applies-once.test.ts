/**
 * YOUR PAGE — EDITS ARE A DRAFT; ONE APPLY PUBLISHES (simpler supplier dashboard step 5, prototype moment 7).
 *
 * The old website editor saved every tap the moment it was made, so a half-chosen page was live while the supplier
 * was still choosing. These hold the new promise from the source, where a regression would land:
 *   1 · the parts editor never calls a one-field save — only Apply writes, and only `applyVendorPageDraft`;
 *   2 · Apply runs EVERY part through the same `websiteFieldPatch` the one-field save uses (allowlist + plan asks),
 *       and writes them in ONE update — all or nothing;
 *   3 · the draft is the supplier's browser only, wrapped, keyed per shop (no new server storage);
 *   4 · Your collections' switch is a draft change too — it never saves.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const PARTS = 'app/vendor-dashboard/website/_components/page-parts.tsx';
const DRAFT = 'app/vendor-dashboard/website/_components/use-page-draft.ts';
const COLLECTIONS = 'app/vendor-dashboard/collections/_components/collections-list.tsx';
const ACTIONS = 'app/vendor-dashboard/actions.ts';

/** The body of an exported async function, up to the next top-level export. */
function fnBody(file: string, name: string): string {
  const s = src(file);
  const at = s.indexOf(`export async function ${name}(`);
  assert.ok(at > -1, `${name} is gone from ${file}`);
  const next = s.indexOf('\nexport ', at + 10);
  return s.slice(at, next > -1 ? next : undefined);
}

test('1 · the page parts never save a part on their own — Apply is the only write', () => {
  const parts = src(PARTS);
  for (const one of ['updateVendorWebsiteField', 'updateVendorProfileField']) {
    assert.ok(!parts.includes(one), `page-parts.tsx calls ${one} — a tap would publish before Apply`);
  }
  assert.equal((parts.match(/applyVendorPageDraft\(/g) ?? []).length, 1, 'Apply must post through applyVendorPageDraft, once');
  // The one call sits inside `apply`, which the thumb row's Apply button runs.
  assert.match(parts, /const apply = \(\) => \{[\s\S]*?applyVendorPageDraft\(null, fd\)/, 'the write is not inside apply()');
  assert.match(parts, /label=\{pending \? 'Applying…' : 'Apply'\}[\s\S]{0,80}onClick=\{apply\}/, 'the Apply button does not run apply()');
});

test('2 · Apply runs every part through the one-field rules, then writes ONCE', () => {
  const apply = fnBody(ACTIONS, 'applyVendorPageDraft');
  assert.match(apply, /for \(const field of fields\) \{\s*const part = websiteFieldPatch\(field, formData, ctx\);/, 'a part skips websiteFieldPatch');
  assert.match(apply, /if \(!part\.ok\) return \{ ok: false, error: `Nothing was applied\./, 'a refused part does not stop the whole Apply');
  assert.equal((apply.match(/\.update\(/g) ?? []).length, 1, 'Apply must write the page in exactly one update');
  assert.ok(apply.indexOf('.update(') > apply.indexOf('websiteFieldPatch('), 'the write happens before every part was checked');
  // …and the one-field save still uses the same helper, so the two can never disagree.
  const one = fnBody(ACTIONS, 'updateVendorWebsiteField');
  assert.match(one, /websiteFieldPatch\(field, formData,/, 'the one-field save no longer shares the part rules');
  // The allowlist is the gate for every field name the form carries.
  assert.match(apply, /fields\.some\(\(f\) => !INLINE_WEBSITE_FIELDS\.has\(f\)\)/, 'Apply accepts a field outside the allowlist');
});

test('3 · the draft lives in this browser only — wrapped, per shop', () => {
  const d = src(DRAFT);
  assert.match(d, /draftStorageKey\(vendorProfileId\)/, 'the draft is not keyed per shop');
  const touches = d.match(/window\.localStorage\.\w+\(/g) ?? [];
  assert.ok(touches.length >= 2, 'the draft is not kept in browser storage');
  // Every storage touch sits inside a try.
  for (const m of d.matchAll(/window\.localStorage\.\w+\(/g)) {
    const before = d.slice(0, m.index);
    assert.ok(before.lastIndexOf('try {') > before.lastIndexOf('}'), 'a browser-storage touch is not wrapped in try/catch');
  }
  assert.ok(!/from '\.\.\/\.\.\/actions'|'use server'/.test(d), 'the draft hook reaches the server');
});

test('4 · Your collections’ switch is a draft change, never a save', () => {
  const c = src(COLLECTIONS);
  assert.match(c, /usePageDraft\(vendorId, saved\)/, 'the switch is not wired to the page draft');
  assert.match(c, /const togglePage = \(\) => \{[\s\S]*?setDraft\(/, 'the switch does not change the draft');
  for (const one of ['updateVendorWebsiteField', 'updateVendorProfileField', 'applyVendorPageDraft']) {
    assert.ok(!c.includes(one), `collections-list.tsx calls ${one} — the switch would publish without Apply`);
  }
  assert.match(c, /Shown on your page after Apply/, 'the switch no longer says it waits for Apply');
});
