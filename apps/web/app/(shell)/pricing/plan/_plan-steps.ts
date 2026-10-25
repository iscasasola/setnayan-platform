/**
 * The questionnaire's questions and its result — pure, so the client draws it and a test can walk it.
 *
 * Owner 2026-10-25, verbatim: "Or maybe a questionaire · Like do you want a guest list? · Do you want to integrate this
 * to a seatplan? · Do you want to connect it to the your guests? · Do you want to have an easier way to take pictures? ·
 * And so on · And then we will say what setnayan can offer to them and how much it saves time and money for them" —
 * then "Yes, build this pricing page and the questionnaire into the app." Prototype
 * `prototypes/pricing_ours_only_2026-10-25/quiz.html`, its questions and words.
 *
 * 🔑 EVERY PESO OF OURS ARRIVES IN `PlanPrices` (read on the server from `platform_retail_catalog_v2`). A paid question
 * whose price could not be read is NOT ASKED — the result can never show a product without its figure. The old-way
 * figures (`lib/old-way-costs.ts`) are about printing and time, never about another company.
 */
import { OLD_WAY, oldWayMoney, type OldWayMoney } from '@/lib/old-way-costs';
import type { AiBand, TwoPrices } from '../_pricing-reads';

export type PlanPrices = {
  pro: TwoPrices | null;
  partsFrom: number | null;
  papicFrom: number | null;
  liveWatch: number | null;
  patiktok: { php: number; perDay: boolean } | null;
  ai: Partial<Record<AiBand, TwoPrices>>;
};

/** Event types, in the prototype's words — each prices Setnayan AI by its band (`AI_TIER_SKU`). */
export const EVENT_TYPES: ReadonlyArray<{ band: AiBand; label: string; words: string }> = [
  { band: 'A', label: 'A wedding', words: 'a wedding' },
  { band: 'B', label: 'A debut, corporate or gala', words: 'a debut, corporate or gala' },
  { band: 'C', label: 'A birthday, christening or another event', words: 'a birthday, christening or another event' },
  { band: 'D', label: 'A date or hangout', words: 'a date or hangout' },
];

export type QuestionKey =
  | 'guests'
  | 'seating'
  | 'hub'
  | 'checkin'
  | 'prints'
  | 'papic'
  | 'live'
  | 'livewatch'
  | 'pro'
  | 'ai'
  | 'patiktok'
  | 'together';

export type PlanState = {
  type: AiBand;
  count: number;
  setup: boolean;
  answers: Partial<Record<QuestionKey, boolean>>;
};

export type Question = {
  k: QuestionKey;
  q: string;
  line: string;
  item: string;
  tip: string;
  /** Asked only when this earlier answer was yes. */
  after?: QuestionKey;
  /** Would be its own app, account or spreadsheet the old way. */
  tool?: boolean;
  /** The "no" answer's words (default "Not needed"). */
  no?: string;
  /** Its price for this state — present only on a paid question. */
  php?: number;
};

