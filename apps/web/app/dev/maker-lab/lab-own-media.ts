/**
 * 🧪 The lab's own pictures for Look › Background › "Your photo or video" — a photo and a hero video (with its
 * still), as the editor page hands them (`photoChoices` · `videoChoice`). Local files the app already serves
 * (`/realstories/…`), under refs shaped like the couple's own: nothing is uploaded, nothing is signed, nothing
 * leaves the machine. The clip is LANDSCAPE on purpose — a phone crops it at the sides, which is what Focus ▾
 * Left · Right exist for (owner 2026-10-14, "focus not working").
 */
const EV = '00000000-0000-4000-8000-000000000000';
const PHOTO = `r2://setnayan-media/events/${EV}/main-background/lab-garden.jpg`;
const HERO_STILL = `r2://setnayan-media/events/${EV}/landing-page-hero-image/lab-tagaytay.jpg`;
const HERO_CLIP = `r2://setnayan-media/events/${EV}/landing-page-hero-video/lab-tagaytay.mp4`;

export const LAB_PHOTO_CHOICES: readonly { ref: string; url: string }[] = [
  { ref: HERO_STILL, url: '/realstories/maria-juan-tagaytay.jpg' },
  { ref: PHOTO, url: '/realstories/jack-jill-g1.jpg' },
];
export const LAB_VIDEO_CHOICE = { ref: HERO_CLIP, url: '/realstories/maria-juan-tagaytay.mp4', poster: HERO_STILL };

/** The same refs → their local addresses, for the lab's guest page (`mainGroundLayerFor`'s `signed`): nothing is signed. */
export const LAB_SIGNED: Readonly<Record<string, string>> = Object.fromEntries([
  ...LAB_PHOTO_CHOICES.map((p) => [p.ref, p.url] as const),
  [LAB_VIDEO_CHOICE.ref, LAB_VIDEO_CHOICE.url] as const,
]);
