/**
 * tag-list-csv.ts — the whole guest list as name + tag link.
 *
 * Writing one sticker per guest from a phone is fine for a handful and absurd
 * for 180: the couple would tap the phone 180 times. A desktop NFC writer
 * (an ACR122U and NFC Tools for PC, or any encoding service) takes a file of
 * links instead, and encodes a stack of stickers in one run — which is also
 * the only way a printer or supplier can do it for them.
 *
 * Pure so it can be tested: no DOM, no fetch.
 */

export type TagRow = { name: string; url: string };

/** RFC 4180: quote every field, double the quotes inside, CRLF line endings. */
function cell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * `name,url` with a header row. A leading `=`, `+`, `-` or `@` is prefixed
 * with a single quote so a spreadsheet treats a name as TEXT rather than a
 * formula (a guest called "-Anna" must not become a calculation).
 */
export function tagListCsv(rows: readonly TagRow[]): string {
  const safe = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
  const lines = [
    [cell('name'), cell('tag_url')].join(','),
    ...rows.map((r) => [cell(safe(r.name)), cell(r.url)].join(',')),
  ];
  return `${lines.join('\r\n')}\r\n`;
}

/** A filename a person can find later: `ana-miguel-nfc-tags.csv`. */
export function tagListFileName(eventName: string | null | undefined): string {
  const slug = (eventName ?? '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug ? `${slug}-nfc-tags.csv` : 'nfc-tags.csv';
}
