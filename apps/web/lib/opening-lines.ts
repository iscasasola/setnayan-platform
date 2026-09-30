/**
 * apps/web/lib/opening-lines.ts — the printed invitation's opening lines, on
 * their own so the Maker's Wording ▾ (`lib/type-in-place.ts`) can offer them
 * without loading the print pieces. `lib/print-pieces.ts` re-exports them.
 */

/**
 * OPENING-LINE TEMPLATES — owner 2026-09-25: *"Opening line, yes you can place it
 * there but provide a template as well"*, on the pattern the E-Gifts page already
 * uses for its message (`PABUYA_TEMPLATES`): a template FILLS THE BOX; what is
 * saved is always the couple's text, so improving a template's wording later
 * never rewrites anybody's card.
 */
export type OpeningLineTemplate = { key: string; name: string; body: string };
export const OPENING_LINE_TEMPLATES: readonly OpeningLineTemplate[] = [
  { key: 'faith', name: 'Faith', body: 'With thanksgiving to God and with the blessing of our parents,' },
  { key: 'formal', name: 'Formal', body: 'Together with their families, request the honour of your presence at their marriage' },
  { key: 'warm', name: 'Warm', body: 'With joyful hearts, we invite you to celebrate the beginning of our forever' },
  { key: 'filipino', name: 'Filipino', body: 'Sa biyaya ng Diyos at sa basbas ng aming mga magulang, kami ay nag-aanyaya' },
  { key: 'simple', name: 'Simple', body: 'Please join us as we begin our life together' },
];
