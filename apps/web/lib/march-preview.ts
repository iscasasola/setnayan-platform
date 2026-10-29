/**
 * ▶ THE WALK PREVIEW — Guests › March's count row "▶ Preview" (owner 2026-10-29, on the Guests prototype v12: *"maybe we
 * can use this row to add the preview walk so it is not lost?"*; prototype `startPreview`). Press it and the march plays
 * itself: every section opens, each walk in turn lights up and scrolls to the middle of the screen while a bar names it
 * ("3. Tito Ben & Tita Cora" · "Principal Sponsors"), one walk every `MARCH_PREVIEW_STEP_MS`; then "That is the whole
 * march · N walks" and the bar leaves. Stop ends it at any walk. Nothing is saved — it is a look, not an edit.
 *
 * Pure, so the order and the words are tested rather than trusted. The walk numbers are the march's own step numbers
 * (`data-march-walk`), counted over every section with all of them open — which is how the preview draws it.
 * 🔒 lib/the-march-preview-plays-the-walks.test.ts
 */
import type { MarchSection } from '@/lib/march-drag';
import { formatCount } from '@/lib/format-number';

/** One walk every 1.1 s, and the closing card for 1.8 s (the prototype's own pace). */
export const MARCH_PREVIEW_STEP_MS = 1100;
export const MARCH_PREVIEW_END_MS = 1800;

export type MarchPreviewStep = {
  /** The walk's step number in the march, 1-based (`data-march-walk`). */
  no: number;
  /** "3. Tito Ben & Tita Cora" — a walk with no names left says "—", never an empty bar. */
  title: string;
  /** "Principal Sponsors" · "Principal Sponsors · walks alone". */
  line: string;
};

export function marchPreviewSteps(sections: readonly MarchSection[]): MarchPreviewStep[] {
  const out: MarchPreviewStep[] = [];
  for (const sec of sections) {
    for (const row of sec.rows) {
      const names = row.filter((p): p is NonNullable<typeof p> => p !== null).map((p) => p.name);
      const no = out.length + 1;
      out.push({
        no,
        title: `${no}. ${names.join(' & ') || '—'}`,
        line: `${sec.label}${names.length === 1 ? ' · walks alone' : ''}`,
      });
    }
  }
  return out;
}

/** The bar's closing card. */
export function marchPreviewEnd(walks: number): { title: string; line: string } {
  return { title: 'That is the whole march', line: `${formatCount(walks)} walk${walks === 1 ? '' : 's'}` };
}
