/**
 * table-words.ts — how a table's name is written next to a guest.
 *
 * A couple names a table however they like: "7", "Table 9", "Sweetheart Table",
 * "Family of the Bride", "Principal Sponsors 1". Only a BARE NUMBER needs the
 * word "Table" in front of it; every other name is already what the couple
 * calls it and is printed exactly as they typed it.
 *
 * 🔴 WHY THIS IS ONE FUNCTION (owner, live on maria-and-jose at 375 px,
 * 2026-10-05): the guest list rows prefixed EVERY label with "Table ", so the
 * bride and groom read "Table Sweetheart Table" and a guest at "Table 9" read
 * "Table Table 9". The guest card already had the right rule in a private
 * helper; the list had its own template literal. Two spellings of one fact
 * drift — so the rule lives here and both read it.
 */

/** "7" → "Table 7"; "Table 9" / "Sweetheart Table" / "Sponsors" stay as named. */
export function tableWords(label: string): string {
  const trimmed = label.trim();
  return /^\d+$/.test(trimmed) ? `Table ${trimmed}` : trimmed;
}
