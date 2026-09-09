/**
 * PUBLISH ONCE, KNOWING WHO READS IT — the ladder's rules and its words.
 *
 * 08 step 1.6 · design `02` §8 · prototype `story-maker.html` "PUBLISH" panel.
 *
 * PURE ON PURPOSE — no `server-only`, no client, no Supabase. The gate that
 * decides whether a host may publish is a function of plain facts, so the
 * BUTTON and the SERVER ACTION ask the identical question and a unit test can
 * exercise it without a database. A disabled button is not a fence; the action
 * calls this too (`app/dashboard/[eventId]/story/actions.ts`).
 *
 * ── THE THREE STATES ALREADY SHIP ────────────────────────────────────────────
 * `lib/who-can-see-your-story.ts` is the audience and its one gate
 * (`storyAudienceAdmits`). Nothing here re-decides who may READ a story; this
 * module only decides whether the host may MOVE it to `published`, and carries
 * the words the prototype puts on that screen.
 *
 * ── WHAT IS GATED, AND WHAT MUST NEVER BE ────────────────────────────────────
 * 🔑 ONLY `published` IS GATED. `draft` and `event` are always available, and
 * that is load-bearing rather than a convenience: the consent tick's own last
 * sentence promises the host "can go back to guests-only whenever". A gate that
 * also blocked the way DOWN would break the promise printed directly above it —
 * a host with a half-decided desk would be locked into `published`, which is
 * the exact opposite of what this screen is for.
 */

import type { StoryAudience } from './who-can-see-your-story';

/* ─── The words ──────────────────────────────────────────────────────────────
 *
 * ⚠ VERBATIM FROM `02` §8 AND THE PROTOTYPE. The consent sentence is the RA
 * 10173 record of what the host agreed to; it is quoted in the design, quoted
 * in the session brief and asserted character-for-character by
 * `publish-once-knowing-who-reads-it.test.ts`. Rewording it is a consent
 * change, not a copy edit.
 */

export const PUBLISH_CONSENT_SENTENCE =
  'I want this story to be public, and I understand it will carry our names, ' +
  'our photos, and the words our guests agreed to share.';

export const PUBLISH_CONSENT_FINE_PRINT =
  'Guests keep their own say either way: anyone can hide their photo or ask to ' +
  'be unnamed at any time, and it comes down everywhere — including the next ' +
  'print run. You can take the story back to guests-only whenever you like.';

export const PUBLISH_PANEL_INTRO =
  'Your story grows in private and publishes once. Until you publish, only the ' +
  'people holding your Papic QR can see what your guests sent.';

/** "Now · Next · Last" — the ladder reads as a ladder, not three equal buttons. */
export const PUBLISH_STATE_RUNG: Record<StoryAudience, string> = {
  draft: 'Now',
  event: 'Next',
  published: 'Last',
  /*
    ⚠ NOT A STEP ON THE LADDER — IT IS THE WAY OFF IT. "Now · Next · Last"
    numbers a journey the host is walking forwards; `taken_back` is the reverse,
    only reachable once they have already reached the top, so giving it a
    fourth ordinal would say it comes AFTER publishing in the ordinary run of
    things. It does not, and most stories will never see it.
  */
  taken_back: 'Undo',
};

/**
 * The rung's own name.
 *
 * ⚠ NOT `STORY_AUDIENCE_LABEL`, AND THE DIFFERENCE IS DELIBERATE. That module's
 * labels answer "who can read it" as a sentence fragment — *Only me* · *The
 * people of this celebration* · *Everyone* — and are used where the answer is
 * the point ("Saved · everyone can read it"). Here the host is choosing a rung
 * on a ladder, and the design names the rungs: Draft · Guests only · Published.
 * Both are shown on the same card, the name above and the who-line below, so
 * neither has to do the other's job.
 */
export const PUBLISH_STATE_NAME: Record<StoryAudience, string> = {
  draft: 'Draft',
  event: 'Guests only',
  published: 'Published',
  taken_back: 'Taken back',
};

/** What the rung does, in the design's own words. */
export const PUBLISH_STATE_BLURB: Record<StoryAudience, string> = {
  draft:
    'Only you. The desk fills as photos, wishes and answers arrive — before, ' +
    'during and after the day.',
  event:
    'Everyone holding your Papic QR can read it and find their own day. Not ' +
    'searchable, not shareable outside the day.',
  published:
    'Your story becomes public at your own address, and can appear on ' +
    'setnayan.com. It gets its edition number the moment you publish.',
  /*
    ⚠ THE SENTENCES A HOST IS OWED HERE ARE THE ONES ABOUT WHAT DOES *NOT*
    HAPPEN. Naming the four surfaces is the honest version of "it comes down
    everywhere", and the last sentence is the limit: paper cannot be recalled.
    `07` Q6 asks for that limit to be said out loud in the copy, not only in the
    PR — a host who believes a printed keepsake can be reached has been misled by
    us, and they may have handed those copies out at the reception.
  */
  taken_back:
    'Your story stops being public straight away — your page, the printable ' +
    'copy and the card that shows when someone shares your link. Your edition ' +
    'number is yours forever and you can publish again whenever you like. ' +
    'Copies already printed on paper cannot be changed by anyone.',
};

