// Tour content lives in TypeScript source files, versioned in code, not in
// the database. The `tour_key` is namespaced (role + surface + version) so
// future content changes can bump the version without disturbing users who
// already dismissed the V1.
//
// Tour mechanics: a centered modal slide carousel (NOT Driver.js spotlight).
// The iteration 0030 spec leans toward Driver.js, but the team picked the
// simpler centered-modal pattern in the MVP — it works well for orientation
// (telling someone the lay of the land) and avoids brittle DOM-coupling.
// Mini-tours follow the same pattern.

import {
  Apple,
  Briefcase,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Mailbox,
  MessageSquare,
  PartyPopper,
  QrCode,
  Receipt,
  Send,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Table2,
  UserSquare,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export type TourSlide = {
  Icon: LucideIcon;
  title: string;
  body: string;
};

export type TourKey =
  // Role welcomes — fire once per user on first signed-in session for that role.
  | 'couple_welcome_v1'
  | 'admin_welcome_v1'
  | 'guest_welcome_v1'
  // Mini-tours — fire once per user when they first land on the surface.
  | 'customer_vendors_v1'
  | 'customer_seat_plan_v1'
  | 'admin_users_v1'
  | 'admin_force_majeure_v1';

export const TOUR_KEYS: ReadonlyArray<TourKey> = [
  'couple_welcome_v1',
  'admin_welcome_v1',
  'guest_welcome_v1',
  'customer_vendors_v1',
  'customer_seat_plan_v1',
  'admin_users_v1',
  'admin_force_majeure_v1',
];

export type TourDefinition = {
  key: TourKey;
  label: string;
  blurb: string;
  slides: ReadonlyArray<TourSlide>;
};

export const TOURS: Record<TourKey, TourDefinition> = {
  couple_welcome_v1: {
    key: 'couple_welcome_v1',
    label: 'Couple — welcome tour',
    blurb: 'Six-step intro to the couple dashboard. Fires on first sign-in.',
    slides: [
      {
        Icon: Sparkles,
        title: 'Welcome to Setnayan',
        body: "Your wedding, planned end-to-end in one place — guest list, invitations, vendors, budget, mood board, seating, day-of. Let&rsquo;s walk through what&rsquo;s where.",
      },
      {
        Icon: Users,
        title: 'Build your guest list',
        body: 'Add guests one at a time or import a CSV. Setnayan ships 18 Filipino wedding roles — maid of honor, principal sponsors, candle/veil/cord/coin, bearers, flower girl — plus plus-ones as first-class rows.',
      },
      {
        Icon: Send,
        title: 'Send branded invitations',
        body: 'Each guest gets a personal QR with your monogram in the center. Print the A4 sheet or share individual links — guests land on a personalized invitation site with RSVP, dress code, countdown.',
      },
      {
        Icon: Briefcase,
        title: 'Track vendors + budget',
        body: 'Move every vendor through a 6-stage flow (considering → complete) and itemize their costs into line items. Export upcoming payment due dates as a .ics file.',
      },
      {
        Icon: MessageSquare,
        title: 'Chat with vendors',
        body: 'Start a thread with any Setnayan vendor by their contact email. Identity stays masked — vendors see your event name, not your personal info, until you choose to share.',
      },
      {
        Icon: PartyPopper,
        title: 'On the day',
        body: 'From T-1 hour, the Day-of card shows you the timeline, lets you reach your coordinator, and surfaces the photo wall. Your guests get the same view, scoped to their seat + role.',
      },
    ],
  },
  admin_welcome_v1: {
    key: 'admin_welcome_v1',
    label: 'Admin — welcome tour',
    blurb: 'Five-step intro to the admin console. Fires on first sign-in as admin.',
    slides: [
      {
        Icon: Shield,
        title: 'Welcome to the admin console',
        body: 'Setnayan operations live here. You have access because your user row has <code>is_internal</code> or <code>is_team_member</code> set. Non-admins see a 404 instead.',
      },
      {
        Icon: Users,
        title: 'Eight day-to-day surfaces',
        body: 'Users · Events · Vendors · Verification · Payments · Payouts · Receipts · Reviews. These are your daily-driver tabs along the top — switch in one tap.',
      },
      {
        Icon: ShieldAlert,
        title: 'Force-majeure escalations',
        body: 'When a couple files a force-majeure flag, it lands in Force majeure. The 7-day clock starts; if vendors and couples don&rsquo;t resolve in chat, the flag escalates to you to mediate.',
      },
      {
        Icon: ShieldCheck,
        title: 'Two-admin major decisions',
        body: 'Routine ops are single-admin. Major decisions (ad activation, vendor verification override, refunds &gt; ₱100K, payment-method config) need a second admin to approve. Both identities are recorded.',
      },
      {
        Icon: ClipboardList,
        title: 'Funnels + Website + Settings',
        body: 'Funnels shows the 7 V1 conversion funnels. Website is where you reorder marketing-site widgets. Settings is your personal admin profile + theme. Read-only audit log lives on every detail page.',
      },
    ],
  },
  guest_welcome_v1: {
    key: 'guest_welcome_v1',
    label: 'Guest — welcome tour',
    blurb: 'Three-step intro shown the first time you open your invite link.',
    slides: [
      {
        Icon: Mailbox,
        title: "You&rsquo;re invited",
        body: "This is your personal Setnayan invitation page. Bookmark this URL — it&rsquo;s your one place for everything about the event (RSVP, schedule, venue, your seat).",
      },
      {
        Icon: CheckCircle2,
        title: 'RSVP whenever you&rsquo;re ready',
        body: 'Tap the RSVP button to say Yes, No, or Maybe. If your invite allows a plus-one, you can name them. You can change your answer up to the couple&rsquo;s cutoff.',
      },
      {
        Icon: PartyPopper,
        title: 'On the day, come back here',
        body: 'From one hour before the event, this same page shows you the live schedule, your table number, and (if enabled) the photo wall where everyone shares snaps.',
      },
    ],
  },
  customer_vendors_v1: {
    key: 'customer_vendors_v1',
    label: 'Vendors mini-tour',
    blurb: 'Quick walkthrough of the vendor management surface.',
    slides: [
      {
        Icon: Briefcase,
        title: 'Track every vendor here',
        body: 'Each vendor is a card with their category, cost, and stage. Tap a card to open their thread, log a payment, or move them to the next stage.',
      },
      {
        Icon: CheckCircle2,
        title: 'Six stages, one flow',
        body: 'Considering → Shortlisted → Contracted → Deposit paid → Delivered → Complete. Move forward when you make a decision; you can always step back.',
      },
      {
        Icon: Wallet,
        title: 'Costs roll up into Budget',
        body: 'Whatever you put in a vendor&rsquo;s total/deposit fields shows up on the Budget page. Update one place, both pages stay in sync.',
      },
    ],
  },
  customer_seat_plan_v1: {
    key: 'customer_seat_plan_v1',
    label: 'Seating mini-tour',
    blurb: 'How to use the drag-and-drop seating editor.',
    slides: [
      {
        Icon: Table2,
        title: 'Drag tables onto the canvas',
        body: 'Pick a table shape from the palette and drop it on the canvas. Rotate, resize, and label — the layout previews in real time.',
      },
      {
        Icon: Users,
        title: 'Tap a chair to seat a guest',
        body: "Empty chairs accept a single guest. Tap the chair, pick a guest from your list. Tap the table body to swap whole tables (e.g. swap the principal-sponsors table with the bride&rsquo;s family).",
      },
      {
        Icon: QrCode,
        title: 'Publish to mint QRs',
        body: "Once you publish, each guest&rsquo;s personal QR includes their seat assignment. The Day-of card on their personal page shows the table number with no extra setup.",
      },
    ],
  },
  admin_users_v1: {
    key: 'admin_users_v1',
    label: 'Admin users mini-tour',
    blurb: 'How to look someone up and act on their record.',
    slides: [
      {
        Icon: UserSquare,
        title: 'Search by name, email, or ID',
        body: 'The top search bar matches across display name, email, and public ID (S89U-xxxxxx). Partial matches work — type the first few characters.',
      },
      {
        Icon: ClipboardList,
        title: 'Every action is audited',
        body: 'Clicking through to a user record exposes Delete, Restore, Blacklist, and Note actions. Each writes a row to <code>admin_audit_log</code> with the actor + before/after JSON.',
      },
      {
        Icon: ShieldCheck,
        title: 'Delete vs blacklist',
        body: 'Delete = soft + 30-day restore window (RA 10173 right-to-erasure). Blacklist = permanent ban from re-signing-up with the same email/device. Default to delete; only blacklist after confirmed fraud.',
      },
    ],
  },
  admin_force_majeure_v1: {
    key: 'admin_force_majeure_v1',
    label: 'Force-majeure mini-tour',
    blurb: 'How escalations land and how you resolve them.',
    slides: [
      {
        Icon: ShieldAlert,
        title: 'The 7-day window',
        body: 'When a couple flags force majeure (typhoon, illness, venue closure), vendors get 7 days to propose terms directly. If a resolution lands in chat by day 7, the flag closes without you.',
      },
      {
        Icon: ClipboardList,
        title: "Escalated flags appear here",
        body: 'If day 7 passes with no resolution, the flag shows up in this queue with an ESCALATED tag. Open the row to see the evidence files, the affected vendors, and the chat history.',
      },
      {
        Icon: Receipt,
        title: 'Four resolution paths',
        body: 'Refund (vendor returns deposit minus expenses), Reschedule (services move to a new date), Substitute (equivalent service later), Partial (some delivered, some refunded). Pick one, both parties get an email.',
      },
    ],
  },
};

export function getTour(key: TourKey): TourDefinition {
  return TOURS[key];
}
