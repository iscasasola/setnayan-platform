/**
 * /dev/inspiration-board-lab — THE INSPIRATION BOARD, ONE + PER PART (owner 2026-11-18, the approved one-+ drawing) on
 * fixtures, for the side-by-side with the drawing at 390 px. Dev only — 404s in production (first statement). No
 * sign-in, no database: every press calls the shipped action, which refuses with no session; nothing is written.
 *
 *   (no params)   a mixed board — empty parts, parts with photos, a supplier's photo, one full part (Cake)
 *   ?empty=1      a new event, nothing added
 */
import { notFound } from 'next/navigation';
import { InspirationBoard, type InspirationItem } from '@/app/dashboard/[eventId]/studio/mood-board/_components/inspiration-board';
import { InspirationBoardSheet } from '@/app/dashboard/[eventId]/vendors/_components/find-inspiration';

const swatch = (a: string, b: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="88" height="88" fill="url(#g)"/></svg>`,
  )}`;

const MIXED: InspirationItem[] = [
  { slot_key: 'venue', slot_position: 1, image_url: swatch('#D9D2E6', '#6A5A8A') },
  { slot_key: 'flowers', slot_position: 1, image_url: swatch('#F3ECDF', '#C5A059'), credit: 'Bloom & Co. · Florist' },
  { slot_key: 'flowers', slot_position: 2, image_url: swatch('#F4D7C9', '#B65A3A') },
  { slot_key: 'cake', slot_position: 1, image_url: swatch('#E8C9C0', '#B8889C') },
  { slot_key: 'cake', slot_position: 2, image_url: swatch('#C5D2BD', '#4F6B4A') },
  { slot_key: 'cake', slot_position: 3, image_url: swatch('#CFE0E6', '#4D7A8A') },
  { slot_key: 'bride', slot_position: 1, image_url: swatch('#F3ECDF', '#B8889C') },
  { slot_key: 'groom', slot_position: 1, image_url: swatch('#CFE0E6', '#1E2229') },
];

export default async function InspirationBoardLab({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const q = await searchParams;
  return (
    <InspirationBoardSheet>
      <InspirationBoard eventId="S89E-LABINSPIRE" initial={q.empty ? [] : MIXED} />
    </InspirationBoardSheet>
  );
}
