/**
 * no-delete-x-on-list-rows.test.ts — 👈 NO LIST ROW SHIPS A VISIBLE DELETE ✕ (owner 2026-11-03, DECISION_LOG
 * "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS": *"can we do the swipe to the left to show delete
 * instead? to all rows that has delete?"* → *"ok"*).
 *
 * A row's delete is the ONE swipe (`app/_components/swipe-to-delete.tsx`): swipe left on a phone, hover on a computer,
 * the row's ⋯ menu for a keyboard. A small ✕ stays ONLY on:
 *   · photo / video tiles in a grid (hero photo, gallery, Papic decorate, monogram upload)
 *   · tags / chips inside a field
 *   · fields inside an editor form
 * and a warning's own confirm button ("Delete" inside the sheet that asks) is not a row's ✕ at all.
 *
 * WHAT COUNTS as a visible delete in source (comments stripped): a control named "Delete…"/"Remove…" (`aria-label`, or
 * an `ActionButton`'s `name`/danger `label`), or a bare ✕ / × glyph drawn as text.
 *
 * HOW IT HOLDS:
 *   1. a file on `ALLOWED` (below) is one of the kept kinds — each line says which, and why;
 *   2. every other file may have NO MORE marks than `no-delete-x-on-list-rows.baseline.txt` records — the rows not yet
 *      moved onto the swipe, area by area. A NEW file with a mark fails;
 *   3. the baseline ONLY SHRINKS: a file that now has fewer marks than its line fails until the line is lowered —
 *      regenerate with `SWIPE_BASELINE=write pnpm exec tsx --test lib/no-delete-x-on-list-rows.test.ts` (from apps/web).
 *      The write refuses to raise a line or add one.
 *
 * SABOTAGE (seen RED, then restored, 2026-11-03): a `<button aria-label="Remove song">✕</button>` added to a row
 * component not on the baseline → test 2 red · the baseline line for budget-sheets.tsx raised by one → test 3 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const BASELINE = join(HERE, 'no-delete-x-on-list-rows.baseline.txt');

/** Kept kinds — tile · chip · editor field · confirm — never a list row. Path (from apps/web) → why. */
export const ALLOWED: ReadonlyMap<string, string> = new Map([
  ['app/dashboard/[eventId]/monogram/upload-mark.tsx', 'tile — the uploaded mark’s ✕'],
  ['app/papic/decorate/_components/kwento-decorator.tsx', 'tile — a sticker on the photo being decorated'],
  ['app/_components/chat-send-form.tsx', 'chip — an attachment waiting in the composer'],
  ['app/dashboard/(account)/people/_components/dependents-section.tsx', 'chip — a ninong / ninang chip’s ✕ inside a loved one’s card'],
  ['app/dashboard/[eventId]/studio/mood-board/_components/inspiration-board.tsx', 'tile — a pinned photo’s ✕ in the board’s image grid'],
  ['app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio.tsx', 'confirm — the “Remove this photo?” box’s own Remove'],
  ['app/dashboard/[eventId]/studio/mood-board/_components/list-field.tsx', 'editor field — a Do / Don’t text input’s ✕ inside the dress-code form'],
  ['app/dashboard/[eventId]/studio/mood-board/_components/palette-section.tsx', 'editor field + chip — a custom role’s fields and its colour swatches inside the palette editor'],
  ['app/dashboard/[eventId]/studio/mood-board/_components/theme-card.tsx', 'chip — a read mood / colour / motif chip inside the theme field'],
  ['app/dashboard/[eventId]/vendors/_components/plan-budget-accordion.tsx', 'tile — a shortlist card’s × in a horizontal card rail (a swipe would fight the rail’s scroll); the other ✕ close a tip and the compare'],
  ['app/dashboard/[eventId]/seating/_components/seating-editor.tsx', 'editor — the selected table’s dock (Delete table), a chair in edit-chairs mode on the plan, the selected marker’s Remove (its table and rule rows are on the swipe)'],
  ['app/dashboard/[eventId]/seating/_components/seat-plan-phone.tsx', 'editor — the selected table’s phone panel: its own “Delete this table” beside Done'],
  ['app/vendor-dashboard/shop/_components/docs-body.tsx', 'editor field — a client reference’s name / number inputs, written on the documents form’s Save'],
  ['app/dashboard/[eventId]/website/our-story/milestones-field.tsx', 'editor field — a milestone’s year / date / title inputs inside the Our Story form'],
  ['app/dashboard/[eventId]/website/photo-moments/_components/photo-moments-editor.tsx', 'editor field — a photo moment’s card of inputs inside its editor'],
  ['app/dashboard/[eventId]/story/_components/editorial-editor.tsx', 'editor field — a custom column’s name + body and a wish’s fields inside the editorial editor'],
  ['app/open-shop/_components/service-cards.tsx', 'editor field — the supplier sign-up’s picked services: Change / Remove beside each one, as the owner-approved prototype v16 draws them (a form being filled, not a list of records)'],
  ['app/dashboard/[eventId]/launch/_components/rsvp-line-list.tsx', 'editor field — the Maker Edit row’s Earlier · Later · Group · Remove for the picked line'],
  ['app/_components/proposal-maker.tsx', 'editor field — a quote line’s ✕ DROPS it (reversible, “Put back”) and a payment’s ✕ removes a draft installment, both inside the quote editor'],
  ['app/_components/amendment-builder.tsx', 'editor field — a draft change item (type, words, ₱) inside the amendment form, written on Send'],
  ['app/vendor-dashboard/clients/[eventId]/cocktail/cocktail-editor.tsx', 'tile — a booth / sign piece on the drag-to-place cocktail floor plan'],
  ['app/vendor-dashboard/clients/[eventId]/editorial-media/_components/editorial-media-studio.tsx', 'tile — a staged photo / clip waiting to be submitted'],
  ['app/vendor-dashboard/clients/[eventId]/_components/supplier-schedule.tsx', 'editor sheet — the moment sheet’s own “Delete moment” at its foot (an ask the host approves)'],
  ['app/dashboard/[eventId]/schedule/_components/chapters-host.tsx', 'confirm — the “Delete chapter” sheet a swipe on the rail opens: its own Delete (the rows themselves are on the swipe)'],
  ['app/dashboard/[eventId]/date-selection/_components/four-question-flow.tsx', 'editor field — a meaningful date’s date / kind / note inputs inside step 3’s form'],
  ['app/vendor-dashboard/invite/_components/locked-qr-generator.tsx', 'chip + editor field — a picked service chip, and a draft payment (name, date, ₱) inside the QR deal form'],
  ['app/dashboard/[eventId]/schedule/_components/moment-inspector.tsx', 'editor — the moment editor’s own “Delete it” at its foot (its parts’ rows are on the swipe)'],
  ['app/dashboard/[eventId]/schedule/_components/moment-sheets.tsx', 'editor — the moment sheet’s own “Delete moment” at its foot'],
  ['app/dashboard/[eventId]/schedule/_components/chapter-sheets.tsx', 'editor — the chapter sheet’s own “Delete chapter” at its foot'],
  // Supplier services / packages / attributes (2026-11-03 sweep): every ✕ here removes an UNSAVED draft line made of
  // inputs, inside an editor that writes only on its own Save — a field in an editor form, not a list row.
  ['app/vendor-dashboard/services/_components/addons-editor.tsx', 'editor field — an add-on’s label + price inputs, written on “Save add-ons”'],
  ['app/vendor-dashboard/services/_components/customization-step.tsx', 'editor field — a draft line / option made of inputs, written on the step’s Save'],
  ['app/vendor-dashboard/services/_components/payment-schedule-editor.tsx', 'editor field — a draft payment (label, %/₱, due) inside the schedule form, written on Save'],
  ['app/vendor-dashboard/packages/_components/package-editor.tsx', 'editor field — a draft inclusion / option made of inputs, written on the package’s Save'],
  ['app/vendor-dashboard/_components/video-links-editor.tsx', 'editor field — a video-link URL input inside the service form'],
  ['app/vendor-dashboard/attributes/_components/attribute-field-renderer.tsx', 'chip — a tag inside a multi_select_open tag field'],
  ['app/vendor-dashboard/services/_components/coverage-panel.tsx', 'chip — a coverage pill in the “who you serve” chip cloud (its own confirm stays)'],
]);

