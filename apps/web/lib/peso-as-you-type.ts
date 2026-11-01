/**
 * peso-as-you-type — A PESO AMOUNT GETS ITS COMMAS WHILE IT IS TYPED. (2026-10-30)
 *
 * Owner, verbatim, on his iPhone in the record sheet: *"cannot place commas because it only shows number pad now with
 * period."* The amount fields open the number pad (digits + a period) on purpose — and it has no comma key, so
 * "100,000" could not be typed and a long amount was unreadable while typing. The field does the work instead: he types
 * 100000 and sees 100,000, the caret stays after the digit he just typed, and what is SAVED is the plain number
 * (`planAmountNumber` / `amountDigits` drop the commas on the way out).
 *
 * Pasting what money is written with ("₱295,000", "PHP 1,000") still works: every mark that is not a digit or the one
 * decimal point is dropped, and the commas are put back where they belong.
 *
 * PURE — executed by `a-peso-amount-gets-its-commas-as-typed.test.ts`.
 */

/** Group whole pesos with commas: "1000000" → "1,000,000". */
function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * The field's new words and where the caret goes. `caret` is the caret in the RAW text the browser just produced;
 * it lands after the same number of digits (and the point) it had after it, so typing in the middle stays in the middle.
 * `decimals` = how many centavo digits are allowed (0 for whole pesos: no point at all).
 */
export function formatPesoTyping(raw: string, caret: number = raw.length, decimals = 2): { text: string; caret: number } {
  const keepChar = (ch: string) => /\d/.test(ch) || (decimals > 0 && ch === '.');
  // How many meaningful characters stood before the caret.
  let before = 0;
  for (let i = 0; i < Math.min(caret, raw.length); i += 1) if (keepChar(raw[i]!)) before += 1;

  let intPart = '';
  let frac = '';
  let seenPoint = false;
  let kept = 0;
  let cut = 0; // meaningful characters actually kept, counted before the caret
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i]!;
    if (!keepChar(ch)) continue;
    const isBefore = kept < before;
    kept += 1;
    if (ch === '.') {
      if (seenPoint) continue; // a second point is dropped
      seenPoint = true;
      if (isBefore) cut += 1;
      continue;
    }
    if (seenPoint) {
      if (frac.length >= decimals) continue;
      frac += ch;
    } else intPart += ch;
    if (isBefore) cut += 1;
  }
  // A leading zero before other whole digits is dropped ("007" → "7") — and the caret with it.
  const stripped = intPart.replace(/^0+(?=\d)/, '');
  cut = Math.max(0, cut - (intPart.length - stripped.length));
  intPart = stripped;
  if (intPart === '' && seenPoint) intPart = '0';

  const text = group(intPart) + (seenPoint ? `.${frac}` : '');
  // Walk the formatted text until `cut` meaningful characters have passed.
  let pos = 0;
  let passed = 0;
  while (pos < text.length && passed < cut) {
    if (text[pos] !== ',') passed += 1;
    pos += 1;
  }
  return { text, caret: pos };
}

/** The number a formatted amount stands for — what is saved. NaN when there is none. */
export function pesoTypedNumber(text: string): number {
  const t = String(text ?? '').replace(/[^\d.]/g, '');
  return t === '' || t === '.' ? NaN : Number(t);
}
