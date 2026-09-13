'use client';

/**
 * "You saved 2 of their photos" — the far end of the supplier gallery chain
 * (MB10).
 *
 * 🔑 WHY THIS IS ITS OWN FILE. A supplier uploads to the inspiration gallery
 * for exactly one reason: the couple who saves their bouquet finds them again
 * in the list where they choose who to hire. That makes this badge the payoff
 * of the whole chain — the library column, the board's `library_asset_id`, the
 * per-shop tally — and none of it is worth anything if the number never
 * reaches a pixel. A repo lesson, paid for more than once: A LOG LINE NEVER
 * CHANGED A PIXEL. The guest-read error was bound and in Sentry, and the couple
 * was still told their wedding was empty.
 *
 * Extracting it buys a real render test (`the-saved-photo-marker-reaches-the-
 * render.test.ts`) against the actual copy and pluralisation, instead of a
 * source grep over `category-search-overlay.tsx`'s 800 lines. The overlay's
 * `renderRow` mounts THIS, with `count={r.savedGalleryPhotoCount}`, and its
 * sibling guard pins that mount — so both ends and the line between them are
 * held.
 *
 * ⚠ `count === null` MEANS UNKNOWN, and this renders NOTHING for it — a badge
 * saying "0" or "we couldn't check" beside every shop would be noise. The
 * unknown is reported ONCE, by the overlay's header, from
 * `savedPhotoTallyFailed`. The two halves are deliberate: absence of a badge is
 * not a claim, whereas a header that stays silent about a dead read is.
 */

/**
 * The copy, exported so its test asserts the real string and not a paraphrase.
 *
 * `null` for 0 AND for `null`, but the two are NOT the same fact and the caller
 * must not conflate them: 0 means "we counted, and none of your saves are
 * theirs"; `null` means the count could not be read. See the note above on
 * which half of the UI is responsible for saying so.
 *
 * ⚠ DELIBERATELY NOT IN `lib/moodboard-gallery.ts`. That module imports
 * `lib/taxonomy.ts` for the slot→trade lookup, and this renders in the
 * browser — importing four lines from there would ship the whole vendor
 * taxonomy to every couple opening the vendor list.
 */
export function savedPhotoMarkerLabel(count: number | null): string | null {
  if (count === null || count <= 0) return null;
  return count === 1
    ? 'You saved 1 of their photos'
    : `You saved ${count} of their photos`;
}

export function SavedPhotoMarker({ count }: { count: number | null }) {
  const label = savedPhotoMarkerLabel(count);
  if (!label) return null;
  return (
    <span
      className="badge saved-photos"
      title="You picked this shop's photos into your inspiration board"
    >
      {label}
    </span>
  );
}
