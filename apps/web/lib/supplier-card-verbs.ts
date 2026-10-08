/**
 * supplier-card-verbs.ts — THE VERBS ON A SUPPLIER'S CARD, BY THE STEP THEY ARE
 * AT (owner 2026-10-07; corpus `SUPPLIERS_BUILD_PLAN_2026-10-07_fable.md` § PR2
 * "Verbs by step"; the prototype's `verbs()`).
 *
 * One table, read by the bench card (`bench-vendor-actions.tsx`). It decides
 * WHICH buttons a card shows, in what order, in which colour and which one is
 * the main verb. It decides nothing about whether an action is ALLOWED — that
 * is `resolveBenchCardActions` (`lib/bench-card-actions.ts`), whose answer this
 * takes as its input and never second-guesses: a verb is only ever offered when
 * the resolver already says its action exists.
 *
 *   step                         verbs (main first)
 *   ─────────────────────────    ─────────────────────────────────────────────
 *   booked, no price             Your record | Set price · Chat · Workspace
 *   booked, a payment due        Pay · [Your record] · Chat · Workspace
 *   booked, nothing due          Payments · [Your record] · Chat · Workspace
 *   asked to book (no yes yet)   Nudge · Chat · Withdraw
 *   their quote is in            Read their reply · Remove
 *   taken on the date            Ask about another day · Remove
 *   priced                       Add to build | In your build · Book · Chat | Your record · Remove
 *   does not fit the build       Chat · Remove
 *   added by you, no price       Your record · Remove
 *   asked for a quote            Nudge · Chat · Remove
 *   saved, never asked           Ask for a quote · Remove
 *
 * ONE COLOUR PER MEANING (`BUTTON_RULE_2026-10-07_fable.md`): terracotta the
 * forward step · green commit and money · blue messaging · amber waiting on
 * someone · red take it back · grey manage.
 */
import type { BenchCardActions } from './bench-card-actions';

/** The tones `ActionButton` draws (`components/action-button.tsx`). */
type VerbTone = 'brand' | 'ok' | 'info' | 'warn' | 'danger' | 'neutral';

export type CardVerbKey =
  | 'ask'
  | 'nudge'
  | 'chat'
  | 'read_reply'
  | 'another_day'
  | 'add'
  | 'in_build'
  | 'book'
  | 'record'
  | 'withdraw'
  | 'pay'
  | 'payments'
  | 'set_price'
  | 'workspace'
  | 'remove';

export type CardVerb = {
  key: CardVerbKey;
  /** The word on the button — fixed (the prototype's). */
  label: string;
  tone: VerbTone;
  /** The row's main verb: filled. At most one per row. */
  main?: boolean;
  /** A main verb that should not shout (nothing is being asked of the couple). */
  quiet?: boolean;
};

const WORDS: Record<CardVerbKey, { label: string; tone: VerbTone }> = {
  ask: { label: 'Ask for a quote', tone: 'info' },
  nudge: { label: 'Nudge', tone: 'warn' },
  chat: { label: 'Chat', tone: 'info' },
  read_reply: { label: 'Read their reply', tone: 'info' },
  another_day: { label: 'Ask about another day', tone: 'warn' },
  add: { label: 'Add to build', tone: 'brand' },
  in_build: { label: 'In your build', tone: 'ok' },
  book: { label: 'Book', tone: 'ok' },
  record: { label: 'Your record', tone: 'neutral' },
  withdraw: { label: 'Withdraw', tone: 'danger' },
  pay: { label: 'Pay', tone: 'ok' },
  payments: { label: 'Payments', tone: 'ok' },
  set_price: { label: 'Set price', tone: 'neutral' },
  workspace: { label: 'Workspace', tone: 'neutral' },
  remove: { label: 'Remove', tone: 'danger' },
};

/** The word and colour of one verb — also what a test reads. */
export function cardVerbWords(key: CardVerbKey): { label: string; tone: VerbTone } {
  return WORDS[key];
}

const verb = (key: CardVerbKey, opts: { main?: boolean; quiet?: boolean } = {}): CardVerb => ({
  key,
  ...WORDS[key],
  ...(opts.main ? { main: true } : {}),
  ...(opts.quiet ? { quiet: true } : {}),
});

/**
 * The one line a Nudge posts in the conversation — the prototype's words. It is
 * sent as the couple, by their own tap, through the same door a typed message
 * uses (`sendChatMessageCore`), so the one-follow-up rule applies to it.
 */
export const NUDGE_MESSAGE = 'Hi! Just checking on the quote — any update?';

export type CardVerbInput = {
  /** `resolveBenchCardActions`' answer for this card. */
  actions: BenchCardActions;
  /** The supplier is booked here (contracted or later). */
  booked: boolean;
  /** A price is recorded for them. */
  hasPrice: boolean;
  /** Their quote is waiting on the couple (`standing.needsYou`). */
  quoteIn: boolean;
  /** A payment is due now — the same answer the Booked body's row gives. */
  payDue: boolean;
};

export function cardVerbs(i: CardVerbInput): CardVerb[] {
  const { actions } = i;
  // A live conversation exists (the resolver hands its id) — Chat, Nudge and
  // "Read their reply" all need one; none is offered without it.
  const thread = actions.inquiry?.kind === 'check';
  // A supplier the couple added themselves: they keep the record.
  const own = actions.connect;
  const out: CardVerb[] = [];

  if (i.booked) {
    if (!i.hasPrice) out.push(verb(own ? 'record' : 'set_price', { main: true }));
    else if (i.payDue) out.push(verb('pay', { main: true }));
    else out.push(verb('payments', { main: true, quiet: true }));
    if (own && i.hasPrice) out.push(verb('record'));
    if (thread) out.push(verb('chat'));
    out.push(verb('workspace'));
    return out;
  }

  // Asked to book, no yes yet: nothing opens — chase, talk, or take it back.
  if (actions.withdraw) {
    if (thread) out.push(verb('nudge'), verb('chat'));
    out.push(verb('withdraw'));
    return out;
  }

  if (i.quoteIn && thread) return [verb('read_reply', { main: true }), verb('remove')];

  const build = actions.build?.kind ?? null;

  // Taken on the couple's date: the card stays, but it cannot be added or booked.
  if (build === 'not_available') {
    if (thread) out.push(verb('another_day', { main: true, quiet: true }));
    out.push(verb('remove'));
    return out;
  }

  if (build === 'add' || build === 'in_build') {
    out.push(verb(build === 'add' ? 'add' : 'in_build', { main: true }));
    if (actions.lockGroupId) out.push(verb('book'));
    if (own) out.push(verb('record'));
    else if (thread) out.push(verb('chat'));
    out.push(verb('remove'));
    return out;
  }

  if (build === 'schedule_clash') {
    if (thread) out.push(verb('chat'));
    out.push(verb('remove'));
    return out;
  }

  if (own) return [verb('record', { main: true }), verb('remove')];
  if (thread) return [verb('nudge'), verb('chat'), verb('remove')];
  if (actions.inquiry?.kind === 'inquire') return [verb('ask', { main: true }), verb('remove')];
  return [verb('remove')];
}
