import { overlayPostEventDraftJson, postEventArrangementOf, sanitizePostEventDraft, type PostEventDraft } from '@/lib/post-event-draft';
import { compilePostEventScenes, postEventSceneList, type PostEventMakerRead, type PostEventSources } from '@/lib/post-event-scenes';

/**
 * 🧪 THE MAKER LAB'S POST EVENT STORY (DEV-ONLY — `/dev/maker-lab`; production 404s the lab).
 *
 * The lab handed the Maker `postEvent: null`, and its canvas drew the Invitation for the Post Event stage — so the
 * Post Event panel (`post-event-scene-panel.tsx`) could not be opened, seen or pressed by anybody without a database
 * (controller, 2026-10-09). This is maria-and-jose's story as the day AFTER the wedding would write it: the facts a
 * day leaves behind (`PostEventSources`), compiled by the REAL compiler (`compilePostEventScenes`) and listed by the
 * REAL lister (`postEventSceneList`) — never a hand-typed list of scenes, so the lab cannot drift from what the
 * Maker really shows.
 *
 * The lab's DRAFT of the story (`lab_editorial`, the cookie the lab's save stand-in writes — `maker-lab-shell.tsx`
 * `labDraft`) is laid over it exactly as the real Maker lays the hub draft over the story (`overlayPostEventDraftJson`),
 * so a switch, a move, a style or a word survives the render that follows a save. No write leaves the browser.
 */
const LAB_STORY_WRITTEN_AT = '2026-12-13T07:04:00.000Z';

/* (2026-10-10) Guest columns, Setnayan services and recommended suppliers are counted too, so Messages, Powered by
   Setnayan and Suppliers We Loved are drawn — every scene the story can write can be tapped on the lab. */
const LAB_POST_EVENT_SOURCES: PostEventSources = {
  cover: 'day',
  milestones: 4,
  metrics: { photos: 486, guests: 32 },
  chapters: [
    { time: '15:00', title: 'The ceremony', leadId: 'lab-c1', isClip: false, media: 42 },
    { time: '18:00', title: 'The reception', leadId: 'lab-c2', isClip: false, media: 61 },
  ],
  galleryPhotos: 486,
  broadcast: true,
  films: 1,
  kwento: 14,
  challengeAnswers: 0,
  guestColumns: 3,
  vendorMedia: 9,
  team: 6,
  seatingTables: 4,
  entourage: 12,
  beforeAfter: false,
  liveWall: { active: false, photos: 0 },
  reviews: 2,
  services: 2,
  vendorsWeLoved: 2,
  specialMessage: true,
  song: null,
  whatsNext: null,
};

/** The cookie the lab's save stand-in keeps the drafted story keys in. */
export const LAB_EDITORIAL_COOKIE = 'lab_editorial';

/** The lab's drafted story keys, read from its cookie's raw value — nothing drafted (or unreadable) = none. */
export function labEditorialDraft(cookieValue: string | undefined): PostEventDraft | undefined {
  if (!cookieValue) return undefined;
  try {
    return sanitizePostEventDraft(JSON.parse(decodeURIComponent(cookieValue)));
  } catch {
    return undefined;
  }
}

/** The story as the lab's "server" reads it: the day's facts compiled, the lab's draft laid over. */
export function labPostEventRead(draft: PostEventDraft | undefined): Extract<PostEventMakerRead, { ok: true }> {
  const story = overlayPostEventDraftJson({}, draft);
  return {
    ok: true,
    rows: postEventSceneList(compilePostEventScenes(LAB_POST_EVENT_SOURCES, LAB_STORY_WRITTEN_AT), story),
    generatedAt: LAB_STORY_WRITTEN_AT,
    coverPhotoUrl: null,
    wrote: false,
    dayHappened: true,
    arrangement: postEventArrangementOf(story),
  };
}
