/**
 * ics-text — the text rules every supplier `.ics` download shares (RFC 5545 §3.1, §3.3.11).
 *
 * Coordinator walk, 2026-10-23: the shop-wide "Phone calendar" file and a customer's day-of timeline each hand-rolled
 * these, and drifted. The shop-wide escape wrote `'\;'` — in a JS string that is just `;` — so a booking named
 * "Ana; Ben" ended its SUMMARY at the semicolon; it also ended without the final CRLF RFC 5545 requires. Neither file
 * folded a line past 75 octets (an event name in Filipino with "·" and "ñ" passes that quickly), and a CR inside a
 * label went through raw. One place now, so the two files cannot drift again.
 *
 * Pure; no imports — safe in any route.
 */

/** A TEXT value: backslash, semicolon and comma escaped; every line break (CRLF, CR or LF) becomes `\n`. */
export function icsEscape(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

const utf8 = new TextEncoder();

/**
 * One content line folded so no physical line passes 75 octets (UTF-8), each continuation starting with one space.
 * Never splits a character: a code point that would cross the limit starts the next line.
 */
export function foldIcsLine(line: string): string {
  if (utf8.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let octets = 0;
  let limit = 75;
  for (const ch of line) {
    const n = utf8.encode(ch).length;
    if (octets + n > limit) {
      out.push(cur);
      cur = '';
      octets = 0;
      limit = 74; // the leading space of a continuation line is one of its 75
    }
    cur += ch;
    octets += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

/** The file: every line folded, CRLF between them AND after the last (RFC 5545 §3.1). */
export function icsDocument(lines: readonly string[]): string {
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}
