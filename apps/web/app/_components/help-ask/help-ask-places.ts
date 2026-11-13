/**
 * THE ASK-FIRST HELP — its tile words and its "Take me there" doors (prototype
 * `Setnayan-specs/prototypes/approved_2026-11-13/help-page-fable.html` v5, approved 13 Nov 2026).
 *
 * The tile words are the prototype's, one short line per topic, per account (a supplier's "Getting started" is about
 * opening a shop; a user's is about the first event). The ANSWERS are never written here — they are read from
 * `lib/help.ts` (and, for the team, `lib/help-admin.ts`) through their existing exports.
 *
 * "Take me there" opens the exact screen, in the reader's own event or shop. A topic with no screen of its own, or an
 * event screen with no event to open it in, draws no button — never a door to a guess.
 * 🔒 `lib/help-ask-finds-the-answer.test.ts` — every door here must be a page that exists.
 */

export type TileAccount = 'user' | 'shop' | 'team';

export type TopicTile = { name: string; line: string };

export const TOPIC_TILES: Record<TileAccount, Record<string, TopicTile>> = {
  user: {
    'getting-started': { name: 'Getting started', line: 'Set up your account and your first event.' },
    guests: { name: 'Guest list', line: 'Add guests, their roles and plus-ones.' },
    invitations: { name: 'Event Hub', line: 'Your invitation page and its QR codes.' },
    'vendors-budget': { name: 'Suppliers & budget', line: 'Who you booked and what you still owe.' },
    'mood-board': { name: 'Mood Board', line: 'Your colours and what everyone wears.' },
    papic: { name: 'Papic', line: 'Turn your guests’ phones into cameras.' },
    'live-studio': { name: 'Live Watch', line: 'Stream your day to those who can’t come.' },
    messaging: { name: 'Messaging', line: 'Chat with suppliers and keep it private.' },
    'orders-payments': { name: 'Orders & payments', line: 'Order a service, pay, or ask for a refund.' },
    'people-memories': { name: 'People & Memories', line: 'Your people and every photo you keep.' },
    'guest-getting-started': { name: 'Got an invite?', line: 'Open an invitation and send your reply.' },
    'guest-day-of': { name: 'The Day', line: 'What to wear, where to sit, what is on.' },
    'account-privacy': { name: 'Account & privacy', line: 'Your settings and your data.' },
    'about-setnayan': { name: 'About Setnayan', line: 'What Setnayan is and what is free.' },
  },
  shop: {
    'getting-started': { name: 'Getting started', line: 'Open your shop and find your way around.' },
    'supplier-fees': { name: 'Fees & plans', line: 'What you pay Setnayan, and when.' },
    'getting-verified': { name: 'Getting verified', line: 'The papers you need, one step at a time.' },
    messaging: { name: 'Messaging', line: 'Reply to couples. It is always free.' },
    'people-memories': { name: 'People & Memories', line: 'Your people and every photo you keep.' },
    'account-privacy': { name: 'Account & privacy', line: 'Your settings and your data.' },
    'about-setnayan': { name: 'About Setnayan', line: 'What Setnayan is and how it works.' },
  },
  team: {
    'admin-console-basics': { name: 'Setnayan HQ basics', line: 'Find anyone, and see who did what.' },
    'admin-approvals': { name: 'Two-admin approvals', line: 'What needs a second admin to agree.' },
    'admin-force-majeure': { name: 'Force-majeure escalations', line: 'When an event cannot go on as planned.' },
  },
};

/** A door: where it goes and the words under the button ("Opens your Home."). */
export type HelpDoor = { href: string; opens: string };

const EVENT_DOORS: Record<string, { path: string; opens: string }> = {
  guests: { path: 'guests', opens: 'Guests' },
  invitations: { path: 'event-page', opens: 'your Event Hub' },
  'vendors-budget': { path: 'vendors', opens: 'Suppliers' },
  'mood-board': { path: 'studio/mood-board', opens: 'Mood Board' },
  papic: { path: 'memories', opens: 'Memories' },
  'live-studio': { path: 'live', opens: 'Live Watch' },
  messaging: { path: 'messages', opens: 'Messages' },
  'orders-payments': { path: 'orders', opens: 'Orders' },
};

const ACCOUNT_DOORS: Record<string, HelpDoor> = {
  'getting-started': { href: '/dashboard', opens: 'your Home' },
  'people-memories': { href: '/dashboard/people', opens: 'People' },
  'account-privacy': { href: '/dashboard/profile', opens: 'your profile' },
};

const SHOP_DOORS: Record<string, HelpDoor> = {
  'getting-started': { href: '/vendor-dashboard', opens: 'your shop’s Today' },
  'supplier-fees': { href: '/vendor-dashboard/booking-fees', opens: 'Booking fees' },
  'getting-verified': { href: '/vendor-dashboard/verify', opens: 'Verify your shop' },
  messaging: { href: '/vendor-dashboard/messages', opens: 'Messages' },
  'account-privacy': { href: '/vendor-dashboard/settings', opens: 'Settings' },
};

const TEAM_DOORS: Record<string, HelpDoor> = {
  'admin-console-basics': { href: '/admin/accounts', opens: 'Setnayan HQ › Accounts' },
  'admin-approvals': { href: '/admin/approvals', opens: 'Setnayan HQ › Approvals' },
  'admin-force-majeure': { href: '/admin/force-majeure', opens: 'Setnayan HQ › Force-majeure' },
};

/** Every door, for the guard (event doors with a sample id). */
export function allHelpDoorHrefs(): string[] {
  return [
    ...Object.values(EVENT_DOORS).map((d) => `/dashboard/[eventId]/${d.path}`),
    ...Object.values(ACCOUNT_DOORS).map((d) => d.href),
    ...Object.values(SHOP_DOORS).map((d) => d.href),
    ...Object.values(TEAM_DOORS).map((d) => d.href),
  ];
}

/**
 * Where "Take me there" goes for a topic, for this reader. `eventId` is the event the help was opened from (the
 * account sheet's `?refer=`); with none, an event screen has no door.
 */
export function helpDoorFor(account: TileAccount, topicKey: string, ctx: { eventId?: string | null; eventName?: string | null } = {}): HelpDoor | null {
  if (account === 'team') return TEAM_DOORS[topicKey] ?? null;
  if (account === 'shop') return SHOP_DOORS[topicKey] ?? null;
  const ev = EVENT_DOORS[topicKey];
  if (ev) {
    if (!ctx.eventId) return null;
    const where = ctx.eventName ? ` in ${ctx.eventName}` : '';
    return { href: `/dashboard/${ctx.eventId}/${ev.path}`, opens: `${ev.opens}${where}` };
  }
  return ACCOUNT_DOORS[topicKey] ?? null;
}

/** The tiles in the prototype's order (Getting started first, About Setnayan last); a topic with no tile words keeps its corpus place at the end. */
export function tilesFor(account: TileAccount, topics: ReadonlyArray<{ key: string; label: string }>): Array<{ key: string } & TopicTile> {
  const order = Object.keys(TOPIC_TILES[account]);
  const rank = (k: string) => (order.includes(k) ? order.indexOf(k) : order.length);
  return [...topics]
    .sort((a, b) => rank(a.key) - rank(b.key))
    .map((t) => ({ key: t.key, ...(TOPIC_TILES[account][t.key] ?? { name: t.label, line: '' }) }));
}
