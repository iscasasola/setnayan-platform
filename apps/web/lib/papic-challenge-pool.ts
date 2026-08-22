/**
 * THE PAPIC CHALLENGE POOL — the canonical list, in one file.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * `papic_challenge_library` is a DATABASE table, and until now its rows were
 * hand-typed into migrations. Sixty rows survived that. Five hundred will not:
 * a migration is write-once (an applied migration is never edited), so the only
 * readable record of what the pool CONTAINS would be scattered across however
 * many migrations it took to get there.
 *
 * So the pool lives here, and `scripts/emit-papic-challenge-pool.mjs` GENERATES
 * the migration from it. Nothing is typed twice.
 * 🔑 A GUARD COMPARING TWO HAND-TYPED THINGS IS NOT A GUARD — that is how
 * `llms.txt` drifted for three weeks with green CI. `papic-challenge-pool.db.
 * test.ts` compares the live table against THIS ARRAY, and the migration is
 * derived from the same array, so the two can only agree.
 *
 * ── THE OWNER'S ASK, 2026-08-21 ─────────────────────────────────────────────
 * "we want to create a 500 papic challenges … activities that they can talk
 * make people do during the event. or something they can share to the host.
 * like a greeting, a story."
 * And the shapes he named, verbatim:
 *   · a confession box where they share their stories  → `stories`
 *   · an on the spot anywhere challenge                → `anywhere`   (NEW)
 *   · a challenge that includes the host               → `couple_family`
 *   · a challenge that includes other people           → `meet_room`
 *   · a selfie                                         → `selfie`     (NEW)
 *   · a flex of what they wore. or brought             → `fashion_candids`
 *   · a special message for the couple                 → `greeting`   (NEW)
 * Five of the seven ALREADY HAD A HOME. Three categories are new; the rest of
 * this file grows what shipped rather than replacing it (RULE 0).
 *
 * ── THE WORDING LOCK — BINDING ON EVERY ROW ADDED HERE ──────────────────────
 * 🔒 "SAFE ENOUGH TO SHARE" IS A CONSTRAINT ON THE WORDING, NOT A DISCLAIMER
 * (owner, 2026-08-10). The capture route's blocklist stops DARES. It does not
 * stop tactlessness, and an answer that embarrasses somebody in front of both
 * families is unsafe though every word passes. So:
 *   · Point at something GOOD — proud of · kindest · best at · what people get
 *     wrong. NEVER wildest / most embarrassing / secret / never-told.
 *   · Anything that could tip carries its steer IN the prompt, where the guest
 *     reads it ("keep it kind" · "Be nice").
 *   · Never ask a guest to rank people, to compare the two of them, or to speak
 *     about an ex, money, or family friction.
 * `papic-challenge-pool.test.ts` enforces the banned words on every row.
 *
 * ── TEN SECONDS IS THE ANSWER, AND THE PROMPT MUST SAY SO ───────────────────
 * ⚠ A clip is hard-capped at 10 000 ms (owner lock 2026-07-22 §0, mirrored in
 * the client, the route and the RPC) and a challenge completes on the guest's
 * NEXT capture. There is NO text-answer path. A story prompt that does not name
 * the ten seconds gets the guest cut off mid-sentence AND TOLD THEY SUCCEEDED.
 * Every `clip` row that asks a QUESTION therefore ends by naming the length;
 * the test asserts it.
 *
 * ── THE TOKENS — SUBSTITUTED AT READ, NEVER STORED RESOLVED ─────────────────
 * The board is materialized per EVENT (one row serves every guest), so nothing
 * per-guest may be baked in at materialization.
 *   {who}   side-aware, WEDDING ONLY — 'the bride' · 'the groom' · 'the couple',
 *           resolved per guest from `guests.side` inside `papic_guest_missions`.
 *   {host}  who is throwing this one — 'the couple' · 'the celebrant' · 'the
 *           graduate' · 'the host', from `event_type_profiles.terminology`.
 *   {hosts} the same, possessive — 'the couple’s' · 'the celebrant’s'.
 *   {event} 'wedding' · 'birthday' · 'graduation' · 'event'.
 * 🔑 {host} IS ONLY EVER AN OBJECT, NEVER A SUBJECT. 'the couple' takes a plural
 * verb and 'the celebrant' a singular one, so "{host} is dancing" is wrong for
 * half the event types no matter which way it is written. "A photo with {host}"
 * is right for all of them. The test refuses a row where {host} is followed by
 * is/are/has/have/was/were.
 *
 * ── EVENT SCOPE ─────────────────────────────────────────────────────────────
 * `eventTypes: null` means the row fits ANY event. A list means only those.
 * 🚨 THIS IS A LIVE DEFECT BEING FIXED, NOT A PRECAUTION. Measured in production
 * 2026-08-21: the event `movie-night` is of type `date` and carries a full
 * 20-slot board asking two people to "dance with the bride or groom", "catch the
 * newlyweds mid-kiss" and get "a photo with one of the couple's parents". The
 * library had no way to say "wedding only", so the board had no way to ask.
 */

import type {
  ChallengeCategory,
  CaptureKindKey as CaptureKind,
  MissionTypeKey as MissionType,
} from './papic-challenge-categories';

export type { ChallengeCategory, CaptureKind, MissionType };

export type PoolRow = {
  /** Stable forever. Assigned from a per-category block — see ID_BLOCKS. */
  libraryId: number;
  slug: string;
  category: ChallengeCategory;
  title: string;
  prompt: string;
  captureKind: CaptureKind;
  missionType: MissionType;
  /**
   * 1..20, UNIQUE across the whole pool — a rank is a BOARD POSITION, and two
   * rows claiming one turns a guarantee into a coin flip. Only 16 are used; a
   * row with no rank is reachable by the couple's picker and by backfill.
   */
  priorityRank: number | null;
  /** null = any event type. A list = only those. */
  eventTypes: string[] | null;
};

/**
 * ID BLOCKS. Ids are handed out by POSITION inside a block, so appending to the
 * END of a block is safe and inserting into the MIDDLE renumbers everything
 * after it. `papic-challenge-pool.test.ts` pins every slug to its id, so a
 * renumber fails loudly instead of silently re-pointing live boards at the
 * wrong question.
 */
export const ID_BLOCKS: Record<string, number> = {
  shipped: 1,            //    1– 60  the 60 that already exist in production
  selfie: 100,           //  100–199
  anywhere: 200,         //  200–299
  greeting: 300,         //  300–399
  stories: 400,          //  400–499
  stories_couple: 500,   //  500–559
  couple_family: 600,    //  600–699
  meet_room: 700,        //  700–799
  fashion_candids: 800,  //  800–899
  food_drinks: 900,      //  900–999
  decor_booth: 1000,     // 1000–1099
  band_dance: 1100,      // 1100–1199
  big_moments: 1200,     // 1200–1299
};

/** WEDDING-ONLY scope, written once so it cannot drift row to row. */
const WEDDING = ['wedding'] as const;

// ─── The authoring helpers ───────────────────────────────────────────────────
//
// A pool row has nine fields and eight of them are the same for most rows in a
// block. Spelling all nine out five hundred times would make the one field that
// VARIES — the sentence a guest reads — the hardest thing on the line to see.
// So a block carries the defaults and each row carries a title, a prompt, and
// only what it overrides.

type Draft = {
  title: string;
  prompt: string;
  /** Overrides the block default. */
  kind?: CaptureKind;
  /** Overrides the block default. */
  mission?: MissionType;
  /** 1..20, UNIQUE pool-wide. Only the 16 shipped ranks are used. */
  rank?: number;
  /** Overrides the block default. `null` re-widens a wedding-scoped block. */
  events?: readonly string[] | null;
  /** Only the 60 shipped rows set this — their slugs are already in prod. */
  slug?: string;
};

/**
 * Title → slug. Deterministic and lossy on purpose: it strips everything that
 * is not a letter, a digit or a space. Two titles that differ only in
 * punctuation therefore collide, which the UNIQUE slug test catches at build
 * time rather than the database catching it at deploy time.
 */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * `at` is either a key of ID_BLOCKS (the new blocks) or a literal number (the
 * nine shipped runs, whose ids 1–60 are already in production and happen to be
 * contiguous per category — verified against the live table, not assumed).
 */
function block(
  at: keyof typeof ID_BLOCKS | number,
  category: ChallengeCategory,
  defaults: { kind: CaptureKind; mission?: MissionType; events?: readonly string[] | null },
  drafts: Draft[],
): PoolRow[] {
  const base = typeof at === 'number' ? at : ID_BLOCKS[at];
  if (base === undefined) throw new Error(`unknown id block: ${String(at)}`);
  return drafts.map((d, i) => ({
    libraryId: base + i,
    slug: d.slug ?? slugifyTitle(d.title),
    category,
    title: d.title,
    prompt: d.prompt,
    captureKind: d.kind ?? defaults.kind,
    missionType: d.mission ?? defaults.mission ?? 'prompt',
    priorityRank: d.rank ?? null,
    // `events` is deliberately checked with `in`, not `??`: a row that means
    // "this one is fine at any event" writes `events: null`, and `??` would
    // read that null as "unset" and silently re-apply the block's wedding scope.
    eventTypes: readEvents('events' in d ? d.events : defaults.events),
  }));
}

/**
 * `readonly string[] | null | undefined` → `string[] | null`.
 * ⚠ The absent case and the explicit-null case must land on the SAME value.
 * `events: null` is how a row inside a wedding-scoped block says "actually this
 * one is fine anywhere"; collapsing that with `??` against the block default
 * would silently re-apply the wedding scope and the row would be right in the
 * file and wrong in the database.
 */