/** The questions for this state — paid ones only when their price was read. */
export function questionsFor(s: PlanState, p: PlanPrices, fmt: (n: number) => string): Question[] {
  const peso = (n: number) => `₱${fmt(n)}`;
  const at = (two: TwoPrices) => (s.setup && two.signup != null ? two.signup : two.regular);
  const ai = p.ai[s.type] ?? null;
  const type = EVENT_TYPES.find((t) => t.band === s.type) ?? EVENT_TYPES[0]!;
  const qs: Array<Question | null> = [
    {
      k: 'guests',
      q: 'Do you want a guest list?',
      line: 'Everyone in one list, no limit.',
      item: 'Guest list & RSVPs',
      tip: 'Your guest list with no limit, and every reply by link — no sign-in for guests. Included with every event.',
      tool: true,
    },
    {
      k: 'seating',
      q: 'Do you want to lay out a seat plan?',
      line: 'Tables in 2D, then walk the room in 3D.',
      item: 'Seat plan, with the 3D walkthrough',
      tip: 'Lay the room out, walk it in 3D before you publish; guests find their seat on their own pass. Included with every event.',
      tool: true,
    },
    {
      k: 'hub',
      q: 'Should your guests reply online and get their own ticket?',
      line: 'One page they open, one pass they keep.',
      item: 'The Event Hub & guest tickets',
      tip: 'The Event Hub your guests open — Save-the-Date, RSVP, the day’s page, your story — and each guest’s own ticket in three styles. Included in the plain design.',
      tool: true,
    },
    {
      k: 'checkin',
      q: 'Do you want to check guests in at the door?',
      line: 'A scan of their own QR, on the day.',
      item: 'Door check-in by QR',
      tip: 'Every accepted guest carries their own QR; your door crew scans it on a phone — arrivals, plus-ones and tables, live. Included with every event.',
      tool: true,
    },
    {
      k: 'prints',
      q: 'Will you print signs, place cards and lists?',
      line: 'Print-ready files, printed anywhere.',
      item: 'Printables',
      tip: 'Guest registry, guest QR codes, seat plan, table signs and place cards, entrance chart, caterer meal counts, event QR — print-ready files, included. Prints in your Event Hub look are part of Pro.',
      tool: true,
    },
    {
      k: 'papic',
      q: 'Do you want an easier way to collect everyone’s photos?',
      line: 'Every guest’s phone becomes a camera.',
      item: 'Papic',
      tip: `Guests shoot from their own phones, no app to install; every photo lands in one place. Your first event’s credits are included${p.papicFrom != null ? `; top-ups from ${peso(p.papicFrom)}` : ''}.`,
      tool: true,
    },
    {
      k: 'live',
      q: 'Will people watch from home?',
      line: 'One camera, live to everyone who can’t be there.',
      item: 'Livestream, one camera',
      tip: p.liveWatch != null
        ? 'The one-camera stream is included. Every camera at once is Live Watch — the next question.'
        : 'The one-camera stream is included with every event.',
      tool: true,
    },
    p.liveWatch != null
      ? {
          k: 'livewatch',
          q: 'Every camera live, not just one?',
          line: 'A directed stage, plus the guests’ cameras.',
          item: 'Live Watch, every camera',
          tip: `One directed Main Stage plus switchable guest cameras; phones join by the event QR. ${peso(p.liveWatch)}, one unlock for every camera on the event.`,
          after: 'live',
          php: p.liveWatch,
        }
      : null,
    p.pro
      ? {
          k: 'pro',
          q: 'Do you want the Event Hub to look like yours?',
          line: 'Your photos, music, themes and logo.',
          item: 'Event Hub Pro',
          tip:
            'Everything: your photos, music, themes and logo on the Event Hub, the cinematic reveal, 500 MB of your own media, prints in your look, no Setnayan mark. ' +
              (p.pro.signup != null
                ? `${peso(p.pro.signup)} while you set up your event · ${peso(p.pro.regular)} after.`
                : `${peso(p.pro.regular)}.`) +
              (p.partsFrom != null
                ? ` Or just the parts you need, from ${peso(p.partsFrom)} — what you pay for parts counts toward ${peso(p.pro.regular)}.`
                : ''),
          php: at(p.pro),
        }
      : null,
    ai
      ? {
          k: 'ai',
          q: 'Do you want help choosing suppliers?',
          line: 'A team suggested by fit, and your plan watched.',
          item: 'Setnayan AI',
          tip:
            `Suggests verified suppliers by how well they fit your event, then tracks deadlines, payments, budget and dates. For ${type.words}: ${peso(ai.regular)}` +
            (ai.signup != null ? `, or ${peso(ai.signup)} while you set up your event` : '') +
            '. One-time, until the event day.',
          tool: true,
          php: at(ai),
        }
      : null,
    p.patiktok
      ? {
          k: 'patiktok',
          q: 'Do you want short videos of the day to share?',
          line: 'Your guests’ moments, cut into reels.',
          item: 'Patiktok',
          tip: `Pick the moments, the length and a song; the reel renders in your browser. ${peso(p.patiktok.php)}${p.patiktok.perDay ? ' per day of your event' : ' for your event'}.`,
          tool: true,
          php: p.patiktok.php,
        }
      : null,
    {
      k: 'together',
      q: 'Will you plan this with other people?',
      line: 'Co-hosts, your people, your group — on one event.',
      item: 'Plan together: co-hosts, your people and your group',
      no: 'Just me',
      tip: 'Invite co-hosts and they plan beside you; add guests from your people and your group in a tap; anything you unlock covers everyone on the event. Included with every event.',
    },
  ];
  return qs.filter((q): q is Question => q !== null);
}

export type StepKey = 'type' | 'count' | QuestionKey | 'result';

/** The screens, in order: type · count · each question asked (a follow-up only after its yes) · result. */
export function stepsFor(s: PlanState, qs: readonly Question[]): StepKey[] {
  return ['type', 'count', ...qs.filter((q) => !q.after || s.answers[q.after]).map((q) => q.k), 'result'];
}

export type PlanResult = {
  yes: Question[];
  paid: Question[];
  total: number;
  includedCount: number;
  tools: number;
  money: OldWayMoney;
  /** "about 9 hours" — shown only when the guest list is yes (the only sourced task time). */
  hoursBack: number | null;
  /** The "while I set up my event" switch shows only when a picked product has a lower set-up price. */
  showSetupSwitch: boolean;
};

export function resultFor(s: PlanState, qs: readonly Question[], p: PlanPrices): PlanResult {
  const yes = qs.filter((q) => s.answers[q.k] && (!q.after || s.answers[q.after]));
  const paid = yes.filter((q) => q.php != null);
  const total = paid.reduce((sum, q) => sum + (q.php ?? 0), 0);
  const ai = p.ai[s.type] ?? null;
  return {
    yes,
    paid,
    total,
    includedCount: yes.length - paid.length,
    tools: yes.filter((q) => q.tool).length,
    money: oldWayMoney({
      guests: s.count,
      wantsGuestList: Boolean(s.answers.guests),
      wantsOnlineReplies: Boolean(s.answers.hub),
      wantsPrintables: Boolean(s.answers.prints),
    }),
    hoursBack: s.answers.guests ? OLD_WAY.guestListHours.value : null,
    showSetupSwitch:
      (Boolean(s.answers.pro) && p.pro?.signup != null) || (Boolean(s.answers.ai) && ai?.signup != null),
  };
}

/** The ⓘ under "Money kept": each counted piece, in words, at the shop price. */
export function moneyWords(m: OldWayMoney, fmt: (n: number) => string): string {
  const words: Record<keyof typeof OLD_WAY, (n: number) => string> = {
    printedInvitation: (n) => `${fmt(n)} printed invitations at ₱${fmt(OLD_WAY.printedInvitation.value)}`,
    placeCard: (n) => `${fmt(n)} place cards at ₱${fmt(OLD_WAY.placeCard.value)}`,
    tableNumber: (n) => `${fmt(n)} table numbers at ₱${fmt(OLD_WAY.tableNumber.value)}`,
    welcomeSign: () => `a welcome sign ₱${fmt(OLD_WAY.welcomeSign.value)}`,
    guestListHours: (n) => `${fmt(n)} hours`,
  };
  return m.parts.map((part) => words[part.figure](part.count)).join(' · ');
}
