/**
 * output-moves.ts — "move the input, the output must move" (Root map part 2,
 * slice 5).
 *
 * Owner, 2026-10-02 (DECISION_LOG "THE ROOT MAP ALSO CATCHES A NUMBER THAT
 * LOOKS LIVE BUT IS TYPED IN"): "a test renders each counting screen for two
 * different events / two different 'today's and fails if the number stays the
 * same". A typed-in "190 days to go" passes every snapshot test and every type
 * check — it only fails when the input moves and the output does not. This is
 * the one assertion that catches it, kept tiny so any counting screen can use it.
 *
 *   assertOutputMoves({
 *     what: 'Home · days to go',
 *     render: (today) => renderHome(today),       // the real chain, rendered
 *     read: (html) => numberBeside(html, 'days to go'),
 *     inputs: [todayA, todayB],
 *     expect: ['200', '199'],                    // optional: the exact readings
 *   });
 *
 * Fails when a reading is missing (the number is not on the screen at all),
 * when the two readings are equal (it did not move), or when `expect` is given
 * and a reading differs (it moved to the wrong value).
 */

export interface OutputMovesCase<I> {
  what: string;
  render: (input: I) => string | Promise<string>;
  read: (output: string) => string | null;
  inputs: readonly [I, I];
  expect?: readonly [string, string];
}

export async function outputReadings<I>(c: OutputMovesCase<I>): Promise<[string | null, string | null]> {
  const a = c.read(await c.render(c.inputs[0]));
  const b = c.read(await c.render(c.inputs[1]));
  return [a, b];
}

export async function assertOutputMoves<I>(c: OutputMovesCase<I>): Promise<void> {
  const [a, b] = await outputReadings(c);
  if (a === null || b === null) {
    throw new Error(`${c.what}: the number is not on the screen (readings: ${String(a)} / ${String(b)}).`);
  }
  if (a === b) {
    throw new Error(`${c.what}: the input moved and the output did not — "${a}" both times. Typed in?`);
  }
  if (c.expect && (a !== c.expect[0] || b !== c.expect[1])) {
    throw new Error(`${c.what}: moved to the wrong value — got "${a}" / "${b}", expected "${c.expect[0]}" / "${c.expect[1]}".`);
  }
}

/** The text of the element just before the one whose text is `label` — the big number above its caption. */
export function numberBeside(html: string, label: RegExp): string | null {
  const re = new RegExp(`>([^<>]+)</(?:p|b|span|div|strong)>\\s*<(?:p|span|div)[^>]*>\\s*(?:${label.source})\\s*<`, label.flags.replace('g', ''));
  return html.match(re)?.[1]?.trim() ?? null;
}
