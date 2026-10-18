/**
 * 👥 TWO HOSTS NEVER OVERWRITE EACH OTHER — ROUND 3's WRITERS (owner 2026-10-18, "build it"). Each writer #6626/#6629
 * left, brought onto the same pattern (`lib/merge-from-base.ts`): it says what it started from, and only what THIS
 * screen changed is written. The pure halves run for real; the wiring is pinned on source.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { hostAnswersThisScreenChanged } from './host-answers-merge';
import { egiftFieldsThisScreenChanged } from './egift-method-merge';
import { floorPlanFieldsOf, floorPlanRowFrom } from './floor-plan-row';
import { floorItemsThisScreenChanged } from './floor-items-merge';
import { changedFields } from './merge-from-base';
import { writeWidgetConfig, type WidgetConfigClient } from './widget-config-write';

const WEB = join(__dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('schedule · host answers: a stale box never puts back — or DELETES — the other host’s answer', () => {
  // The form was drawn with Q1 empty and Q2 "Our song". Claire has since answered Q1. Indalecio changes only Q2.
  const w = hostAnswersThisScreenChanged([
    ['answer:Q1', ''],
    ['base:Q1', ''],
    ['answer:Q2', 'The first dance'],
    ['base:Q2', 'Our song'],
  ]);
  assert.deepEqual(w.clears, [], 'the stale empty box deleted the other host’s answer (before: it did)');
  assert.deepEqual(w.upserts, [{ questionId: 'Q2', answer: 'The first dance' }]);
  // Emptying a box this screen showed filled IS a clear; an older page (no base) is taken whole.
  assert.deepEqual(hostAnswersThisScreenChanged([['answer:Q3', ' '], ['base:Q3', 'x']]).clears, ['Q3']);
  assert.deepEqual(hostAnswersThisScreenChanged([['answer:Q4', 'a']]).upserts, [{ questionId: 'Q4', answer: 'a' }]);
  assert.deepEqual(hostAnswersThisScreenChanged([['answer:Q5', ' same '], ['base:Q5', 'same']]).upserts, [], 'whitespace alone is a change');
  const action = src('app/dashboard/[eventId]/schedule/question-answers-actions.ts');
  assert.match(action, /hostAnswersThisScreenChanged\(formData\.entries\(\)\)/, 'the action writes every box again');
  const form = src('app/dashboard/[eventId]/schedule/_components/host-questions.tsx');
  assert.match(form, /name=\{`base:\$\{question\.question_id\}`\} value=\{answer \?\? ''\}/, 'the form does not say what each box showed');
});

test('e-gifts · editing a way writes only the fields this screen changed — never the old number back', () => {
  const opened = { method_kind: 'gcash', label: 'GCash', account_name: 'Maria', handle: '0917 000 0000', qr_r2_key: null, note: null };
  // Claire fixed the number to 0917 111 1111; Indalecio's form (opened before) changes only the label.
  const mine = { ...opened, label: 'Our GCash' };
  assert.deepEqual([...(egiftFieldsThisScreenChanged(JSON.stringify(opened), mine) ?? [])], ['label']);
  assert.equal(egiftFieldsThisScreenChanged(null, mine), null, 'an older page must be taken whole');
  assert.equal(egiftFieldsThisScreenChanged('{not json', mine), null);
  // A field the base does not carry counts as changed (Studio sends a base only for what it carries forward unseen).
  assert.deepEqual([...(egiftFieldsThisScreenChanged({ label: 'GCash' }, mine) ?? [])].sort(), ['account_name', 'handle', 'label', 'method_kind', 'note', 'qr_r2_key']);
  assert.deepEqual([...(egiftFieldsThisScreenChanged({ ...opened, note: '' }, opened) ?? [])], [], "'' and none are one value");
  const action = src('app/dashboard/[eventId]/pabuya/actions.ts');
  assert.match(action, /egiftFieldsThisScreenChanged\(formData\.get\(MERGE_BASE_FIELD\)/);
  assert.match(action, /onlyChanged\.has\(k as EgiftEditField\)/, 'the edit still writes every field');
  assert.match(action, /if \(qrR2Key && writesQr\) \{/, 'a stale QR is checked and redrawn as if it were new');
  const manager = src('app/dashboard/[eventId]/pabuya/_components/pabuya-manager.tsx');
  assert.match(manager, /fd\.set\(MERGE_BASE_FIELD, JSON\.stringify\(\{ method_kind, label, account_name, handle, qr_r2_key, note \}\)\)/, 'the E-Gifts page sends no base');
});

test('seating · the floor: a stale editor writes only the columns IT changed — the stage the other host moved stays', () => {
  const stored = {
    stage_x: 50, stage_y: 6, stage_w: 24, stage_h: 7, entrance_enabled: true, entrance_x: 50, entrance_y: 94, entrance_kind: 'door',
    entrance_depth_m: 3, dance_enabled: false, dance_x: 50, dance_y: 55, dance_w: 22, dance_h: 18, service_entrance_enabled: false,
    service_entrance_x: 97, service_entrance_y: 50, cocktail_enabled: false, cocktail_x: 50, cocktail_y: 40, cocktail_w: 30, cocktail_h: 22,
    cocktail_label: 'Cocktail Area', cocktail_vendor_edit: true, cocktail_linked: true, venue_width_m: null, venue_length_m: null,
  };
  const base = floorPlanFieldsOf(stored);
  // The editor's own copy reads back as exactly the stored row (anti-vacuity: a base that misreads changes everything).
  assert.deepEqual(changedFields(floorPlanRowFrom((k) => base[k] ?? null), stored), new Set());
  // This screen turns the dance floor on; everything else it sends is its stale copy.
  const mine = { ...base, dance_enabled: 'true' };
  const changed = changedFields(floorPlanRowFrom((k) => base[k] ?? null), floorPlanRowFrom((k) => mine[k as keyof typeof mine] ?? null));
  assert.deepEqual([...changed], ['dance_enabled'], 'the floor save writes columns this screen never touched');
  const action = src('app/dashboard/[eventId]/seating/actions.ts');
  assert.match(action, /changed = changedFields\(floorPlanRowFrom\(\(k\) => \(typeof base\[k\] === 'string' \? base\[k\] : null\)\), row\)/);
  assert.match(action, /Object\.entries\(row\)\.filter\(\(\[k\]\) => changed!\.has\(k\)\)/, 'the floor save writes every column again');
  const editor = src('app/dashboard/[eventId]/seating/_components/seating-editor.tsx');
  assert.match(editor, /fd\.set\(MERGE_BASE_FIELD, JSON\.stringify\(floorBase\.current\)\);\s*await saveFloorPlan\(fd\);/, 'the 2D editor sends no floor base');
  const lab = src('app/dashboard/[eventId]/seating/lab/_components/seating-lab-3d.tsx');
  assert.match(lab, /fd\.set\(MERGE_BASE_FIELD, JSON\.stringify\(floorBase\.current\)\);/, 'the 3D lab sends no floor base');
});

test('seating · booths and signs: a row this screen never saw is never deleted; only changed fields are written', () => {
  const B = (id: string | null, x: number, label = 'Bar') => ({ booth_id: id, label, x_pos: x, sort_order: 0 });
  // Opened with b1 + b2. Claire then added b3 and renamed b2. This screen moves b1 and removes nothing.
  const w = floorItemsThisScreenChanged('booth_id', [B('b1', 10), B('b2', 20)], [B('b1', 15), B('b2', 20), B(null, 30)]);
  assert.deepEqual(w.remove, [], 'a booth the other host added was deleted (before: replace-all deleted b3)');
  assert.deepEqual(w.updates, [{ id: 'b1', fields: { x_pos: 15 } }], 'an untouched booth was written back from the stale copy');
  assert.equal(w.inserts.length, 1);
  // Taking a booth out IS a delete — of one this screen had.
  assert.deepEqual(floorItemsThisScreenChanged('booth_id', [B('b1', 10), B('b2', 20)], [B('b2', 20)]).remove, ['b1']);
  const action = src('app/dashboard/[eventId]/seating/actions.ts');
  assert.match(action, /floorItemsThisScreenChanged\('booth_id', base, booths\)/);
  assert.match(action, /floorItemsThisScreenChanged\('sign_id', base, signs\)/);
  assert.match(action, /\.delete\(\)\.eq\('event_id', eventId\)\.in\('booth_id', w\.remove\)/, 'a based save still deletes by "not in my list"');
  const editor = src('app/dashboard/[eventId]/seating/_components/seating-editor.tsx');
  assert.match(editor, /fd\.set\(MERGE_BASE_FIELD, boothsPayload\(boothsBase\.current\)\);\s*await saveBooths\(fd\);/);
  assert.match(editor, /fd\.set\(MERGE_BASE_FIELD, signsPayload\(signsBase\.current\)\);\s*await saveSigns\(fd\);/);
});

test('post event · saveEditorial: only the story keys THIS screen changed move, laid onto the row as it is when the write lands', () => {
  const a = src('app/dashboard/[eventId]/story/actions.ts');
  const save = a.slice(a.indexOf('export async function saveEditorial('), a.indexOf("revalidatePath(`/dashboard/${eventId}/story`);"));
  assert.ok(save.length > 0, 'anti-vacuity: saveEditorial was not found');
  assert.match(save, /const draft = buildDraft\(input\);\s*const baseDraft = baseInput \? buildDraft\(baseInput\) : null;/, 'what the screen started from is not built the same way as what it sends');
  assert.match(save, /!baseDraft \|\| !sameValue\(baseDraft\[k\], draft\[k\]\)/, 'a key this screen did not change is still written');
  assert.match(save, /\.from\('event_editorial'\)\.select\('draft_json'\)\.eq\('event_id', eventId\)\.maybeSingle\(\);/, 'the write is not laid onto the row as it is now');
  assert.match(save, /for \(const k of keysOfThisSave\) \{\s*if \(k in draft\) written\[k\] = draft\[k\];\s*else delete written\[k\];\s*\}/);
  assert.match(save, /draft_json: written,/, 'the whole draft built on the copy read at the top is still written');
  assert.doesNotMatch(save, /draft_json: draft,/);
  const editor = src('app/dashboard/[eventId]/story/_components/editorial-editor.tsx');
  assert.match(editor, /const r = await saveEditorial\(eventId, sent, savedInput\.current\);/, 'the story editor sends no base');
  assert.match(editor, /if \(savedInput\.current === null\) savedInput\.current = composeInput\(form\.audience\);/);
  assert.match(editor, /savedInput\.current = sent;/, 'a second save is still based on the form as it first opened');
});

/** A one-row `invitation_widgets` in memory, with the trigger's version — and a hook that lands another screen's write. */
function fakeWidgets(start: Record<string, unknown>) {
  const row = { config_json: start as unknown, updated_at: 'v0' };
  let n = 0;
  let between: (() => void) | null = null;
  const q = (filters: Record<string, unknown>, then: () => unknown) => {
    const o = {
      eq(c: string, v: unknown) {
        filters[c] = v;
        return o;
      },
      maybeSingle: async () => ({ data: then() as Record<string, unknown> | null, error: null }),
      select: async () => ({ data: then() as unknown[] | null, error: null }),
    };
    return o;
  };
  const client = {
    from: () => ({
      select: () => q({}, () => ({ ...row })),
      update: (values: Record<string, unknown>) => {
        const filters: Record<string, unknown> = {};
        return q(filters, () => {
          if (between) {
            const b = between;
            between = null;
            b(); // another screen's write lands between this writer's read and its write
          }
          if (filters.updated_at !== row.updated_at) return [];
          row.config_json = values.config_json;
          row.updated_at = `v${++n}`;
          return [{ widget_id: 'w' }];
        });
      },
    }),
  } as unknown as WidgetConfigClient;
  return {
    client,
    row,
    otherScreen(config: Record<string, unknown>) {
      between = () => {
        row.config_json = config;
        row.updated_at = `v${++n}`;
      };
    },
  };
}

