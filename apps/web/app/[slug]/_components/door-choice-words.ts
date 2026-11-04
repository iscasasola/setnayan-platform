/**
 * 🚪 THE GUEST DOOR'S WORDS (owner 2026-11-03, DECISION_LOG "THE GUEST DOOR IS ONE BUTTON"): *"just 1 button please"* ·
 * *"yes Open your invitation"* · *"either that or your recommendation, lost QR? Login"*.
 *
 * One button on the first screen; pressed, exactly three choices. Shared by the signed-out door (`get-inside.tsx`)
 * and a listed guest's "Not [name]? Switch account" (`not-you-switch.tsx`) — one set of words, never two.
 */
export const STRANGER_DOOR_WORDS = 'Open your invitation';

export const DOOR_CHOICE = {
  scan: 'Scan QR',
  upload: 'Upload QR',
  login: 'Lost QR? Login',
} as const;

/** A choice is a quiet framed button (it is pressable) — the ONE primary on the screen is the door itself. */
export const DOOR_CHOICE_CLASS = 'button-secondary flex min-h-[48px] w-full items-center justify-center gap-2';

/** "Lost QR? Login" — the shipped sign-in, back to this event afterwards. */
export function doorSignInHref(slug: string | null): string {
  return slug ? `/login?next=${encodeURIComponent(`/${slug}`)}` : '/login';
}