function readEvents(v: readonly string[] | null | undefined): string[] | null {
  return v ? [...v] : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// THE SIXTY THAT ALREADY SHIP
// ═══════════════════════════════════════════════════════════════════════════
//
// Read out of the production table on 2026-08-21 and reproduced with their ids,
// slugs and ranks intact.
//
// ⚠ ONE PROMPT IS CORRECTED, AND IT IS NAMED HERE RATHER THAN SLIPPED IN.
// `serenade` (id 20) is a CLIP that said only "Sing one line of the couple's
// song" — no length. A clip is cut at 10 000 ms and the guest is then TOLD THEY
// SUCCEEDED, so that row was quietly truncating people mid-line. It now says
// "Ten seconds." Safe to change: a board copies the prompt at materialization,
// so the two live boards keep the text they already have and only future ones
// get the corrected line. The id and the slug — the things a live board points
// at — are untouched. Two live events already carry boards built from
// these rows, and `papic_missions.library_id` points straight at them — so an
// id or a slug that moves here re-points a live board at a different question.
//
// ⚠ THE ONLY THING THAT CHANGES FOR THEM IS `eventTypes`, and it is the fix.
// Every one of the sixty was written for a wedding; the library had no way to
// SAY so, so `movie-night` (a `date`) is sitting in production right now with a
// board that asks two people to catch the newlyweds mid-kiss. Rows that read
// fine at any celebration are widened by REWORDING them onto {host} further
// down this file, never by pretending the wedding wording is neutral.

const SHIPPED: PoolRow[] = [
  ...block(1, 'couple_family', { kind: 'photo', events: WEDDING }, [
    { slug: 'steal-a-dance', title: 'Steal a Dance', prompt: 'Sneak onto the floor and dance with the bride or groom. Now. Go.', rank: 1, kind: 'clip' },
    { slug: 'kiss-cam', title: 'Kiss Cam', prompt: 'Catch the newlyweds mid-kiss.', rank: 4 },
    { slug: 'twin-the-couple', title: 'Twin the Couple', prompt: 'Recreate their signature pose. Full commitment.' },
    { slug: 'blessing-cam', title: 'Blessing Cam', prompt: 'Five seconds to camera: your wish for them.', rank: 3, kind: 'clip' },
    { slug: 'pabati', title: 'Pabati', prompt: 'Leave the newlyweds a video greeting.', kind: 'pabati', mission: 'video_greeting' },
    { slug: 'parents-hug', title: "Parents' Hug", prompt: "A photo with one of the couple's parents.", rank: 10 },
    { slug: 'entourage-selfie', title: 'Entourage Selfie', prompt: 'Grab a shot with a bridesmaid or groomsman.' },
  ]),
  ...block(8, 'food_drinks', { kind: 'photo', events: WEDDING }, [
    { slug: 'toast-at-the-bar', title: 'Toast at the Bar', prompt: 'Raise a glass at the drinks station. Any drink counts. Clink!', mission: 'toast_or_dance' },
    { slug: 'signature-drink', title: 'Signature Drink', prompt: "Order the couple's signature cocktail or mocktail and show it off." },
    { slug: 'sweet-tooth', title: 'Sweet Tooth', prompt: 'Raid the dessert table and flaunt your haul.' },
    { slug: 'cake-watch', title: 'Cake Watch', prompt: "Get the wedding cake in frame before it's gone." },
    { slug: 'catch-the-cart', title: 'Catch the Cart', prompt: 'Ice cream, coffee, fishball, cotton candy — catch a cart in action.', kind: 'clip' },
    { slug: 'grazing-table', title: 'Grazing Table', prompt: 'Strike a pose at the grazing or appetizer spread.' },
    { slug: 'food-trip', title: 'Food Trip', prompt: 'Snap the best-looking plate of the night.' },
  ]),
  ...block(15, 'band_dance', { kind: 'clip', events: WEDDING }, [
    { slug: 'tunnel-run', title: 'Tunnel Run', prompt: 'Dance your way through the grand entrance or send-off tunnel.' },
    { slug: 'bust-a-move', title: 'Bust a Move', prompt: 'Your best move, on the floor, no warning.' },
    { slug: 'dance-off', title: 'Dance-Off', prompt: 'Challenge someone to a 10-second dance battle.', mission: 'toast_or_dance' },
    { slug: 'group-boogie', title: 'Group Boogie', prompt: 'Get 5+ people dancing in one frame.', rank: 7, kind: 'photo' },
    { slug: 'request-a-song', title: 'Request a Song', prompt: 'Shout your request at the band or DJ.' },
    { slug: 'serenade', title: 'Serenade', prompt: "Sing one line of the couple's song. Ten seconds." },
    { slug: 'conga-line', title: 'Conga Line', prompt: 'Start one. Do not stop.' },
  ]),
  ...block(22, 'decor_booth', { kind: 'photo', events: WEDDING }, [
    { slug: 'photo-booth-run', title: 'Photo Booth Run', prompt: 'Hit the photo booth or photo wall and grab a shot.', rank: 8 },
    { slug: 'backdrop-star', title: 'Backdrop Star', prompt: 'Pose at the main backdrop or arch.' },
    { slug: 'bloom-check', title: 'Bloom Check', prompt: 'Find the prettiest florals in the room.' },
    { slug: 'under-the-lights', title: 'Under the Lights', prompt: 'Catch the LED wall, fairy lights, or dance-floor glow.', kind: 'clip' },
    { slug: 'table-art', title: 'Table Art', prompt: "Show off your table's centerpiece and styling." },
    { slug: 'aisle-moment', title: 'Aisle Moment', prompt: 'A photo at the ceremony aisle, altar, or arch.' },
  ]),
  ...block(28, 'meet_room', { kind: 'photo', mission: 'roster', events: WEDDING }, [
    { slug: 'new-friend', title: 'New Friend', prompt: 'Meet a total stranger. Selfie. Instant friend.' },
    { slug: 'table-squad', title: 'Table Squad', prompt: 'Everyone at your table, one shot.' },
    { slug: 'both-sides', title: 'Both Sides', prompt: 'A photo with one guest from each family side, together.' },
    { slug: 'generation-gap', title: 'Generation Gap', prompt: 'The oldest and youngest at your table.' },
  ]),
  ...block(32, 'fashion_candids', { kind: 'photo', events: WEDDING }, [
    { slug: 'runway-moment', title: 'Runway Moment', prompt: 'Best runway walk, then pose. Show the fit.', kind: 'clip' },
    { slug: 'best-dressed', title: 'Best Dressed', prompt: 'Hunt down the sharpest-dressed guest here.' },
    { slug: 'accessory-game', title: 'Accessory Game', prompt: 'The boldest accessory in the room — hat, earrings, barong detail.' },
    { slug: 'the-big-laugh', title: 'The Big Laugh', prompt: 'A real, unposed mid-laugh candid.' },
    { slug: 'photobomb', title: 'Photobomb', prompt: "Sneak into someone else's shot." },
  ]),
  ...block(37, 'big_moments', { kind: 'clip', events: WEDDING }, [
    { slug: 'bouquet-catch', title: 'Bouquet / Garter Catch', prompt: 'Catch the toss (or the scramble for it).' },
    { slug: 'confetti-moment', title: 'Confetti Moment', prompt: 'The petal, bubble, sparkler, or confetti toss.' },
    { slug: 'guestbook-signing', title: 'Guestbook Signing', prompt: 'A photo leaving your message at the signing station.', kind: 'photo' },
    { slug: 'grand-finale', title: 'Grand Finale', prompt: 'The send-off or the last dance.', rank: 5 },
  ]),
  ...block(41, 'stories', { kind: 'clip', events: WEDDING }, [
    { slug: 'story-most-memorable', title: 'Most Memorable', prompt: 'Share a story about your most memorable experience with {who}. Ten seconds.', rank: 2 },
    { slug: 'story-first-met', title: 'The First Time', prompt: 'Share a story about the first time you met {who}. Ten seconds.', rank: 9 },
    { slug: 'story-crucial-part', title: 'When It Mattered', prompt: 'Share a story of an experience where {who} played a crucial part in your life. Ten seconds.' },
    { slug: 'story-always-remember', title: 'Always Remember', prompt: 'Share a story of how you will always remember {who}. Ten seconds.' },
    { slug: 'story-brag', title: 'Brag For Them', prompt: 'Brag about {who} for ten seconds. Go.' },
    { slug: 'story-three-words', title: 'Three Words', prompt: 'Describe {who} in three words, then explain one. Ten seconds.' },
    { slug: 'story-best-at', title: 'The Best At', prompt: 'What is {who} the absolute best at? Ten seconds to say it.' },
    { slug: 'story-kindest', title: 'The Kindest Thing', prompt: 'The kindest thing {who} has ever done for you. Ten seconds.' },
    { slug: 'story-get-wrong', title: 'Set It Straight', prompt: 'What do people always get wrong about {who}? Ten seconds to set it straight.' },
    { slug: 'story-first-thought', title: 'First Impression', prompt: 'What did you think the first time you met {who}? Ten seconds. Be nice.' },
    { slug: 'story-made-you-laugh', title: 'Made You Laugh', prompt: 'The last time {who} made you laugh. Ten seconds — keep it kind.' },
    { slug: 'story-proud', title: 'Proud Of Them', prompt: 'What are you most proud of {who} for? Ten seconds.' },
  ]),
  ...block(53, 'stories_couple', { kind: 'clip', events: WEDDING }, [
    { slug: 'story-knew-it', title: 'When You Knew', prompt: 'When did you know these two were it? Ten seconds.', rank: 6 },
    { slug: 'story-together', title: 'Better Together', prompt: 'Your favourite thing about the two of them together. Ten seconds.' },
    { slug: 'story-advice', title: 'Advice For The Years', prompt: 'Ten seconds of advice for the years ahead. Serious or not.' },
    { slug: 'story-different', title: 'Different Together', prompt: 'How are they different when they are with each other? Ten seconds.' },
    { slug: 'story-ten-years', title: 'Ten Years From Now', prompt: 'Where will these two be in ten years? Ten seconds to call it.' },
    { slug: 'story-best-day', title: 'The Best Day', prompt: 'The best day you have ever spent with the two of them. Ten seconds.' },
    { slug: 'story-their-song', title: 'Their Song', prompt: 'A song that will always make you think of them — and why. Ten seconds.' },
    { slug: 'story-their-kids', title: 'One Day, Their Kids', prompt: 'What will you tell their kids about them one day? Ten seconds.' },
  ]),
];

// ═══════════════════════════════════════════════════════════════════════════
// SELFIE — "a selfie" (owner, 2026-08-21). NEW CATEGORY.
// ═══════════════════════════════════════════════════════════════════════════
// The one challenge that needs nobody else's cooperation. It is here because
// every other category can stall: the host is busy, the dance floor is empty,
// the food has not come out. A guest who arrives early and knows nobody can
// still start playing. Universal by construction — nothing here names a wedding.

const SELFIE: PoolRow[] = block('selfie', 'selfie', { kind: 'photo' }, [
  { title: 'You Made It', prompt: 'First selfie of the night. Prove you arrived.', rank: 15 },
  { title: 'At The Door', prompt: 'Selfie at the door, before you even sit down.' },
  { title: 'Best Light In The Room', prompt: 'Find the best light here and take one selfie in it.' },
  { title: 'Golden Hour', prompt: 'A selfie in the warmest light you can find.' },
  { title: 'Seat Check', prompt: 'Selfie from your seat, exactly as you found it.' },
  { title: 'Mirror Moment', prompt: 'Find a mirror. Take the mirror selfie.' },
  { title: 'Before And After', prompt: 'A selfie now, at your freshest. You will want it later.' },
  { title: 'Straight Face', prompt: 'One selfie with the most serious face you own.' },
  { title: 'Big Grin', prompt: 'Widest smile you can manage. One selfie.' },
  { title: 'Sunglasses On', prompt: 'Selfie with shades on, indoors, no explanation.' },
  { title: 'Low Angle', prompt: 'A selfie from below. Yes, that angle. Send it anyway.' },
  { title: 'Way Up High', prompt: 'Arm all the way up, selfie looking down.' },
  { title: 'With The View', prompt: 'A selfie with the best view at this place behind you.' },
  { title: 'Prettiest Light', prompt: 'Stand under the prettiest light here and take a selfie.' },
  { title: 'The Ceiling Shot', prompt: 'Selfie with the ceiling in it. Every venue has one good ceiling.' },
  { title: 'Corner Find', prompt: 'Find the nicest corner nobody is using. Selfie there.' },
  { title: 'Selfie With A Sign', prompt: 'A selfie with any sign, board or lettering at this place.' },
  { title: 'Shoes On Show', prompt: 'A selfie that gets your shoes in the frame. Somehow.' },
  { title: 'Hair Check', prompt: 'Selfie the second after you fix your hair.' },
  { title: 'Second Wind', prompt: 'A selfie the moment you get your energy back.' },
  { title: 'Full Belly', prompt: 'Selfie right after you finish eating. No filter needed.' },
  { title: 'Dance Floor Selfie', prompt: 'A selfie taken on the dance floor. Moving is fine.' },
  { title: 'Rest Stop', prompt: 'Selfie from wherever you sat down to catch your breath.' },
  { title: 'Outside Air', prompt: 'Step outside for a minute. Selfie out there.' },
  { title: 'Late Night You', prompt: 'A selfie taken later than you planned to stay.' },
  { title: 'One Word For Tonight', prompt: 'Say one word for how tonight feels. Ten seconds.', kind: 'clip' },
  { title: 'Say Hi', prompt: 'Say hi to the camera and tell us your name. Ten seconds.', kind: 'clip' },
  { title: 'Where You Came From', prompt: 'Ten seconds: say who you are and how far you travelled to be here.', kind: 'clip' },
  { title: 'Your Favourite Bit', prompt: 'Ten seconds: your favourite thing about today so far.', kind: 'clip' },
  { title: 'Caught You Smiling', prompt: 'A selfie taken the moment something made you smile.' },
  { title: 'Peace Sign', prompt: 'The most committed peace sign selfie of your life.' },
  { title: 'Thumbs Up', prompt: 'Selfie, thumbs up, no irony.' },
  { title: 'Blurry On Purpose', prompt: 'One deliberately blurry selfie. Art.' },
  { title: 'Very Close Up', prompt: 'A selfie far too close to your own face.' },
  { title: 'Very Far Away', prompt: 'A selfie where you are the smallest thing in the frame.' },
  { title: 'The Reflection', prompt: 'A selfie in a window, a spoon, a glass — anything reflective but a mirror.' },
  { title: 'Colour Match', prompt: 'Find something the same colour as your outfit. Selfie with it.' },
  { title: 'Selfie With A Drink', prompt: 'A selfie with whatever is in your glass right now.' },
  { title: 'Selfie With A Plate', prompt: 'A selfie with your plate before you touch it.' },
  { title: 'Selfie With A Flower', prompt: 'Find a flower anywhere here. Selfie with it.' },
  { title: 'Selfie With A Candle', prompt: 'A selfie lit only by a candle or a phone screen.' },
  { title: 'Best Seat', prompt: 'Selfie from the best seat in the house, whether or not it is yours.' },
  { title: 'The Quiet Spot', prompt: 'Find the quietest place here and take one selfie in it.' },
  { title: 'Ready Or Not', prompt: 'Take a selfie right now without checking it first. Send that one.' },
  { title: 'Hat Optional', prompt: 'Borrow a hat from anyone here. Selfie in it.' },
  { title: 'Squint', prompt: 'A selfie where you are laughing so hard your eyes disappear.' },
  { title: 'Deep Breath', prompt: 'Selfie taken during one slow breath. Just you, for a second.' },
  { title: 'Thank You Face', prompt: 'A selfie of your face saying thank you, without saying it.' },
  { title: 'One More', prompt: 'Last selfie before you leave. Make it count.' },
  { title: 'Tomorrow You', prompt: 'Ten seconds: tell tomorrow-you one thing about tonight.', kind: 'clip' },
]);

// ═══════════════════════════════════════════════════════════════════════════
// ANYWHERE — "an on the spot anywhere challenge" (owner, 2026-08-21). NEW.
// ═══════════════════════════════════════════════════════════════════════════
// Doable from wherever the guest is standing, right now, without walking
// anywhere or finding anybody. The category exists because a scavenger hunt
// stops being fun the moment it asks a lola in a fitted gown to cross a
// ballroom. Every row here is one turn of the head or one arm's reach.
// Universal — nothing here names a wedding.

const ANYWHERE: PoolRow[] = block('anywhere', 'anywhere', { kind: 'photo' }, [
  { title: 'Look Left', prompt: 'Point the camera at whatever is on your left. No adjusting.' },
  { title: 'Look Right', prompt: 'Whatever is on your right, right now. One shot.' },
  { title: 'Look Up', prompt: 'Point straight up and shoot whatever is there.' },
  { title: 'Look Down', prompt: 'Point at the floor under your feet. Shoot it.' },
  { title: 'Behind You', prompt: 'Turn around. Photograph whatever is behind you.' },
  { title: 'Arms Reach', prompt: 'The nearest thing you can touch without standing up.' },
  { title: 'On The Table', prompt: 'Everything on the table in front of you, one photo.' },
  { title: 'Hands', prompt: 'A photo of hands — yours or anybody near you.' },
  { title: 'Three Colours', prompt: 'One photo with three different colours in it. Go.' },
  { title: 'Something Gold', prompt: 'Find anything gold from where you are. Shoot it.' },
  { title: 'Something Red', prompt: 'Anything red, without moving your feet.' },
  { title: 'Something Round', prompt: 'The nearest round thing. One photo.' },
  { title: 'Something Shiny', prompt: 'The shiniest thing within reach.' },
  { title: 'Something Soft', prompt: 'Photograph the softest thing near you.' },
  { title: 'Something Old', prompt: 'The oldest-looking thing you can see from here.' },
  { title: 'Something Tiny', prompt: 'Get as close as your camera allows to something small.' },
  { title: 'A Pattern', prompt: 'Any repeating pattern near you — tiles, fabric, chairs.' },
  { title: 'A Shadow', prompt: 'Photograph a shadow. Any shadow.' },
  { title: 'A Straight Line', prompt: 'One photo where something makes a perfectly straight line.' },
  { title: 'Texture Hunt', prompt: 'Get close to a texture — wood, linen, stone, lace.' },
  { title: 'Empty Chair', prompt: 'An empty chair. There is always one.' },
  { title: 'The Light Source', prompt: 'Photograph whatever is lighting the room you are in.' },
  { title: 'Through Something', prompt: 'Shoot through a glass, a gap, or between two people.' },
  { title: 'Half And Half', prompt: 'One photo, half light and half dark.' },
  { title: 'Reflection Nearby', prompt: 'Anything reflective within arm’s reach. Shoot the reflection.' },
  { title: 'Out The Window', prompt: 'The nearest window, and whatever is on the other side.' },
  { title: 'The Floor Plan', prompt: 'Stand still, hold the camera high, one photo of the room.' },
  { title: 'Wide Open', prompt: 'Step back as far as you can and take the widest shot you can.' },
  { title: 'The Doorway', prompt: 'Photograph the nearest doorway, with or without people in it.' },
  { title: 'What You Are Holding', prompt: 'Photograph whatever is in your hand right now.' },
  { title: 'Pocket Check', prompt: 'Empty one pocket or bag onto the table. Photo.' },
  { title: 'Your Phone Screen', prompt: 'A photo of somebody else photographing something.' },
  { title: 'The Nearest Person', prompt: 'Ask the person nearest you if you can take their photo. Then take it.', mission: 'roster' },
  { title: 'Two Seats Down', prompt: 'A photo of whoever is sitting two seats away.', mission: 'roster' },
  { title: 'Ten Seconds Of This', prompt: 'Hold the camera still and film ten seconds of exactly what is happening.', kind: 'clip' },
  { title: 'Slow Pan', prompt: 'One slow turn all the way around, ten seconds, no stopping.', kind: 'clip' },
  { title: 'The Sound Of It', prompt: 'Ten seconds of whatever this room sounds like right now.', kind: 'clip' },
  { title: 'Say What You See', prompt: 'Film ten seconds and narrate what is in front of you.', kind: 'clip' },
  { title: 'Freeze Frame', prompt: 'Take one photo the exact second you read this. No setup.' },
  { title: 'Worst Angle', prompt: 'Deliberately the worst possible angle of something nice.' },
  { title: 'Best Angle', prompt: 'Now the best possible angle of the same kind of thing.' },
  { title: 'Upside Down', prompt: 'Turn the camera upside down and shoot anyway.' },
  { title: 'One Handed', prompt: 'Take a photo without looking at the screen.' },
  { title: 'Eye Level', prompt: 'Put the camera on the table and shoot from there.' },
  { title: 'Ground Level', prompt: 'Crouch. One photo from as low as you can get.' },
  { title: 'The Crowd', prompt: 'Photograph as many people at once as you can from where you are.' },
  { title: 'Backs Of Heads', prompt: 'One photo of the room from behind everybody.' },
  { title: 'Nobody In It', prompt: 'A photo of this place with not one person in the frame.' },
  { title: 'Everybody In It', prompt: 'The fullest frame of people you can manage without moving.' },
  { title: 'The Detail Nobody Noticed', prompt: 'Find one small thing somebody put effort into. Photograph it.' },
  { title: 'Left Behind', prompt: 'Something somebody set down and walked away from.' },
  { title: 'A Little Mess', prompt: 'The most honest, least tidy corner of your table.' },
  { title: 'Right Now', prompt: 'Ten seconds: say the time and what is happening this minute.', kind: 'clip' },
  { title: 'Stay Still', prompt: 'One photo where absolutely nothing is moving.' },
  { title: 'Catch Motion', prompt: 'One photo where something is clearly moving. Blur is the point.' },
]);

// ═══════════════════════════════════════════════════════════════════════════
// GREETING — "a special message for the couple" (owner, 2026-08-21). NEW.
// ═══════════════════════════════════════════════════════════════════════════
// Straight to camera, for whoever this day belongs to. The shipped library had
// exactly ONE of these (`pabati`, and it needs the Pabati SKU); this block is
// the free version, and it is the half of the owner's ask that a guest can do
// without knowing anybody at the party.
//
// 🔑 EVERY ROW NAMES THE TEN SECONDS. A greeting is the prompt most likely to
// run long — somebody is being sincere — and a clip is cut at 10 000 ms while
// the guest is TOLD THEY SUCCEEDED. The number is not decoration.
// 🔑 {host} IS ALWAYS AN OBJECT HERE. 'the couple' takes a plural verb and 'the
// celebrant' a singular one, so no row lets it start a clause.

const GREETING: PoolRow[] = block('greeting', 'greeting', { kind: 'clip', mission: 'video_greeting' }, [
  { title: 'A Message For Them', prompt: 'Ten seconds to camera: your message for {host}.', rank: 11 },
  { title: 'Congratulations', prompt: 'Say congratulations to {host} properly. Ten seconds.' },
  { title: 'Thank You', prompt: 'Ten seconds: thank {host} for having you here.' },
  { title: 'One Wish', prompt: 'One wish for {host}, said out loud. Ten seconds.' },
  { title: 'Them In Three Words', prompt: 'Describe {host} in three words. Ten seconds to explain one of them.' },
  { title: 'Good Advice', prompt: 'Ten seconds of genuinely good advice for {host}.' },
  { title: 'Terrible Advice', prompt: 'Ten seconds of cheerfully terrible advice. Keep it kind.' },
  { title: 'Proud Of You', prompt: 'Tell {host} what you are proud of them for. Ten seconds.' },
  { title: 'The Toast You Did Not Give', prompt: 'The toast nobody asked you to give. Ten seconds. Go.' },
  { title: 'From All Of Us', prompt: 'Grab the people at your table and send one message together. Ten seconds.', mission: 'roster' },
  { title: 'In Your Language', prompt: 'Say your message in the language you grew up speaking. Ten seconds.' },
  { title: 'Sing It', prompt: 'Sing your greeting instead of saying it. Ten seconds. Any tune.' },
  { title: 'A Blessing', prompt: 'Ten seconds: a blessing for {host}, however you say one.' },
  { title: 'See You Soon', prompt: 'Ten seconds: tell {host} when you want to see them next.' },
  { title: 'What I Admire', prompt: 'One thing you genuinely admire about {host}. Ten seconds.' },
  { title: 'What You Are Best At', prompt: 'Tell {host} what they are the best at. Ten seconds.' },
  { title: 'A Promise', prompt: 'Promise {host} one small thing. Ten seconds. Mean it.' },
  { title: 'The Short Version', prompt: 'Everything you want to say to {host}, in ten seconds flat.' },
  { title: 'Say It Slowly', prompt: 'One sentence for {host}, said as slowly as ten seconds allows.' },
  { title: 'Open This In Ten Years', prompt: 'A message for {host} to open in ten years. Ten seconds.' },
  { title: 'From Far Away', prompt: 'Say where you travelled from and why you came. Ten seconds.' },
  { title: 'On Behalf Of', prompt: 'Send a message for somebody who could not make it. Ten seconds.' },
  { title: 'For The Family', prompt: 'Ten seconds: a message for {hosts} family, not just for them.' },
  { title: 'The Best Part Of Today', prompt: 'Tell {host} the best part of today from where you stood. Ten seconds.' },
  { title: 'Thank The Cooks', prompt: 'Ten seconds of thanks to whoever fed everyone tonight.' },
  { title: 'Thank The Crew', prompt: 'Ten seconds of thanks to the people working this {event}.' },
  { title: 'Loud Version', prompt: 'Say congratulations as loudly as you dare. Ten seconds.' },
  { title: 'Quiet Version', prompt: 'Now say something to {host} in a whisper. Ten seconds.' },
  { title: 'A Joke For Them', prompt: 'Tell {host} one clean joke. Ten seconds.' },
  { title: 'The Nickname', prompt: 'Ten seconds: the name you actually call {host}, and where it came from.' },
  { title: 'One Piece Of Truth', prompt: 'One true, kind thing about {host} they might not know you think. Ten seconds.' },
  { title: 'Do This More', prompt: 'Ten seconds: one thing you want {host} to do more of.' },
  { title: 'Rest Now', prompt: 'Tell {host} to rest after all this. Ten seconds. They will need it.' },
  { title: 'What I Will Remember', prompt: 'Ten seconds: the part of today you will still remember next year.' },
  { title: 'To The Camera, Properly', prompt: 'Look straight down the lens and say it like they are in front of you. Ten seconds.' },
  { title: 'Cheers', prompt: 'Raise whatever is in your hand and say cheers to {host}. Ten seconds.', mission: 'toast_or_dance' },
  { title: 'A Poem, Badly', prompt: 'Ten seconds. Two lines. It does not have to rhyme.' },
  { title: 'In One Breath', prompt: 'Your whole message in one breath. Ten seconds maximum.' },
  { title: 'Say Their Name', prompt: 'Ten seconds: say {hosts} name and one thing you love about them.' },
  { title: 'Welcome To This', prompt: 'Ten seconds: welcome {host} to whatever comes next.' },
  { title: 'Take A Bow', prompt: 'Tell {host} they did a good job today. Ten seconds.' },
  { title: 'From The Kids Table', prompt: 'Get the youngest person near you to say hello. Ten seconds.', mission: 'roster' },
  { title: 'From The Elders', prompt: 'Ask the eldest person near you for ten seconds of advice.', mission: 'roster' },
  { title: 'Two Of You', prompt: 'Grab one other guest and send a message together. Ten seconds.', mission: 'roster' },
  { title: 'The Reason You Came', prompt: 'Ten seconds: why you said yes to this invitation.' },
  { title: 'What This Day Means', prompt: 'Ten seconds: what this {event} means to you.' },
  { title: 'A Message In Writing', prompt: 'Write a note on anything to hand, hold it up, and photograph it.', kind: 'photo', mission: 'prompt' },
  { title: 'Sign Here', prompt: 'Photograph your message on the guestbook, a napkin, or your own hand.', kind: 'photo', mission: 'prompt' },
  { title: 'Hold Up A Heart', prompt: 'Make a heart with your hands and hold it to the camera.', kind: 'photo', mission: 'prompt' },
  { title: 'Last Word', prompt: 'Ten seconds: the last thing you want to say before you go home.' },
]);

// ═══════════════════════════════════════════════════════════════════════════
// STORIES — "a confession box where we want them to share their stories"
// ═══════════════════════════════════════════════════════════════════════════
// The category already ships (12 rows, ids 41–52). This grows it, and splits it
// in two, because the shipped ones cannot leave a wedding:
//
//   400–449  {who} — side-aware. Each guest is asked about THE HALF THEY KNOW.
//            WEDDING ONLY: {who} is resolved from `guests.side`, whose values
//            are bride · groom · both. At a birthday it would fall through to
//            "the couple" and name two people who do not exist.
//   450–499  {host} — the same confession box at ANY celebration.
//
// 🔒 THE WORDING LOCK IS AT ITS TIGHTEST HERE. A story told into a camera at a
// party gets played back to a room. Every row points at something GOOD, and any
// row that could tip carries its steer where the guest reads it. Nothing here
// asks for a secret, a ranking, a comparison, an ex, money, or a family
// argument — see the header, and `papic-challenge-pool.test.ts`, which refuses
// the banned words rather than trusting this comment.

const STORIES_SIDE: PoolRow[] = block(400, 'stories', { kind: 'clip', events: WEDDING }, [
  { title: 'How You Two Met', prompt: 'Ten seconds: how you and {who} first ended up in the same room.' },
  { title: 'The Day You Clicked', prompt: 'The day you knew {who} was going to be a real friend. Ten seconds.' },
  { title: 'Something They Taught You', prompt: 'One thing {who} taught you without meaning to. Ten seconds.' },
  { title: 'The Favour', prompt: 'A time {who} helped you out and never mentioned it again. Ten seconds.' },
  { title: 'Best Trip Together', prompt: 'The best trip or day out you ever had with {who}. Ten seconds.' },
  { title: 'Their Signature Move', prompt: 'The thing {who} always does that everybody recognises. Ten seconds.' },
  { title: 'What They Say Too Much', prompt: 'The phrase {who} says constantly. Say it the way they say it. Ten seconds.' },
  { title: 'Caught Being Kind', prompt: 'A time you caught {who} being kind when nobody was watching. Ten seconds.' },
  { title: 'The Talent Nobody Knows', prompt: 'Something {who} is quietly very good at. Ten seconds.' },
  { title: 'Your Favourite Photo Of Them', prompt: 'Describe your favourite photo of {who} and why. Ten seconds.' },
  { title: 'How They Are In A Crisis', prompt: 'What {who} is like when things go wrong. Ten seconds.' },
  { title: 'The Text You Kept', prompt: 'A message from {who} you never deleted. Ten seconds — what it said.' },
  { title: 'They Showed Up', prompt: 'A time {who} showed up for you. Ten seconds.' },
  { title: 'Your Longest Laugh', prompt: 'The longest you have ever laughed with {who}. Ten seconds. Keep it kind.' },
  { title: 'The Food They Make', prompt: 'What {who} cooks, orders, or brings every single time. Ten seconds.' },
  { title: 'Before Today', prompt: 'What {who} was like when you first knew them. Ten seconds. Be nice.' },
  { title: 'How They Changed', prompt: 'The best way {who} has changed since you met. Ten seconds.' },
  { title: 'What They Are Not Given Credit For', prompt: 'Something {who} does that goes unnoticed. Ten seconds.' },
  { title: 'Their Best Idea', prompt: 'The best idea {who} ever had. Ten seconds.' },
  { title: 'The Thing They Are Loyal To', prompt: 'What {who} will defend to the death — team, snack, opinion. Ten seconds.' },
  { title: 'Ask Them Anything', prompt: 'One question you have always wanted to ask {who}. Ten seconds. Keep it kind.' },
  { title: 'Your Nickname For Them', prompt: 'What you actually call {who}, and where it started. Ten seconds.' },
  { title: 'The First Impression, Corrected', prompt: 'What you got wrong about {who} at first. Ten seconds.' },
  { title: 'Where You Would Be Without Them', prompt: 'Ten seconds: where you would be if you had never met {who}.' },
  { title: 'The Song', prompt: 'A song that will always be {who} to you. Ten seconds — say why.' },
  { title: 'Their Comfort Zone', prompt: 'Where {who} is happiest. Ten seconds.' },
  { title: 'A Small Thing They Do', prompt: 'One tiny habit of {who} that you would miss. Ten seconds.' },
  { title: 'The Advice They Gave You', prompt: 'The best advice {who} ever gave you. Ten seconds.' },
  { title: 'What Their Family Should Know', prompt: 'Something good about {who} their family may not have seen. Ten seconds.' },
  { title: 'What Their Friends Should Know', prompt: 'Something good about {who} their friends may not have seen. Ten seconds.' },
  { title: 'The Bravest Thing', prompt: 'The bravest thing you have seen {who} do. Ten seconds.' },
  { title: 'The Time They Were Right', prompt: 'A time {who} was right and you were not. Ten seconds.' },
  { title: 'Ten Years Of Them', prompt: 'Ten seconds: {who}, summed up by somebody who has known them a while.' },
  { title: 'The Room They Walk Into', prompt: 'What happens to a room when {who} walks in. Ten seconds.' },
  { title: 'Their Best Day', prompt: 'The happiest you have ever seen {who}. Ten seconds.' },
  { title: 'What You Borrowed', prompt: 'Something of {who}’s you still have. Ten seconds. Give it back.' },
  { title: 'The Standing Joke', prompt: 'The joke only you and {who} understand. Ten seconds to explain it.' },
  { title: 'One Word For Them', prompt: 'One word for {who}. Ten seconds to say why that word.' },
  { title: 'What You Hope For Them', prompt: 'Ten seconds: what you hope happens for {who} next.' },
  { title: 'Say It To Their Face', prompt: 'Something nice you have never said out loud to {who}. Ten seconds.' },
]);

const STORIES_ANY: PoolRow[] = block(450, 'stories', { kind: 'clip' }, [
  { title: 'How You Know Them', prompt: 'Ten seconds: how you know {host}, and how long it has been.', rank: 12 },
  { title: 'First Memory', prompt: 'Your first memory of {host}. Ten seconds.' },
  { title: 'Best Memory', prompt: 'Your best memory with {host}. Ten seconds.', rank: 20 },
  { title: 'The Story You Always Tell', prompt: 'The story about {host} you tell other people. Ten seconds. Keep it kind.' },
  { title: 'What They Are Great At', prompt: 'Ten seconds: name one thing nobody does better than {host}.' },
  { title: 'What People Get Wrong', prompt: 'What people get wrong about {host}. Ten seconds to set it straight.' },
  { title: 'The Kindest Thing They Did', prompt: 'The kindest thing {host} ever did for you. Ten seconds.' },
  { title: 'Why You Came', prompt: 'Ten seconds: why you would not have missed this {event}.' },
  { title: 'A Time They Helped', prompt: 'A time {host} helped you out. Ten seconds.' },
  { title: 'Something You Learned From Them', prompt: 'One thing you learned from {host}. Ten seconds.' },
  { title: 'The Thing They Always Say', prompt: 'The phrase {host} says constantly. Say it their way. Ten seconds.' },
  { title: 'Caught Being Good', prompt: 'A time you caught {host} being kind with nobody watching. Ten seconds.' },
  { title: 'What Makes Them Laugh', prompt: 'Ten seconds: what reliably makes {host} laugh.' },
  { title: 'Their Talent', prompt: 'Name a talent of {hosts} that most people here do not know about. Ten seconds.' },
  { title: 'How They Are Under Pressure', prompt: 'Describe {host} on a day when everything goes sideways. Ten seconds.' },
  { title: 'Three Words For Them', prompt: 'Three words for {host}. Ten seconds to explain one.' },
  { title: 'The Best Day You Shared', prompt: 'The best day you ever spent with {host}. Ten seconds.' },
  { title: 'What You Admire', prompt: 'Ten seconds: what you admire most about {host}.' },
  { title: 'They Showed Up For You', prompt: 'A time {host} showed up when it mattered. Ten seconds.' },
  { title: 'The Best Idea They Had', prompt: 'The best idea {host} ever had. Ten seconds.' },
  { title: 'The Advice They Gave', prompt: 'The best advice {host} ever gave you. Ten seconds.' },
  { title: 'What You Are Proud Of', prompt: 'What you are most proud of {host} for. Ten seconds.' },
  { title: 'How They Have Changed', prompt: 'The best change you have seen in {host} since you met. Ten seconds.' },
  { title: 'What You Would Miss', prompt: 'One small thing about {host} you would miss. Ten seconds.' },
  { title: 'The Nickname Origin', prompt: 'What you call {host} and where it came from. Ten seconds.' },
  { title: 'The Song For Them', prompt: 'A song that is {host} to you. Ten seconds — say why.' },
  { title: 'What This Day Means To You', prompt: 'Ten seconds: what this {event} means to you, in your own words.' },
  { title: 'When They Arrive', prompt: 'What happens to a room when {host} arrives. Ten seconds.' },
  { title: 'A Question For Them', prompt: 'One thing you have always wanted to ask {host}. Ten seconds. Keep it kind.' },
  { title: 'Where You Met', prompt: 'Ten seconds: the exact place you first met {host}. Describe it.' },
  { title: 'The Favour Never Repaid', prompt: 'Something {host} did for you that you never paid back. Ten seconds.' },
  { title: 'Your Prediction', prompt: 'Ten seconds: guess where {host} will be a year from now.' },
  { title: 'What You Hope Comes Next', prompt: 'Ten seconds: what you hope happens for {host} next.' },
  { title: 'Something You Never Said', prompt: 'Something kind you never said out loud to {host}. Ten seconds.' },
  { title: 'The Table You Are On', prompt: 'Ten seconds: introduce the people at your table to {host}.', mission: 'roster' },
  { title: 'How Everybody Here Connects', prompt: 'Ten seconds: explain how everybody in this room knows {host}.' },
  { title: 'A Tradition You Keep', prompt: 'Ten seconds: a tradition you and {host} keep going.' },
  { title: 'The Food Memory', prompt: 'A meal you will always associate with {host}. Ten seconds.' },
  { title: 'The Place', prompt: 'A place that reminds you of {host}. Ten seconds.' },
  { title: 'What You Would Tell A Stranger', prompt: 'Ten seconds: describe {host} to somebody who has never met them.' },
  { title: 'Their Bravest Moment', prompt: 'The bravest thing you have ever watched {host} pull off. Ten seconds.' },
  { title: 'Time They Were Right', prompt: 'A time you should have listened to {host}. Ten seconds.' },
  { title: 'Sum Them Up In One Word', prompt: 'One word for {host}. Ten seconds on why that word.' },
  { title: 'The Long Version, Short', prompt: 'Everything you would say about {host}, in ten seconds.' },
  { title: 'Say It To Camera', prompt: 'Look at the lens and tell {host} one true, kind thing. Ten seconds.' },
]);

// ═══════════════════════════════════════════════════════════════════════════
// STORIES_COUPLE — the confession box, about the two of them. WEDDING ONLY.
// ═══════════════════════════════════════════════════════════════════════════
// No token at all, by design. "As a couple" can ONLY come from the untokenised
// set: a both-sides guest resolving {who} to "the couple" is an accident of
// which side they were listed on, not a decision.
//
// 🔒 NOT ONE ROW HERE COMPARES THEM. "Who is funnier", "who is the tidy one",
// "who wears the trousers" — all excluded on purpose. A guest answers those
// honestly into a camera and one half of a marriage watches it back in front of
// both families. The lock says never rank anyone; a couple is two anyones.

const STORIES_COUPLE: PoolRow[] = block('stories_couple', 'stories_couple', { kind: 'clip', events: WEDDING }, [
  { title: 'The First Time You Saw Them Together', prompt: 'Ten seconds: the first time you saw these two in the same room.' },
  { title: 'How They Talk About Each Other', prompt: 'How each of them talks about the other when they are not around. Ten seconds.' },
  { title: 'The Story They Tell Wrong', prompt: 'A story they both tell differently. Ten seconds — tell your version.' },
  { title: 'Their Best Day Out', prompt: 'The best day you have spent with the two of them. Ten seconds.' },
  { title: 'What They Are Like At Home', prompt: 'Ten seconds: what these two are like on an ordinary evening.' },
  { title: 'The Double Act', prompt: 'The thing they do together that only they do. Ten seconds.' },
  { title: 'How They Argue Well', prompt: 'Ten seconds: how these two work things out. Keep it kind.' },
  { title: 'What They Built', prompt: 'Something these two made or built together. Ten seconds.' },
  { title: 'Their Home', prompt: 'Ten seconds: describe their place to somebody who has never been.' },
  { title: 'The Meal At Theirs', prompt: 'What they feed you when you visit. Ten seconds.' },
  { title: 'When You Stopped Saying Their Names Separately', prompt: 'Ten seconds: when they became one word to you.' },
  { title: 'What They Are Better At Together', prompt: 'Something they are better at as a pair. Ten seconds.' },
  { title: 'Their Travel Style', prompt: 'Ten seconds: what these two are like on a trip.' },
  { title: 'The Group Chat', prompt: 'How these two behave in a group chat. Ten seconds. Be nice.' },
  { title: 'Their Hosting', prompt: 'Ten seconds: what they are like when they host people.' },
  { title: 'The Plan They Keep Making', prompt: 'A plan these two keep talking about. Ten seconds.' },
  { title: 'Their Running Joke', prompt: 'The joke that never dies between them. Ten seconds.' },
  { title: 'What You Learned From Watching Them', prompt: 'Ten seconds: what these two taught you about being with somebody.' },
  { title: 'The Moment You Knew It Was Serious', prompt: 'Ten seconds: the moment it stopped being casual.' },
  { title: 'Their First Trip', prompt: 'Ten seconds: a trip these two took that you heard all about.' },
  { title: 'Their Sunday', prompt: 'Ten seconds: describe a perfect Sunday for these two.' },
  { title: 'What Their Friends Say', prompt: 'Ten seconds: what everybody says about these two behind their backs. Good things only.' },
  { title: 'The Pet, The Plant, The Project', prompt: 'Something these two look after together. Ten seconds.' },
  { title: 'How They Say Goodbye', prompt: 'Ten seconds: what these two are like saying goodbye at the door.' },
  { title: 'The Thing They Always Do', prompt: 'A ritual these two never skip. Ten seconds.' },
  { title: 'A Toast To Them', prompt: 'Ten seconds. Raise something. Toast them properly.', mission: 'toast_or_dance' },
  { title: 'The First Year', prompt: 'Ten seconds of advice for the first year. Serious or not.' },
  { title: 'Twenty Years From Now', prompt: 'Ten seconds: what these two are like at seventy.' },
  { title: 'What Will Not Change', prompt: 'Ten seconds: the thing about them that will never change.' },
  { title: 'Their House Rule', prompt: 'One rule you would give this household. Ten seconds.' },
  { title: 'Say It To Both Of Them', prompt: 'Look at the lens and say one thing to the two of them. Ten seconds.' },
  { title: 'The Photo On The Wall', prompt: 'Ten seconds: describe the photo of them that should go on the wall.' },
  { title: 'What Today Is Really About', prompt: 'Ten seconds: what today is actually about, in your words.' },
  { title: 'Welcome To The Family', prompt: 'Ten seconds: welcome one of them into your family, whichever side you are on.' },
  { title: 'All Of It, In Ten Seconds', prompt: 'Everything you would say about these two, in ten seconds.' },
]);

// ═══════════════════════════════════════════════════════════════════════════
// COUPLE_FAMILY — "a challenge that includes the host" (owner, 2026-08-21)
// ═══════════════════════════════════════════════════════════════════════════
// Get the person this day belongs to into the frame. The shipped seven all name
// a wedding; these are the same idea written on {host}, so they work at a
// birthday, a graduation, a debut or a Tuesday.
//
// 🪤 THE HOST IS THE BUSIEST PERSON IN THE BUILDING. Half of these deliberately
// do NOT need their cooperation — photographing them from across the room, or
// catching them mid-something — because a board full of "go interrupt the
// celebrant" produces one queue and no photos.

const COUPLE_FAMILY: PoolRow[] = block('couple_family', 'couple_family', { kind: 'photo' }, [
  { title: 'One With The Host', prompt: 'Get a photo with {host}. However long you have to wait.', rank: 13 },
  { title: 'Across The Room', prompt: 'Photograph {host} from wherever you are. No interrupting.' },
  { title: 'Caught Laughing', prompt: 'Catch {host} mid-laugh.' },
  { title: 'The Arrival', prompt: 'Photograph the moment {host} walks in.' },
  { title: 'Mid-Sentence', prompt: 'Catch {host} in the middle of telling somebody something.' },
  { title: 'The Hug', prompt: 'Photograph {host} hugging somebody.' },
  { title: 'Working The Room', prompt: 'Ten seconds of {host} going table to table.', kind: 'clip' },
  { title: 'Quiet Second', prompt: 'Catch {host} in a rare quiet moment. Do not disturb them.' },
  { title: 'Group Shot With The Host', prompt: 'Get {host} and everybody at your table in one frame.', mission: 'roster' },
  { title: 'Same Pose', prompt: 'Copy the pose {host} just struck. Get both of you in one shot.' },
  { title: 'Hands Full', prompt: 'Photograph {host} holding too many things at once.' },
  { title: 'The Look', prompt: 'Catch the exact face {host} makes when something goes right.' },
  { title: 'Behind The Scenes', prompt: 'Photograph {host} doing something unglamorous. Kindly.' },
  { title: 'With Their Parents', prompt: 'A photo of {host} with a parent.' },
  { title: 'With The Elders', prompt: 'Photograph {host} with the oldest person here.' },
  { title: 'With The Kids', prompt: 'Photograph {host} with the youngest guests.' },
  { title: 'The Siblings', prompt: 'A photo of {host} with a brother or sister.' },
  { title: 'The Oldest Friend', prompt: 'Find whoever has known {host} longest. Photo of the two of them.', mission: 'roster' },
  { title: 'The Whole Family', prompt: 'Get as much of {hosts} family in one frame as you can.', mission: 'roster' },
  { title: 'Three Generations', prompt: 'Three generations of one family in a single photo.', mission: 'roster' },
  { title: 'Say Something To Them', prompt: 'Ask {host} for ten seconds to camera. Anything they want to say.', kind: 'clip', mission: 'video_greeting' },
  { title: 'Ask Them One Question', prompt: 'Ask {host} one question and film the answer. Ten seconds.', kind: 'clip' },
  { title: 'Make Them Laugh', prompt: 'Say something to {host} and film the reaction. Ten seconds.', kind: 'clip' },
  { title: 'Their Best Angle', prompt: 'Photograph {host} the way you think they look best.' },
  { title: 'The Outfit', prompt: 'A full-length photo of {hosts} outfit today.' },
  { title: 'The Details', prompt: 'Close up on one detail of {hosts} outfit — shoes, ring, buttons, hair.' },
  { title: 'The Table Visit', prompt: 'Photograph {host} the moment they reach your table.' },
  { title: 'Toast Them', prompt: 'Get {host} and your raised glass in the same photo.', mission: 'toast_or_dance' },
  { title: 'Dance With Them', prompt: 'Ten seconds of you dancing near {host}. Near counts.', kind: 'clip', mission: 'toast_or_dance' },
  { title: 'Between The Two Of You', prompt: 'A photo of just you and {host}, nobody else in frame.' },
  { title: 'Serious Version', prompt: 'One photo of you and {host} looking extremely serious.' },
  { title: 'Silly Version', prompt: 'Now the silly one. Same two people.' },
  { title: 'Whisper', prompt: 'Photograph somebody whispering to {host}.' },
  { title: 'Getting Fed', prompt: 'Catch {host} actually eating something. Rare footage.' },
  { title: 'Sitting Down At Last', prompt: 'Photograph {host} the first time they sit down all day.' },
  { title: 'Shoes Off', prompt: 'Catch the moment somebody gives up on their shoes.' },
  { title: 'The Thank You', prompt: 'Photograph {host} thanking somebody.' },
  { title: 'The Speech', prompt: 'Ten seconds of somebody speaking about {host}.', kind: 'clip' },
  { title: 'The Reaction To The Speech', prompt: 'Photograph {hosts} face while somebody talks about them.' },
  { title: 'Their Favourite Person Here', prompt: 'Ask {host} to point at somebody they love. Photograph both.', mission: 'roster' },
  { title: 'Handed Something', prompt: 'Photograph {host} being given a gift, a plate, or a drink.' },
  { title: 'The Wave', prompt: 'Get {host} to wave at the camera. One photo.' },
  { title: 'The Crowd Around Them', prompt: 'Photograph the people gathered around {host}, not {host}.' },
  { title: 'From Behind', prompt: 'Photograph {host} from behind, looking out at the room.' },
  { title: 'The Godparents', prompt: 'A photo with a ninong or ninang here today.', mission: 'roster', events: WEDDING },
  { title: 'The Entourage', prompt: 'Grab a shot with anyone in the entourage.', mission: 'roster', events: WEDDING },
  { title: 'Sponsors Row', prompt: 'Photograph the principal sponsors together.', mission: 'roster', events: WEDDING },
  { title: 'Both Families', prompt: 'One photo with somebody from each family.', mission: 'roster', events: WEDDING },
  { title: 'The Last One Of The Night', prompt: 'Your last photo with {host} before you go home.' },
  { title: 'Goodbye At The Door', prompt: 'Photograph {host} seeing somebody out.' },
]);

// ═══════════════════════════════════════════════════════════════════════════
// MEET_ROOM — "a challenge that includes other people" (owner, 2026-08-21)
// ═══════════════════════════════════════════════════════════════════════════
// The mingling engine. These are the rows that make a party out of a room of
// strangers, and they are the reason a photo challenge is worth having at all:
// nobody meets the other side of the family because the seating chart said so.
//
// Most carry `mission: 'roster'` — the same type the four shipped rows use.
// ⚠ `roster` is about WHO IS IN THE SHOT, not about targeting: a roster mission
// with no `target_guest_id` still shows to every guest. Nothing here is scoped
// to one person.

const MEET_ROOM: PoolRow[] = block('meet_room', 'meet_room', { kind: 'photo', mission: 'roster' }, [
  { title: 'Someone New', prompt: 'Introduce yourself to somebody you have never met. Photo together.', rank: 14 },
  { title: 'Furthest Travelled', prompt: 'Find the guest who came the furthest. Photo with them.' },
  { title: 'Same First Name', prompt: 'Find somebody with your first name. Proof required.' },
  { title: 'Same Birthday Month', prompt: 'Find a guest born in your birth month. One photo.' },
  { title: 'Matching Outfits', prompt: 'Find somebody wearing your colour. Stand together. Photo.' },
  { title: 'Tallest And Shortest', prompt: 'Get the tallest and shortest people near you in one frame.' },
  { title: 'The Newest Guest', prompt: 'Find whoever arrived last. Welcome them, then photograph them.' },
  { title: 'The Early Bird', prompt: 'Find whoever got here first. Photo with them.' },
  { title: 'Four Hands', prompt: 'Four hands, one photo. Any four.' },
  { title: 'A Handshake', prompt: 'Photograph a handshake between two people meeting.' },
  { title: 'Table Swap', prompt: 'Sit at a table that is not yours for one photo. Ask first.' },
  { title: 'Five People, One Frame', prompt: 'Five people you did not arrive with, in one photo.' },
  { title: 'Ten People, One Frame', prompt: 'Ten people. One photo. Good luck.' },
  { title: 'The Whole Row', prompt: 'Everybody in your row or on your side of the table.' },
  { title: 'Two Strangers Talking', prompt: 'Photograph two people who have clearly just met.' },
  { title: 'The Loudest Table', prompt: 'Find the loudest table here. Photo of them.' },
  { title: 'The Quiet Corner', prompt: 'Photograph the people who found the quiet spot.' },
  { title: 'Kids Table', prompt: 'One photo with the youngest guests here. Ask a parent first.' },
  { title: 'The Titos', prompt: 'A photo with the tito or tita holding court.' },
  { title: 'The Lolo And Lola', prompt: 'A photo with a grandparent here today. Ask first.' },
  { title: 'Same Shoes', prompt: 'Find somebody with similar shoes. Photograph both pairs.' },
  { title: 'Glasses Club', prompt: 'Get everybody near you wearing glasses into one photo.' },
  { title: 'The Barong Line-Up', prompt: 'Line up everybody in a barong or a filipiniana. One photo.' },
  { title: 'Somebody From Work', prompt: 'Find a guest who knows the host from work. Photo.' },
  { title: 'Somebody From School', prompt: 'Find a guest who knew {host} at school. Photo together.' },
  { title: 'The Longest Friendship', prompt: 'Find the two guests who have known each other longest. Photograph them.' },
  { title: 'Ask Their Story', prompt: 'Ask a stranger how they know {host}. Film the answer. Ten seconds.', kind: 'clip' },
  { title: 'Two Truths', prompt: 'Get a stranger to say one true thing about themselves. Ten seconds.', kind: 'clip' },
  { title: 'Introduce Somebody', prompt: 'Ten seconds: introduce the person next to you to the camera.', kind: 'clip' },
  { title: 'Interview A Guest', prompt: 'Ask any guest what they think of tonight. Ten seconds.', kind: 'clip' },
  { title: 'The Chain', prompt: 'Photograph three people holding hands or linking arms.' },
  { title: 'Group Jump', prompt: 'Get a group of people to jump. Ten seconds.', kind: 'clip' },
  { title: 'Everybody Wave', prompt: 'Get a whole table to wave at once. One photo.' },
  { title: 'Everybody Cheers', prompt: 'A whole table raising their glasses, one photo.', mission: 'toast_or_dance' },
  { title: 'Same Drink', prompt: 'Find somebody drinking the same thing as you. Photo of both glasses.' },
  { title: 'Split The Dessert', prompt: 'Share a dessert with somebody new. Photograph the evidence.' },
  { title: 'Swap Seats', prompt: 'Swap seats with somebody for one photo, then swap back.' },
  { title: 'The Recruiter', prompt: 'Get one reluctant person onto the dance floor. Ten seconds.', kind: 'clip' },
  { title: 'The Photographer, Photographed', prompt: 'Photograph another guest taking a photo.' },
  { title: 'Whoever Is Nearest', prompt: 'Photo with whoever is standing closest to you right now.' },
  { title: 'The Person You Owe A Message', prompt: 'Find somebody you have been meaning to catch up with. Photo.' },
  { title: 'Two Sides Of The Room', prompt: 'Get one person from each end of the room into one photo.' },
  { title: 'The Circle', prompt: 'Get a group to stand in a circle. Shoot from the middle.' },
  { title: 'Everybody Looking Away', prompt: 'One group photo where nobody is looking at the camera.' },
  { title: 'Everybody Looking', prompt: 'Now the same group, all looking. Harder than it sounds.' },
  { title: 'Piggyback', prompt: 'Somebody on somebody’s back. Consent first, obviously.' },
  { title: 'The Queue', prompt: 'Photograph whatever people are queueing for.' },
  { title: 'The Smokers Corner', prompt: 'Photograph whoever stepped outside together.' },
  { title: 'Find The Organiser', prompt: 'Find whoever is actually running today. Thank them. Photo.' },
  { title: 'The Vendor Crew', prompt: 'Photograph one of the crew working today. Ask first.' },
  { title: 'Last Ones Standing', prompt: 'A photo of whoever is still here at the end.' },
]);

// ═══════════════════════════════════════════════════════════════════════════
// FASHION_CANDIDS — "a flex of what they wore. or brought" (owner 2026-08-21)
// ═══════════════════════════════════════════════════════════════════════════
// The category shipped as five candid rows. The owner's word was FLEX, and that
// is a different instruction: it points the camera at the guest's own effort —
// the outfit they agonised over, the shoes, the gift they wrapped — rather than
// at somebody else being caught unawares. Both halves live here.
//
// 🔒 NOT ONE ROW ASKS ANYBODY TO JUDGE ANYBODY. "Worst dressed", "who wore it
// better", "rate the outfits" are all excluded: the lock says never rank
// anyone, and clothes at a Filipino party are frequently borrowed, rented, or
// made by somebody's tita.

const FASHION: PoolRow[] = block('fashion_candids', 'fashion_candids', { kind: 'photo' }, [
  { title: 'The Fit', prompt: 'Full length. Show what you wore today.', rank: 16 },
  { title: 'Shoe Game', prompt: 'Photograph your shoes. Then somebody else’s.' },
  { title: 'The Detail You Chose', prompt: 'One close-up of the part of your outfit you are proudest of.' },
  { title: 'Earrings, Watch, Ring', prompt: 'Photograph whatever you put on last before you left the house.' },
  { title: 'Borrowed', prompt: 'Photograph the thing you are wearing that is not yours.' },
  { title: 'Handed Down', prompt: 'Wearing something that belonged to somebody in your family? Show it.' },
  { title: 'The Bag', prompt: 'Photograph the bag you brought and what is actually in it.' },
  { title: 'What You Brought', prompt: 'Photograph the gift, the dish, or the bottle you turned up with.' },
  { title: 'Wrapped It Yourself', prompt: 'If you wrapped it, prove it. One photo.' },
  { title: 'The Emergency Kit', prompt: 'Photograph the thing in your bag that saved somebody tonight.' },
  { title: 'Made By Somebody', prompt: 'Photograph something you are wearing that a person made.' },
  { title: 'The Colour Story', prompt: 'Line up three guests in the same colour. One photo.', mission: 'roster' },
  { title: 'Coordinated', prompt: 'Find somebody you accidentally match with. Photo of both.', mission: 'roster' },
  { title: 'Barong Detail', prompt: 'Close up on the embroidery of a barong or a terno.' },
  { title: 'The Filipiniana', prompt: 'Photograph the best butterfly sleeves in the room.' },
  { title: 'Sneakers Under The Gown', prompt: 'Catch whoever swapped into comfortable shoes.' },
  { title: 'The Second Outfit', prompt: 'Photograph anybody who changed clothes tonight.' },
  { title: 'Hair Of The Night', prompt: 'The most impressive hair here. Ask before you shoot.' },
  { title: 'The Nails', prompt: 'Photograph somebody’s nails. They did those for today.' },
  { title: 'Best Accessory', prompt: 'The boldest single accessory you can find.' },
  { title: 'Glasses On', prompt: 'Photograph the best pair of frames in the room.' },
  { title: 'The Hat', prompt: 'Find a hat. Photograph the hat. Wear the hat.' },
  { title: 'The Suit', prompt: 'Photograph the sharpest jacket here.' },
  { title: 'Pockets Out', prompt: 'Photograph everything in your pockets, laid out.' },
  { title: 'Before The Night Wrecks It', prompt: 'Photograph your outfit now, while it is still perfect.' },
  { title: 'After The Night Wrecked It', prompt: 'Photograph the same outfit later. Honest version.' },
  { title: 'The Fit Check', prompt: 'Ten seconds: turn slowly and narrate what you are wearing.', kind: 'clip' },
  { title: 'Where You Got It', prompt: 'Ten seconds: what you are wearing and where it came from.', kind: 'clip' },
  { title: 'The Getting Ready Story', prompt: 'Ten seconds: how long it took you to get ready. Be honest.', kind: 'clip' },
  { title: 'Runway, Two People', prompt: 'Walk it with somebody else. Ten seconds.', kind: 'clip', mission: 'roster' },
  { title: 'The Spin', prompt: 'One full spin, ten seconds, whatever you are wearing.', kind: 'clip' },
  { title: 'Show The Gift', prompt: 'Ten seconds: what you brought and why you chose it.', kind: 'clip' },
  { title: 'The Real Laugh', prompt: 'An unposed photo of somebody mid-laugh.' },
  { title: 'The Real Cry', prompt: 'A happy-tears photo. Only if they would want it kept.' },
  { title: 'Caught Off Guard', prompt: 'One candid of somebody who did not know you were shooting. Be kind.' },
  { title: 'The Yawn', prompt: 'Catch the first yawn of the night.' },
  { title: 'Deep In Conversation', prompt: 'Photograph two people completely absorbed in talking.' },
  { title: 'The Fixer', prompt: 'Catch somebody adjusting somebody else’s collar, veil or hair.' },
  { title: 'Someone Being Handed A Baby', prompt: 'The universal photo. Take it.' },
  { title: 'The Shoe Rescue', prompt: 'Photograph somebody dealing with a shoe emergency.' },
  { title: 'Fan Yourself', prompt: 'Photograph whoever is coping worst with the heat.' },
  { title: 'The Group Fix', prompt: 'Catch a group all checking the same photo on one phone.' },
  { title: 'Napping', prompt: 'A gentle photo of whoever has given up and gone to sleep.' },
  { title: 'Best Reaction', prompt: 'Catch the biggest reaction of the night on somebody’s face.' },
  { title: 'The Whisper', prompt: 'Photograph two people sharing something private. From a distance.' },
]);

// ═══════════════════════════════════════════════════════════════════════════
// FOOD_DRINKS — the table. Universal: everybody feeds people.
// ═══════════════════════════════════════════════════════════════════════════
const FOOD: PoolRow[] = block('food_drinks', 'food_drinks', { kind: 'photo' }, [
  { title: 'First Plate', prompt: 'Photograph your first plate before you touch it.', rank: 17 },
  { title: 'Second Plate', prompt: 'Now photograph the second one. No judgement.' },
  { title: 'The Best Thing On The Table', prompt: 'The single best thing served tonight. One photo.' },
  { title: 'The Rice', prompt: 'There is always rice. Photograph it.' },
  { title: 'Lechon Watch', prompt: 'If there is lechon, document it before it disappears.' },
  { title: 'The Pancit', prompt: 'Photograph the noodles. Long life, long photo.' },
  { title: 'Sauce Situation', prompt: 'Photograph the condiments. Everybody has an opinion.' },
  { title: 'The Cake', prompt: 'Photograph the cake before anybody cuts it.' },
  { title: 'The Cake, After', prompt: 'Now photograph the cake after. Carnage.' },
  { title: 'Dessert Haul', prompt: 'Raid the dessert table and flaunt what you took.' },
  { title: 'The Halo-Halo', prompt: 'Photograph the best cold dessert here, mid-melt.' },
  { title: 'Coffee Run', prompt: 'Photograph whatever is keeping people awake.' },
  { title: 'The Bar', prompt: 'Photograph the bar in full swing.' },
  { title: 'Your Glass', prompt: 'Photograph whatever is in your glass right now.' },
  { title: 'Cheers With A Stranger', prompt: 'Clink glasses with somebody new. One photo.', mission: 'toast_or_dance' },
  { title: 'The Toast', prompt: 'Ten seconds of a toast — yours or somebody else’s.', kind: 'clip', mission: 'toast_or_dance' },
  { title: 'Empty Glasses', prompt: 'Photograph a table of empty glasses. Evidence.' },
  { title: 'The Ice Bucket', prompt: 'Photograph whatever is keeping the drinks cold.' },
  { title: 'The Cart', prompt: 'Ten seconds of a food cart in action — ice cream, coffee, fishball, anything.', kind: 'clip' },
  { title: 'Street Food Corner', prompt: 'Photograph the most unexpected thing being served tonight.' },
  { title: 'The Grazing Board', prompt: 'Photograph the cheese, the fruit, the whole spread.' },
  { title: 'Fruit', prompt: 'Photograph the fruit nobody has touched yet.' },
  { title: 'The Buffet Line', prompt: 'Photograph the queue from the front of it.' },
  { title: 'Second Trip', prompt: 'Photograph somebody going back for more. Salute them.' },
  { title: 'Clean Plate', prompt: 'Photograph a completely finished plate.' },
  { title: 'The Kids Menu', prompt: 'Photograph what the children are actually eating.' },
  { title: 'Someone Else’s Order', prompt: 'Photograph the plate you wish you had taken.' },
  { title: 'Table Full', prompt: 'Photograph your whole table mid-meal.' },
  { title: 'The Takeaway', prompt: 'Photograph whatever is being packed to take home.' },
  { title: 'Feed Someone', prompt: 'Photograph one person feeding another. Ask first.' },
  { title: 'Review It', prompt: 'Ten seconds: review the food out loud. Be generous.', kind: 'clip' },
  { title: 'The One You Went Back For', prompt: 'Ten seconds: name the dish you went back for and why.', kind: 'clip' },
  { title: 'Thank The Kitchen', prompt: 'Ten seconds of thanks aimed at whoever cooked.', kind: 'clip', mission: 'video_greeting' },
  { title: 'The Table Setting', prompt: 'Photograph your place setting before anybody moves it.' },
  { title: 'Napkin Art', prompt: 'Do something with a napkin. Photograph it.' },
  { title: 'Last Bite', prompt: 'Photograph the last bite of the night.' },
  { title: 'The Signature Drink', prompt: 'Order whatever {host} chose for tonight. Show it off.' },
  { title: 'Non-Drinkers Corner', prompt: 'Photograph the best drink here with nothing in it.' },
  { title: 'The Water Glass', prompt: 'Photograph somebody being sensible. Water counts.' },
  { title: 'Midnight Snack', prompt: 'Photograph whatever comes out late.' },

  // ═════════════════════════════════════════════════════════════════════════
]);

// ═══════════════════════════════════════════════════════════════════════════
// DECOR_BOOTH — the room somebody spent months on.
// ═══════════════════════════════════════════════════════════════════════════
// 🔑 THIS IS THE CATEGORY THE VENDORS CARE ABOUT. Every row here is a photo of
// somebody's work — the stylist, the florist, the lighting crew — which is
// exactly what a sponsoring supplier gets back through the challenge-photo
// consent path. Written to be flattering by default.
const DECOR: PoolRow[] = block('decor_booth', 'decor_booth', { kind: 'photo' }, [
  { title: 'The Entrance', prompt: 'Photograph the way in, before the crowd arrives.' },
  { title: 'The Backdrop', prompt: 'Pose at the main backdrop, arch, or stage.', rank: 18 },
  { title: 'Your Centrepiece', prompt: 'Photograph your table’s centrepiece properly.' },
  { title: 'A Different Table', prompt: 'Photograph somebody else’s centrepiece. They are never identical.' },
  { title: 'The Flowers', prompt: 'Find the best flowers in the building.' },
  { title: 'One Single Flower', prompt: 'Get as close as you can to one bloom.' },
  { title: 'The Lights', prompt: 'Ten seconds of whatever is lighting this room.', kind: 'clip' },
  { title: 'The Fairy Lights', prompt: 'Photograph the smallest lights here.' },
  { title: 'The Big Screen', prompt: 'Photograph the LED wall or projection.' },
  { title: 'The Signage', prompt: 'Photograph the lettering, the welcome sign, the seating board.' },
  { title: 'The Seating Chart', prompt: 'Find your name on the plan. Photograph it.' },
  { title: 'Your Place Card', prompt: 'Photograph your own name card.' },
  { title: 'Left On Your Seat', prompt: 'Photograph whatever was left on your seat for you.' },
  { title: 'The Guestbook Table', prompt: 'Photograph the signing station.' },
  { title: 'The Gift Table', prompt: 'Photograph where the gifts are piling up.' },
  { title: 'Bring Back A Strip', prompt: 'Hit the photo booth and bring back the printed strip.' },
  { title: 'The Props Box', prompt: 'Photograph the props before anybody wrecks them.' },
  { title: 'The Ceiling', prompt: 'Point straight up. Photograph whatever is hanging.' },
  { title: 'The Floor', prompt: 'Photograph the floor — aisle runner, tiles, dance floor, grass.' },
  { title: 'The Best Corner', prompt: 'Find the corner the stylist clearly loved most.' },
  { title: 'Outside The Venue', prompt: 'Step out and photograph the building itself.' },
  { title: 'The View', prompt: 'Photograph whatever this place has a view of.' },
  { title: 'Golden Hour Outside', prompt: 'If the sky is doing anything, photograph it.' },
  { title: 'The Details Nobody Sees', prompt: 'Find one small styled detail most guests will walk past.' },
  { title: 'Before The Room Fills', prompt: 'Photograph the room while it is still empty.' },
  { title: 'After Everybody Leaves', prompt: 'Photograph the room once it empties out.' },
  { title: 'The Stage', prompt: 'Photograph the stage or the head table.' },
  { title: 'The Chairs', prompt: 'Photograph the chairs. Somebody chose those.' },
  { title: 'Linens And Layers', prompt: 'Close up on the fabric on your table.' },
  { title: 'Glass And Cutlery', prompt: 'Photograph the glassware catching the light.' },
  { title: 'The Candles', prompt: 'Photograph the room lit only by candles.' },
  { title: 'The Colour Palette', prompt: 'One photo that shows the colours of today.' },
  { title: 'The Monogram', prompt: 'Find the initials or the logo of today and photograph it.' },
  { title: 'Balloon Watch', prompt: 'Photograph the balloons before gravity wins.' },
  { title: 'The Neon', prompt: 'If there is a neon sign, it exists to be photographed.' },
  { title: 'The Cake Table', prompt: 'Photograph the cake in its full setting, not just the cake.' },
  { title: 'The Bar Setup', prompt: 'Photograph how the bar was styled.' },
  { title: 'Give Them Credit', prompt: 'Ten seconds: say what the room looks like, out loud.', kind: 'clip' },
  { title: 'The Crew At Work', prompt: 'Photograph the team setting up or striking down. Ask first.' },
  { title: 'One Wide Shot', prompt: 'Stand as far back as you can. One photo of the whole room.' },
]);

// ═══════════════════════════════════════════════════════════════════════════
// BAND_DANCE — noise, movement, the floor.
// ═══════════════════════════════════════════════════════════════════════════
const DANCE: PoolRow[] = block('band_dance', 'band_dance', { kind: 'clip' }, [
  { title: 'First On The Floor', prompt: 'Ten seconds of whoever dances first. Heroes.', rank: 19 },
  { title: 'Your Move', prompt: 'Your single best move. Ten seconds.' },
  { title: 'Teach Somebody', prompt: 'Teach one person a step. Film ten seconds of it.', mission: 'roster' },
  { title: 'Learn Something', prompt: 'Get somebody to teach YOU a step. Ten seconds.', mission: 'roster' },
  { title: 'The Line Dance', prompt: 'Ten seconds of everybody doing the same thing at once.' },
  { title: 'Budots', prompt: 'Ten seconds. You know what to do.' },
  { title: 'The Slow One', prompt: 'Photograph the floor during a slow song.', kind: 'photo' },
  { title: 'Full Floor', prompt: 'One photo of the floor at its absolute fullest.', kind: 'photo' },
  { title: 'Empty Floor', prompt: 'Photograph the floor before anybody is brave enough.', kind: 'photo' },
  { title: 'The Kids Take Over', prompt: 'Ten seconds of the children owning the dance floor.' },
  { title: 'The Titos Take Over', prompt: 'Ten seconds of the older crowd showing everybody up.' },
  { title: 'Shoes Off, Dancing', prompt: 'Photograph the first person to dance barefoot.', kind: 'photo' },
  { title: 'The Band', prompt: 'Photograph whoever is making the music.', kind: 'photo' },
  { title: 'The DJ', prompt: 'Ten seconds of the DJ working.' },
  { title: 'Shout Your Request', prompt: 'Ask for a song out loud. Film it. Ten seconds.' },
  { title: 'Sing One Line', prompt: 'Sing one line of the song playing right now. Ten seconds.' },
  { title: 'The Duet', prompt: 'Grab somebody and sing one line together. Ten seconds.', mission: 'roster' },
  { title: 'Videoke', prompt: 'Ten seconds of whoever grabbed the microphone.' },
  { title: 'The High Note', prompt: 'Catch somebody going for it. Ten seconds.' },
  { title: 'Clap Along', prompt: 'Ten seconds of a room clapping in time. Or trying.' },
  { title: 'The Conga', prompt: 'Start one. Film ten seconds. Do not stop.' },
  { title: 'Five On The Floor', prompt: 'Five or more people dancing in one frame.', kind: 'photo' },
  { title: 'Dance With A Stranger', prompt: 'Ten seconds dancing with somebody you just met.', mission: 'roster' },
  { title: 'The Reluctant Dancer', prompt: 'Ten seconds of somebody who swore they would not.' },
  { title: 'Best Footwork', prompt: 'Point the camera at feet only. Ten seconds.' },
  { title: 'Spun Around', prompt: 'Film somebody being spun. Ten seconds.' },
  { title: 'The Dip', prompt: 'Catch a dip. One photo.', kind: 'photo' },
  { title: 'Sweat Check', prompt: 'Photograph the aftermath of one good song.', kind: 'photo' },
  { title: 'The Speaker', prompt: 'Photograph whatever the sound is coming out of.', kind: 'photo' },
  { title: 'Everybody Jump', prompt: 'Ten seconds. Get a group airborne.', mission: 'roster' },
  { title: 'The Last Song', prompt: 'Ten seconds of the final song of the night.' },
  { title: 'Name That Tune', prompt: 'Ten seconds: name the song playing and why it fits today.' },
  { title: 'The Playlist Request', prompt: 'Ten seconds: the song you would have added.' },
  { title: 'From The Balcony', prompt: 'Shoot the dance floor from as high as you can get.', kind: 'photo' },
  { title: 'From The Middle', prompt: 'Ten seconds filmed from the centre of the floor.' },
]);

// ═══════════════════════════════════════════════════════════════════════════
// BIG_MOMENTS — the parts of the programme everybody stops for.
// ═══════════════════════════════════════════════════════════════════════════
// ⚠ MIXED SCOPE ON PURPOSE. A bouquet toss belongs to a wedding; a candle blow
// belongs to a birthday; "the moment everybody cheers" belongs to all of them.
// Each row says which, and the ones that name a wedding ritual are scoped so a
// graduation never asks for a garter.
const BIG: PoolRow[] = block('big_moments', 'big_moments', { kind: 'clip' }, [
  { title: 'The Grand Entrance', prompt: 'Ten seconds of the grand entrance.' },
  { title: 'The Moment Everybody Cheers', prompt: 'Ten seconds of the loudest the room gets tonight.' },
  { title: 'Best Line Of The Speech', prompt: 'Ten seconds of the best line in any speech.' },
  { title: 'The Reaction Shot', prompt: 'Photograph the crowd during the speech, not the speaker.', kind: 'photo' },
  { title: 'The Applause', prompt: 'Ten seconds of a room applauding.' },
  { title: 'The Group Photo Being Taken', prompt: 'Photograph the chaos of organising a group photo.', kind: 'photo' },
  { title: 'The Countdown', prompt: 'Ten seconds of everybody counting down to something.' },
  { title: 'The Surprise', prompt: 'Ten seconds of whatever nobody saw coming.' },
  { title: 'The Programme Card', prompt: 'Photograph tonight’s programme or menu.', kind: 'photo' },
  { title: 'Leave Your Message', prompt: 'Photograph yourself leaving a message.', kind: 'photo' },
  { title: 'The Gift Handover', prompt: 'Photograph a gift changing hands.', kind: 'photo' },
  { title: 'The Photo Everybody Wanted', prompt: 'Take the photo you can tell everybody is waiting for.', kind: 'photo' },
  { title: 'The Send-Off', prompt: 'Ten seconds of the goodbye.' },
  { title: 'The Last Dance', prompt: 'Ten seconds of the final dance.' },
  { title: 'Sparklers, Bubbles, Confetti', prompt: 'Ten seconds of whatever gets thrown or lit.' },
  { title: 'The Car', prompt: 'Photograph the ride leaving.', kind: 'photo' },
  { title: 'After It All', prompt: 'Photograph the room the minute it is over.', kind: 'photo' },
  { title: 'Blow Them Out', prompt: 'Ten seconds of the candles being blown out.', events: ['birthday', 'debut', 'anniversary', 'celebration'] },
  { title: 'The Wish', prompt: 'Ten seconds: ask {host} what they wished for. They do not have to answer.', events: ['birthday', 'debut', 'anniversary', 'celebration'] },
  { title: 'Happy Birthday, Sung', prompt: 'Ten seconds of the whole room singing.', events: ['birthday', 'debut'] },
  { title: 'The Cake Cut', prompt: 'Ten seconds of the first cut.' },
  { title: 'The Toss', prompt: 'Catch the bouquet or garter toss — or the scramble.', events: WEDDING },
  { title: 'The First Kiss', prompt: 'Catch the kiss.', kind: 'photo', events: WEDDING },
  { title: 'The Rings', prompt: 'Photograph the rings up close.', kind: 'photo', events: WEDDING },
  { title: 'The Vows', prompt: 'Ten seconds of the vows.', events: WEDDING },
  { title: 'The Aisle Walk', prompt: 'Ten seconds of the walk down the aisle.', events: WEDDING },
  { title: 'The First Dance', prompt: 'Ten seconds of the first dance.', events: WEDDING },
  { title: 'The Money Dance', prompt: 'Ten seconds of the money dance.', events: WEDDING },
  { title: 'The Unity Moment', prompt: 'Ten seconds of the candle, cord, or veil.', events: WEDDING },
  { title: 'The Cap Toss', prompt: 'Ten seconds of the caps going up.', events: ['graduation'] },
  { title: 'The Certificate', prompt: 'Photograph the diploma or certificate.', kind: 'photo', events: ['graduation'] },
  { title: 'The Reveal', prompt: 'Ten seconds of the moment everybody finds out.', events: ['gender_reveal'] },
  { title: 'The Blessing', prompt: 'Ten seconds of the blessing.', events: ['christening', 'wedding'] },
  { title: 'The 18 Roses', prompt: 'Ten seconds of one of the eighteen.', events: ['debut'] },
  { title: 'The Team Photo', prompt: 'Photograph the whole team together.', kind: 'photo', events: ['tournament', 'corporate', 'reunion'] },
]);

// ═══════════════════════════════════════════════════════════════════════════
// THE POOL
// ═══════════════════════════════════════════════════════════════════════════

/** Every challenge Setnayan supplies. The migration is generated from this. */
export const CHALLENGE_POOL: PoolRow[] = [
  ...SHIPPED,
  ...SELFIE,
  ...ANYWHERE,
  ...GREETING,
  ...STORIES_SIDE,
  ...STORIES_ANY,
  ...STORIES_COUPLE,
  ...COUPLE_FAMILY,
  ...MEET_ROOM,
  ...FASHION,
  ...FOOD,
  ...DECOR,
  ...DANCE,
  ...BIG,
];

/**
 * The floor the owner asked for: "we want to have over 500 challenges photos or
 * videos combined." Asserted at MODULE LOAD, not in a test, because a test can
 * be skipped and an import cannot — and a pool that quietly falls under the
 * number is the failure nobody would notice.
 */
export const CHALLENGE_POOL_FLOOR = 500;
if (CHALLENGE_POOL.length < CHALLENGE_POOL_FLOOR) {
  throw new Error(
    `papic-challenge-pool: ${CHALLENGE_POOL.length} challenges, floor is ${CHALLENGE_POOL_FLOOR}`,
  );
}

/**
 * Does this row belong at an event of this type? `null` scope fits everything.
 * Pure, and shared by the picker and the pool test so the screen and the
 * database cannot disagree about what a birthday is allowed to ask.
 */
export function fitsEventType(row: PoolRow, eventType: string): boolean {
  return row.eventTypes === null || row.eventTypes.includes(eventType);
}
