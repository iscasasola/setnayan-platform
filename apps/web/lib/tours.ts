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
  BookOpen,
  Briefcase,
  Calendar,
  Camera,
  CheckCircle2,
  EyeOff,
  Heart,
  Images,
  ClipboardList,
  LayoutPanelLeft,
  Maximize2,
  Mailbox,
  MessageSquare,
  MousePointerClick,
  Palette,
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
  Wand2,
  type LucideIcon,
} from 'lucide-react';

/**
 * ⚠ THE TWO TEXT FIELDS HAVE DIFFERENT CONTRACTS, AND THAT IS THE TRAP.
 *
 * `guided-tour.tsx` renders `title` as ordinary React text and `body` through
 * `dangerouslySetInnerHTML`. So in `body` an HTML entity resolves and a tag
 * works; in `title` **both come out as literal characters**.
 *
 * That is not theoretical: `guest_welcome_v1`'s first slide shipped as
 * `"You&rsquo;re invited"` and every guest opening their invitation was
 * greeted with the raw `&rsquo;` — while the body directly beneath it, written
 * the same way by the same hand, read correctly. One object, one style of
 * authoring, two outcomes, no signpost.
 *
 * ✅ TITLE — plain text. Type the real character: ’ “ ” — …  **never an entity.**
 * ✅ BODY  — HTML. Entities resolve, and two admin slides genuinely need tags
 *    (`<code>is_internal</code>`, `<code>admin_audit_log</code>`), which is why
 *    the dangerous render stays rather than being tidied away.
 *
 * `lib/tour-titles-are-text.test.ts` fails on any entity in a title.
 */
export type TourSlide = {
  Icon: LucideIcon;
  /** PLAIN TEXT — rendered as `{title}`. An HTML entity here shows literally. */
  title: string;
  /** HTML — rendered via dangerouslySetInnerHTML. Entities and tags both work. */
  body: string;
  /**
   * TRUE for a slide that sells something. The Event Hub Maker's tour drops it
   * in the app-store shell (App Review 3.1.1 — no digital price, no paid pitch)
   * and fills its `{price}` token from `platform_retail_catalog_v2`, never from
   * this file. `GuidedTour` drops it too when `MiniTour` is told the request is
   * the shell. Optional, so every older tour is untouched.
   */
  sells?: boolean;
};

export type TourKey =
  // Role welcomes — fire once per user on first signed-in session for that role.
  | 'couple_welcome_v1'
  | 'admin_welcome_v1'
  | 'guest_welcome_v1'
  | 'vendor_welcome_v1'
  // Mini-tours — fire once per user when they first land on the surface.
  | 'customer_vendors_v1'
  | 'customer_seat_plan_v1'
  | 'customer_papic_v1'
  | 'customer_love_story_v1'
  | 'customer_event_hub_maker_v1'
  | 'customer_post_event_v1'
  | 'admin_users_v1'
  | 'admin_force_majeure_v1';

