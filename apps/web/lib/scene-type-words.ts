/**
 * apps/web/lib/scene-type-words.ts
 *
 * ✍ TAP ANY TEXT, TYPE RIGHT THERE — ON EVERY SCENE, NOT ONLY THE HERO.
 *
 * DECISION_LOG "✂ THE MAKER RE-PLAN IS CUT TO ITS CORE" keeps *"tap any text to
 * type + Wording ▾ + Format ▾"*; the two-week audit (Area B) found it only on the
 * hero (`typeablePart`), every other scene still typed in an inspector box. This
 * is the Maker's half for the other scenes — which of a scene's words are typed
 * in place, and the ONE draft write each becomes. The canvas half is
 * `type-in-place-canvas.ts` (it marks the part, puts the caret in it); the bar is
 * `type-in-place.tsx`.
 *
 * ONE WRITE, ONE SOURCE, WAITS FOR APPLY (owner 2026-10-01, *"in event hub
 * maker will only take effect when pressed apply"*). Each field is written to
 * the one place it already lives, in the hub DRAFT — never a copy, never live:
 *
 *   message   → `events.special_message`  (`HUB_DRAFT_WORDS_COLUMNS`)
 *   reminders → `events.what_to_bring`    (`HUB_DRAFT_WORDS_COLUMNS`)
 *   title     → the scene of their own's `custom.title` (`HubDraftWidget.custom`)
 *   body      → the scene of their own's `custom.body`
 *
 * WHICH WORDS ARE OFFERED. Only words the scene DRAWS now — an empty scene has
 * nothing to tap, and keeps its box for its first words. The Special message
 * a couple changed "just here" (`canvas.details.message`) is NOT offered: its
 * box asked "everywhere or just here" and carries the ↺ back to the shared
 * message (`lib/details-bound.ts`), which a caret cannot. A Letter's words that
 * are the shared message (template 11 with no words of its own) are not
 * offered for the same reason — its heading is.
 *
 * Nothing here is Pro: a couple's own words are free (`HUB_WORDS_EVENT_COLUMNS`;
 * a scene of their own's words under its grandfather rule).
 *
 * Pure. No I/O. Imports only constants with no imports of their own.
 */
import type { HubSectionCanvas } from './hub-canvas';
import type { HubDraftPatch } from './hub-draft';
import type { SceneTypeField, SceneTypeWords } from './hub-part-words';
import { CUSTOM_COLUMN_BODY_MAX, CUSTOM_COLUMN_TITLE_MAX } from '@/app/[slug]/_components/editorial/custom-columns';

/**
 * The longest message / reminders — the draft's own cap for both columns
 * (`HUB_DRAFT_TEXT_MAX`, the writers' 600). Restated, not imported, so the type
 * bar's chunk does not carry the draft module; `scene-type-words.test.ts`
 * holds the two equal.
 */
export const SCENE_WORDS_TEXT_MAX = 600;

/** The custom section rows (`CUSTOM_SECTION_TYPES`) — restated for the same reason, held equal by the test. */
const CUSTOM_TYPE = /^custom_[1-6]$/;

export type SceneOwnWords = { title: string; body: string };

/** The longest a field may be. */
export function sceneFieldMax(field: SceneTypeField): number {
  if (field === 'title') return CUSTOM_COLUMN_TITLE_MAX;
  if (field === 'body') return CUSTOM_COLUMN_BODY_MAX;
  return SCENE_WORDS_TEXT_MAX;
}

/** What the couple sees the field called, in the bar's messages. */
export const SCENE_FIELD_LABEL: Record<SceneTypeField, string> = {
  message: 'Your message',
  reminders: 'Your reminders',
  title: 'Heading',
  body: 'Words',
};

/**
 * Every scene field the Maker offers to type in place, with the words it draws
 * now — read off the SAME values the canvas is drawn from (the draft over live).
 */
export function sceneTypeWords(input: {
  /** The scene rows the page has (`widget_type`). */
  types: readonly string[];
  /** Each scene's canvas as the page draws it (only its `details` is read). */
  canvases: Readonly<Record<string, object | undefined>>;
  /** `events.special_message`, drafted over live. */
  message: string | null | undefined;
  /** `events.what_to_bring`, drafted over live. */
  reminders: string | null | undefined;
  /** Each scene of their own's words (`config_json.custom`), drafted over live. */
  own: Readonly<Record<string, SceneOwnWords | undefined>>;
}): SceneTypeWords[] {
  const out: SceneTypeWords[] = [];
  const put = (type: string, field: SceneTypeField, raw: string | null | undefined) => {
    const text = (raw ?? '').replace(/\r\n?/g, '\n').trim();
    if (text) out.push({ key: `w:${type}`, field, text });
  };
  for (const type of input.types) {
    if (type === 'special_message') {
      // "Just this scene" keeps its box (its ↺ is the box's).
      const canvas = input.canvases[type] as Pick<HubSectionCanvas, 'details'> | undefined;
      if (!canvas?.details?.message) put(type, 'message', input.message);
    } else if (type === 'what_to_bring') {
      put(type, 'reminders', input.reminders);
    } else if (CUSTOM_TYPE.test(type)) {
      const own = input.own[type];
      put(type, 'title', own?.title);
      put(type, 'body', own?.body);
    }
  }
  return out;
}

export type SceneTypeWrite =
  | { ok: true; writeKey: string; patch: HubDraftPatch; words: string }
  | { ok: false; reason: string };

/**
 * THE ONE DRAFT WRITE for words typed into a scene field. `own` is the scene of
 * their own's words as the Maker has them now (the other half rides along — the
 * draft replaces `custom` whole). Refused, never cut: an empty message,
 * reminders or words (taking them off the page is Hide), or words over the cap.
 */
export function sceneTypeWrite(
  field: SceneTypeField,
  widgetType: string,
  typed: string,
  own: SceneOwnWords | null | undefined,
): SceneTypeWrite {
  const words = typed.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
  const label = SCENE_FIELD_LABEL[field];
  if (words.length > sceneFieldMax(field)) {
    return { ok: false, reason: `${label}: keep it under ${sceneFieldMax(field).toLocaleString('en-PH')} characters.` };
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(words)) {
    return { ok: false, reason: `${label}: those characters cannot be used here.` };
  }
  if (!words && field !== 'title') {
    return { ok: false, reason: `${label} cannot be left empty — to take the words off the page, tap Hide.` };
  }
  if (field === 'message') {
    return { ok: true, writeKey: 'events:special_message', patch: { events: { special_message: words } }, words };
  }
  if (field === 'reminders') {
    return { ok: true, writeKey: 'events:what_to_bring', patch: { events: { what_to_bring: words } }, words };
  }
  if (!CUSTOM_TYPE.test(widgetType)) return { ok: false, reason: `${label}: this scene's words are not typed here.` };
  const base = own ?? { title: '', body: '' };
  const custom = field === 'title' ? { title: words, body: base.body } : { title: base.title, body: words };
  if (!custom.body) return { ok: false, reason: 'Words cannot be left empty — to take the words off the page, tap Hide.' };
  return {
    ok: true,
    writeKey: `custom:${widgetType}`,
    patch: { widgets: { [widgetType]: { custom } } } as HubDraftPatch,
    words,
  };
}
