/**
 * apps/web/lib/social/library-import.ts — turns the planned Facebook library (specs corpus, library v2 CSV) into ONE
 * migration that inserts each row into social_posts. Pure: no I/O, no env. The command line is
 * `apps/web/scripts/social/import-library.ts`.
 *
 * Owner, 28 Nov 2026: posting is automatic in three Manila slots (08:00 · 14:00 · 20:00, plus the 12:00 holiday
 * extra), and the daily cap counts the planned posts. So each library row becomes a `social_posts` row:
 *
 *   source_type   'library'
 *   source_ref    a stable hash of date + slot (`librarySourceRef`) — one planned post per slot, ever
 *   title         Pillar · Link headline (the queue's label)
 *   body          Caption (primary text)
 *   link_url      the Door, made absolute on setnayan.com
 *   media_urls    every image, in order ("Images, in this order", split on "|"): 2+ → one multi-photo Facebook post
 *                 (controller, 28 Nov). A relative path ("slides/01.jpg") resolves under `imagesBase` + the row's
 *                 Folder; without a base it is an error, never a silent drop
 *   media_url     the first image (Instagram, TikTok and the single-photo path); none → the branded card
 *   first_comment the Pinned first comment
 *   slot          morning / afternoon / evening / holiday, from Time (Manila)
 *   scheduled_for Date + Time in Manila (+08:00, no DST), stored as UTC
 *   status        'scheduled'
 *
 * Idempotent: the INSERT skips any row whose ('library', source_ref) already exists in ANY status (a pulled planned
 * post stays pulled), and the partial-unique index (source_type, source_ref) is the backstop. Running the same
 * migration twice inserts nothing the second time.
 */
import { createHash } from 'node:crypto';

import { slotInstant, type SocialSlot } from './governor';

/** The site every Door hangs off. */
export const LIBRARY_DOOR_ORIGIN = 'https://setnayan.com';

export type LibraryRow = {
  line: number;
  date: string;
  slot: SocialSlot;
  sourceRef: string;
  scheduledFor: string;
  title: string;
  body: string;
  linkUrl: string | null;
  mediaUrl: string | null;
  mediaUrls: string[] | null;
  firstComment: string | null;
};

export type LibraryImportOptions = {
  /** Public https base the relative image paths live under (e.g. the public media bucket's library folder). */
  imagesBase?: string | null;
};

export type LibraryParse = { rows: LibraryRow[]; errors: string[]; warnings: string[] };

/** RFC 4180 CSV: quoted fields, doubled quotes, newlines inside quotes, CRLF, a leading BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/** The one place a planned post's identity is made: date + slot, hashed. Never changes for the same pair. */
export function librarySourceRef(date: string, slot: SocialSlot): string {
  return `lib-${createHash('sha256').update(`${date}|${slot}`).digest('hex').slice(0, 24)}`;
}

const TIME_TO_SLOT: Readonly<Record<string, SocialSlot>> = {
  '08:00': 'morning',
  '12:00': 'holiday',
  '14:00': 'afternoon',
  '20:00': 'evening',
};

