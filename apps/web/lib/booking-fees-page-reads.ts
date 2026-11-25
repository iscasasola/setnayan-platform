/**
 * 🧾 THE BOOKING-FEE PAGES' READS, SAID WHEN THEY FAIL (final check 25 Nov, area 6).
 *
 *   · `readWaivedForPage` (A6-59) — the waived list for a shop. A shop id that could not be read is not "no free
 *     bookings": the answer is `null` (unread), and the page draws "We couldn't load your waived fees just now." With
 *     the fee system dark there is nothing to list either way, so that case still asks the reader (which answers []).
 *   · `batchOrUnread` (A6-60) — one fee's batch of reads. A read that THROWS inside it is `null`, and the page draws its
 *     own `BookingFeeReadFailed` instead of the dashboard error screen.
 */
export async function readWaivedForPage<Row, Unreadable>(
  vendorProfileId: string | null | undefined,
  feeEnabled: boolean,
  read: (vendorProfileId: string | null | undefined) => Promise<Row[] | Unreadable>,
  unreadable: Unreadable,
): Promise<Row[] | null> {
  if (!vendorProfileId && feeEnabled) return null;
  const result = await read(vendorProfileId).catch(() => unreadable);
  return result === unreadable ? null : (result as Row[]);
}

export async function batchOrUnread<T>(reads: () => Promise<T>, onError?: (err: unknown) => void): Promise<T | null> {
  try {
    return await reads();
  } catch (err) {
    onError?.(err);
    return null;
  }
}