test('live sections · a write merges from the bag it READ onto the bag as it is NOW — another screen’s crop is kept', async () => {
  const read = { canvas: { focal: 50, zoom: 1 }, stage_order: { before: 2 } };
  const db = fakeWidgets(read);
  // Claire's crop lands after Indalecio's background write read the bag.
  db.otherScreen({ canvas: { focal: 20, zoom: 1.5 }, stage_order: { before: 2 } });
  const out = await writeWidgetConfig(db.client, { eventId: 'e', widgetId: 'w' }, read, { ...read, canvas: { ...read.canvas, bg: 'r2://x' } });
  assert.deepEqual(db.row.config_json, { canvas: { focal: 20, zoom: 1.5, bg: 'r2://x' }, stage_order: { before: 2 } }, 'the other screen’s crop was overwritten (before: the whole bag went back)');
  assert.equal(out.moved, true);
  const actions = src('app/dashboard/[eventId]/website/widgets/actions.ts');
  assert.doesNotMatch(actions, /\.update\(\{ config_json/, 'a live widget writer writes the whole bag again');
  assert.equal((actions.match(/writeWidgetConfig\(supabase as unknown as WidgetConfigClient/g) ?? []).length, 6, 'motion ×2 · background · crop · own scene · stage move');
  assert.match(src('app/dashboard/[eventId]/studio/save-the-date/actions.ts'), /await writeWidgetConfig\(supabase as unknown as WidgetConfigClient, \{ eventId, widgetId: w\.widget_id as string \}, config,/);
  assert.match(src('app/dashboard/[eventId]/website/hub-draft-actions.ts'), /await writeWidgetConfig\(supabase as unknown as WidgetConfigClient, \{ eventId, widgetId \}, row\.config_json, nextConfig as Record<string, unknown>\);/, 'Apply writes the section bag from its stale read');
  const wizard = src('app/dashboard/[eventId]/wizard-actions.ts');
  assert.equal((wizard.match(/column: 'role_palette', what: 'The palette' \}/g) ?? []).length, 2, 'the mood-board palette slot writes the board’s colours back whole');
});
