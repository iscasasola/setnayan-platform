/**
 * 📋 THE FORM MAKER — pure rules (THE ONE BUILD · C3 Forms; B2 §2.7).
 *
 * Rulings: DECISION_LOG 2026-10-28 "THE FORM MAKER IS APPROVED" · "SUGGESTED FOR YOUR SERVICE — APPROVED" ·
 * "FORM MEDIA BY PLAN"; build plan v111 item 18 (owner verbatim: Title / Add Media files / Add Video Link / Add a
 * Question Line / Link to Service Card / Save to Library / Send to Chat).
 *
 * Storage (migration 20271325118550): a form is a `vendor_forms` row; its items are `vendor_questions` rows with its
 * `form_id` (the shipped "Questions for the couple" set is `form_id IS NULL`); answers are `event_question_answers`.
 * Everything here is plain data in, plain data out — no client, no DOM — so the Maker, the actions and the tests all
 * read ONE copy of the rules.
 */
import { parseVideoLink } from '@/lib/video-embed';
import { ANSWER_MAX, QUESTION_HINT_MAX, QUESTION_PROMPT_MAX } from '@/lib/emcee-questions';

export const FORM_TITLE_MAX = 120;
export const FORM_ITEMS_MAX = 60;
export const FORM_OPTIONS_MAX = 30;
export const FORM_OPTION_MAX = 120;
export const FORM_MEDIA_PER_ITEM_MAX = 10;
export const FORM_VIDEO_URL_MAX = 500;
export { ANSWER_MAX };

/**
 * The question types = the v113 Form Maker's type dropdown (THE ONE BUILD §9 #13), in its order, WITHOUT
 * "Photo upload": §4 rules photo-upload answers out of this build (text answers only). The database CHECK
 * (`vendor_questions_answer_type_chk`) holds exactly these keys — `lib/vendor-forms.test.ts` pins the two together.
 */
export const FORM_ANSWER_TYPES = [
  { key: 'short_answer', label: 'Short answer' },
  { key: 'long_answer', label: 'Long answer' },
  { key: 'multiple_choice', label: 'Multiple choice' },
  { key: 'checkboxes', label: 'Checkboxes' },
  { key: 'dropdown', label: 'Dropdown' },
  { key: 'date', label: 'Date' },
  { key: 'number', label: 'Number' },
  { key: 'yes_no', label: 'Yes / No' },
  { key: 'measurement', label: 'Measurement' },
] as const;

export type FormAnswerType = (typeof FORM_ANSWER_TYPES)[number]['key'];
export type FormItemKind = 'question' | 'media' | 'video_link';

/** Types whose answer is one or more of the supplier's own choices. */
export const CHOICE_TYPES: ReadonlySet<FormAnswerType> = new Set(['multiple_choice', 'checkboxes', 'dropdown']);

export function isFormAnswerType(v: unknown): v is FormAnswerType {
  return typeof v === 'string' && FORM_ANSWER_TYPES.some((t) => t.key === v);
}

export function answerTypeLabel(t: string): string {
  return FORM_ANSWER_TYPES.find((x) => x.key === t)?.label ?? 'Long answer';
}

/** One item as the Maker edits it and the save action receives it. */
export type FormItemDraft =
  | {
      kind: 'question';
      /** Existing row id when editing a saved form; absent for a new line. */
      id?: string;
      prompt: string;
      hint?: string | null;
      answerType: FormAnswerType;
      required: boolean;
      options?: string[];
    }
  | { kind: 'media'; id?: string; caption: string; mediaKeys: string[] }
  | { kind: 'video_link'; id?: string; caption: string; url: string };

export type FormDraft = {
  formId?: string;
  title: string;
  items: FormItemDraft[];
  /** The shop's service cards this form is linked to ("pick as many"). */
  serviceIds: string[];
};

export type FormDraftProblem = { at: 'title' | 'items' | number; message: string };

const trim = (s: unknown) => (typeof s === 'string' ? s.trim() : '');

/** Clean choices: trimmed, non-empty, unique, capped. */
export function cleanOptions(options: readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of options ?? []) {
    const o = trim(raw).slice(0, FORM_OPTION_MAX);
    if (!o || seen.has(o.toLowerCase())) continue;
    seen.add(o.toLowerCase());
    out.push(o);
    if (out.length >= FORM_OPTIONS_MAX) break;
  }
  return out;
}

/**
 * What would stop this draft saving, in plain words — empty when it can save. Mirrors the database CHECKs so a
 * refusal is said on the screen, never discovered as a failed write.
 */
