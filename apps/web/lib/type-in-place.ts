/**
 * apps/web/lib/type-in-place.ts
 *
 * ✍ TAP ANY TEXT, TYPE RIGHT THERE — what each hero part's words ARE, and
 * where typing them writes (Maker core part 2; `prototypes/maker_in_four_
 * 2026-09-30_fable.html` frames B · C · H; DECISION_LOG "THE MAKER RE-PLAN IS
 * CUT TO ITS CORE": *"tap any text to type + Wording ▾ + Format ▾"*).
 *
 * ONE WRITE, ONE SOURCE. A part's words are typed on the page and written to
 * the ONE place they already live — never a copy:
 *
 *   WORDS parts — the small line on top, the invitation line, the joiner, the
 *     link and the photo caption. Their words are the couple's own
 *     (`HubElementStyle.word`, the shipped field the joiner, link and caption
 *     already carry), on the hero's canvas: DRAFTED like every part's look,
 *     one scene changed at Apply however many letters were typed, free.
 *     Empty, or the page's own words again = the automatic words back.
 *   FORMAT parts — the date and the time. Format ▾ is how the fact is
 *     written (`HubElementStyle.format`, `lib/hub-date-formats.ts`); the fact
 *     itself is Details' (the date finder, the programme), so no caret is put
 *     in them here — Format ▾ · Style ▾ · Hide.
 *
 * Wording ▾ offers ONLY lines that already exist in the product (owner
 * 2026-09-30, "✂ … never invent to reach five"): the page's own automatic
 * words, the card's two eyebrows, the printed invitation's opening lines, the
 * joiner's three words. Nothing here is Pro (`HUB_ELEMENT_PRO_FIELDS` is font
 * and motion only).
 *
 * Pure. The canvas (`type-in-place-canvas.ts`, inside the guest page's editing
 * bridge) and the Maker's bar (`type-in-place.tsx`) both read it, so it imports
 * only what both already carry.
 */
import {
  HUB_JOINER_WORDS,
  withElementChoice,
  sanitizeHubElementWord,
  type HubElementKey,
  type HubElementStyles,
} from './element-style';
import {
  HUB_FORMAT_DEFAULT,
  formatHubDate,
  formatHubTime,
  hubDateDefaultWords,
  hubDateFormatChoices,
  hubTimeDefaultWords,
  hubTimeFormatChoices,
  isHubDateFormat,
  isHubTimeFormat,
} from './hub-date-formats';
import { OPENING_LINE_TEMPLATES } from './opening-lines';
import { HUB_CARD_EYEBROWS } from './hub-part-words';

export { HUB_TYPE_PARTS, HUB_TYPE_WORD_PARTS, isHubTypePart, isTypeCaretPart, type HubTypePart } from './hub-part-words';

/**
 * THE WORDS, AS TYPED → THE PART'S `word`. The page's own words (`auto`) or
 * nothing = no word of their own (the automatic words come back); anything the
 * sanitizer refuses (markup-ish, too long) is NOT stored — the caller keeps the
 * last good words and says so.
 */
export function withTypedWords(
  elements: HubElementStyles | null | undefined,
  el: HubElementKey,
  typed: string,
  auto: string | null | undefined,
): { elements: HubElementStyles | null; refused: boolean } {
  const text = typed.replace(/\s+/g, ' ').trim();
  if (text.length === 0 || (auto && text === auto.replace(/\s+/g, ' ').trim())) {
    return { elements: withElementChoice(elements, el, 'word', null), refused: false };
  }
  const word = sanitizeHubElementWord(text, el);
  if (!word) return { elements: elements ?? null, refused: true };
  return { elements: withElementChoice(elements, el, 'word', word), refused: false };
}

/** Format ▾'s pick → the part's `format` (the page's own = no format stored). */
export function withTypedFormat(
  elements: HubElementStyles | null | undefined,
  el: HubElementKey,
  format: string,
): HubElementStyles | null {
  const ok = el === 'date' ? isHubDateFormat(format) : el === 'time' ? isHubTimeFormat(format) : false;
  return withElementChoice(elements, el, 'format', ok ? format : null);
}

/**
 * THE WORDS A FORMAT DRAWS — exactly what the masthead writes for that pick
 * (`PahinaMasthead`: the date alone; the time after its moment's own title,
 * `firstMomentLine`'s rule). Null when the part carries no fact to write.
 */
export function formatWords(
  el: HubElementKey,
  format: string,
  fact: { iso?: string | null; at?: string | null; title?: string | null },
): string | null {
  if (el === 'date') {
    return format === HUB_FORMAT_DEFAULT ? hubDateDefaultWords(fact.iso) : formatHubDate(fact.iso, format);
  }
  if (el === 'time') {
    const time = format === HUB_FORMAT_DEFAULT ? hubTimeDefaultWords(fact.at) : formatHubTime(fact.at, format);
    if (!time) return null;
    return `${(fact.title ?? '').trim() || 'Starts'} ${time}`;
  }
  return null;
}

/** Format ▾'s list for a part, each choice written in the couple's own date or time. */
export function formatChoices(el: HubElementKey, fact: { iso?: string | null; at?: string | null }) {
  if (el === 'date') return hubDateFormatChoices(fact.iso);
  if (el === 'time') return hubTimeFormatChoices(fact.at);
  return [];
}

/**
 * WORDING ▾ — the lines that already exist for this part, the page's own
 * first ("Automatic"). One line alone is no choice: the bar then shows no
 * Wording ▾ (the words are still typed in place).
 */
export function wordingLines(
  el: HubElementKey,
  ctx: { auto?: string | null; twoPeople: boolean },
): string[] {
  const out: string[] = [];
  const add = (line: string | null | undefined) => {
    const t = (line ?? '').replace(/\s+/g, ' ').trim();
    if (t && !out.includes(t) && (t === ctx.auto || sanitizeHubElementWord(t, el) === t)) out.push(t);
  };
  add(ctx.auto);
  if (el === 'eyebrow') {
    add(ctx.twoPeople ? HUB_CARD_EYEBROWS.twoPeople : HUB_CARD_EYEBROWS.one);
    add(ctx.twoPeople ? HUB_CARD_EYEBROWS.one : HUB_CARD_EYEBROWS.twoPeople);
    // The printed invitation's opening lines sit exactly here — above the names.
    if (ctx.twoPeople) for (const t of OPENING_LINE_TEMPLATES) add(t.body);
  }
  if (el === 'joiner') for (const w of HUB_JOINER_WORDS) add(w);
  return out.length > 1 ? out : [];
}
