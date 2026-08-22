/**
 * WHO CAN SEE YOUR STORY — three answers, one column.
 *
 * Owner 2026-08-22, closing the story maker: only me · the people of this
 * celebration · everyone. The same three the Storyteller composer already
 * offers (`lib/creator-chapters.ts`), deliberately worded the same way — a
 * person meeting this choice twice in one product should not have to work out
 * whether the two mean the same thing.
 *
 *   draft      →  only me
 *   event      →  the people of this celebration
 *   published  →  everyone
 *
 * 🔑 THE AUDIENCE LIVES INSIDE `status`, NOT IN A COLUMN OF ITS OWN, and that is
 * the whole safety argument. Several shipped read paths already ask
 * `status = 'published'` — the Told shelf, the Library's guest view, Real
 * Stories, the admin counts. Keeping the audience in that column means every one
 * of them, and every one written in future, refuses a celebration-only story
 * WITHOUT being edited. **Forgetting hides; forgetting cannot leak.** A separate
 * `story_audience` column would have left all of them reading `published` and
 * silently ignoring the couple's choice.
 *
 * 🚨 WHAT THIS FIXES, not just adds. Until now the public page rendered the
 * story on LIFECYCLE ALONE — `plan.body === 'editorial'` — and never looked at
 * `status`. A row is auto-created for every event at creation, so after the day
 * a couple's UNPUBLISHED story was already readable by anyone who could open the
 * page. "Only me" did not exist. That is why the gate below closes the DATA
 * rather than hiding a component: hiding the block leaves the same words one
 * fetch away.
 *
 * Pure + total — no network, no `server-only`. Safe on the client and on the
 * render path, so the editor and the public page share one definition.
 */

export const STORY_AUDIENCES = ['draft', 'event', 'published'] as const;
export type StoryAudience = (typeof STORY_AUDIENCES)[number];

/** What a person reads. Never the stored word — see the note above. */
export const STORY_AUDIENCE_LABEL: Record<StoryAudience, string> = {
  draft: 'Only me',
  event: 'The people of this celebration',
  published: 'Everyone',
};

/** What each choice actually does, said before it is pressed. */
export const STORY_AUDIENCE_NOTE: Record<StoryAudience, string> = {
  draft:
    'Nobody else can open it — not even your guests. You can keep writing and choose later.',
  event:
    'The people of that day can read it — the hosts, the guests who have a seat, ' +
    'and the suppliers who worked it. It stays off Setnayan’s Stories and off ' +
    'search engines.',
  published:
    'Anyone with your link can read it, and Setnayan may feature it on Stories.',
};

export function isStoryAudience(v: unknown): v is StoryAudience {
  return typeof v === 'string' && (STORY_AUDIENCES as readonly string[]).includes(v);
}

/**
 * Read a stored status into an audience.
 *
 * ⚠ AN UNRECOGNISED VALUE FAILS CLOSED, to `draft`. This is the opposite of the
 * Live Photo Wall's value narrowing, and deliberately so: there, an unknown
 * value silently deleting a ₱2,500 feature was the worse outcome, so it failed
 * open. Here the thing on the other side is somebody's wedding being readable by
 * strangers, so an unreadable value must mean "show nobody" and never "show
 * everyone".
 */
export function storyAudienceOf(status: unknown): StoryAudience {
  return isStoryAudience(status) ? status : 'draft';
}

/** Is this story readable by anyone other than its host? */
export function storyIsShared(status: StoryAudience): boolean {
  return status === 'event' || status === 'published';
}

/**
 * Who is asking.
 *
 * `isHost` — an accepted host of THIS celebration. They wrote it; they always
 * see it, at every audience, including their own draft.
 *
 * `belongsToEvent` — one of the day's people: a guest with a seat, a redeemed
 * invitation, an invited account, or a supplier who worked it. The page already
 * knows how to answer this for its private-event lock screen; this type exists
 * so the answer is PASSED IN rather than re-derived here, where it would be a
 * second opinion that could disagree with the lock.
 */
export type StoryViewer = {
  isHost: boolean;
  belongsToEvent: boolean;
};

/** The viewer a caller gets when it says nothing: a stranger. */
export const STRANGER: StoryViewer = { isHost: false, belongsToEvent: false };

/**
 * May this viewer read this story?
 *
 * THE ONE GATE. Every public surface asks this and nothing else — the page, the
 * print sheet, the social card. Three surfaces each asking their own version of
 * the question is three chances to forget, and the next surface makes four; that
 * is exactly how the Live Photo Wall ended up mirrored onto every guest's phone.
 */
export function storyAudienceAdmits(
  status: StoryAudience,
  viewer: StoryViewer = STRANGER,
): boolean {
  if (viewer.isHost) return true;
  if (status === 'draft') return false;
  if (status === 'event') return viewer.belongsToEvent;
  return true;
}