export const TOUR_KEYS: ReadonlyArray<TourKey> = [
  'couple_welcome_v1',
  'admin_welcome_v1',
  'guest_welcome_v1',
  'vendor_welcome_v1',
  'customer_vendors_v1',
  'customer_seat_plan_v1',
  'customer_papic_v1',
  'customer_love_story_v1',
  'customer_event_hub_maker_v1',
  'customer_post_event_v1',
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
        // Corrected 2026-09-10. It said "by their contact email" (a couple is no
        // longer shown one — owner: "not to let them communicate outside the
        // app") and "Identity stays masked" (retired 2026-09-08 — a shop now
        // sees who is asking). Both were promises the product no longer makes.
        body: 'Message any Setnayan vendor from their page or your list. They reply here, and every message, quote and booking stays with your event.',
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
        title: "You’re invited",
        body: "This is your personal Setnayan invitation page. Bookmark this URL — it&rsquo;s your one place for everything about the event (RSVP, schedule, venue, your seat).",
      },
      {
        Icon: CheckCircle2,
        title: 'RSVP whenever you’re ready',
        body: 'Tap the RSVP button to say Yes, No, or Maybe. If your invite allows a plus-one, you can name them. You can change your answer up to the couple&rsquo;s cutoff.',
      },
      {
        Icon: PartyPopper,
        title: 'On the day, come back here',
        body: 'From one hour before the event, this same page shows you the live schedule, your table number, and (if enabled) the photo wall where everyone shares snaps.',
      },
    ],
  },
  // Added 2026-08-24 (W5-B). Couple, admin and guest each had a welcome tour;
  // the vendor — the role iteration 0030 gave the second-longest script — had
  // none at all. Claims below are verified against shipped behaviour: the
  // permanent shop address + admin-approval gate (owner 2026-07-27), per-service
  // schedules with auto-close + the booked-out waitlist (2026-08-09), free
  // answering on every tier (0 tokens ever; tokens retired 2026-08-07), and the
  // reply-time line on the public card (3+ replies floor, W3-B 2026-08-24).
  vendor_welcome_v1: {
    key: 'vendor_welcome_v1',
    label: 'Vendor — welcome tour',
    blurb: 'Five-step intro to the vendor dashboard. Fires on first sign-in.',
    slides: [
      {
        Icon: Sparkles,
        title: 'Welcome to your shop',
        body: 'Everything about your business on Setnayan runs from here — your services, your calendar, your customers, and the public page couples see.',
      },
      {
        Icon: Briefcase,
        title: 'My Shop is your storefront',
        body: 'Build service cards with photos, prices and what&rsquo;s included. Your shop address is yours for good — it goes live to couples once Setnayan approves your shop.',
      },
      {
        Icon: Calendar,
        title: 'Your calendar guards your dates',
        body: 'Set a schedule per service and block days off. When a booking locks, that date closes by itself — and couples who just missed it can join your waitlist.',
      },
      {
        Icon: MessageSquare,
        title: 'Answering is always free',
        body: 'Inquiries and bookings land in one place, and replying costs nothing on any plan. Couples see how quickly you usually reply once you&rsquo;ve built a track record — a fast answer works for you.',
      },
      {
        Icon: ShieldCheck,
        title: 'Get verified',
        body: 'Verification is what puts your shop in front of couples. Send your documents once from My Shop — Setnayan reviews them, and your page goes live.',
      },
    ],
  },
  // Rewritten 2026-08-24 for the Marketplace takeover (the surface a couple
  // actually sees — BUDGET_BUILD_ENABLED is live-by-default since 2026-06-09).
  // The original copy described the pre-2026-05-31 card/stage page and its
  // mount was deliberately removed when that page was replaced (879c1c138);
  // the copy was never rewritten, so the tour sat defined-but-unmounted.
  // ⚠ The takeover's section headings flip with isExploreReplanEnabled()
  // ("Build your team" ↔ "Your team") — this copy deliberately describes what
  // each section DOES rather than quoting a heading that can change under it.
  customer_vendors_v1: {
    key: 'customer_vendors_v1',
    label: 'Marketplace mini-tour',
    blurb: 'Quick walkthrough of the in-event supplier marketplace.',
    slides: [
      {
        Icon: Briefcase,
        title: 'Browse every category',
        body: 'Every supplier category for your celebration, in calm folders. Open one to see who you&rsquo;re considering, find more in the marketplace, or add someone you already know by hand.',
      },
      {
        Icon: CheckCircle2,
        title: 'Build your team',
        body: 'Your picks come together into one plan, with price ranges held up against your budget. Move a supplier forward when you decide — you can always step back.',
      },
      {
        Icon: Wallet,
        title: 'Save plans, compare, and see your spend',
        body: 'Save your team under a name and compare saved plans side by side. Your budget and payments live further down this same page, and they stay in sync on their own.',
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
  customer_papic_v1: {
    key: 'customer_papic_v1',
    label: 'Papic mini-tour',
    blurb: 'How candid photos get captured, tagged, and delivered.',
    slides: [
      {
        Icon: Camera,
        title: 'Your guests become the photographers',
        body: 'A few friends you pick shoot freely all night, and — if you add it — every guest can snap candids too. Every shot lands in your private gallery. No app to install.',
      },
      {
        Icon: Send,
        title: 'Hand out your photo-crew seats',
        body: 'Share each seat&rsquo;s link with a friend — their phone becomes a candid camera bound to your wedding. Re-issue a seat anytime. Your first 5 guest cameras are free to try.',
      },
      {
        Icon: Sparkles,
        title: 'The right people are found',
        body: 'Guests who add a selfie are recognized in candid shots — those photos show up in their &ldquo;Photos of you&rdquo;. Your crew can also scan a guest&rsquo;s QR to tag. Either way, every photo reaches you, tagged or not.',
      },
      {
        Icon: Images,
        title: 'Everything lands in your gallery',
        body: 'Filter by &ldquo;Photos of us&rdquo;, save any shot to your phone, or download the whole gallery as a zip. Connect Google Drive to auto-sync every photo to a folder you own.',
      },
    ],
  },
  /*
    OUR LOVE STORY (Event Hub Maker Phase 7; owner 2026-09-25: every feature
    gets a proper first-visit welcome). Slides per the build plan: a moment is
    anything · a year is enough · both of you can add · it becomes scenes on
    your Event Hub · five are free, more and your photos are Pro — that last
    one `sells`, so the app-store shell never shows it. No price is typed here.
  */
  customer_love_story_v1: {
    key: 'customer_love_story_v1',
    label: 'Our Love Story welcome',
    blurb: 'How moments become the story scenes on your Event Hub.',
    slides: [
      {
        Icon: Heart,
        title: 'A moment is anything',
        body: 'The jeepney ride where you met, the Sunday calls, the trip where it rained the whole time. Write it the way you would tell it to a friend.',
      },
      {
        Icon: Calendar,
        title: 'A year is enough',
        body: 'Only as exact as you remember &mdash; an exact day, a month, or just the year. Each moment finds its own chapter: before us, how we met, falling, the yes, toward the day.',
      },
      {
        Icon: Users,
        title: 'Both of you can add',
        body: 'Add moments in any order, whenever one comes back to you. Each one remembers who added it.',
      },
      {
        Icon: Images,
        title: 'It becomes scenes on your Event Hub',
        body: 'Every moment is one scene on your Invitation, in the order it happened and dressed in your Event Hub&rsquo;s theme. Keep any one off the hub with a tap.',
      },
      {
        Icon: Sparkles,
        title: 'Five stories are free',
        body: 'Tell up to five stories in your words for free. More stories and your own photos come with Event Hub Pro.',
        sells: true,
      },
    ],
  },
  /*
    THE EVENT HUB MAKER'S WELCOME (owner 2026-09-25: "for everything we have on
    the website. we always give them a proper tour/welcome so they understand
    how things work"). Slides per EVENT_HUB_MAKER_BUILD_PLAN Phase 1: what it
    does · the theme dresses the whole hub · tap anything · one place for the
    four stages · what Pro adds. Rendered by `launch/_components/maker-tour.tsx`
    in its own skin; the SYSTEM — this registry, `users.tour_seen_keys`,
    `completeTour` — is the shared one. Its last button reads "Start".
    ⛔ The Pro slide carries `sells` and a `{price}` token: dropped in the store
    shell, and the figure is read from the catalogue at render.
  */
  customer_event_hub_maker_v1: {
    key: 'customer_event_hub_maker_v1',
    label: 'Event Hub Maker welcome',
    blurb: 'How the Event Hub Maker builds your one link, stage by stage.',
    slides: [
      {
        Icon: Wand2,
        title: 'Your whole Event Hub, made in one place',
        body: 'The Save the Date, the Invitation, the day itself and the story after it are one link. This is where you make all of it &mdash; and you watch the real page change as you go.',
      },
      {
        Icon: Palette,
        title: 'Pick a theme and the whole hub is dressed',
        body: 'A theme sets the look of every stage at once &mdash; colours, lettering and how things move. Choose it once; everything follows.',
      },
      {
        Icon: MousePointerClick,
        title: 'Tap anything to edit it',
        body: 'Tap a scene on the left, or tap a section on the page itself, and its controls open beside it. The eye hides a scene from guests; drag a scene to move it.',
      },
      {
        Icon: LayoutPanelLeft,
        title: 'One place for the four stages',
        body: 'Save the Date &middot; Invitation &middot; On the Day &middot; Post Event sit along the top. Pick one and the canvas shows that stage, the way your guests will meet it.',
      },
      {
        Icon: Sparkles,
        title: 'What Event Hub Pro adds',
        body: 'Themes beyond Classic, the reveal that opens your invitation, your own photos and film as backgrounds, music and the animated logo &mdash; one unlock for every stage{price}.',
        sells: true,
      },
    ],
  },
  /* Event Hub Maker Phase 8 — Post Event as scenes, written for them. Shown on
     the couple's first Maker visit after the day (after the Maker's own welcome,
     never on top of it). The last slide names Pro and is marked `sells`, so the
     app-store shell drops it. */
  /* 2026-09-25 ("POST EVENT IS MANY SMALL SCENES"): Post Event is its scenes
     before the day too, and the couple edits them in the Maker — so this tour
     now also shows before the day, and it no longer sends anyone to the story
     workroom to hide or reorder. The slide that names Pro is `sells`. */
  customer_post_event_v1: {
    key: 'customer_post_event_v1',
    label: 'Post Event — your story after the day, scene by scene',
    blurb: 'How the story after the day is made of scenes you can arrange — written for you from what happened.',
    slides: [
      {
        Icon: BookOpen,
        title: 'Post Event is its own scenes',
        body: 'The story after your day is not one block: the cover, the chapters of your day, the gallery, the film, the wishes, your closing words and your song are each their own scene in the Event Hub Maker. After the day they are written for you from what happened &mdash; there is nothing to type.',
      },
      {
        Icon: EyeOff,
        title: 'Nothing there yet? It says so',
        body: 'Before your day, a scene that fills itself from the day is marked <b>Not yet</b> and says what will fill it &mdash; &ldquo;Your photos from the day appear here.&rdquo; After the day, one with nothing in it is <b>Skipped</b>. Your guests never meet an empty box.',
      },
      {
        Icon: Maximize2,
        title: 'Tap to open it full screen',
        body: 'The gallery, the film, Were you there? and the wishes open full screen on your page, and Back returns everyone to the same place. A guest&rsquo;s gallery shows <b>Yours</b> and <b>Everyone&rsquo;s</b>; a stranger sees only what is shared.',
      },
      {
        Icon: LayoutPanelLeft,
        title: 'Arrange it here, free',
        body: 'Tap a scene to hide it or move it earlier or later &mdash; free, right here in the Maker. It all goes into your draft, and your guests see it after you press <b>Apply</b>.',
      },
      {
        Icon: Sparkles,
        title: 'Add scenes of your own',
        body: 'Press <b>+ Add a scene</b> on Post Event for scenes made for the story after the day &mdash; a thank-you note, a letter, a gallery grid, a film, a wishes wall. Your own scenes come with Event Hub Pro: try one in your draft, and Apply asks for Pro before guests see it.',
        sells: true,
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
