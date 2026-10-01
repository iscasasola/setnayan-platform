/**
 * apps/web/lib/love-story-words.ts — THE LOVE STORY'S WORDS, READ FROM THE FORM
 * ONE WAY, WHEREVER THEY ARE SAVED.
 *
 * `updateOurStory` (the server action) and the Maker's instant words panel
 * (`love-story-live.tsx`, owner 2026-09-30: *"so hard to edit … the delay of
 * response is terrible"*) both turn the Our Story questions into the stored
 * `events.love_story` blob. They used to be one function inside the action;
 * now both call THIS one, so the caps, the trimming, the milestone rows and the
 * dual-stored `together_since` can never differ between the Save button and a
 * keystroke saved behind the page.
 *
 * Pure: no I/O, no React. `love-story-live.test.ts` drives it.
 */

export const STORY_FIELD_MAX = 600;
export const STORY_SHORT_MAX = 120;
export const STORY_YEAR_MAX = 12;

/** The scalar LoveStory keys the words form edits, all trimmed + length-capped. */
export const STORY_TEXT_FIELDS = [
  'how_we_met',
  'spark',
  'spark_why',
  'obstacle',
  'obstacle_kept',
  'proposal',
  'proposal_feel',
] as const;
export const STORY_SHORT_FIELDS = ['together_since', 'proposal_setting', 'obstacle_kind', 'proposal_voice'] as const;
export const STORY_YEAR_FIELDS = ['met_year', 'proposal_year'] as const;
export const STORY_ANCHOR_KEYS = ['song', 'place', 'injoke', 'food'] as const;

/** Anything with FormData's two readers — a real FormData, or a test's. */
export type StoryFormRead = {
  get(name: string): FormDataEntryValue | null;
  getAll(name: string): FormDataEntryValue[];
};

export function storyStr(v: FormDataEntryValue | null | undefined, max: number): string {
  return (typeof v === 'string' ? v.trim() : '').slice(0, max);
}

export type StoryMilestoneRow = { year: string; month?: string; day?: string; title: string };

/** The timeline rows — a row needs a year and a title; capped; sorted by date. */
export function readStoryMilestones(formData: StoryFormRead): StoryMilestoneRow[] {
  const years = formData.getAll('ms_year');
  const months = formData.getAll('ms_month');
  const days = formData.getAll('ms_day');
  const titles = formData.getAll('ms_title');
  const rows: StoryMilestoneRow[] = [];
  for (let i = 0; i < years.length; i++) {
    const year = storyStr(years[i] ?? null, 4);
    const title = storyStr(titles[i] ?? null, STORY_SHORT_MAX);
    if (!year || !title) continue; // a row needs at least a year + a title
    const month = storyStr(months[i] ?? null, 2);
    const day = storyStr(days[i] ?? null, 2);
    rows.push({ year, ...(month ? { month } : {}), ...(day ? { day } : {}), title });
  }
  // Cap the timeline (a couple can't balloon their own blob into every /[slug] render).
  if (rows.length > 100) rows.length = 100;
  // Auto-sorted chronologically — the canonical milestones behavior.
  rows.sort(
    (a, b) =>
      Number(a.year) - Number(b.year) ||
      Number(a.month ?? 0) - Number(b.month ?? 0) ||
      Number(a.day ?? 0) - Number(b.day ?? 0),
  );
  return rows;
}

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * EVERY question from one post, MERGED over `base` (keys this form does not
 * edit — the moments, `spark_anchor`, anything later — survive). What
 * `updateOurStory` writes.
 */
export function mergeStoryWords(
  base: unknown,
  formData: StoryFormRead,
): { story: Record<string, unknown>; togetherSince: string | null } {
  const existing = asRecord(base);
  const merged: Record<string, unknown> = { ...existing };
  for (const key of STORY_TEXT_FIELDS) merged[key] = storyStr(formData.get(key), STORY_FIELD_MAX);
  for (const key of STORY_SHORT_FIELDS) merged[key] = storyStr(formData.get(key), STORY_SHORT_MAX);
  for (const key of STORY_YEAR_FIELDS) merged[key] = storyStr(formData.get(key), STORY_YEAR_MAX);
  merged.anchors = {
    ...asRecord(existing.anchors),
    ...Object.fromEntries(STORY_ANCHOR_KEYS.map((k) => [k, storyStr(formData.get(`anchor_${k}`), STORY_SHORT_MAX)])),
  };
  merged.milestones = readStoryMilestones(formData);
  // together_since is DUAL-STORED: public readers prefer the column.
  const togetherSince = storyStr(formData.get('together_since'), STORY_SHORT_MAX);
  return { story: merged, togetherSince: togetherSince || null };
}

/**
 * ONE question, typed — only THAT key changes (`name` is the field's name).
 * The instant panel patches field by field, never the whole form: the same
 * words can be open in two places (Details and a stage's panel), and a form
 * whose other boxes were drawn before an edit elsewhere must not write those
 * older words back. `ms_*` re-reads the whole timeline from `formData` (its
 * rows are one list). Null when `name` is not one of the story's fields.
 */
export function patchStoryWord(
  base: unknown,
  name: string,
  formData: StoryFormRead,
): { story: Record<string, unknown>; togetherSince?: string | null } | null {
  const existing = asRecord(base);
  if ((STORY_TEXT_FIELDS as readonly string[]).includes(name)) {
    return { story: { ...existing, [name]: storyStr(formData.get(name), STORY_FIELD_MAX) } };
  }
  if ((STORY_SHORT_FIELDS as readonly string[]).includes(name)) {
    const v = storyStr(formData.get(name), STORY_SHORT_MAX);
    return name === 'together_since'
      ? { story: { ...existing, together_since: v }, togetherSince: v || null }
      : { story: { ...existing, [name]: v } };
  }
  if ((STORY_YEAR_FIELDS as readonly string[]).includes(name)) {
    return { story: { ...existing, [name]: storyStr(formData.get(name), STORY_YEAR_MAX) } };
  }
  if (name.startsWith('anchor_')) {
    const k = name.slice('anchor_'.length);
    if (!(STORY_ANCHOR_KEYS as readonly string[]).includes(k)) return null;
    return {
      story: { ...existing, anchors: { ...asRecord(existing.anchors), [k]: storyStr(formData.get(name), STORY_SHORT_MAX) } },
    };
  }
  if (name.startsWith('ms_')) return { story: { ...existing, milestones: readStoryMilestones(formData) } };
  return null;
}