const SKIP_DIR = /^(admin|dev|prototypes?|node_modules|\.next|tests?|__tests__|e2e)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIR.test(name)) walk(full, out);
    } else if (name.endsWith('.tsx') && !/\.test\.tsx$|\.stories\.tsx$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const MARKS: readonly RegExp[] = [
  // a control NAMED Delete/Remove — "Delete Ana", `Remove ${item}`, {'Remove photo'}
  /aria-label=(?:"|\{\s*[`'"])(?:Delete|Remove)\b/g,
  // an ActionButton's accessible name
  /\bname=(?:"|\{\s*[`'"])(?:Delete|Remove)\b/g,
  // a danger-toned button whose word is Delete/Remove (either attribute order, same tag)
  /tone="danger"[^<>]{0,160}?\blabel=(?:"|\{\s*[`'"])(?:Delete|Remove)\b/g,
  /\blabel=(?:"|\{\s*[`'"])(?:Delete|Remove)\b[^<>]{0,160}?tone="danger"/g,
  // a bare ✕ / × drawn as text
  />\s*[✕×]\s*</g,
];

/** How many visible delete marks one source carries. */
export function deleteMarks(source: string): number {
  const src = stripComments(source);
  return MARKS.reduce((n, re) => n + (src.match(re) ?? []).length, 0);
}