export function validateFormDraft(d: FormDraft): FormDraftProblem[] {
  const out: FormDraftProblem[] = [];
  const title = trim(d.title);
  if (!title) out.push({ at: 'title', message: 'Name this form.' });
  else if (title.length > FORM_TITLE_MAX) out.push({ at: 'title', message: `Keep the name under ${FORM_TITLE_MAX} characters.` });
  if (d.items.length === 0) out.push({ at: 'items', message: 'Add a question, media files or a video link.' });
  if (d.items.length > FORM_ITEMS_MAX) out.push({ at: 'items', message: `A form holds up to ${FORM_ITEMS_MAX} items.` });
  d.items.forEach((it, i) => {
    if (it.kind === 'question') {
      const p = trim(it.prompt);
      if (!p) out.push({ at: i, message: 'Write the question.' });
      else if (p.length > QUESTION_PROMPT_MAX) out.push({ at: i, message: `Keep the question under ${QUESTION_PROMPT_MAX} characters.` });
      if (trim(it.hint).length > QUESTION_HINT_MAX) out.push({ at: i, message: `Keep the hint under ${QUESTION_HINT_MAX} characters.` });
      if (!isFormAnswerType(it.answerType)) out.push({ at: i, message: 'Pick a type.' });
      if (CHOICE_TYPES.has(it.answerType) && cleanOptions(it.options).length === 0) {
        out.push({ at: i, message: 'Add at least one choice.' });
      }
    } else if (it.kind === 'media') {
      if (it.mediaKeys.length === 0) out.push({ at: i, message: 'Add a file.' });
      if (it.mediaKeys.length > FORM_MEDIA_PER_ITEM_MAX) out.push({ at: i, message: `Up to ${FORM_MEDIA_PER_ITEM_MAX} files per item.` });
    } else {
      const v = normalizedVideoUrl(it.url);
      if (!v) out.push({ at: i, message: 'Paste a video link that starts with https://.' });
    }
  });
  return out;
}

