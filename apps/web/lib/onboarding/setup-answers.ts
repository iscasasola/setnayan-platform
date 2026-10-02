/**
 * setup-answers.ts — what the event onboarding's setup cards hold (G1).
 *
 * ⚖ Owner 2026-09-30 (DECISION_LOG "THE SETUP LIVES AT THE END OF CREATING THE
 * EVENT…", amended by "EVERY SETUP CARD NEEDS AN ANSWER"): the shared
 * essentials + the Yes/No list, every card answered, a quick answer counts,
 * everything changeable later. The cards and their ORDER are decided by the
 * event-type profile in `flow-config.ts` (`resolveSetupSteps`); this file is
 * only the answers — their shape, their defaults, and whether a card is
 * answered.
 *
 * Pure and client-safe (no runtime imports): the wizard imports it, the commit
 * re-parses through it (`sanitizeSetupAnswers` — the wire is never trusted).
 */

/** The cards the engine draws, in the engine's order. */
export const SETUP_CARD_IDS = [
  'setup_where',
  'setup_photo',
  'setup_look',
  'setup_guests',
  'setup_more',
] as const;
export type SetupCardId = (typeof SETUP_CARD_IDS)[number];

export type SetupWhere = 'place' | 'home' | 'undecided';
export type SetupPhoto = 'upload' | 'theme';
export type SetupReply = 'yes' | 'no';
/** "How do guests get in?" → Entry ▾, shown only when they will NOT reply. */
export type SetupEntry = 'personal' | 'one_qr' | 'both';
export type SetupGuests = 'people' | 'type' | 'import' | 'later';
export type YesNo = 'yes' | 'no';

export const SETUP_ENTRIES: readonly SetupEntry[] = ['personal', 'one_qr', 'both'];
export const SETUP_GUEST_WAYS: readonly SetupGuests[] = ['people', 'type', 'import', 'later'];

export type SetupAnswers = {
  where: SetupWhere | null;
  /** The place, typed — only when `where` is 'place'. */
  whereText: string;
  photo: SetupPhoto;
  look: string;
  reply: SetupReply;
  entry: SetupEntry;
  /**
   * "Guest list + requests" (a wedding's three-way "How do guests get in?"):
   * the list is still the door, but anyone with the link may ASK to come and
   * the hosts say yes or no. Only meaningful while `reply` is 'yes'; it lands in
   * `rsvp_ask_config.whoCanRsvp = 'anyone'`, the field the Guest list's "Who can
   * reply?" already reads — never a second setting.
   */
  requests: boolean;
  guests: SetupGuests | null;
  logo: YesNo;
  questions: 'defaults' | 'change';
  papic: YesNo;
  gifts: YesNo;
};

/** The rows of the last card ("A few more, quick"). */
export type MoreRow = 'logo' | 'questions' | 'papic' | 'gifts';

/**
 * Everything the cards need to know about the event type, resolved on the
 * server from the profile (`setupViewFor` in flow-config.ts) and handed down —
 * so the wizard never imports the profile module or the theme catalogue.
 */
export type SetupView = {
  eventType: string;
  /** The type's register — a wake speaks quietly ("Not settled yet"). */
  solemn: boolean;
  guestWord: string;
  giftsMode: 'gifts' | 'donations' | 'abuloy' | 'ambag' | 'none';
  cameraDefault: 'on' | 'quiet' | 'off';
  /** The looks this type may wear, its own set first; `pro` draws ◆. */
  looks: ReadonlyArray<{ id: string; name: string; pro: boolean; own: boolean }>;
  replyDefault: SetupReply;
  /** FALSE = the guest list is optional for this type (a wake): no guests card. */
  guestList: boolean;
  /** Does the last card offer a logo row? */
  logoRow: boolean;
  /** The type's skin — the look the onboarding takes on once the type is picked. */
  skin: 'wedding' | 'party' | 'quiet' | 'casual';
};

/**
 * The look onboarding PRE-SELECTS: the first FREE look in the type's list,
 * never a Pro one (owner 2026-10-01, DECISION_LOG "ONBOARDING PRE-SELECTS A
 * FREE THEME"). A Pro look stays pickable (◆) — it is only never the default.
 * Only if no free look is offered at all does the list's first stand.
 */
export function defaultLookId(view: Pick<SetupView, 'looks'>): string {
  return (view.looks.find((l) => !l.pro) ?? view.looks[0])?.id ?? 'house';
}

/** Every answer pre-filled with the type's default — the default IS an answer. */
export function setupDefaults(view: SetupView): SetupAnswers {
  return {
    where: null,
    whereText: '',
    photo: 'theme',
    look: defaultLookId(view),
    reply: view.replyDefault,
    // ⚖ Owner d24 (2026-10-02): a personal QR for each guest — changed later in Event Details.
    // A wake has no guest list to hand a QR to, so it keeps the one QR everyone shares.
    entry: view.guestList ? 'personal' : 'one_qr',
    requests: false,
    guests: view.guestList ? null : 'later',
    logo: 'no',
    questions: 'defaults',
    papic: view.cameraDefault === 'off' ? 'no' : 'yes',
    gifts: view.giftsMode === 'none' ? 'no' : 'yes',
  };
}

