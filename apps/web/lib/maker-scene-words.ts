/**
 * apps/web/lib/maker-scene-words.ts
 *
 * ✍ THE MAKER IS THE EDITOR: WORDS ARE EDITED WHERE THEY ARE SEEN.
 *
 * Owner, 2026-09-27 (DECISION_LOG), tapping his Special message scene's
 * "Write your message." placeholder: *"i cannot write a message"* → *"this is
 * the editor, so we can edit here."* So a tap on a scene's WORDS — in the
 * canvas, or its navigator tile — opens that scene's Content tab with the text
 * box focused, never the font · colour · size sheet and never another page.
 *
 * A "words scene" is one whose Content is ONE text box:
 *   · the Special message (bound to Details, `lib/details-bound.ts`);
 *   · a Letter scene built on it (template 11) that has no words of its own;
 *   · What to bring (its Content is the shipped `TextPanel`).
 * Every other scene keeps the tap it had: a part opens its style sheet, the
 * scene's space opens its panel.
 *
 * Pure — the shell and the tests both read it.
 */
import { detailsFactOfScene } from '@/lib/details-bound';
import type { HubSectionCanvas } from '@/lib/hub-canvas';

/** The scenes whose Content is one text box, by type. */
export const MAKER_WORDS_SCENE_TYPES: readonly string[] = ['special_message', 'what_to_bring'];

/** Is this scene's Content one text box (so a tap on its words opens it)? */
export function isWordsScene(
  widgetType: string,
  canvas: Pick<HubSectionCanvas, 'template'> | null | undefined,
  ownWords: readonly string[] = [],
): boolean {
  if (MAKER_WORDS_SCENE_TYPES.includes(widgetType)) return true;
  return detailsFactOfScene(widgetType, canvas) !== null && !ownWords.includes(widgetType);
}

/**
 * Does THIS canvas tap open the scene's words box? A tap on its words (`el`
 * 'body'), or any tap on it while it is empty — the placeholder IS the invitation
 * to write. Its label or heading still opens the style sheet on a written scene.
 */
export function tapOpensWords(input: { wordsScene: boolean; el: unknown; empty: unknown }): boolean {
  return input.wordsScene && (input.el === 'body' || input.empty === true);
}
