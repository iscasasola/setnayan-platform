/**
 * guest-list-flash.ts — WHAT THE GUEST LIST SAYS AFTER A PRESS, from the `?<news>` an action lands with. Moved out of
 * `page.tsx` (2026-10-26) so the in-place door (`app/_actions/save-in-place.ts`) says the SAME words on the row when
 * a press stays on the screen instead of redirecting. Pure.
 */
import { formatCount } from '@/lib/format-number';

export function pickFlash(search: {
  added?: string;
  saved?: string;
  removed?: string;
  imported?: string;
  updated?: string;
  skipped?: string;
  duplicates?: string;
  bulk_assigned?: string;
  bulk_grouped?: string;
  bulk_sided?: string;
  bulk_seated?: string;
  bulk_unseatable?: string;
  new_qr?: string;
  inspect?: string;
  bulk_deleted?: string;
  paired?: string;
  unpaired?: string;
  swapped?: string;
  sections?: string;
  reordered?: string;
  order_cleared?: string;
  group_created?: string;
  group_saved?: string;
  group_deleted?: string;
  group_member_removed?: string;
}): string | null {
  if (search.added) {
    const n = Number(search.added);
    if (Number.isFinite(n) && n > 1) return `Added ${formatCount(n)} guests.`;
    return 'Guest added.';
  }
  if (search.saved) return 'Saved.';
  if (search.removed) return 'Guest removed.';
  if (search.imported) {
    const n = Number(search.imported);
    const s = Number(search.skipped ?? 0);
    const d = Number(search.duplicates ?? 0);
    const u = Number(search.updated ?? 0);
    const parts = [`Imported ${formatCount(n)} guest${n === 1 ? '' : 's'}`];
    if (u > 0) parts.push(`updated ${formatCount(u)}`);
    if (d > 0) parts.push(`skipped ${d} duplicate${d === 1 ? '' : 's'}`);
    if (s > 0) parts.push(`skipped ${s} invalid row${s === 1 ? '' : 's'}`);
    return parts.join(' · ') + '.';
  }
  if (search.bulk_assigned) {
    const n = Number(search.bulk_assigned);
    return `Role assigned to ${formatCount(n)} guest${n === 1 ? '' : 's'}.`;
  }
  if (search.bulk_grouped) {
    const n = Number(search.bulk_grouped);
    return `Added ${formatCount(n)} guest${n === 1 ? '' : 's'} to the group.`;
  }
  // ⋯ › New QR from a row (the card says it on the card itself).
  if (search.new_qr === '1' && !search.inspect) {
    return 'Done — a new QR and link. The old ones no longer work. Send them the new one.';
  }
  if (search.bulk_seated) {
    const n = Number(search.bulk_seated);
    const left = Number(search.bulk_unseatable ?? 0);
    return `Table set for ${formatCount(n)} ${n === 1 ? 'guest' : 'guests'}.${
      left > 0 ? ` ${formatCount(left)} not coming or not placed were left as they were.` : ''
    }`;
  }
  if (search.bulk_sided) {
    const n = Number(search.bulk_sided);
    return `Side updated for ${formatCount(n)} guest${n === 1 ? '' : 's'}.`;
  }
  if (search.bulk_deleted) {
    const n = Number(search.bulk_deleted);
    return `Removed ${formatCount(n)} guest${n === 1 ? '' : 's'} · seats opened up.`;
  }
  if (search.paired) return 'Paired — they walk in together.';
  if (search.unpaired) return 'Pair removed.';
  if (search.swapped) return 'Swapped — they traded places.';
  if (search.sections) return search.sections === 'reset' ? 'Sections back in the usual order.' : 'Section order saved.';
  if (search.reordered) return 'Wedding March saved.';
  if (search.order_cleared) return 'Back to alphabetical order.';
  if (search.group_created) return 'Group created.';
  if (search.group_saved) return 'Group saved.';
  if (search.group_deleted) return 'Group deleted.';
  if (search.group_member_removed) return 'Removed from group.';
  return null;
}
