/**
 * GUARD — a choice of several is ONE dropdown, and every new tour is mounted.
 *
 * Owner, 2026-09-28, on yet another row of pills: *"if there are choices,
 * again. us drop down menu"* — "again" because it had already been said
 * (DECISION_LOG 2026-09-27). A pill row wraps and clips on a 375 phone, and it
 * was being rebuilt faster than it was being removed. And 2026-09-25: *"we
 * always give them a proper tour/welcome so they understand how things work."*
 *
 * ── WHAT THIS CHECKS, AND WHY IT IS A PROPERTY, NOT A PHRASE ────────────────
 * A pill row is recognised by what it DOES, not what it is called: a control
 * that shows which of several options is on — `aria-pressed={x === y}`,
 * `aria-current={…}` or an `active={x === y}` prop — either produced by a
 * `.map(` (one row, however many options) or written out three or more times.
 * A boolean toggle (`aria-pressed={textPill}`) is not a choice between options
 * and is deliberately NOT matched: an on/off stays a switch (owner ruling).
 *
 * Each surface is a WINDOW between two strings that were in the file BEFORE
 * this change (never a line number, never a comment this change wrote), so a
 * revert to pills lands inside the window and is caught. Every window must also
 * still hold a dropdown — `PickMenu`, `LinkPickMenu`, `SelectFilter` or a
 * native `<select>` — so deleting the control does not pass as "no pills".
 *
 * ⚠ The remove frame's reason picker is a native `<select>` on purpose: it is
 * inside a `showModal()` dialog (the top layer), and PickMenu's list portals
 * to `document.body`, under it. See the comment on that control.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOURS, type TourKey } from './tours';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(resolve(WEB, rel), 'utf8');

type Surface = { name: string; file: string; from?: string; to?: string };

const SURFACES: Surface[] = [
  { name: 'Papic Decorate — filter + caption colour', file: 'app/papic/decorate/_components/kwento-decorator.tsx' },
  { name: 'Live Wall layout', file: 'app/dashboard/[eventId]/studio/papic/_components/live-wall-controls.tsx' },
  { name: 'Live Wall mode', file: 'app/dashboard/[eventId]/live/_components/mode-control.tsx' },
  { name: 'Papic gallery filter', file: 'app/dashboard/[eventId]/studio/papic/_components/papic-gallery-grid.tsx' },
  {
    name: 'Patiktok categories',
    file: 'app/dashboard/[eventId]/studio/patiktok/page.tsx',
    from: 'function CategoryChips(',
    to: 'function TemplateCard(',
  },
  {
    name: 'Guest list phone filter (Side, RSVP)',
    file: 'app/dashboard/[eventId]/guests/_components/mobile-guest-carousel.tsx',
    from: 'Filter bottom sheet',
    to: 'Sort bottom sheet',
  },
  {
    name: 'Your Team — Sort by',
    file: 'app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx',
    from: '<div className="sortbar">',
    to: '<div className="bench-search">',
  },
  {
    name: 'Budget — Save / Standard / Splurge',
    file: 'app/dashboard/[eventId]/budget/_components/budget-allocation-planner.tsx',
    from: 'function TiltEditor(',
    to: 'Or set your own (PHP)',
  },
  {
    name: 'Budget tour — Save / Standard / Splurge',
    file: 'app/tour/budget/_components/tour-budget-planner.tsx',
    from: 'function TiltEditor(',
    to: 'Or set your own (PHP)',
  },
  {
    name: 'Seat plan — room size',
    file: 'app/dashboard/[eventId]/seating/_components/seating-editor.tsx',
    from: 'change it if your room is different.',
    to: 'Stage + dance-floor dimensions',
  },
  { name: 'Memories lenses', file: 'app/dashboard/(account)/library/page.tsx' },
  {
    name: 'Remove frame — reason',
    file: 'app/dashboard/(launcher)/_components/event-card-menu.tsx',
    from: 'function ReasonPicker(',
    to: 'function ReasonNote(',
  },
];

/** A control that shows WHICH of several options is on. */
const CHOICE_STATE = /aria-pressed=\{[^}]*===|aria-current=\{|\sactive=\{[^}]*===/g;
const DROPDOWN = /<PickMenu\b|<LinkPickMenu\b|<SelectFilter\b|<select\b/;

export function pillRowsIn(src: string): string[] {
  const hits = [...src.matchAll(CHOICE_STATE)];
  const rows: string[] = [];
  for (const m of hits) {
    const before = src.slice(Math.max(0, (m.index ?? 0) - 800), m.index);
    if (/\.map\(/.test(before)) rows.push(`mapped: …${src.slice(m.index, (m.index ?? 0) + 60)}`);
  }
  if (hits.length >= 3) rows.push(`${hits.length} option controls written out`);
  return rows;
}

function windowOf(s: Surface): string {
  const src = read(s.file);
  if (!s.from) return src;
  const a = src.indexOf(s.from);
  assert.ok(a >= 0, `${s.name}: the anchor "${s.from}" is gone from ${s.file} — re-anchor this guard, do not delete it`);
  const b = s.to ? src.indexOf(s.to, a) : src.length;
  assert.ok(b > a, `${s.name}: the anchor "${s.to}" is gone from ${s.file}`);
  return src.slice(a, b);
}

test('the detector sees a pill row, and does not see a toggle', () => {
  // Executed, so the guard below cannot pass by matching nothing.
  const mapped = `{OPTS.map((o) => (<button aria-pressed={v === o.id} onClick={() => set(o.id)}>{o.label}</button>))}`;
  assert.equal(pillRowsIn(mapped).length, 1);
  const written = `<Seg active={t === 'a'} /><Seg active={t === 'b'} /><Seg active={t === 'c'} />`;
  assert.ok(pillRowsIn(written).length >= 1);
  assert.deepEqual(pillRowsIn(`<button aria-pressed={textPill}>Pill</button>`), []);
});

for (const s of SURFACES) {
  test(`${s.name} is one dropdown, not a pill row`, () => {
    const w = windowOf(s);
    assert.deepEqual(
      pillRowsIn(w),
      [],
      `${s.name} (${s.file}) has a single-choice pill row again. A choice of several options is ONE dropdown — the shared PickMenu (owner rule 2026-09-28).`,
    );
    assert.match(w, DROPDOWN, `${s.name} (${s.file}) no longer holds a dropdown at all — the choice was deleted, not converted.`);
  });
}

// ── First-visit tours ────────────────────────────────────────────────────────

const TOUR_MOUNTS: { key: TourKey; file: string; tag: 'MiniTour' | 'GuestGuidedTour' }[] = [
  { key: 'guest_papic_camera_v1', file: 'app/papic/guest/page.tsx', tag: 'GuestGuidedTour' },
  { key: 'guest_papic_me_v1', file: 'app/papic/me/[token]/page.tsx', tag: 'GuestGuidedTour' },
  { key: 'customer_guest_list_v1', file: 'app/dashboard/[eventId]/guests/page.tsx', tag: 'MiniTour' },
  { key: 'customer_budget_v1', file: 'app/dashboard/[eventId]/budget/page.tsx', tag: 'MiniTour' },
  { key: 'customer_galleries_v1', file: 'app/dashboard/[eventId]/galleries/page.tsx', tag: 'MiniTour' },
  { key: 'customer_papic_v1', file: 'app/dashboard/[eventId]/studio/papic/page.tsx', tag: 'MiniTour' },
];

for (const t of TOUR_MOUNTS) {
  test(`tour ${t.key} exists, is short, and is mounted`, () => {
    const tour = TOURS[t.key];
    assert.ok(tour, `${t.key} is not in TOURS`);
    assert.ok(
      tour.slides.length >= 3 && tour.slides.length <= 5,
      `${t.key} has ${tour.slides.length} slides — a first-visit tour is 3 to 5 short slides`,
    );
    const mount = new RegExp(`<${t.tag} tourKey="${t.key}"`);
    assert.match(read(t.file), mount, `${t.key} is defined but not mounted in ${t.file} — a tour nobody sees`);
  });
}

test('the tours speak plain, event-neutral words', () => {
  for (const t of TOUR_MOUNTS) {
    const text = TOURS[t.key].slides.map((s) => `${s.title} ${s.body}`).join(' ');
    // Retired Papic products and words the owner has banned from UI copy.
    assert.doesNotMatch(text, /\bwedding\b|\bwebsite\b|\bvendors?\b|photo-crew|guest cameras are free|first 5/i, `${t.key}: "${text.slice(0, 80)}…"`);
  }
});
