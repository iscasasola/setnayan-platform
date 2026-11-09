import { saveInPlace } from '@/app/_actions/save-in-place';
import type { PapicDoor, PapicInPlaceResult } from './_lib/papic-in-place';

/**
 * 📍 EVERY PAPIC CONTROL SAVES IN PLACE (owner, live 2026-10-26: *"saving minimum and maximum on papic resets the whole
 * screen. this should not happen"* · *"when i turn of a challenge. it should just remove it"* · *"it jumped to a
 * different page"*).
 *
 * Papic's own door (#6970) is now part of the ONE app-wide door (`app/_actions/save-in-place.ts`, owner "same to the
 * rest of the website"): its `papic.*` doors run the SAME actions, through the same limited-helper gate (`photos`), and
 * read the redirect with the same reader (`papicInPlaceAnswer`). This is only the Papic spelling of that door — the
 * name without its `papic.` prefix — so every Papic caller (`PapicStayForm`, the challenge swipe, the Home card's
 * chapter pick) keeps its call. Not a server action itself: it calls one.
 * Held by `_lib/papic-saves-in-place.test.ts`.
 */
export function papicSaveInPlace(door: PapicDoor, formData: FormData): Promise<PapicInPlaceResult> {
  return saveInPlace(`papic.${door}`, formData);
}
