/**
 * 🧭 ONE ICON PER TOPIC, EVERYWHERE (Supplier Build 3 · lane B, owner 9 Nov 2026).
 *
 * Owner, on the prototype's pins (bell · clock · chain · bell · calendar) against the picked client's tab row:
 * *"should somewhat show similar on their logos. even the logos inside the details."* ⇒ a pin, a chat card, a Details
 * row and the tab of the same topic wear THE SAME icon. Payment due / confirm / receipt = the Payment tab's icon; a
 * quote change = Quotation; call time / meeting / schedule change = Schedule; a form = Forms; a saved photo =
 * Inspiration; guest count / date / people = Details; access = the chain; a decision = the Decisions mark; files =
 * the paperclip (owner: *"also the files shared?"*).
 *
 * 🔒 No pin, card or Details row picks its own glyph for a topic — `lib/one-icon-per-topic.test.ts` fails a chat part
 * that imports a topic glyph from `lucide-react` instead of reading this map.
 */
import {
  CalendarDays,
  ClipboardList,
  Flag,
  Hash,
  Heart,
  Info,
  LayoutDashboard,
  ListChecks,
  Link2,
  MessageSquare,
  Paperclip,
  ReceiptText,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export const CHAT_TOPICS = [
  'details',
  'chat',
  'schedule',
  'quote',
  'payment',
  'forms',
  'files',
  'inspiration',
  'access',
  'decision',
  'poll',
  'hub',
  'report',
] as const;
export type ChatTopic = (typeof CHAT_TOPICS)[number];

export const TOPIC_ICON: Record<ChatTopic, LucideIcon> = {
  details: Info,
  chat: MessageSquare,
  schedule: CalendarDays,
  quote: ReceiptText,
  payment: Wallet,
  forms: ClipboardList,
  files: Paperclip,
  inspiration: Heart,
  // Owner 8 Nov: "access can be the chain icon".
  access: Link2,
  decision: Hash,
  // 🗳 Owner 11 Nov (prototype chat_decisions_polls v1): a poll wears ListChecks; a decision keeps Hash.
  poll: ListChecks,
  hub: LayoutDashboard,
  report: Flag,
};

/** The word each topic goes by on a pin's kicker and a Details heading. */
export const TOPIC_LABEL: Record<ChatTopic, string> = {
  details: 'Details',
  chat: 'Chat',
  schedule: 'Schedule',
  quote: 'Quotation',
  payment: 'Payment',
  forms: 'Forms',
  files: 'Files',
  inspiration: 'Inspiration',
  access: 'Access',
  decision: 'Decision',
  poll: 'Poll',
  hub: 'Hub',
  report: 'Report',
};
