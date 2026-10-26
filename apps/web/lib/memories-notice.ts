/**
 * memories-notice.ts — WHAT MEMORIES SAYS AFTER A PRESS (review 2026-10-24: "Memories must read ?error/?hidden and show
 * a banner"). Every action that lands on Memories — the photo sheet's moderation (`studio/papic/moderation/actions.ts`
 * with `back=memories`), a supplier's photos switch, + Add photos and its switch, and Google Drive's connect /
 * disconnect (carried on from the Papic page) — answers in the address. A save that did not land is SAID; it never
 * looks like nothing happened. Pure — `memories-notice.test.ts`.
 */
export type MemoriesNotice = { tone: 'ok' | 'bad'; text: string };

type Search = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined): string | null => (typeof v === 'string' ? v : Array.isArray(v) ? (v[0] ?? null) : null);

export function memoriesNotice(search: Search): MemoriesNotice | null {
  const error = one(search.error);
  if (error === 'tag_declined') {
    // ⚖ The guest took themselves off this photo ("Not me", or withdrew from face tagging) — their word stands.
    return { tone: 'bad', text: 'That guest took themselves off this photo, so they can’t be tagged in it again.' };
  }
  if (error === 'delete_partial') {
    // A partial delete must not say "try again and it will be fine" — the photo is still here on purpose.
    return { tone: 'bad', text: 'We could not remove every copy of that photo, so nothing was deleted — it is still here. Please try again.' };
  }
  if (error) return { tone: 'bad', text: 'That did not go through — nothing changed. Please try again.' };
  if (one(search.uploads_error)) return { tone: 'bad', text: 'Adding photos could not be turned on just now. Please try again.' };
  const drive = one(search.drive_error);
  if (drive) return { tone: 'bad', text: 'Google Drive did not connect — nothing changed. Please try again.' };
  if (one(search.vendorMedia) === 'error') return { tone: 'bad', text: 'That supplier’s photos did not change. Please try again.' };
  const ok =
    (one(search.reported) && 'Report sent to the Setnayan team.') ||
    (one(search.hidden) && 'Photo hidden from your Memories.') ||
    (one(search.unhidden) && 'Photo back in your Memories.') ||
    (one(search.blocked) && 'That guest can no longer add photos to this event.') ||
    (one(search.unblocked) && 'That guest can add photos again.') ||
    (one(search.approved) && 'Photo approved — it shows in your Memories again.') ||
    (one(search.deleted) && 'Photo deleted. Every copy of it is gone.') ||
    (one(search.tagged) && 'Tagged.') ||
    (one(search.untagged) && 'Tag removed.') ||
    (one(search.uploads_ready) && 'Adding photos is on — tap + to add yours.') ||
    (one(search.uploads_open_set) === '1' && 'Adding photos by hand is on.') ||
    (one(search.uploads_open_set) === '0' && 'Adding photos by hand is off.') ||
    (one(search.drive_connected) && 'Google Drive is connected.') ||
    (one(search.drive_disconnected) && 'Google Drive is disconnected.') ||
    (one(search.vendorMedia) === 'hidden' && 'That supplier’s photos are hidden from your Memories.') ||
    (one(search.vendorMedia) === 'shown' && 'That supplier’s photos are back in your Memories.') ||
    null;
  return ok ? { tone: 'ok', text: ok } : null;
}
