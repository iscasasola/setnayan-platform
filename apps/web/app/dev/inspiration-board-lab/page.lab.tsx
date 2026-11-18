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

// The app's own onboarding pictures stand in for photos — no raw colours, no drawn marks.
const pic = (name: string) => `/onboarding/wed_${name}.webp`;

const MIXED: InspirationItem[] = [
  { slot_key: 'venue', slot_position: 1, image_url: pic('catholic') },
  { slot_key: 'flowers', slot_position: 1, image_url: pic('christian'), credit: 'Bloom & Co. · Florist' },
  { slot_key: 'flowers', slot_position: 2, image_url: pic('cultural') },
  { slot_key: 'cake', slot_position: 1, image_url: pic('chinese') },
  { slot_key: 'cake', slot_position: 2, image_url: pic('inc') },
  { slot_key: 'cake', slot_position: 3, image_url: pic('jewish') },
  { slot_key: 'bride', slot_position: 1, image_url: pic('mixed') },
  { slot_key: 'groom', slot_position: 1, image_url: pic('muslim') },
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