/** "8:00", "08:00", "8:00 AM", "2:00 PM", "14:00" → "HH:MM", or null. */
export function normalizeManilaTime(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm|nn)?$/i);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  const mer = m[3]?.toLowerCase();
  if (mer === 'pm' && hour < 12) hour += 12;
  if (mer === 'am' && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** The Door as an absolute setnayan.com URL: an http(s) URL as is, "/path", or "setnayan.com/path". */
export function doorToUrl(raw: string): string | null {
  const door = raw.trim();
  if (!door) return null;
  if (/^https?:\/\//i.test(door)) return door;
  if (door.startsWith('/')) return `${LIBRARY_DOOR_ORIGIN}${door}`;
  const bare = door.match(/^(?:www\.)?setnayan\.com(\/\S*)?$/i);
  if (bare) return `${LIBRARY_DOOR_ORIGIN}${bare[1] ?? ''}`;
  return null;
}

/**
 * A real calendar day in YYYY-MM-DD. `new Date('2026-02-30')` silently rolls over to 2 March, so the day must
 * survive a round trip unchanged — 2026-02-30, 2026-13-01 and 2027-02-29 are refused, never moved.
 */
export function isRealCalendarDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

/** Find a column by its header, case-insensitive, by prefix (library v1 says "Pinned first comment (post by hand…)"). */
function columnIndex(header: string[], ...names: string[]): number {
  const cells = header.map((h) => h.trim().toLowerCase());
  for (const name of names) {
    const want = name.toLowerCase();
    const i = cells.findIndex((h) => h === want || [' ', '(', ','].some((sep) => h.startsWith(`${want}${sep}`)));
    if (i >= 0) return i;
  }
  return -1;
}

/** Read the library CSV into rows. Bad rows are listed in `errors` and left out; nothing is guessed. */
export function libraryRowsFromCsv(text: string, opts: LibraryImportOptions = {}): LibraryParse {
  const table = parseCsv(text);
  const errors: string[] = [];
  const warnings: string[] = [];
  const header = table[0] ?? [];
  const col = {
    date: columnIndex(header, 'Date'),
    time: columnIndex(header, 'Time (Manila)', 'Time'),
    slot: columnIndex(header, 'Slot'),
    pillar: columnIndex(header, 'Pillar'),
    caption: columnIndex(header, 'Caption (primary text)', 'Caption'),
    headline: columnIndex(header, 'Link headline'),
    comment: columnIndex(header, 'Pinned first comment'),
    door: columnIndex(header, 'Door'),
    images: columnIndex(header, 'Images'),
    folder: columnIndex(header, 'Folder'),
  };
  const base = opts.imagesBase?.trim().replace(/\/+$/, '') || null;
  if (base && !/^https:\/\//i.test(base)) {
    return { rows: [], errors: [`The images base "${base}" is not an https URL.`], warnings };
  }
  for (const required of ['date', 'time', 'caption'] as const) {
    if (col[required] < 0) errors.push(`The CSV has no "${required}" column.`);
  }
  if (errors.length > 0) return { rows: [], errors, warnings };

  const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');
  const seen = new Map<string, number>();
  const rows: LibraryRow[] = [];

  table.slice(1).forEach((r, idx) => {
    const line = idx + 2;
    const date = cell(r, col.date);
    if (!isRealCalendarDate(date)) {
      errors.push(`Line ${line}: date "${date}" is not a real YYYY-MM-DD date.`);
      return;
    }
    const time = normalizeManilaTime(cell(r, col.time));
    const slot = time ? TIME_TO_SLOT[time] : undefined;
    if (!slot) {
      errors.push(`Line ${line}: time "${cell(r, col.time)}" is not a slot (08:00, 12:00 holiday, 14:00, 20:00).`);
      return;
    }
    const slotLabel = cell(r, col.slot).toLowerCase();
    if (slotLabel && slotLabel.includes('holiday') !== (slot === 'holiday')) {
      errors.push(`Line ${line}: slot "${cell(r, col.slot)}" does not match time ${time} (holidays post at 12:00).`);
      return;
    }
    const body = cell(r, col.caption);
    if (!body) {
      errors.push(`Line ${line}: the caption is empty.`);
      return;
    }
    const key = `${date}|${slot}`;
    if (seen.has(key)) {
      errors.push(`Line ${line}: ${date} ${time} is already planned on line ${seen.get(key)}. One post per slot.`);
      return;
    }
    seen.set(key, line);

    const doorRaw = cell(r, col.door);
    const linkUrl = doorToUrl(doorRaw);
    if (doorRaw && !linkUrl) warnings.push(`Line ${line}: door "${doorRaw}" is not a setnayan.com link; no link set.`);
    const images = cell(r, col.images)
      .split('|')
      .map((x) => x.trim())
      .filter(Boolean);
    const relative = images.filter((x) => !/^https?:\/\//i.test(x));
    if (relative.length > 0 && !base) {
      errors.push(`Line ${line}: image "${relative[0]}" is a relative path; pass --images-base <https url>.`);
      return;
    }
    const folder = cell(r, col.folder).replace(/^\/+|\/+$/g, '');
    const imageUrls = images.map((x) =>
      /^https?:\/\//i.test(x) ? x : [base, folder, x.replace(/^\/+/, '')].filter(Boolean).join('/'),
    );
    const pillar = cell(r, col.pillar);
    const headline = cell(r, col.headline);

    rows.push({
      line,
      date,
      slot,
      sourceRef: librarySourceRef(date, slot),
      scheduledFor: slotInstant(date, slot).toISOString(),
      title: [pillar, headline].filter(Boolean).join(' · ') || `Planned post · ${date} ${time}`,
      body,
      linkUrl,
      mediaUrl: imageUrls[0] ?? null,
      mediaUrls: imageUrls.length >= 2 ? imageUrls : null,
      firstComment: cell(r, col.comment) || null,
    });
  });

  return { rows, errors, warnings };
}

/** A SQL string literal (standard_conforming_strings: only the quote is doubled). */
export function sqlText(value: string | null): string {
  return value === null ? 'NULL' : `'${value.replace(/'/g, "''")}'`;
}

/** A SQL text[] literal, or NULL. */
export function sqlTextArray(values: readonly string[] | null): string {
  return values === null || values.length === 0 ? 'NULL' : `ARRAY[${values.map(sqlText).join(', ')}]::text[]`;
}

/** The migration body that inserts every row once. Same rows in → same bytes out. */
export function libraryMigrationSql(rows: readonly LibraryRow[], sourceLabel: string): string {
  const header = [
    '-- ============================================================================',
    `-- Planned Facebook library → social_posts (source_type 'library').`,
    `-- Generated by apps/web/scripts/social/import-library.ts from ${sourceLabel.replace(/\n/g, ' ')}.`,
    `-- ${rows.length} planned post(s). Idempotent: a row whose ('library', source_ref) already exists in any`,
    '-- status is skipped, so re-running inserts nothing. Do not edit by hand; re-generate.',
    '-- ============================================================================',
    '',
  ];
  if (rows.length === 0) return [...header, '-- No rows.', ''].join('\n');
  const values = rows
    .map(
      (r) =>
        `  (${sqlText(r.sourceRef)}, ${sqlText(r.title)}, ${sqlText(r.body)}, ${sqlText(r.mediaUrl)}, ` +
        `${sqlTextArray(r.mediaUrls)}, ${sqlText(r.linkUrl)}, ${sqlText(r.scheduledFor)}::timestamptz, ${sqlText(r.slot)}, ` +
        `${sqlText(r.firstComment)})`,
    )
    .join(',\n');
  return [
    ...header,
    'BEGIN;',
    '',
    '-- 1 · the planned rows, once.',
    'CREATE TEMP TABLE library_import_rows ON COMMIT DROP AS',
    'SELECT v.source_ref, v.title, v.body, v.media_url, v.media_urls::text[] AS media_urls, v.link_url,',
    '       v.scheduled_for, v.slot, v.first_comment',
    'FROM (VALUES',
    values,
    ') AS v(source_ref, title, body, media_url, media_urls, link_url, scheduled_for, slot, first_comment);',
    '',
    '-- 2 · a planned post wins its slot: a site auto-post not yet sent that sits on a planned instant loses its',
    '--     time, and the flush hands it the next free 2 PM (one post per slot is a UNIQUE index).',
    'UPDATE public.social_posts p',
    '   SET scheduled_for = NULL, updated_at = NOW()',
    "WHERE p.status = 'scheduled'",
    "  AND p.source_type <> 'library'",
    '  AND p.scheduled_for IN (SELECT r.scheduled_for FROM library_import_rows r',
    '                          WHERE NOT EXISTS (SELECT 1 FROM public.social_posts q',
    "                                            WHERE q.source_type = 'library' AND q.source_ref = r.source_ref));",
    '',
    '-- 3 · insert each planned post once. Skipped: one already imported in any status (a pulled one stays pulled),',
    '--     and one whose slot a SENT post already holds (ON CONFLICT on the one-post-per-slot index).',
    'INSERT INTO public.social_posts',
    '  (source_type, source_ref, title, body, media_url, media_urls, link_url, scheduled_for, slot, first_comment, status)',
    "SELECT 'library', v.source_ref, v.title, v.body, v.media_url, v.media_urls, v.link_url, v.scheduled_for, v.slot, v.first_comment, 'scheduled'",
    'FROM library_import_rows v',
    'WHERE NOT EXISTS (',
    '  SELECT 1 FROM public.social_posts p',
    "   WHERE p.source_type = 'library' AND p.source_ref = v.source_ref",
    ')',
    'ON CONFLICT DO NOTHING;',
    '',
    'COMMIT;',
    '',
  ].join('\n');
}
