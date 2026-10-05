import { isHubMainChoice, isHubMainOwn, type HubMainGround } from './hub-canvas';

/**
 * 🖼 WHICH OF THE FOUR CHOICES IS LIT — the Main background panel's one rule.
 *
 * `choosingMedia` is the couple's own press of "Upload media", and it WINS over
 * what is stored. It used to be read only after a stored choice: on an event
 * saved as "None — just the colour" (or the theme's own), the press changed
 * nothing on screen — no pictures, no upload — and with no hero photo ("Same as
 * my hero" disabled) there was no way back to a photo at all (owner, live on
 * his own event, 2026-10-01: *"nothing happens when i click the upload media"*).
 * Pressing never saves; picking a photo does.
 */
export function mainGroundChoice(input: {
  current: HubMainGround | null;
  choosingMedia: boolean;
  /** The stored value follows THIS hero photo. */
  followsHero: boolean;
  heroPhotoRef: string | null;
}): 'theme' | 'loop' | 'hero' | 'media' | 'none' {
  const { current, choosingMedia } = input;
  if (choosingMedia || isHubMainOwn(current)) return 'media';
  if (isHubMainChoice(current)) return current.ground;
  return input.followsHero || (!current && input.heroPhotoRef) ? 'hero' : 'theme';
}
