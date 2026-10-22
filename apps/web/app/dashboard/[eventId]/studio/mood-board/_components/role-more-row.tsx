'use client';

import { ChevronRight, Image as ImageIcon, PenLine } from 'lucide-react';

/**
 * 👗 A ROLE ROW'S ONE QUIET "MORE" ROW, ON A PHONE (owner 2026-10-22, "Yes to all" to prototype
 * `dress_code_role_rows_tidy_2026-10-22.html` § 2–3): ✎ the note's words (or "Add a note") · the photos' first two
 * thumbs and how many (or "No photos yet") · ›. Read without opening; a tap opens the row's sheet, which holds the
 * SAME note field and the SAME photos line (＋ · Search ideas) — nothing new is stored. A desk never draws it: the
 * same two stand in the row's right-hand column there (`lg:hidden`).
 *
 * Its own file for the reason `colour-dot.tsx` is: the Studio draws no hand-made button
 * (`studio-mood-board-are-the-templates.test.ts` rule 1) — this is a dialog opener (`aria-haspopup="dialog"`), the one
 * row-shaped one, with the frame because it is pressed. ≥ 44 px tall.
 */
export function RoleMoreRow({
  rowKey,
  label,
  note,
  photos,
  onOpen,
}: {
  rowKey: string;
  label: string;
  /** `undefined` — no note on this row yet (no Wear to keep it on); `''` — none written; else the note. */
  note: string | undefined;
  /** `null` — this role has no photo board. */
  photos: { count: number; thumbs: readonly string[] } | null;
  onOpen: () => void;
}) {
  const said = [
    note === undefined ? null : note ? `note “${note}”` : 'add a note',
    photos === null ? null : photos.count > 0 ? `${photos.count} ${photos.count === 1 ? 'photo' : 'photos'}` : 'no photos yet',
  ].filter(Boolean);
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={`${label} — ${said.join(' · ')}`}
      onClick={onOpen}
      className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-2xl border border-ink/15 px-3 py-1.5 text-left text-[14px] text-ink lg:hidden"
      data-mood-board-more={rowKey}
    >
      {note !== undefined ? (
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <PenLine aria-hidden strokeWidth={1.9} className="h-4 w-4 flex-none text-ink/55" />
          {note ? <em className="min-w-0 truncate">“{note}”</em> : <span className="truncate text-ink/70">Add a note</span>}
        </span>
      ) : null}
      {note !== undefined && photos ? (
        <span aria-hidden className="flex-none text-ink/30">
          ·
        </span>
      ) : null}
      {photos ? (
        <span className={`flex items-center gap-1.5 ${note !== undefined ? 'flex-none' : 'min-w-0 flex-1'}`}>
          {photos.thumbs.length > 0 ? (
            photos.thumbs.slice(0, 2).map((src, k) => (
              // eslint-disable-next-line @next/next/no-img-element -- the couple's own photo, already sized by the board
              <img key={k} src={src} alt="" className="h-6 w-6 flex-none rounded-md object-cover" />
            ))
          ) : (
            <ImageIcon aria-hidden strokeWidth={1.9} className="h-4 w-4 flex-none text-ink/55" />
          )}
          <span className="whitespace-nowrap text-ink/70">{photos.count > 0 ? `${photos.count} ${photos.count === 1 ? 'photo' : 'photos'}` : 'No photos yet'}</span>
        </span>
      ) : null}
      <ChevronRight aria-hidden strokeWidth={1.9} className="ml-auto h-4 w-4 flex-none text-ink/45" />
    </button>
  );
}
