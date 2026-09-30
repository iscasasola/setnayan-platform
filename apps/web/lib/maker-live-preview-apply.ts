/**
 * apps/web/lib/maker-live-preview-apply.ts — the CANVAS half of
 * `lib/maker-live-preview.ts`: the guest page's editor bridge lays the Maker's
 * Love Story and Programme words on the scenes the server drew. Nothing is
 * fetched, nothing reloads.
 *
 * Imported ONLY by `app/[slug]/_components/editor-bridge.tsx` (and tests) — see
 * the note in `maker-live-preview.ts`. The two message names are spelled here
 * again for that reason; `the-love-story-and-programme-are-instant.test.ts`
 * holds them equal to the Maker's.
 */

/** The message names — equal to `LOVE_STORY_PREVIEW` / `SCHEDULE_PREVIEW` in `maker-live-preview.ts`. */
export const LOVE_STORY_PREVIEW_T = 'loveStory';
export const SCHEDULE_PREVIEW_T = 'scheduleMoment';

/** The part of the DOM an applier touches — a real document, or a test's. */
export type PreviewRoot = { querySelectorAll(selector: string): ArrayLike<PreviewEl> };
type PreviewEl = {
  textContent: string | null;
  hidden: boolean;
  querySelectorAll(selector: string): ArrayLike<PreviewEl>;
};

const TEXT_MAX = 2000;
const str = (v: unknown): string | null => (typeof v === 'string' ? v.slice(0, TEXT_MAX) : null);
/** Attribute-selector-safe: the ids the Maker sends are ours (`m…`, uuids) — anything else is dropped. */
const safeId = (v: unknown): string | null => (typeof v === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(v) ? v : null);

function setText(root: PreviewEl, selector: string, text: string): void {
  const list = root.querySelectorAll(selector);
  for (let i = 0; i < list.length; i++) {
    const el = list[i]!;
    if (el.textContent !== text) el.textContent = text;
  }
}

/** One optional line (a place): its words, hidden while empty. */
function setOptional(root: PreviewEl, selector: string, text: string): void {
  const list = root.querySelectorAll(selector);
  for (let i = 0; i < list.length; i++) {
    const el = list[i]!;
    if (el.textContent !== text) el.textContent = text;
    el.hidden = text.trim() === '';
  }
}

/**
 * Every Love Story scene on this page takes the Maker's words. Returns how many
 * scenes it found — 0 on a page that draws no such scene (the canvas's own
 * business; the Maker reloads it once the save lands if it had to).
 */
export function applyLoveStoryPreview(doc: PreviewRoot, raw: unknown): number {
  if (!Array.isArray(raw)) return 0;
  let found = 0;
  for (const s of raw.slice(0, 200)) {
    if (!s || typeof s !== 'object') continue;
    const r = s as Record<string, unknown>;
    const id = safeId(r.id);
    const line = str(r.line);
    if (!id || line === null) continue;
    const when = str(r.when) ?? '';
    const chapter = str(r.chapterLabel) ?? '';
    const place = str(r.place) ?? '';
    const scenes = doc.querySelectorAll(`[data-love-scene="${id}"]`);
    for (let i = 0; i < scenes.length; i++) {
      const el = scenes[i]!;
      found += 1;
      setText(el, '[data-love-line]', line);
      setText(el, '[data-love-when]', `${when ? `${when} · ` : ''}${chapter}`);
      setOptional(el, '[data-love-place]', place);
    }
  }
  return found;
}

/** One programme moment on this page takes the Maker's name, time and place. */
export function applySchedulePreview(doc: PreviewRoot, raw: unknown): number {
  if (!raw || typeof raw !== 'object') return 0;
  const r = raw as Record<string, unknown>;
  const id = safeId(r.id);
  if (!id) return 0;
  const rows = doc.querySelectorAll(`[data-schedule-moment="${id}"]`);
  for (let i = 0; i < rows.length; i++) {
    const el = rows[i]!;
    const label = str(r.label);
    if (label !== null && label.trim() !== '') setText(el, '[data-schedule-label]', label);
    const time = str(r.time);
    if (time !== null && time !== '') setText(el, '[data-schedule-time]', time);
    const location = str(r.location);
    if (location !== null) setOptional(el, '[data-schedule-location]', location);
  }
  return rows.length;
}