/**
 * The last card's rows. Questions only matter when guests reply; the rest
 * follow the profile (`logoRow`, `cameraDefault`, `giftsMode`).
 */
export function moreRows(view: SetupView, reply: SetupReply): MoreRow[] {
  const rows: MoreRow[] = [];
  if (view.logoRow) rows.push('logo');
  if (reply === 'yes') rows.push('questions');
  if (view.cameraDefault !== 'off') rows.push('papic');
  if (view.giftsMode !== 'none') rows.push('gifts');
  return rows;
}

/** Is this card answered? A quick answer counts; nothing is skipped. */
export function setupCardAnswered(card: SetupCardId, a: SetupAnswers): boolean {
  switch (card) {
    case 'setup_where':
      return a.where === 'home' || a.where === 'undecided' || (a.where === 'place' && a.whereText.trim().length > 0);
    case 'setup_guests':
      return a.guests !== null;
    default:
      // photo · look · entry · more carry a default from the first render.
      return true;
  }
}

/**
 * The QUICK ANSWERS each card offers — at least one per card, so no card is
 * ever work (DECISION_LOG "EVERY SETUP CARD NEEDS AN ANSWER"). The guard in
 * flow-config.test.ts holds every card to ≥ 1.
 */
export function setupQuickAnswers(card: SetupCardId, solemn: boolean): string[] {
  const notYet = solemn ? 'Not settled yet' : 'Not decided yet';
  switch (card) {
    case 'setup_where':
      return ['At home', notYet];
    case 'setup_photo':
      return [solemn ? 'A plain notice for now' : 'Use a theme picture for now'];
    case 'setup_look':
      return ['Keep the one picked'];
    case 'setup_guests':
      return [solemn ? 'Later' : 'I’ll add them later'];
    case 'setup_more':
      return ['Use the defaults'];
  }
}

const MAX_TEXT = 200;
const pick = <T extends string>(v: unknown, allowed: readonly T[], d: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : d;

/**
 * The wire is never trusted: every key re-read against its allowed values,
 * anything else takes the type's default. NULL when nothing was sent — a
 * caller that never ran the engine writes nothing.
 */
export function sanitizeSetupAnswers(raw: unknown, view: SetupView): SetupAnswers | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const d = setupDefaults(view);
  const whereText = typeof r.whereText === 'string' ? r.whereText.trim().slice(0, MAX_TEXT) : '';
  const where = pick<SetupWhere | 'none'>(r.where, ['place', 'home', 'undecided'], 'none');
  const looks = view.looks.map((l) => l.id);
  return {
    where: where === 'none' || (where === 'place' && !whereText) ? null : where,
    whereText: where === 'place' ? whereText : '',
    photo: pick(r.photo, ['upload', 'theme'] as const, d.photo),
    look: pick(r.look, looks, d.look),
    reply: pick(r.reply, ['yes', 'no'] as const, d.reply),
    entry: pick(r.entry, SETUP_ENTRIES, d.entry),
    requests: r.requests === true,
    guests: view.guestList ? pick<SetupGuests | 'none'>(r.guests, SETUP_GUEST_WAYS, 'none') === 'none' ? null : (r.guests as SetupGuests) : 'later',
    logo: view.logoRow ? pick(r.logo, ['yes', 'no'] as const, d.logo) : 'no',
    questions: pick(r.questions, ['defaults', 'change'] as const, d.questions),
    papic: view.cameraDefault === 'off' ? 'no' : pick(r.papic, ['yes', 'no'] as const, d.papic),
    gifts: view.giftsMode === 'none' ? 'no' : pick(r.gifts, ['yes', 'no'] as const, d.gifts),
  };
}

/**
 * Where to land after the commit. The guests card decides first: a way to add
 * them opens the Guest list. With guests for later, the answers that promised
 * a next step keep it (owner 2026-10-02, "EVERY ANSWER … LIVES IN EVENT
 * DETAILS" — the app obeys the answer): "Do you want a logo? — Yes, make one"
 * opens the Logo maker, and "Upload a photo" ("You'll add it from your Event
 * Hub") opens the First screen, where the photo goes — each the Maker's Your
 * info item. Otherwise Home, whose Next card says "Add your guests". Never a
 * second question.
 */
export function setupLanding(eventId: string, a: SetupAnswers | null): string {
  const home = `/dashboard/${eventId}`;
  if (!a) return home;
  if (a.guests === 'type') return `${home}/guests/new`;
  if (a.guests === 'import') return `${home}/guests/import`;
  if (a.guests === 'people') return `${home}/guests`;
  if (a.logo === 'yes') return `${home}/launch?tool=details&item=logo`;
  if (a.photo === 'upload') return `${home}/launch?tool=details&item=hero`;
  return home;
}
