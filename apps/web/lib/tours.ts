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
  | 'customer_adaptive_theme_v1'
  | 'customer_post_event_v1'
  | 'customer_ombre_background_v1'
  | 'customer_details_bound_v1'
  | 'customer_pro_qr_v1'
  | 'customer_print_menu_v1'
  | 'customer_guest_reminders_v1'
  | 'customer_schedule_v1'
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
  'customer_adaptive_theme_v1',
  'customer_post_event_v1',
  'customer_ombre_background_v1',
  'customer_details_bound_v1',
  'customer_pro_qr_v1',
  'customer_print_menu_v1',
  'customer_guest_reminders_v1',
  'customer_schedule_v1',
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
    blurb: 'Your hero goes behind every scene, and the theme follows its colours.',
    slides: [
      {
        Icon: Palette,
        title: 'Your hero, behind every scene',
        body: 'The photo you put on your hero also sits behind every scene &mdash; change it once, in Hero, and it changes everywhere. Your theme&rsquo;s buttons and accents take on its colours, while the lettering and ornaments stay your theme&rsquo;s.',
      },
      {
        Icon: CheckCircle2,
        title: 'Your words always read',
        body: 'We check the photo and lay a soft veil so every word stays easy to read. You can keep the theme&rsquo;s own colours any time, or put a different clip or photo behind the page.',
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
    label: 'Post Event — your story, written for you',
    blurb: 'How the story after the day is written from what happened, scene by scene.',
    slides: [
      {
        Icon: BookOpen,
        title: 'Your story after the day, written for you',
        body: 'After the day, the Event Hub Maker wrote Post Event from what happened &mdash; the chapters of your day, the gallery, the film, the wishes. There was nothing to type, and every scene says what filled it.',
      },
      {
        Icon: EyeOff,
        title: 'Nothing to show? The scene is skipped',
        body: 'A part of the day with nothing in it yet &mdash; no reviews, no Live Photo Wall &mdash; is marked <b>Skipped</b>, and your guests never meet an empty box. It appears on its own when something arrives.',
      },
      {
        Icon: Maximize2,
        title: 'Tap to open it full screen',
        body: 'The gallery, the film, Were you there? and the wishes open full screen on your page, and Back returns everyone to the same place. A guest&rsquo;s gallery shows <b>Yours</b> and <b>Everyone&rsquo;s</b>; a stranger sees only what is shared.',
      },
      {
        Icon: Sparkles,
        title: 'Free — and yours to change',
        body: 'The written story is free. Hide or reorder its scenes in your story workroom. A theme, a different template for a scene and your own photos come with Event Hub Pro.',
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
        title: 'Written once, in Details',
        body: 'Your special message lives in Details, and every scene that shows it follows. Change it in Details and every scene changes with it.',
      },
      {
        Icon: MousePointerClick,
        title: 'Everywhere, or just here',
        body: 'Change it on a scene and we ask: <strong>Change it everywhere</strong> updates Details, or <strong>Just this scene</strong> keeps a version for this scene only. Tap <strong>&#8634; Use Details</strong> to bring the scene back in line.',
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
  /*
    THE MENU CARD (owner 2026-09-28: *"add to print out our meals for tonight.
    from vendors from ceremony, to cocktail to the buffet."*). Mounted in Prints
    & Tickets (`maker-prints.tsx`), so it fires the first time a couple opens
    it after the Menu arrived. Sells nothing — the Menu prints free in Classic.
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
    📮 GUEST REMINDER EMAILS (owner 2026-09-26, "THE LAST 30 DAYS"). Fires the
    first time the couple opens the Maker's RSVP page after the Maker welcome —
    the switch lives there. Two slides: what each guest gets, and that the
    switch is theirs. Mounted inside the RSVP page's controls (launch/page.tsx),
    so it never stacks on the Maker's own first-visit welcome.
  */
  customer_guest_reminders_v1: {
    key: 'customer_guest_reminders_v1',
    label: 'Reminder emails for your guests',
    blurb: 'Three short emails — 30 days, 7 days and the day before — each listing only what a guest has not ticked.',
    slides: [
      {
        Icon: Mailbox,
        title: 'Your guests are reminded for you',
        body: 'Every guest who gave an email gets three short reminders &mdash; <strong>30 days</strong>, <strong>7 days</strong> and <strong>the day before</strong>. Each one lists only what they have not ticked on their checklist, and links to their own page. A guest who has not replied is asked to reply by your date first.',
      },
      {
        Icon: CheckCircle2,
        title: 'The switch is yours',
        body: 'They are on by default. Turn <strong>Reminder emails</strong> off on this page and nobody is emailed. Guests without an email are never emailed either way &mdash; their invitation is the link you share.',
      },
    ],
  },
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
        body: 'Tap <b>Announce</b> to send everyone one message &mdash; before the day or on it. Your latest announcement sits at the top of your guests&rsquo; Event Hub on the day. You and your approved coordinator can announce.',
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
