// Tour content lives in TypeScript source files, versioned in code, not in
// the database. The `tour_key` is namespaced (role + surface + version) so
// future content changes can bump the version without disturbing users who
// already dismissed the V1.
//
// Tour mechanics — TWO SKINS, ONE SYSTEM (one key space, one "seen" store:
// `users.tour_seen_keys`, written by the shipped `completeTour`):
//   · `slides` — the centred carousel (`GuidedTour` / `MiniTour`). SWITCHED OFF
//     (`lib/tip-popups.ts`, owner 2026-10-03); its words stay as the script.
//   · `spotlight` — 🔦 THE SPOTLIGHT TOUR (owner-approved 2026-10-02, corpus
//     `prototypes/spotlight_tour_sample_2026-10-02.html`): the screen dims and a
//     white ring glides to the REAL button, found by its `data-tour` token.
//     Drawn by `app/_components/spotlight-tour.tsx`, mounted by
//     `spotlight-mount.tsx`. Its steps reuse the slides' words where they fit.

import { FREE_THEMES, themeNames } from '@/lib/invite-themes';
import { FIRST_BOOKING_ON_US } from '@/lib/booking-fee-lock';

import {
  Apple,
  BookOpen,
  Briefcase,
  Calendar,
  Camera,
  CheckCircle2,
  EyeOff,
  Gift,
  Heart,
  Images,
  Laptop,
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
  Ticket,
  UserSquare,
  Users,
  UtensilsCrossed,
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

/**
 * 🔦 ONE STEP OF A SPOTLIGHT TOUR. Both words are PLAIN TEXT (rendered as `{…}`,
 * never as HTML — unlike a slide body), so type the real character: ’ — …
 */
export type SpotlightStep = {
  /** The token on the real element: `data-tour="…"` (matched as `[data-tour~="…"]`). Never a line number, never a label. */
  anchor: string;
  title: string;
  body: string;
  /** A doorway (a tab, a link to the next page): Next walks through it too, as the sample's Next did. */
  go?: boolean;
  /** The line under the words, when this stop asks for something else than "Tap it yourself — or press Next" — a
      stop with nothing to tap says "Press Next" (the host page tours' prototype, 2026-10-22). Plain text. */
  hint?: string;
  /**
   * 👋 THE ONCE-ONLY WELCOME (owner 2026-10-21, prototype `first_run_you_and_next_steps_2026-10-21.html` P4 —
   * controller decision, owner may veto). Drawn with the SETNAYAN wordmark, larger, and "Welcome" in place of
   * "Step N of M"; not counted in the steps; `{name}` in the title is the person's display name ("Welcome,
   * Isabel"; no name → "Welcome"). Shown on the FIRST run only — a replay ("Show me around") skips it
   * (`spotlightSteps`).
   */
  welcome?: boolean;
};

/* The steps a run walks (the welcome on the first run only) — `lib/spotlight-steps.ts`, a file of its own so the
   client mount can take it without carrying every tour's words (`lib/tours-stay-on-the-server.test.ts`). */

/** The "You're set" card at the end, with the sample's confetti. */
export type SpotlightFinale = { title: string; body: string; button: string };

export type SpotlightScript = { steps: ReadonlyArray<SpotlightStep>; finale: SpotlightFinale };

export type TourKey =
  // Role welcomes — fire once per user on first signed-in session for that role.
  | 'couple_welcome_v1'
  | 'admin_welcome_v1'
  | 'guest_welcome_v1'
  | 'vendor_welcome_v1'
  // Mini-tours — fire once per user when they first land on the surface.
  // ── First-visit tours for five everyday surfaces (owner 2026-09-25: every
  //    feature gets a first-visit tour). Kept as ONE block so it merges
  //    cleanly beside other sessions' keys. The two `guest_` keys are for
  //    signed-out guests and mount through `GuestGuidedTour` (localStorage);
  //    the three `customer_` keys mount through `MiniTour`.
  | 'guest_papic_camera_v1'
  | 'guest_papic_me_v1'
  | 'customer_guest_list_v1'
  | 'customer_budget_v1'
  | 'customer_galleries_v1'
  | 'customer_seat_plan_v1'
  | 'customer_papic_v1'
  | 'customer_love_story_v1'
  | 'customer_event_hub_maker_v1'
  | 'customer_adaptive_theme_v1'
  | 'customer_post_event_v1'
  | 'customer_ombre_background_v1'
  | 'customer_details_bound_v1'
  | 'customer_pro_qr_v1'
  | 'customer_theme_picker_v1'
  | 'customer_print_menu_v1'
  | 'customer_details_guided_v1'
  | 'customer_print_story_poster_v1'
  | 'customer_schedule_v1'
  | 'customer_add_scene_v1'
  | 'customer_hero_designs_v1'
  | 'customer_people_v1'
  // 🔦 The account screens' spotlights (owner 2026-10-22, "have you updated our Help, all (i) and spotlight
  // tutorials?"): the account bar on the Events board, and People as it now looks. NEW keys — People was
  // redrawn on 2026-10-22, and the old carousel's words described the dropdown it removed.
  | 'customer_account_bar_v1'
  | 'customer_people_v2'
  | 'customer_guest_invite_v1'
  | 'customer_apply_pro_v1'
  | 'customer_event_menu_v1'
  | 'customer_wish_list_v1'
  | 'discover_upcoming_v1'
  | 'admin_users_v1'
  | 'admin_force_majeure_v1'
  // The supplier phone app (DECISION_LOG 2026-10-01 "THE SUPPLIER PHONE APP —
  // APPROVED, WITH THE THREE RECOMMENDED ANSWERS").
  | 'vendor_today_v1'
  | 'vendor_customers_v1'
  // The supplier dashboard redesign (corpus SUPPLIER_DASHBOARD_REDESIGN_2026-10-08
  // § 4 NEW 1): one slide each for Shop and the Event Hub. Registered in S-PR0;
  // each MOUNTS with the page it describes (S-PR6 · S-PR11), never before.
  | 'vendor_shop_v1'
  | 'vendor_hub_v1'
  // 🔦 Customers › Dates and Customers › Money — first-visit spotlights (owner
  // "Yes to all" 2026-10-22, journey_fixes Supplier 3), beside Shop and Hub.
  | 'vendor_dates_v1'
  | 'vendor_money_v1'
  // 🔦 The spotlight journeys (DECISION_LOG 2026-10-02 "NOBODY SHOULD LEAVE
  // BECAUSE THEY DON'T UNDERSTAND THE APP"): the host from creating the event
  // to Post Event, the supplier from shop set-up to payday. NEW keys, so a
  // person who skipped the old carousel still meets the spotlight once.
  | 'host_spotlight_v1'
  | 'host_day_spotlight_v1'
  | 'supplier_spotlight_v1'
  // 🔦 The host's page tours (owner "yes to all" 2026-10-22, prototype
  // `journey_fixes_later_2026-10-22.html` § Host 4): the Maker, Budget, Papic,
  // Seat plan and Mood Board, each a first-visit spotlight AFTER the journey
  // (`lib/host-page-tours.ts`), none repeating its stops. NEW keys, so a host
  // who once dismissed the old carousel still meets the spotlight once.
  | 'customer_event_hub_maker_v2'
  | 'customer_budget_v2'
  | 'customer_papic_v2'
  | 'customer_seat_plan_v2'
  | 'customer_mood_board_v1';

export const TOUR_KEYS: ReadonlyArray<TourKey> = [
  'couple_welcome_v1',
  'admin_welcome_v1',
  'guest_welcome_v1',
  'vendor_welcome_v1',
  'guest_papic_camera_v1',
  'guest_papic_me_v1',
  'customer_guest_list_v1',
  'customer_budget_v1',
  'customer_galleries_v1',
  'customer_seat_plan_v1',
  'customer_papic_v1',
  'customer_love_story_v1',
  'customer_event_hub_maker_v1',
  'customer_adaptive_theme_v1',
  'customer_post_event_v1',
  'customer_ombre_background_v1',
  'customer_details_bound_v1',
  'customer_pro_qr_v1',
  'customer_theme_picker_v1',
  'customer_print_menu_v1',
  'customer_details_guided_v1',
  'customer_print_story_poster_v1',
  'customer_schedule_v1',
  'customer_add_scene_v1',
  'customer_hero_designs_v1',
  'customer_people_v1',
  'customer_account_bar_v1',
  'customer_people_v2',
  'customer_guest_invite_v1',
  'customer_apply_pro_v1',
  'customer_event_menu_v1',
  'customer_wish_list_v1',
  'discover_upcoming_v1',
  'admin_users_v1',
  'admin_force_majeure_v1',
  'vendor_today_v1',
  'vendor_customers_v1',
  'vendor_shop_v1',
  'vendor_hub_v1',
  'vendor_dates_v1',
  'vendor_money_v1',
  'host_spotlight_v1',
  'host_day_spotlight_v1',
  'supplier_spotlight_v1',
  'customer_event_hub_maker_v2',
  'customer_budget_v2',
  'customer_papic_v2',
  'customer_seat_plan_v2',
  'customer_mood_board_v1',
];

export type TourDefinition = {
  key: TourKey;
  label: string;
  blurb: string;
  slides: ReadonlyArray<TourSlide>;
  /** 🔦 Present → this tour is drawn as the SPOTLIGHT (`spotlight-mount.tsx`). */
  spotlight?: SpotlightScript;
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
        body: "Your wedding, planned end-to-end in one place — guest list, invitations, suppliers, budget, mood board, seating, day-of. Let&rsquo;s walk through what&rsquo;s where.",
      },
      {
        Icon: Users,
        title: 'Build your guest list',
        body: 'Add guests one at a time or import a CSV. More than 30 Filipino wedding roles are built in — maid, matron or man of honor, principal sponsors, candle/veil/cord/coin, bearers, flower girl — and each plus-one gets a seat of their own.',
      },
      {
        Icon: Send,
        title: 'Send branded invitations',
        body: 'Each guest gets a personal QR with your monogram in the center. Print the A4 sheet or share individual links — guests land on their own invitation on your Event Hub, with RSVP, dress code and a countdown.',
      },
      {
        Icon: Briefcase,
        title: 'Track suppliers + budget',
        body: 'Move every supplier through a 6-stage flow (considering → complete) and itemize their costs into line items. Export upcoming payment due dates as a .ics file.',
      },
      {
        Icon: MessageSquare,
        title: 'Chat with suppliers',
        // Corrected 2026-09-10. It said "by their contact email" (a couple is no
        // longer shown one — owner: "not to let them communicate outside the
        // app") and "Identity stays masked" (retired 2026-09-08 — a shop now
        // sees who is asking). Both were promises the product no longer makes.
        body: 'Message any Setnayan supplier from their page or your list. They reply here, and every message, quote and booking stays with your event.',
      },
      {
        Icon: PartyPopper,
        title: 'The Day',
        body: 'From noon the day before, the Day-of card shows you the timeline, lets you reach your coordinator, and surfaces the photo wall. Your guests get the same view, scoped to their seat + role.',
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
        body: 'Users · Events · Suppliers · Verification · Payments · Payouts · Receipts · Reviews. These are your daily-driver tabs along the top — switch in one tap.',
      },
      {
        Icon: ShieldAlert,
        title: 'Force-majeure escalations',
        body: 'When a couple files a force-majeure flag, it lands in Force majeure. The 7-day clock starts; if suppliers and couples don&rsquo;t resolve in chat, the flag escalates to you to mediate.',
      },
      {
        Icon: ShieldCheck,
        title: 'Two-admin major decisions',
        body: 'Routine ops are single-admin. Major decisions (ad activation, supplier verification override, refunds &gt; ₱100K, payment-method config) need a second admin to approve. Both identities are recorded.',
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
        body: 'Tap the RSVP button to say Yes or No. If your invite allows a plus-one, you can name them. You can change your answer up to the couple&rsquo;s cutoff.',
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
    label: 'Supplier — welcome tour',
    blurb: 'Five-step intro to the supplier dashboard. Fires on first sign-in.',
    slides: [
      {
        Icon: Sparkles,
        title: 'Welcome to your shop',
        body: 'Everything about your business on Setnayan runs from here — your services, your calendar, your customers, and the public page couples see.',
      },
      {
        Icon: Briefcase,
        title: 'Shop is your storefront',
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
        body: 'Verification is what puts your shop in front of couples. Send your documents once from Shop — Setnayan reviews them, and your page goes live.',
      },
    ],
  },
  // Rewritten 2026-08-24 for the Marketplace takeover (the surface a couple
  // actually sees — BUDGET_BUILD_ENABLED is live-by-default since 2026-06-09).
  // customer_vendors_v1 RETIRED 2026-10-02 (first-timer fix 23): its three
  // slides narrated the desktop page ("Browse every category", "Build your
  // team", "Save plans, compare") on a phone whose Suppliers page shows none of
  // that. It waits for the spotlight tour; a tour that describes another screen
  // is worse than none.
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
  // Copy refreshed 2026-09-30: the old slides still sold "photo-crew seats",
  // "5 guest cameras free" and "your wedding" — the seat hand-out is retired
  // and Papic runs on every event type. These words match the Papic page as it
  // ships: cameras, camera QRs, credits, the shooting days, the library.
  customer_papic_v1: {
    key: 'customer_papic_v1',
    label: 'Papic mini-tour',
    blurb: 'How candid photos get captured, tagged, and delivered.',
    slides: [
      {
        Icon: Camera,
        title: 'Your guests become the photographers',
        body: 'Every guest&rsquo;s phone can be a candid camera &mdash; no app to install. Every shot lands in your library.',
      },
      {
        Icon: Calendar,
        title: 'Pick the days first',
        body: 'Choose when the cameras can shoot. They can start before the day itself, so they catch the preparations too.',
      },
      {
        Icon: QrCode,
        title: 'Hand out your camera QRs',
        body: 'Show the QR codes at the door or print them as cards. Each scan turns a phone into a camera, and you decide how many credits each guest gets.',
      },
      {
        Icon: Images,
        title: 'Everything lands in your library',
        body: 'Filter by &ldquo;Photos of us&rdquo;, save any shot to your phone, or download everything at once. Guests find the photos they are in, too.',
      },
    ],
  },
  // ── The five first-visit tours (see the TourKey block). Plain words, no
  //    "wedding", no "couple" — each surface serves every event type.
  guest_papic_camera_v1: {
    key: 'guest_papic_camera_v1',
    label: 'Papic guest camera',
    blurb: 'A guest’s first look at the camera on their phone.',
    slides: [
      {
        Icon: Camera,
        title: 'Your phone is a camera now',
        body: 'Everything you shoot here goes straight to the host&rsquo;s gallery. No app to install, nothing to sign up for.',
      },
      {
        Icon: MousePointerClick,
        title: 'Tap for a photo, hold for a clip',
        body: 'Tap the big button for a photo. Press and hold it to record a short clip of up to 10 seconds.',
      },
      {
        Icon: QrCode,
        title: 'Tag who is in it',
        body: 'Right after a shot, point at a guest&rsquo;s QR or a table sign, and the photo reaches them too.',
      },
      {
        Icon: Images,
        title: 'Shoot while there are credits left',
        body: 'The camera shows how many shots are left. When they run out, it rests &mdash; enjoy the rest of the day.',
      },
    ],
  },
  guest_papic_me_v1: {
    key: 'guest_papic_me_v1',
    label: 'Papic — your camera and photos',
    blurb: 'A guest’s own camera and the photos they are in, from their personal QR.',
    slides: [
      {
        Icon: Camera,
        title: 'Your own camera',
        body: 'Tap <b>Open my camera</b> and your phone shoots straight into the host&rsquo;s gallery.',
      },
      {
        Icon: Images,
        title: 'Photos of you',
        body: 'When someone takes a photo you are in, it shows up here, in the order the day happened.',
      },
      {
        Icon: Heart,
        title: 'Keep them and make them yours',
        body: 'Tap a photo to save it full size, or download all of yours at once. You can also decorate one, or make a short story from them.',
      },
    ],
  },
  customer_guest_list_v1: {
    key: 'customer_guest_list_v1',
    label: 'Guest list',
    blurb: 'Adding guests, finding anyone, sending invitations and checking people in.',
    slides: [
      {
        Icon: Users,
        title: 'Everyone in one list',
        body: 'Add guests one by one, pick them from your people, or bring a whole list in at once. Each guest gets their own invitation and QR.',
      },
      {
        Icon: ClipboardList,
        title: 'Find anyone fast',
        body: 'Search by name, or filter by side, reply, role or group. Tap a name to open that guest&rsquo;s card.',
      },
      {
        Icon: Send,
        title: 'Send invitations, see replies',
        body: 'Send each invitation from here and watch the replies come in, guest by guest.',
      },
      {
        Icon: QrCode,
        title: 'Check-in on the day',
        body: 'On the day, check guests in here by scanning the QR on their invitation.',
      },
    ],
  },
  customer_budget_v1: {
    key: 'customer_budget_v1',
    label: 'Budget',
    // Rewritten 2026-10-18 (Budget B5) to the page that ships: the estimates
    // split these slides described ("Start with one number" · "Adjust any
    // service" — Save · Standard · Splurge) left the page in B2 (owner: "not
    // this one"). Words verbatim from the approved prototype's first-visit tour
    // (`prototypes/budget_page_2026-10-08_fable.html`, `TOUR`).
    blurb: 'One list of what you booked, bought and added — the totals are its sum.',
    slides: [
      {
        Icon: ClipboardList,
        title: 'One list, one truth',
        body: 'Booked suppliers, what you bought here, and your own expenses. The numbers up top are the sum of this list.',
      },
      {
        Icon: Briefcase,
        title: 'Tap a supplier',
        body: 'See every payment and record one. Owed moves the moment you do.',
      },
      {
        Icon: Receipt,
        title: 'Add anything else',
        body: '＋ Add expense for what you pay outside Setnayan. No Save button — it keeps as you type.',
      },
    ],
  },
  customer_galleries_v1: {
    key: 'customer_galleries_v1',
    label: 'Galleries',
    blurb: 'Where every collected photo and recording from the event is found.',
    slides: [
      {
        Icon: Images,
        title: 'Every photo in one place',
        body: 'Papic photos, your live stream recording and the photos you add each have their own gallery here.',
      },
      {
        Icon: Calendar,
        title: 'Collecting, then Ready',
        body: 'A gallery says <b>Collecting</b> until photos arrive, then <b>Ready</b>. Photos can keep arriving for a few days after the event.',
      },
      {
        Icon: CheckCircle2,
        title: 'Open one to keep it',
        body: 'Open a gallery to look through it and download everything.',
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
  /*
    THE MAKER'S TOUR, SHORT (owner 2026-10-02, "SIMPLIFY FIRST, THEN TOUR";
    FIRST_TIMER_TEST fix 6 — the 5-slide welcome that opened before the first
    tap and ended on "What Event Hub Pro adds" scored the invitation HARD).
    It no longer opens on a first visit at all: the Maker shows one quiet line,
    "Tap anything to change it", and this plays only from ⋯ › About the Maker.
    No Pro slide — Pro is met where it is tried (◆ PRO on the thing, Apply asks).
  */
  customer_event_hub_maker_v1: {
    key: 'customer_event_hub_maker_v1',
    label: 'Event Hub Maker welcome',
    blurb: 'Tap anything to change it — then Apply.',
    slides: [
      {
        Icon: MousePointerClick,
        title: 'Tap anything to change it',
        body: 'Tap words on the page to type over them, or tap a scene for its settings. Your guests see nothing until you press <b>Apply</b>.',
      },
      {
        Icon: LayoutPanelLeft,
        title: 'Page, Look and Event Details',
        body: '<b>Page</b> picks what you are looking at. <b>Look</b> dresses the whole Event Hub. <b>Event Details</b> holds the facts &mdash; names, date, places &mdash; shown on every page.',
      },
    ],
  },
  /*
    THE ADAPTIVE THEME'S FIRST-VISIT HINT (Maker Phase 10; owner 2026-09-25
    "every feature gets a first-visit tour"). Mounted inside the Maker's "Behind
    every scene" panel, so it opens the first time the couple opens Main —
    not on top of the Maker's own welcome. The panel is hidden in the store
    shell, and its Pro slide carries `sells` besides.
  */
  customer_adaptive_theme_v1: {
    key: 'customer_adaptive_theme_v1',
    label: 'Behind every scene',
    blurb: 'Your hero goes behind every scene, and your buttons follow its colours.',
    slides: [
      {
        Icon: Palette,
        title: 'Your hero, behind every scene',
        body: 'The photo you put on your hero also sits behind every scene &mdash; change it once, in Hero, and it changes everywhere. Your buttons and accents take on its colours, while the lettering stays as you set it.',
      },
      {
        Icon: CheckCircle2,
        title: 'Your words always read',
        body: 'We check the photo and lay a soft veil so every word stays easy to read. You can keep your own colours any time, or put a moving background, a different clip or a photo behind the page.',
      },
      {
        Icon: Sparkles,
        title: 'Try it now, keep it with Event Hub Pro',
        body: 'Try it in your draft &mdash; only you see it. It goes live for your guests when you Apply with Event Hub Pro.',
        sells: true,
      },
    ],
  },
  /* Event Hub Maker Phase 8 — Post Event as scenes, written for them. Shown on
     the couple's first Maker visit after the day (after the Maker's own welcome,
     never on top of it). The last slide names Pro and is marked `sells`, so the
     app-store shell drops it. */
  customer_post_event_v1: {
    key: 'customer_post_event_v1',
    label: 'Post Event — your story after the day, scene by scene',
    blurb: 'How the story after the day is made of scenes you can style, arrange and add to — written for you from what happened.',
    slides: [
      {
        Icon: BookOpen,
        title: 'Post Event is its own scenes',
        body: 'The story after your day is not one block: the front page, the road to the day, the numbers, each chapter, the gallery, the notes, your thank-you &mdash; each is its own scene here. After the day they are written for you from what happened; there is nothing to type.',
      },
      {
        Icon: EyeOff,
        title: 'Nothing there yet? It says so',
        body: 'Before your day, a scene that fills itself from the day is marked <b>Not yet</b> and says what will fill it. After the day, one with nothing in it is <b>Skipped</b>. Your guests never meet an empty box.',
      },
      {
        Icon: Maximize2,
        title: 'Tap to open it full screen',
        body: 'The gallery, the film, Were you there? and the wishes open full screen on your page, and Back returns everyone to the same place. A guest&rsquo;s gallery shows <b>Yours</b> and <b>Everyone&rsquo;s</b>; a stranger sees only what is shared.',
      },
      {
        Icon: Sparkles,
        title: 'Free — and yours to change, right here',
        body: 'Tap a scene to pick its <b>Style</b>, hide it, or move it earlier or later &mdash; all free, all in your draft until you press <b>Apply</b>. Tap any part to change its words.',
      },
      {
        Icon: Users,
        title: 'Your guests’ bar after the day',
        body: 'After the day your guests move through the story with <b>Recap · Film · Suppliers · Gallery · Me</b>. A slot with nothing behind it is simply not there, and the camera is put away &mdash; yours stays.',
      },
      {
        Icon: Wand2,
        title: 'Add scenes made for after the day',
        body: 'Press <b>+ Add a scene</b> on Post Event for twelve scenes made for the story after the day &mdash; The Toast, Before &amp; After, By Our Count, Since Then and more. Each is &#9670; Event Hub Pro: try one in your draft now, and Pro is asked for when you press <b>Apply</b>. A Pro theme, a part&rsquo;s own font and your own photos come with Pro too.',
        sells: true,
      },
    ],
  },
  /*
    THE BACKGROUND'S FIRST-VISIT HINT (owner 2026-09-25: "so the pick a color,
    and you apply either plain, dawn, diagonal or glow effect. that's it" ·
    "every feature gets a first-visit tour"). Mounted beside the Maker's Colors panel. It sells nothing — the
    ombré ships free (`OMBRE_IS_PRO`, lib/ombre.ts) — so the store shell keeps
    every slide.
  */
  customer_ombre_background_v1: {
    key: 'customer_ombre_background_v1',
    label: 'One colour, one effect',
    blurb: 'Pick a colour, then Plain, Dawn, Diagonal or Glow.',
    slides: [
      {
        Icon: Palette,
        title: 'One colour, one effect',
        body: 'Pick a colour, then choose how it sits on the page: Plain, or a soft blend &mdash; Dawn, Diagonal or Glow &mdash; made from that one colour, the way a wallpaper fades.',
      },
      {
        Icon: CheckCircle2,
        title: 'Your words always read',
        body: 'We measure the whole blend and choose the ink that reads on it. If your own colours sit too close to the words, a soft veil is added for you.',
      },
    ],
  },
  /*
    DETAILS IS THE SOURCE (owner 2026-09-25: *"any edits on details will reflect
    across the stages and prints. but if the edit that part on the scene itself,
    they will ask if do you want to update details and apply to all or just
    here"*). Mounted in a bound scene's Content tab (`details-bound-field.tsx`),
    so it fires the first time a couple opens one. Sells nothing — words are free.
  */
  customer_details_bound_v1: {
    key: 'customer_details_bound_v1',
    label: 'Everywhere, or just here',
    blurb: 'A scene that shows a Details fact asks where a change should go.',
    slides: [
      {
        Icon: MessageSquare,
        title: 'Written once',
        body: 'Your special message is written once, and every scene that shows it follows — and so does your printed Finer Details card.',
      },
      {
        Icon: MousePointerClick,
        title: 'Everywhere, or just here',
        body: 'Change it on a scene and we ask: <strong>Change it everywhere</strong> changes it on every scene and your prints, or <strong>Just this scene</strong> keeps a version for this scene only. Tap <strong>&#8634; Use your message</strong> to bring the scene back in line.',
      },
      {
        Icon: CheckCircle2,
        title: 'Nothing goes live yet',
        body: 'Every change waits in your draft. Guests see it after you Apply.',
      },
    ],
  },
  customer_pro_qr_v1: {
    key: 'customer_pro_qr_v1',
    label: 'Your QR code',
    blurb: 'First visit to the Details page: what the QR carries, and what Event Hub Pro lets you change.',
    slides: [
      {
        Icon: QrCode,
        title: 'One code, on everything',
        body: 'Every printed piece and every guest pass carries this QR. Guests scan it to open your Event Hub — the same code here, on the poster, on the passes.',
      },
      {
        Icon: Sparkles,
        title: 'Your logo in the centre',
        // A pitch: dropped in the app-store shell, price never written here.
        sells: true,
        body: 'Free codes carry the Setnayan mark. With <strong>Event Hub Pro</strong> the centre carries your own logo, and you pick the shape (square or circle), the pattern and a colour from your Mood Board.',
      },
      {
        Icon: CheckCircle2,
        title: 'It always scans',
        body: 'Every look is checked to scan before it ships — the corners stay sharp, the logo stays small, and only colours dark enough to read are offered. A change here saves straight away and every print follows.',
      },
    ],
  },
  /*
    🎨 THE THEME PICKER, ON DETAILS (owner 2026-09-28: *"a complete preview of
    what each theme would look like"*). Mounted beside the picker in the
    Maker's Details page (`maker-details.tsx`); the QR tour on the same page
    waits for this one (`MiniTour` `after`), so two never stack.
  */
  customer_theme_picker_v1: {
    key: 'customer_theme_picker_v1',
    label: 'Your theme',
    blurb: 'First visit to Details: each theme on our sample Event Hub, and a tap to wear it.',
    slides: [
      {
        Icon: Palette,
        title: 'Every theme, on a sample Event Hub',
        body: 'Each entry is our sample Event Hub, <strong>Maria &amp; Jose</strong>, in that theme — its Event Hub and its prints. Tap &#10530; to see one full screen; looking changes nothing.',
      },
      {
        Icon: CheckCircle2,
        title: 'Tap to wear it',
        body: 'A tap puts the theme on your own Event Hub and every print. <strong>Undo</strong> steps it back, and guests see it when you press <strong>Apply</strong>.',
      },
      {
        Icon: Sparkles,
        // The free themes from the registry (owner 2026-09-29), never typed.
        title: `${themeNames(FREE_THEMES)} are free`,
        // A pitch: dropped in the app-store shell, price never written here.
        sells: true,
        // Tried free, paid at Apply (owner 2026-09-28, PR #6091): a Pro theme is
        // picked like any other and waits in the draft — no padlock, no detour.
        body: 'The others are marked <strong>&#9670; PRO</strong>. Try one on your page for free &mdash; it waits in your draft, and <strong>Event Hub Pro</strong> puts it live when you press Apply.',
      },
    ],
  },
  /*
    THE MENU CARD (owner 2026-09-28: *"add to print out our meals for tonight.
    from vendors from ceremony, to cocktail to the buffet."*). Mounted on the
    Details page's Menu item (`maker-details.tsx` — Prints & Tickets folded into
    Details 2026-09-28), so it fires the first time a couple opens the Menu.
    Sells nothing — the Menu prints free in Classic.
  */
  customer_print_menu_v1: {
    key: 'customer_print_menu_v1',
    label: 'Your menu card',
    blurb: 'The meals of your night, by moment, on a card in your theme.',
    slides: [
      {
        Icon: UtensilsCrossed,
        title: 'The meals of your night',
        body: 'Add the moments of your night — cocktails, the buffet, dessert — in the order they happen, and the dishes of each. They print as <strong>The Menu</strong>, in your theme.',
      },
      {
        Icon: Calendar,
        title: 'Started from your plans',
        body: 'The moments come from your schedule, and if your caterer&rsquo;s package is booked on Setnayan its dishes start the list. Change anything — your version is what prints.',
      },
      {
        Icon: CheckCircle2,
        title: 'Offered once it has a dish',
        body: 'An empty menu is never printed. Until you add a dish, its card shows where your menu will go.',
      },
    ],
  },
  /*
    🪜 WHAT'S LEFT — THE GUIDED FLOW (owner 2026-09-29: *"it needs to be very
    easy"* · *"they can still pick a step anytime?"*; Details part 5). Mounted
    on the flow's progress line (`details-guide.tsx`, via `maker-details.tsx`),
    never on the Maker's very first visit — its own welcome goes first. Sells
    nothing.
  */
  customer_details_guided_v1: {
    key: 'customer_details_guided_v1',
    label: 'What’s left',
    blurb: 'Your Event Hub one thing at a time, in three rounds — and any step whenever you like.',
    slides: [
      {
        Icon: CheckCircle2,
        title: 'One thing at a time',
        body: 'Each screen is one thing to fill in &mdash; your names, your date, your look. Press <strong>Next</strong> for the next thing still to do, or <strong>Skip for now</strong> to leave it on your list.',
      },
      {
        Icon: Send,
        title: 'Three rounds, each ready to send',
        body: 'Round 1 gets your <strong>Save the Date</strong> ready, Round 2 your <strong>invitations</strong>, Round 3 <strong>the day</strong>. Each ends with <strong>Apply</strong>, which puts it live for your guests.',
      },
      {
        Icon: ClipboardList,
        title: 'Any step, any time',
        body: 'Tap the <strong>Round</strong> line at the top to see every step, each marked &#10003; or &#9675;, and jump to any of them. <strong>All items</strong> shows everything at once.',
      },
    ],
  },
  /*
    THE OUR STORY POSTER (owner 2026-09-26: *"is it possible to generate a A3
    printable of their stories? so they can print it and frame it?"*). Mounted
    on Details › Our Story poster after the Menu's tour (`after`), so the two
    never stack on one first visit. Sells nothing — it prints free in the free themes.
  */
  customer_print_story_poster_v1: {
    key: 'customer_print_story_poster_v1',
    label: 'Your Our Story poster',
    blurb: 'Your Love Story on an A3 poster in your theme, ready to frame.',
    slides: [
      {
        Icon: BookOpen,
        title: 'Your story, ready to frame',
        body: 'Your <strong>Love Story</strong> prints as an A3 poster in your theme &mdash; every chapter, with each moment&rsquo;s date, words and place.',
      },
      {
        Icon: Heart,
        title: 'Written once, in Love Story',
        body: 'The poster reads the moments you wrote in the Maker&rsquo;s Love Story. Change a moment there and the poster follows; a moment you hid stays off it.',
      },
      {
        Icon: CheckCircle2,
        title: 'Offered once there is a story',
        body: 'An empty poster is never printed. Until you add a moment, its card shows where your story will go.',
      },
    ],
  },
  // 📮 `customer_guest_reminders_v1` retired 2026-09-29 with the switch it
  // taught — no email to guests (owner ruling, DECISION_LOG "NO EMAIL TO GUESTS").
  /*
    THE SCHEDULE'S FIRST VISIT (Schedule rebuild slice 1, 2026-09-27; owner
    2026-09-25: every feature gets a first-visit tour). One slide per thing the
    rebuilt page asks the couple to learn: the rail, tap-and-drag, the eye,
    suppliers' requests, Announce. Sells nothing, so the store shell keeps all.
  */
  customer_schedule_v1: {
    key: 'customer_schedule_v1',
    label: 'Your schedule, as the day',
    blurb: 'The day drawn as a rail — tap, drag, show to guests, announce.',
    slides: [
      {
        Icon: Calendar,
        title: 'Your day, drawn as it runs',
        body: 'Event Day shows your day as a rail of time: each moment starts where its top sits and runs as long as it is tall. Journey is what already happened on the way; Preparation is what is still due.',
      },
      {
        Icon: MousePointerClick,
        title: 'Tap to change, drag to move',
        body: 'Tap a moment to change it. Drag it to move it, or drag its top or bottom edge to change how long it runs &mdash; everything lands on five minutes. Tap an empty time to add a moment there. On a phone, tap a moment first, then drag it.',
      },
      {
        Icon: EyeOff,
        title: 'The eye decides what guests see',
        body: 'A moment with the eye open shows on your Event Hub, with a live &ldquo;happening now&rdquo; on the day. Close the eye to keep it between you, your coordinator and the suppliers you tag.',
      },
      {
        Icon: MessageSquare,
        title: 'Suppliers ask, you decide',
        body: 'When a booked supplier asks for a change, it appears as a dashed moment where they asked, and in Requests. Approve or decline &mdash; they are told either way, and they never change your schedule themselves.',
      },
      {
        Icon: Send,
        title: 'Announce to your guests',
        body: 'Tap <b>Announce</b> to send everyone one message &mdash; before the day or on it. Your latest announcement sits at the top of your guests&rsquo; Event Hub as soon as you send it, and comes down once the event is over. You and your approved coordinator can announce.',
      },
    ],
  },
  /*
    "+ ADD A SCENE" WORKS IN THE EVENT HUB MAKER (DECISION_LOG 2026-09-27; owner:
    *"yes add the add a scene"*). Mounted inside the template sheet
    (`scene-template-picker.tsx`), so it fires the first time a couple opens it
    — from the toolbar's ＋, the phone's More ▾ row, or the navigator's button.
    The sheet is already Pro's (a free couple sees the padlock, never the sheet),
    so this sells nothing.
  */
  customer_add_scene_v1: {
    key: 'customer_add_scene_v1',
    label: 'Add a scene',
    blurb: 'Pick a template; the scene joins this stage in your draft.',
    slides: [
      {
        Icon: LayoutPanelLeft,
        title: 'Pick a template',
        body: 'Twenty-five templates in five families, drawn as they will look on a desktop or a phone. Tap one and it becomes a scene of your own on the stage you are editing.',
      },
      {
        Icon: MousePointerClick,
        title: 'It lands on the canvas, selected',
        body: 'The new scene appears at the end of this stage and opens for editing at once &mdash; change its words, its look and its effect from the panel. Up to six scenes of your own.',
      },
      {
        Icon: CheckCircle2,
        title: 'Nothing goes live yet',
        body: 'The scene waits in your draft. Guests meet it after you Apply; Restore folds it away as hidden until you show it again.',
      },
    ],
  },
  /* 🎴 THE HERO'S FOUR DESIGNS (owner 2026-09-26: "designs are the initial
     design, they can always improve it"; 2026-09-25: every feature gets a
     first-visit tour). Mounted on the Maker's Hero page beside the Design
     dropdown (`maker-hero-design.tsx`); it sells nothing — a design is free,
     and it says only what a tap on the canvas already does. */
  customer_hero_designs_v1: {
    key: 'customer_hero_designs_v1',
    label: 'Your hero, four ways',
    blurb: 'Pick a design for your hero, then change any part of it.',
    slides: [
      {
        Icon: LayoutPanelLeft,
        title: 'Four designs, one hero',
        body: 'Design lays out your names, your mark, the line and the date four ways &mdash; The Card, The Marquee, The Crest and The Letter. Pick one from the Design dropdown; it shows on every stage and your poster.',
      },
      {
        Icon: MousePointerClick,
        title: 'A design is a starting point',
        body: 'Tap any part of your hero on the canvas &mdash; a name, the date, your mark &mdash; to change its font, colour, size or motion. Your changes stay with each part when you switch designs.',
      },
    ],
  },
  // People, one place, one picker (owner 2026-09-28, the People redesign —
  // slides ①②③ on frame B of people-redesign.html).
  /* 📨 THE GUEST LIST'S INVITE COLUMN (owner 2026-09-30: *"the personal QR is
     found on the guest list … and instructions on how to use it"*). Mounted on
     the Guest list (`guests/page.tsx`). No "email": Setnayan sends guests
     nothing — every invite leaves from the couple's own phone. */
  customer_guest_invite_v1: {
    key: 'customer_guest_invite_v1',
    label: 'Guest list — Invite',
    blurb: 'Sending each guest their own message and Digital ticket from the Invite column.',
    slides: [
      {
        Icon: Ticket,
        title: 'Each guest has their own ticket',
        body: 'Every guest on your list has a personal link and Digital ticket. The ticket opens their own invitation, and it is their pass at the door.',
      },
      {
        Icon: Send,
        title: 'Tap Invite to send it',
        body: 'Tap Invite, then <b>Share</b> &mdash; pick Messenger, Viber or any app, and the message and their ticket go together. <b>Copy invitation link</b> gives you just their link.',
      },
      {
        Icon: Laptop,
        title: 'On a computer',
        body: 'Tap Invite, then <b>Copy message</b> and <b>Copy ticket</b>, and paste both into the chat. Tap <b>Mark as sent</b> when it is on its way.',
      },
      {
        Icon: CheckCircle2,
        title: 'Replies update here by themselves',
        body: 'When a guest answers or gets their ticket, this list changes on its own. Nothing to type in.',
      },
    ],
  },
  customer_people_v1: {
    key: 'customer_people_v1',
    label: 'Your people',
    blurb: 'Who you’re connected with, who you follow, and who follows you.',
    slides: [
      {
        Icon: Users,
        title: 'One place for your people',
        body: 'The counts at the top show who is connected, who you are waiting for and who is asking you &mdash; tap one to see just them. Groups, Following and Followers are under &equiv; at the bottom.',
      },
      {
        Icon: CheckCircle2,
        title: 'Connected means you both said yes',
        body: 'Add someone and they get a request. Once they accept, you’re connected &mdash; and you follow each other. Nothing connects until they say so.',
      },
      {
        Icon: Heart,
        title: 'Following needs no request',
        body: 'Follow anyone with a public profile. Say yes to an event and you follow its hosts on your own. Only you can see who follows you, and you can unfollow any time &mdash; even someone you’re connected with.',
      },
    ],
  },
  /* 🔦 THE ACCOUNT BAR (owner "yes to all" 2026-10-21, DECISION_LOG "THE ACCOUNT BAR — EVENTS · DISCOVER ·
     MEMORIES · PEOPLE"). A first-visit SPOTLIGHT on the Events board, after the host's journey
     (`host_spotlight_v1`), mounted by the board's own page. It lights the bar's own tabs (`tab-<last path
     segment>`, stamped by `<BottomNav>`) and walks nowhere, so nothing else can stack on it. Discover is not a
     stop: the iPhone app drops it, and its address `/` has no segment to stamp. Memories is lit on the BAR, not
     inside its page — the page is being redrawn (#6778) and a stop on it would point at something about to go.
     The bar is phone only (the laptop keeps the rail, which stamps no tab tokens), so the last stop is the avatar —
     drawn at every width — and a laptop's tour skips straight to it. Sells nothing. */
  customer_account_bar_v1: {
    key: 'customer_account_bar_v1',
    label: 'Your account bar',
    blurb: 'Events, Memories and People — the bar on your account screens — and Switch to.',
    slides: [],
    spotlight: {
      steps: [
        {
          anchor: 'tab-dashboard',
          title: 'Your events',
          body: 'Every event you host or are invited to. Tap one to open it — inside an event, the bar changes to that event’s own.',
        },
        {
          anchor: 'tab-library',
          title: 'Memories',
          body: 'The photos and stories from all your events, kept in one place.',
        },
        {
          anchor: 'tab-people',
          title: 'People',
          body: 'Everyone you’re connected to, your loved ones and your groups.',
        },
        {
          // The avatar sheet's Switch to (#6783, #6802). The LAST stop on purpose: the top bar draws it at every
          // width, so on a laptop — where the bar's tabs are the rail's and stamp nothing — the tour comes here.
          anchor: 'account-avatar',
          title: 'Switch to',
          body: 'Your picture opens Switch to: your events and each shop you run, one tap apart. Profile & settings are there too.',
        },
      ],
      finale: {
        title: 'You’re set 🎉',
        body: 'These stay at the bottom of your account screens.',
        button: 'Done',
      },
    },
  },
  /* 🔦 PEOPLE, AS IT LOOKS SINCE 2026-10-22 ("People wears the Guest list" — the counts line is the top, the thumb
     row's field finds or invites, ≡ holds Groups · Following · Followers). A first-visit SPOTLIGHT, mounted by the
     People page, after the host's journey. Loved ones is the middle stop on purpose: it is a section only some
     accounts have, and a missing stop is skipped only when a LATER one is on screen (`spotlight-tour.tsx`) — the
     thumb row's field always is. The field's own word is not quoted (it is being renamed, #6790). Sells nothing. */
  customer_people_v2: {
    key: 'customer_people_v2',
    label: 'People — first visit',
    blurb: 'The counts, your loved ones, and finding or inviting someone.',
    slides: [],
    spotlight: {
      steps: [
        {
          anchor: 'people-counts',
          title: 'Your people, counted',
          body: 'Connected, waiting for them, asking you. Tap a number to see just those people; tap it again for everyone.',
        },
        {
          anchor: 'people-loved-ones',
          title: 'Loved ones',
          body: 'The people you plan events for — a child, a lola, a pet. A shop you own is here too, so you can make an event for it.',
        },
        {
          anchor: 'people-find',
          title: 'Find someone, or invite them',
          body: 'Type a name here to find someone — or to invite them, if they’re not on Setnayan yet. ≡ beside it opens Groups, Following and Followers.',
        },
      ],
      finale: {
        title: 'You’re set 🎉',
        body: 'Nobody is connected until they say yes.',
        button: 'Done',
      },
    },
  },
  /* 🧭 THE EVENT MENU — FIVE PLACES (Stage D, owner 2026-09-29: "Home · Guest
     list · Your Team · Event Hub Maker · Our Services"; "on mobile mode … we
     want it to be simple and easy to manage"; 2026-09-25: every feature gets a
     first-visit tour). Mounted on the event's Home (`[eventId]/page.tsx`),
     after the couple welcome, so the two never stack. Words fit every event
     type — no "wedding", no "couple". No price is named, so nothing here sells. */
  /*
    🎁 E-GIFTS › WISH LIST (owner 2026-10-08, "ok wish list"; prototype
    `egifts_wish_list_2026-10-08_fable.html` frame 26). First visit to Studio ›
    E-Gifts once the wish list is there. One slide, the prototype's own words.
    Sells nothing — the wish list is free ("free.").
    ⛔ The word is "sent": a guest's screenshot is what they SAY they sent, so
    this slide tells the couple to check their own account, and never says a gift
    was received or verified.
  */
  customer_wish_list_v1: {
    key: 'customer_wish_list_v1',
    label: 'Your wish list',
    blurb: 'First visit to E-Gifts: what a wish is, how guests send toward one, and when it marks itself.',
    slides: [
      {
        Icon: Gift,
        title: 'Your wish list',
        body: 'Add what you\u2019d love. Guests send toward a wish through your own GCash or bank and show you a screenshot \u2014 the money never passes through Setnayan. A wish marks itself <strong>Got it</strong> when what they sent reaches its price; check your account first.',
      },
    ],
  },
  customer_event_menu_v1: {
    key: 'customer_event_menu_v1',
    label: 'Your event menu',
    blurb: 'The four places that hold everything for an event — the same on phone and laptop.',
    slides: [
      {
        Icon: Sparkles,
        title: 'Four places for your whole event',
        body: 'Home, Guests, Suppliers and Hub. The same four sit at the bottom of your phone and down the side of your laptop.',
      },
      {
        Icon: Users,
        title: 'Guests',
        body: 'Your guests, your hosts and, on the day, check-in. Switch between them from the menu at the top of the page.',
      },
      {
        Icon: Briefcase,
        title: 'Suppliers',
        body: 'The suppliers you book and your budget, in one place.',
      },
      {
        Icon: Wand2,
        title: 'Hub',
        body: 'Where you make your Event Hub, the invitation and every print. Names, date, schedule, mood board and logo are all in its Details.',
      },
      {
        Icon: Camera,
        title: 'Your services',
        body: 'Setnayan AI, Papic, Live Watch, Music Maker and Patiktok live on Home, under Your services &mdash; add the ones you want for your day.',
        // 🍎 Five paid web extras (More left the bar 22 Oct 2026 — they live on Home › Your services); the
        // iPhone app shows none of them (#6725), so this slide is dropped there.
        sells: true,
      },
    ],
  },
  /* 💎 THE APPLY SHEET (owner 2026-09-28: *"they can edit it with pro features.
     but need to upgrade to pro when clicked on apply and point out the effect
     chosen that caused them to upgrade to pro"*; 2026-09-25: every feature gets
     a first-visit tour). Mounted inside the sheet (`apply-pro-sheet.tsx`, via
     `HubDraftDock`), so it opens the first time Apply names a Pro effect. The
     sheet is never drawn in the app-store shell, and these slides name no
     price — `sells` keeps them out of the shell all the same. */
  customer_apply_pro_v1: {
    key: 'customer_apply_pro_v1',
    label: 'Apply with Pro effects',
    blurb: 'What the list at Apply is, and your three ways on from it.',
    slides: [
      {
        Icon: Sparkles,
        title: 'You tried Event Hub Pro',
        body: 'Everything marked &#9670; PRO in the Maker works before you pay &mdash; it waits in your draft. This list names each Pro effect you chose, and where it is.',
        sells: true,
      },
      {
        Icon: MousePointerClick,
        title: 'Keep it, change it, or take it off',
        body: 'Tap Go to to see an effect in the Maker, or &times; to take it off your draft. Unlock Event Hub Pro to put them all live &mdash; or apply the rest now; the Pro ones stay in your draft.',
        sells: true,
      },
    ],
  },
  /* 🌍 DISCOVER (owner 2026-09-29, DECISION_LOG "DISCOVER IS THE DOOR TO THE
     WHOLE SETNAYAN UNIVERSE"; prototype `discover_upcoming_2026-09-29.html`
     frame 1C). Mounted on `/` for a signed-in visitor by the shipped
     `<MiniTour>` in `front-door.tsx`. Two slides, the prototype's own words —
     minus its "you'll hear by email", which the same day's NO EMAIL TO GUESTS
     ruling retired: an approved requester learns it by reopening their link. */
  discover_upcoming_v1: {
    key: 'discover_upcoming_v1',
    label: 'Discover',
    blurb: 'Your people’s public events first, then everything public on Setnayan.',
    slides: [
      {
        Icon: Calendar,
        title: 'Your people’s public events',
        body: 'When someone you follow or are connected to announces a public event, it shows here &mdash; soonest first. Tap <b>Ask to join</b>; the host approves who gets in.',
      },
      {
        Icon: Users,
        title: 'Then the rest of Setnayan',
        body: 'Below them: every other upcoming public event, nearest region first, then shops and people to follow. Tickets, when an event has them, are sold by its organizer &mdash; never by Setnayan.',
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
        body: 'When a couple flags force majeure (typhoon, illness, venue closure), suppliers get 7 days to propose terms directly. If a resolution lands in chat by day 7, the flag closes without you.',
      },
      {
        Icon: ClipboardList,
        title: "Escalated flags appear here",
        body: 'If day 7 passes with no resolution, the flag shows up in this queue with an ESCALATED tag. Open the row to see the evidence files, the affected suppliers, and the chat history.',
      },
      {
        Icon: Receipt,
        title: 'Four resolution paths',
        body: 'Refund (supplier returns payment minus expenses), Reschedule (services move to a new date), Substitute (equivalent service later), Partial (some delivered, some refunded). Pick one, both parties get an email.',
      },
    ],
  },
  // 📱 THE SUPPLIER PHONE APP — the first visit to the new Today and Customers
  // (owner-APPROVED 2026-10-01). Claims checked against what the pages do: one
  // Next card (the oldest answer owed, or "Run the day" on an event day), the
  // bar of four — Today · Customers · Shop · Hub since 2026-10-21 (More left the
  // bar; Messages = the envelope, Insights = Shop › How it is going, Settings =
  // the profile picture) — and the round + that opens "Import an outside client".
  vendor_today_v1: {
    key: 'vendor_today_v1',
    label: 'Supplier — Today mini-tour',
    blurb: 'The one Next card, the three numbers and the bar of four.',
    slides: [
      {
        Icon: Sparkles,
        title: 'One thing at a time',
        body: 'The Next card is the most urgent thing waiting on you — a reply, a booking to answer, or on an event day, running the day. Answer it and the next one takes its place.',
      },
      {
        Icon: Wallet,
        title: 'Three numbers',
        body: 'Waiting on you, events this week, and what is still to come in. Tap any of them to see the list behind it.',
      },
      {
        Icon: Settings,
        title: 'Four places, nothing hidden',
        body: 'The bar is Today, Customers, Shop and Hub. Messages open from the envelope at the top, How it is going is in Shop, and Settings is under your profile picture.',
      },
    ],
  },
  vendor_customers_v1: {
    key: 'vendor_customers_v1',
    label: 'Supplier — Customers mini-tour',
    blurb: 'One row per customer, one next step each, and the round +.',
    slides: [
      {
        Icon: Users,
        title: 'Who is waiting comes first',
        body: 'Every customer is one row with their next step on it. The ones waiting on your answer are always at the top.',
      },
      {
        Icon: ClipboardList,
        title: 'Filter and Show',
        body: 'Filter narrows the list to one stage. Show picks what each row tells you on the right — the next step, the money, or the date.',
      },
      {
        Icon: Calendar,
        title: 'Add an outside client',
        body: 'Took a booking outside Setnayan? The round + adds it, free, so the date is held and you are never double-booked.',
      },
    ],
  },
  // 🧭 THE SUPPLIER DASHBOARD REDESIGN — one slide per page (owner-approved
  // prototype `supplier_dashboard_2026-10-08_fable.html`, its `TOUR` map, word
  // for word). ⚠ NOT MOUNTED YET, ON PURPOSE: a tour that names Services ·
  // Page · Insights before Shop has those three segments would describe a page
  // that is not there. `vendor_shop_v1` mounts with S-PR6 and `vendor_hub_v1`
  // with S-PR11 — `a-supplier-tour-mounts-with-its-page.test.ts` holds both
  // the keys and the "not before its page" half.
  vendor_shop_v1: {
    key: 'vendor_shop_v1',
    label: 'Supplier — Shop mini-tour',
    blurb: 'Services, Page and Insights — the three segments of Shop.',
    slides: [
      {
        Icon: Briefcase,
        title: 'Services · Page · Insights',
        body: 'What you sell, how your page looks, how it is doing.',
      },
    ],
    // 🔦 SWITCHED ON 2026-10-22 (owner "Yes to all", journey_fixes Supplier 3):
    // the slide above stays as the switched-off carousel's script; this is what
    // runs — three stops, none the Today tour already makes (it lands on Your
    // details and + Create service card). Mounted by the supplier layout through
    // `lib/supplier-page-tours.ts`, after `supplier_spotlight_v1`.
    spotlight: {
      steps: [
        {
          anchor: 'shop-segments',
          title: 'Services · Page · How it is going',
          body: 'What you sell, how your page looks to couples, and how it is doing. Tap Page.',
          go: true,
        },
        {
          anchor: 'shop-page-list',
          title: 'Tap a part to change it',
          body: 'Your cover, your About, which services show first. “View my page” shows it exactly as a couple sees it.',
        },
        {
          anchor: 'shop-details-row',
          title: 'Your documents live in Your details',
          body: 'DTI or SEC, BIR 2303, Mayor’s permit, bank proof. Setnayan checks them in 5 working days, then your shop goes live.',
        },
      ],
      finale: {
        title: 'You’re set 🎉',
        body: 'Today’s Next card always shows the one thing waiting on you. To see this again, open your account menu and tap Show me around.',
        button: 'Done',
      },
    },
  },
  vendor_hub_v1: {
    key: 'vendor_hub_v1',
    label: 'Supplier — Event Hub mini-tour',
    blurb: 'Running one event on its day.',
    slides: [
      {
        Icon: Calendar,
        title: 'Run the day',
        body: 'Scan, schedule, shot list, headcount — for this event only.',
      },
    ],
    // 🔦 SWITCHED ON 2026-10-22 (journey_fixes Supplier 3) — drawn on a day with
    // no event; on an event day its anchors are not there and it waits.
    spotlight: {
      steps: [
        {
          anchor: 'hub-empty',
          title: 'Your day-of console',
          body: 'On an event day this is where you run it — scan, schedule, shot list, headcount. Today it is a preview.',
        },
        {
          anchor: 'hub-next-days',
          title: 'Your next days',
          body: 'Each booked day unlocks here once its booking fee is paid. Tap one to see it.',
        },
        {
          anchor: 'hub-setup',
          title: 'Set it up before the day',
          body: 'Pick what you want on the day, and which of your helpers can open it.',
        },
      ],
      finale: {
        title: 'You’re set 🎉',
        body: 'On the day, Today’s Next card says “Run the day” and brings you here.',
        button: 'Done',
      },
    },
  },
  vendor_dates_v1: {
    key: 'vendor_dates_v1',
    label: 'Supplier — Dates spotlight',
    blurb: 'The month, checking a date, adding the bookings you already have.',
    slides: [],
    spotlight: {
      steps: [
        {
          anchor: 'dates-calendar',
          title: 'Your month at a glance',
          body: 'Green is booked here, grey is booked elsewhere, gold is a couple asking. Striped days are off.',
        },
        {
          anchor: 'dates-check',
          title: 'Check a date',
          body: 'Tap a day to see what is on it — or block it off so nobody asks for it.',
        },
        {
          anchor: 'dates-add',
          title: 'Add what you already have',
          body: 'Bookings from outside Setnayan go here too, so a couple never asks for a day you have given away.',
        },
      ],
      finale: {
        title: 'You’re set 🎉',
        body: 'Every day you block or book shows here and on Today.',
        button: 'Done',
      },
    },
  },
  vendor_money_v1: {
    key: 'vendor_money_v1',
    label: 'Supplier — Money spotlight',
    blurb: 'What is still to come in, each payment, logging one, Setnayan’s fee.',
    slides: [],
    spotlight: {
      steps: [
        {
          anchor: 'money-summary',
          title: 'What is still to come in',
          body: 'Received, against everything booked. Anything overdue shows first.',
        },
        {
          anchor: 'money-next',
          title: 'One row per payment',
          body: 'Who, how much and when it is due. Tap a row to remind them or to log what they paid.',
        },
        {
          anchor: 'money-log',
          title: 'Log a payment',
          body: 'When a couple pays you directly — GCash, bank, cash — log it here so their balance stays right.',
        },
        {
          anchor: 'money-fees',
          title: 'Setnayan’s fee',
          // The sentence is the lock's own — the rule the fee engine actually waives (owner 2026-10-23), never typed here.
          body: `One booking fee per booking, due after the day. ${FIRST_BOOKING_ON_US} Your own clients are always free.`,
        },
      ],
      finale: {
        title: 'You’re set 🎉',
        body: '“To come in” on Today is this page in one number.',
        button: 'Done',
      },
    },
  },
  // ─────────────────────────────────────────────────────────────────────────
  // 🔦 THE SPOTLIGHT JOURNEYS. Each step's `anchor` is a `data-tour` token on
  // the real element (`lib/spotlight-anchors-exist.test.ts` fails if one is not
  // in the tree). Words come from the slides above where they fit — the
  // sample's own where they do not. Plain English · "event", never
  // "celebration" · "Event Hub", never "website".
  host_spotlight_v1: {
    key: 'host_spotlight_v1',
    label: 'Host — spotlight tour',
    blurb: 'Create the event, make the Event Hub, add guests, find suppliers.',
    slides: [],
    spotlight: {
      steps: [
        {
          anchor: 'create-event',
          title: 'Start with your event',
          body: 'Tap here and pick what kind of event it is. It takes a minute.',
          go: true,
        },
        {
          // 👋 The once-only welcome — rings the same Next card the step after it explains (P4 → P5).
          anchor: 'home-next',
          title: 'Welcome, {name}',
          body: 'Your first event is made. The Next card always shows the one thing to do next.',
          welcome: true,
        },
        {
          anchor: 'home-next',
          title: 'Start here, every time',
          body: 'The Next card always shows the one thing to do next.',
        },
        {
          anchor: 'home-launch',
          title: 'Your Event Hub',
          body: 'Tap words on the page to type over them. Your guests see nothing until you press Apply.',
        },
        {
          anchor: 'tab-guests',
          title: 'Your guests',
          body: 'Your guests, your hosts and, on the day, check-in.',
          go: true,
        },
        {
          anchor: 'guests-add',
          title: 'Search or add',
          body: 'Type a name to find a guest — or, if they are not on your list yet, to add them. Each guest gets their own invitation and QR.',
        },
        {
          anchor: 'guests-setup',
          title: 'Send invitations, see replies',
          body: 'Send each invitation from here and watch the replies come in, guest by guest.',
        },
        {
          anchor: 'tab-vendors',
          title: 'Suppliers',
          body: 'The suppliers you book and your budget, in one place.',
          go: true,
        },
        {
          anchor: 'suppliers-find',
          title: 'Find a supplier',
          body: 'Type what you need. Chat with them here — every message, quote and booking stays with your event.',
        },
      ],
      finale: {
        title: 'You’re set 🎉',
        body: 'Whenever you’re unsure, the Next card on Home shows the one thing to do. To see this again, open your account menu and tap Show me around.',
        button: 'Done',
      },
    },
  },
  host_day_spotlight_v1: {
    key: 'host_day_spotlight_v1',
    label: 'Host — event day and Post Event spotlight',
    blurb: 'Home on the day, then the story after it.',
    slides: [],
    spotlight: {
      steps: [
        {
          anchor: 'day-live',
          title: 'Your event day',
          body: 'Announcements, the photo wall and what is happening now — all from here.',
        },
        {
          anchor: 'day-planning',
          title: 'Planning is still here',
          body: 'Your lists and tools stay one tap away if you need them today.',
        },
        {
          anchor: 'post-story',
          title: 'Post Event',
          body: 'The story after your day is written for you from what happened. Open it to see it and make it yours.',
        },
        {
          anchor: 'post-photos',
          title: 'The photos',
          body: 'Every photo from your day, in one place.',
        },
      ],
      finale: {
        title: 'That’s the whole journey 🎉',
        body: 'From creating your event to the story after it. The Next card on Home still shows the one thing to do.',
        button: 'Done',
      },
    },
  },
  supplier_spotlight_v1: {
    key: 'supplier_spotlight_v1',
    label: 'Supplier — spotlight tour',
    blurb: 'Set up the shop, add services, answer customers, get paid.',
    slides: [],
    spotlight: {
      steps: [
        {
          anchor: 'today-next',
          title: 'One thing at a time',
          body: 'The Next card is the most urgent thing waiting on you. Answer it and the next one takes its place.',
        },
        {
          anchor: 'tab-shop',
          title: 'Shop is your storefront',
          body: 'Your details, your page and what you sell.',
          go: true,
        },
        {
          anchor: 'shop-details',
          title: 'Set up your shop',
          body: 'Your name, photos and where you work. Your shop goes live to couples once Setnayan approves it.',
        },
        {
          anchor: 'shop-add-service',
          title: 'Add what you sell',
          body: 'Build service cards with photos, prices and what’s included.',
        },
        {
          anchor: 'tab-customers',
          title: 'Customers',
          body: 'Requests and bookings land here, and replying costs nothing on any plan.',
          go: true,
        },
        {
          anchor: 'customers-list',
          title: 'Who is waiting comes first',
          body: 'Every customer is one row with their next step on it. The ones waiting on your answer are always at the top.',
        },
        {
          anchor: 'tab-vendor-dashboard',
          title: 'Back to Today',
          body: 'Every day starts here.',
          go: true,
        },
        {
          anchor: 'today-money',
          title: 'Get paid',
          body: 'What is still to come in from your bookings. Tap it to see every payment and when it is due.',
        },
      ],
      finale: {
        title: 'You’re set 🎉',
        body: 'The Next card on Today always shows the one thing waiting on you. To see this again, open your account menu and tap Show me around.',
        button: 'Done',
      },
    },
  },
  // ─────────────────────────────────────────────────────────────────────────
  // 🔦 THE HOST'S PAGE TOURS (owner "yes to all" 2026-10-22, prototype
  // `journey_fixes_later_2026-10-22.html` § Host 4 — the words are the
  // prototype's, stop for stop). Each runs on the first visit to its page,
  // only once `host_spotlight_v1` is seen (`lib/host-page-tours.ts`), and none
  // lights an anchor the journey already lit. The old carousels' words for
  // Budget, Papic and the Seat plan moved in here; their MiniTour mounts are gone.
  customer_event_hub_maker_v2: {
    key: 'customer_event_hub_maker_v2',
    label: 'Event Hub Maker — first open',
    blurb: 'The quiet line, the tools in the lower third, and Apply.',
    slides: [],
    // Option A: three stops, no Pro pitch (the 2 Oct cut stands). Mounted by the
    // Maker's own page, inside the Maker — the one place the journey pauses.
    spotlight: {
      steps: [
        {
          anchor: 'maker-hint',
          hint: 'Tap the page — or press Next',
          title: 'Tap anything to change it',
          body: 'Tap words on the page to type over them, or tap a scene for its settings. Your guests see nothing until you press Apply.',
        },
        {
          anchor: 'maker-tools',
          title: 'Page, Look and Event Details',
          body: 'Page ▾ picks what you are looking at. Look dresses the whole Event Hub. Event Details holds the facts — names, date, places — shown on every page.',
        },
        {
          anchor: 'maker-apply',
          title: 'Apply when you like it',
          body: 'Until then it is your draft — try anything. If a look is Pro, Apply says so there, and you can apply without it.',
        },
      ],
      finale: {
        title: 'You’re set 🎉',
        body: 'Exit any time; your draft keeps. To see this again, open ⋯ › About the Maker.',
        button: 'Done',
      },
    },
  },
  customer_budget_v2: {
    key: 'customer_budget_v2',
    label: 'Budget — first visit',
    blurb: 'The totals, the one list, and adding an expense.',
    slides: [],
    spotlight: {
      steps: [
        {
          anchor: 'budget-summary',
          hint: 'Press Next',
          title: 'Target · Agreed · Paid · Owed',
          body: 'The numbers up top are the sum of the list below — nothing is typed here.',
        },
        {
          anchor: 'budget-list',
          hint: 'Tap a row — or press Next',
          title: 'One list, one truth',
          body: 'Booked suppliers, what you bought here, and your own expenses. Tap a supplier to see every payment and record one — Owed moves the moment you do.',
        },
        {
          anchor: 'budget-thumb',
          title: 'Add anything else',
          body: '＋ Add expense for what you pay outside Setnayan. No Save button — it keeps as you type.',
        },
      ],
      finale: {
        title: 'You’re set 🎉',
        body: 'When a payment is due, the Next card on Home says so.',
        button: 'Done',
      },
    },
  },
  customer_papic_v2: {
    key: 'customer_papic_v2',
    label: 'Papic — first visit',
    blurb: 'The band, the days, the one shared code and the library — no price in any step.',
    slides: [],
    spotlight: {
      steps: [
        {
          anchor: 'papic-band',
          hint: 'Press Next',
          title: 'Your guests become the photographers',
          body: 'Every guest’s phone can be a camera — no app to install. This band says when the cameras are on and how many shots are left.',
        },
        {
          anchor: 'papic-coverage',
          title: 'Pick the days first',
          body: 'Choose when the cameras can shoot. They can start before the day itself, so they catch the preparations too.',
        },
        {
          anchor: 'papic-qrs',
          title: 'One code for everyone',
          body: 'Print it or show it at the door — each scan turns a phone into a camera. Every guest’s invite QR is a camera too, and every shot comes out of one shared pot of credits.',
        },
        {
          anchor: 'papic-library',
          title: 'Everything lands in your library',
          body: 'Filter by “Photos of us”, save any shot to your phone, or download everything at once. Guests find the photos they are in, too.',
        },
      ],
      finale: {
        title: 'You’re set 🎉',
        body: 'Your first event’s free credits are already on. When they run out, Buy more is the one button.',
        button: 'Done',
      },
    },
  },
  customer_seat_plan_v2: {
    key: 'customer_seat_plan_v2',
    label: 'Seat plan — first visit',
    // Rewritten for the phone plan (`seat-plan-phone.tsx`): no drag — a guest is tapped, then moved.
    blurb: 'Auto arrange, who still needs a seat, and the three views.',
    slides: [],
    spotlight: {
      steps: [
        {
          anchor: 'seat-plan-auto',
          title: 'Auto arrange',
          body: 'One tap seats everyone by group and side. Don’t like it? Undo, or move anyone yourself.',
        },
        {
          anchor: 'seat-plan-unseated',
          title: 'Who still needs a seat',
          body: 'Tap a name, then Move to a table. Rules ▾ keeps a group together or apart.',
        },
        {
          anchor: 'seat-plan-view',
          title: 'One plan, three views',
          body: '2D here, the same room in 3D, or a list by table. ⋯ adds a table and shares or prints the plan.',
        },
      ],
      finale: {
        title: 'You’re set 🎉',
        body: 'On the day, each guest’s own page shows their table.',
        button: 'Done',
      },
    },
  },
  customer_mood_board_v1: {
    key: 'customer_mood_board_v1',
    label: 'Mood Board — first visit',
    blurb: 'Your colours, your reception design, sharing the board.',
    slides: [],
    // Stop 1's claim was re-read on 2026-10-22 before it shipped: the Event Hub's
    // look IS the board's five main colours (`lib/main-colours.ts` — "one
    // palette, not a copy"; the Studio's own tip says "One palette with Look ›
    // Colours"), so "Your Event Hub's look … read from here" is true.
    spotlight: {
      steps: [
        {
          anchor: 'mood-board-palette',
          hint: 'Tap a colour — or press Next',
          title: 'Your colours',
          body: 'Up to five. Your Event Hub’s look, your prints and your dress code read from here — change one and they follow.',
        },
        {
          anchor: 'mood-board-reception',
          title: 'Your reception design',
          body: 'Attire, flowers and cake, drawn in your colours. A booked supplier can agree a part with you here, so everyone works from one board.',
        },
        {
          anchor: 'mood-board-share',
          title: 'Share with your suppliers',
          body: 'One link or a file of the whole board — the same one your booked suppliers see.',
        },
      ],
      finale: {
        title: 'You’re set 🎉',
        body: 'The dress code your guests see is this board, in their invitation.',
        button: 'Done',
      },
    },
  },
};

export function getTour(key: TourKey): TourDefinition {
  return TOURS[key];
}

/**
 * 🧭 THE ONCE-OFFER'S MARKER — "Finish your Event Hub", offered once right after
 * onboarding (owner-approved 2026-10-01). It is the What's left first-visit
 * tour's own key: Start opens What's left, whose tour marks it; Later marks it
 * on Home (`completeTour`). Either way the offer never comes back — the slim
 * card and What's left stay. No tour of its own: `lib/tours.ts` rides in the
 * Maker's first load, so the offer's words live on Home's card instead.
 */
export const HUB_SETUP_OFFER_TOUR: TourKey = 'customer_details_guided_v1';
