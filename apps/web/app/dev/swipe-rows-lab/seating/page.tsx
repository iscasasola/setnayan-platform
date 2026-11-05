/**
 * /dev/swipe-rows-lab/seating — the REAL Guests › Seats › List (`seating/_components/seat-list.tsx`) on fixture tables
 * with seated guests and edit held, for the swipe-to-delete screenshots (owner 2026-11-03). Dev only — 404s in
 * production (first statement). Nothing is written: Remove only moves the guest back to "To seat" in memory.
 */
import { notFound } from 'next/navigation';
import { LabSeatListRows } from './lab-seat-list-rows';

export default function SwipeRowsSeatingLab() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <LabSeatListRows />;
}