function measure(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const root of ['app', 'components']) {
    for (const file of walk(join(WEB, root))) {
      const rel = relative(WEB, file).split('\\').join('/');
      if (ALLOWED.has(rel)) continue;
      const n = deleteMarks(readFileSync(file, 'utf8'));
      if (n > 0) counts.set(rel, n);
    }
  }
  return counts;
}

function readBaseline(): Map<string, number> {
  const m = new Map<string, number>();
  for (const line of readFileSync(BASELINE, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const at = t.lastIndexOf(' ');
    m.set(t.slice(0, at), Number(t.slice(at + 1)));
  }
  return m;
}

const HEADER = [
  '# List rows that still draw a visible delete/remove ✕ — not yet moved onto the swipe (owner 2026-11-03).',
  '# Guard: lib/no-delete-x-on-list-rows.test.ts. `path count` — this list ONLY SHRINKS. Move a row onto',
  '# SwipeToDelete (app/_components/swipe-to-delete.tsx) and lower its line; never add one or raise one.',
];

test('the marks are what they claim — a named delete, a danger Remove, a bare ✕ count; a plain word does not', () => {
  assert.equal(deleteMarks('<button aria-label="Remove song">✕</button>'), 2);
  assert.equal(deleteMarks('<button aria-label={`Delete ${name}`}><X /></button>'), 1);
  assert.equal(deleteMarks('<ActionButton tone="danger" icon={Trash2} label="Delete" onClick={go} />'), 1);
  assert.equal(deleteMarks('<p>Delete it from the card.</p>'), 0);
  assert.equal(deleteMarks('{/* aria-label="Delete" in a comment */}'), 0);
  assert.equal(deleteMarks('<SwipeToDelete label={`Delete ${name}`} onDelete={ask}>'), 0, 'the swipe’s own label is the way, not a mark');
});

test('2 · no NEW list row draws a visible delete ✕ — use SwipeToDelete (or, for a tile/chip/editor field, ALLOWED)', () => {
  const base = readBaseline();
  const grew = [...measure()]
    .filter(([f, n]) => n > (base.get(f) ?? 0))
    .map(([f, n]) => `${f}: ${n} (baseline ${base.get(f) ?? 0})`);
  assert.deepEqual(
    grew,
    [],
    'a list row draws a visible delete/remove ✕ (owner 2026-11-03: swipe left to delete, no ✕ on rows).\n' +
      'Wrap the row in <SwipeToDelete label="Delete …" onDelete={…}> (app/_components/swipe-to-delete.tsx), keep Delete\n' +
      'in its ⋯ menu, and give it Undo (app/_components/undo/delete-with-undo.ts). Only a photo/video tile, a chip in a\n' +
      'field or a field in an editor keeps a ✕ — add that file to ALLOWED with which one it is.\n' +
      grew.join('\n'),
  );
});

test('3 · the baseline only shrinks — a moved row takes its line down', () => {
  const now = measure();
  const base = readBaseline();
  if (process.env.SWIPE_BASELINE === 'write') {
    const raised = [...now].filter(([f, n]) => n > (base.get(f) ?? 0));
    assert.deepEqual(raised, [], 'the write never raises or adds a line');
    const lines = [...now].sort(([a], [b]) => (a < b ? -1 : 1)).map(([f, n]) => `${f} ${n}`);
    writeFileSync(BASELINE, [...HEADER, ...lines, ''].join('\n'));
    return;
  }
  const healed = [...base]
    .filter(([f, n]) => (now.get(f) ?? 0) < n)
    .map(([f, n]) => `${f}: ${now.get(f) ?? 0} (baseline ${n})`);
  assert.deepEqual(
    healed,
    [],
    'fewer visible ✕ than the baseline records — lower these lines (SWIPE_BASELINE=write pnpm exec tsx --test ' +
      'lib/no-delete-x-on-list-rows.test.ts):\n' +
      healed.join('\n'),
  );
  for (const f of ALLOWED.keys()) assert.equal(base.has(f), false, `${f} is ALLOWED and on the baseline — one or the other`);
});

test('an ALLOWED file still draws the ✕ it is allowed for — a stale line is taken off', () => {
  const stale = [...ALLOWED.keys()].filter((f) => deleteMarks(readFileSync(join(WEB, f), 'utf8')) === 0);
  assert.deepEqual(stale, [], `no ✕ left in these ALLOWED files — take them off the list:\n${stale.join('\n')}`);
});