/** A pasted link as stored: https only (the database CHECK), or null when it is not a usable link. */
export function normalizedVideoUrl(raw: string): string | null {
  const parsed = parseVideoLink(raw);
  if (!parsed) return null;
  const url = parsed.originalUrl.replace(/^http:\/\//i, 'https://');
  if (!/^https:\/\//.test(url) || url.length > FORM_VIDEO_URL_MAX) return null;
  return url;
}

/** The `vendor_questions` columns one item writes (order = list index). */
export function itemRow(it: FormItemDraft, displayOrder: number) {
  if (it.kind === 'question') {
    const choice = CHOICE_TYPES.has(it.answerType);
    return {
      item_kind: 'question' as const,
      prompt: trim(it.prompt).slice(0, QUESTION_PROMPT_MAX),
      hint: trim(it.hint) ? trim(it.hint).slice(0, QUESTION_HINT_MAX) : null,
      answer_type: it.answerType,
      is_required: !!it.required,
      options: choice ? cleanOptions(it.options) : null,
      media_keys: null,
      video_url: null,
      display_order: displayOrder,
      is_asked: true,
    };
  }
  if (it.kind === 'media') {
    return {
      item_kind: 'media' as const,
      prompt: trim(it.caption).slice(0, QUESTION_PROMPT_MAX) || 'Media files',
      hint: null,
      answer_type: 'long_answer' as const,
      is_required: false,
      options: null,
      media_keys: it.mediaKeys.slice(0, FORM_MEDIA_PER_ITEM_MAX),
      video_url: null,
      display_order: displayOrder,
      is_asked: true,
    };
  }
  return {
    item_kind: 'video_link' as const,
    prompt: trim(it.caption).slice(0, QUESTION_PROMPT_MAX) || 'Video link',
    hint: null,
    answer_type: 'long_answer' as const,
    is_required: false,
    options: null,
    media_keys: null,
    video_url: normalizedVideoUrl(it.url),
    display_order: displayOrder,
    is_asked: true,
  };
}

/** A saved item row back into the Maker's shape. */
export type FormItemRow = {
  question_id: string;
  form_id: string | null;
  item_kind: string;
  prompt: string;
  hint: string | null;
  answer_type: string;
  is_required: boolean;
  options: string[] | null;
  media_keys: string[] | null;
  video_url: string | null;
  display_order: number;
  is_asked: boolean;
};

export function draftItemOf(r: FormItemRow): FormItemDraft {
  if (r.item_kind === 'media') return { kind: 'media', id: r.question_id, caption: r.prompt, mediaKeys: r.media_keys ?? [] };
  if (r.item_kind === 'video_link') return { kind: 'video_link', id: r.question_id, caption: r.prompt, url: r.video_url ?? '' };
  return {
    kind: 'question',
    id: r.question_id,
    prompt: r.prompt,
    hint: r.hint,
    answerType: isFormAnswerType(r.answer_type) ? r.answer_type : 'long_answer',
    required: r.is_required,
    options: r.options ?? undefined,
  };
}

/** Live items in their order (a removed item is retired with is_asked = FALSE, never deleted). */
export function liveItems<T extends { is_asked: boolean; display_order: number }>(rows: readonly T[]): T[] {
  return rows.filter((r) => r.is_asked).sort((a, b) => a.display_order - b.display_order);
}

/** How the library row reads its size: "8 questions" / "2 items". */
export function formSizeLine(items: readonly { item_kind: string }[]): string {
  const q = items.filter((i) => i.item_kind === 'question').length;
  if (q === items.length) return `${q} question${q === 1 ? '' : 's'}`;
  return `${items.length} item${items.length === 1 ? '' : 's'}`;
}

/** "used with N" — how many events a form has been sent into. */
export function usedWithLine(n: number): string {
  return n > 0 ? `used with ${n}` : 'not sent yet';
}

/** The forms linked to any card this booking holds — what the booking moment sends. */
export function formsForBookedCards(
  links: readonly { form_id: string; vendor_service_id: string }[],
  bookedCardIds: readonly string[],
  liveFormIds?: ReadonlySet<string>,
): string[] {
  const booked = new Set(bookedCardIds);
  const out: string[] = [];
  for (const l of links) {
    if (!booked.has(l.vendor_service_id)) continue;
    if (liveFormIds && !liveFormIds.has(l.form_id)) continue;
    if (!out.includes(l.form_id)) out.push(l.form_id);
  }
  return out;
}

/**
 * "Suggested for <service>" then "Also useful for <group>" (DECISION_LOG 2026-10-28): the service's own suggestions
 * first, then the rest of its group's, each template once. Ships EMPTY (no seed) — callers say so honestly.
 */
export function suggestionsForCategories(
  suggestions: readonly { category_id: string; template_key: string; sort_order: number }[],
  own: readonly string[],
  group: readonly string[],
): { own: string[]; alsoUseful: string[] } {
  const ownSet = new Set(own);
  const groupSet = new Set(group.filter((g) => !ownSet.has(g)));
  const sorted = [...suggestions].sort((a, b) => a.sort_order - b.sort_order);
  const ownKeys: string[] = [];
  for (const s of sorted) if (ownSet.has(s.category_id) && !ownKeys.includes(s.template_key)) ownKeys.push(s.template_key);
  const also: string[] = [];
  for (const s of sorted) {
    if (!groupSet.has(s.category_id)) continue;
    if (ownKeys.includes(s.template_key) || also.includes(s.template_key)) continue;
    also.push(s.template_key);
  }
  return { own: ownKeys, alsoUseful: also };
}

/** A template's items → Maker items ("Use this" copies; question lines only — a template carries no shop's media). */
export function draftItemsOfTemplate(items: unknown): FormItemDraft[] {
  if (!Array.isArray(items)) return [];
  const out: FormItemDraft[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const prompt = trim(r.prompt);
    if (!prompt) continue;
    const answerType = isFormAnswerType(r.answer_type) ? r.answer_type : 'short_answer';
    out.push({
      kind: 'question',
      prompt: prompt.slice(0, QUESTION_PROMPT_MAX),
      hint: trim(r.hint) || null,
      answerType,
      required: r.required === true,
      options: CHOICE_TYPES.has(answerType) ? cleanOptions(Array.isArray(r.options) ? (r.options as string[]) : []) : undefined,
    });
    if (out.length >= FORM_ITEMS_MAX) break;
  }
  return out;
}

/** The couple's typed answer for a type, as stored text — or null when the box should be cleared. */
export function answerText(type: FormAnswerType, raw: string | string[] | null | undefined, options?: readonly string[]): string | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    const allowed = new Set(options ?? []);
    const picked = raw.map((x) => x.trim()).filter((x) => x && (allowed.size === 0 || allowed.has(x)));
    return picked.length ? picked.join(' · ').slice(0, ANSWER_MAX) : null;
  }
  const t = raw.trim();
  if (!t) return null;
  if (type === 'number' && !/^-?\d+(?:[.,]\d+)?$/.test(t)) return null;
  if (type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  if (type === 'yes_no' && t !== 'Yes' && t !== 'No') return null;
  if ((type === 'multiple_choice' || type === 'dropdown') && options && options.length && !options.includes(t)) return null;
  return t.slice(0, ANSWER_MAX);
}

/** "answered N of M" counts only the question lines (media and links are not asked). */
export function answeredCount(
  items: readonly { question_id: string; item_kind: string }[],
  answered: ReadonlySet<string>,
): { answered: number; total: number } {
  const qs = items.filter((i) => i.item_kind === 'question');
  return { answered: qs.filter((q) => answered.has(q.question_id)).length, total: qs.length };
}