/**
 * "Who can see it: …" — the line the design requires on every rung.
 *
 * ⚠ THE PROTOTYPE WRITES "your 120 guests" ON THE MIDDLE RUNG. That is a filled
 * mock-up, not a template: a real headcount is a number this screen does not
 * hold, and printing a wrong one under the words "who can see it" is worse than
 * printing none. The rung says WHO, which is what the design asked for; how
 * many is a different question and nobody is guessing at it here.
 */
export const PUBLISH_STATE_WHO: Record<StoryAudience, string> = {
  draft: 'Who can see it: you',
  event: 'Who can see it: the people holding your Papic QR',
  published: 'Who can see it: anyone with the link',
  taken_back: 'Who can see it: you, and nobody else any more',
};

export const LAST_WORD_INTRO =
  'The story always ends with your words, then your song. Nobody writes this ' +
  'for you.';

/**
 * The hard ceiling on the host's last word.
 *
 * 🔑 ONE COLUMN, TWO DOORS, ONE CAP. `events.special_message` is also written by
 * `/dashboard/[eventId]/website/special-message`, whose action caps at 600. The
 * number lives here so the two doors cannot drift into different truths about
 * how long a last word may be — the drift the Theme step refuses for the mood
 * board, met again in a smaller shape.
 */
export const LAST_WORD_MAX = 600;

/* ─── The gate ────────────────────────────────────────────────────────────── */

/**
 * Why publishing is refused. Every value is a sentence the host can act on —
 * there is no "invalid" arm, because a host who cannot publish is owed the
 * reason and never a shrug.
 */
export type PublishBlocker = 'desk_undecided' | 'desk_unknown' | 'no_consent';

/** The facts the gate is a function of. Nothing here is read from a client. */
export type PublishFacts = {
  /** Is every decidable item on the desk decided? (`deskIsClear`.) */
  deskClear: boolean;
  /**
   * Did the desk actually load, completely?
   *
   * 🔑 FALSE MUST REFUSE, NOT SHRUG. An unreadable source and an empty one look
   * identical — the desk's own banner says so — and this gate exists to stop a
   * story publishing over undecided guest words. A desk that could not be read
   * has not proved it is clear, so it is treated as not clear, with its own
   * reason so the host is not told a lie about what is waiting.
   */
  deskLoaded: boolean;
  /** Has the host ticked the consent, now or on an earlier visit? */
  consented: boolean;
};

export function publishBlockers(facts: PublishFacts): PublishBlocker[] {
  const out: PublishBlocker[] = [];
  if (!facts.deskLoaded) out.push('desk_unknown');
  else if (!facts.deskClear) out.push('desk_undecided');
  if (!facts.consented) out.push('no_consent');
  return out;
}

/**
 * May the host move the story to this audience?
 *
 * Total by construction: every audience that is not `published` returns true.
 * See the module docblock — the way DOWN is never gated.
 */
export function mayChooseAudience(
  audience: StoryAudience,
  facts: PublishFacts,
): boolean {
  if (audience !== 'published') return true;
  return publishBlockers(facts).length === 0;
}

/** The reason, in the host's words. Shown beside the rung it disables. */
export function publishBlockerSentence(
  blocker: PublishBlocker,
  openCount: number,
): string {
  switch (blocker) {
    case 'desk_undecided':
      return openCount === 1
        ? 'One thing is still waiting for you on the desk.'
        : `${openCount} things are still waiting for you on the desk.`;
    case 'desk_unknown':
      return 'We could not read your desk just now, so we cannot tell what is still waiting. Reload and try again.';
    case 'no_consent':
      return 'Tick the box below to say you want this story public.';
  }
}

/**
 * The refusal the SERVER returns. Deliberately the same sentences the button
 * shows, so a host who gets past the button (an old tab, a hand-made request)
 * is told the same thing rather than meeting a different vocabulary.
 */
export function publishRefusal(blockers: readonly PublishBlocker[], openCount: number): string {
  const first = blockers[0];
  if (!first) return 'Could not publish. Please try again.';
  return publishBlockerSentence(first, openCount);
}

/**
 * WHICH RUNGS THE LADDER OFFERS — the fourth one is not always one of them.
 *
 * `STORY_AUDIENCES` is every value the column may hold; this is the smaller
 * question of what a host should be shown right now. Draft · Guests only ·
 * Published are always offered. **Taken back is offered only to a story that has
 * actually been published**, because "take it back" said to a story that was
 * never out there is a rung with nothing behind it — and pressing it would move
 * the row to a status meaning "this was public once", which would be a lie
 * written by the product about the host's own celebration.
 *
 * 🔑 A ROW ALREADY AT `taken_back` ALWAYS SHOWS IT, whatever else is true. A
 * ladder that hides the rung a story is standing on tells the host their story
 * is in a state it is not, and there would be no way back to it. (It can only be
 * reached from `published`, so in practice `hasBeenPublished` is true here too —
 * this arm is the belt to that braces, and costs one comparison.)
 *
 * Pure and total: the caller passes the facts, so the BUTTON and any test ask
 * the same question — the same reason the gate above is pure.
 */
export function rungIsOffered(
  rung: StoryAudience,
  facts: { hasBeenPublished: boolean; current: StoryAudience },
): boolean {
  if (rung !== 'taken_back') return true;
  return facts.hasBeenPublished || facts.current === 'taken_back';
}
