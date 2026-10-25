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

/**
 * 🎞 THE COVER SCENE'S OWN UPLOADS, SHAPED LIKE cale-ice (read 2026-10-17): one photo (the hero's) and one ≤ 15 s clip
 * the couple uploaded on the cover itself — `scene-background/<uuid>-<name>.mp4` with its grabbed still beside it — as
 * the editor page hands them (`sceneUploadRefs` → `sceneUploads`). Local files, nothing signed.
 */
const COVER_CLIP = `r2://setnayan-media/events/${EV}/scene-background/b1643582-c132-4fcd-972b-311b5a2e5e50-lab-cebu.mp4`;
const COVER_CLIP_STILL = `r2://setnayan-media/events/${EV}/scene-background/b375e610-5d50-4477-98af-7ed1ab14a5dc-still.jpg`;
export const LAB_COVER_PHOTO_CHOICES: readonly { ref: string; url: string }[] = [LAB_PHOTO_CHOICES[1]!];
export const LAB_SCENE_UPLOADS: readonly { ref: string; url: string; kind: 'photo' | 'snippet'; poster: string | null; posterUrl: string | null }[] = [
  { ref: COVER_CLIP, url: '/realstories/jack-jill-cebu.mp4', kind: 'snippet', poster: COVER_CLIP_STILL, posterUrl: '/realstories/jack-jill-cebu.jpg' },
];

/** The same refs → their local addresses, for the lab's guest page (`mainGroundLayerFor`'s `signed`): nothing is signed. */
export const LAB_SIGNED: Readonly<Record<string, string>> = Object.fromEntries([
  ...LAB_PHOTO_CHOICES.map((p) => [p.ref, p.url] as const),
  [LAB_VIDEO_CHOICE.ref, LAB_VIDEO_CHOICE.url] as const,
  ...LAB_SCENE_UPLOADS.flatMap((u) => [[u.ref, u.url] as const, ...(u.poster && u.posterUrl ? [[u.poster, u.posterUrl] as const] : [])]),
]);
