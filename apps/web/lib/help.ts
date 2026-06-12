export type HelpRole = 'couple' | 'vendor' | 'guest' | 'admin';

export type HelpArticle = {
  slug: string;
  title: string;
  body: string;
};

export type HelpTopic = {
  key: string;
  label: string;
  roles: ReadonlyArray<HelpRole>;
  articles: HelpArticle[];
};

export const HELP_ROLES: ReadonlyArray<{
  key: HelpRole;
  label: string;
  blurb: string;
}> = [
  {
    key: 'couple',
    label: 'Couple',
    blurb: "You're planning a wedding. Guest list, vendors, budget, day-of.",
  },
  {
    key: 'vendor',
    label: 'Vendor',
    blurb: 'You sell a service to couples on Setnayan.',
  },
  {
    key: 'guest',
    label: 'Guest',
    blurb: 'You got an invite. Time to RSVP and show up.',
  },
  {
    key: 'admin',
    label: 'Admin',
    blurb: "You're part of the Setnayan operations team.",
  },
];

// GEO Phase G3 (2026-05-28) — "About Setnayan" topic lands at the top
// of HELP_TOPICS so its 18 brand/discovery Q&A pairs lead the FAQPage
// JSON-LD shipped by apps/web/app/help/page.tsx. AI answer engines
// (ChatGPT-User · OAI-SearchBot · PerplexityBot · ClaudeBot — allowlisted
// via robots.txt per CLAUDE.md 2026-05-14 SEO playbook lock) extract
// FAQPage Question + Answer pairs verbatim when responding to "what is
// X" / "how much does X cost" / "does X support Filipino weddings"
// queries. Each answer is under ~300 chars so it surfaces cleanly as a
// SERP snippet and as a structured chunk in AI chat responses. Pricing
// + features match v2.1 canonical brief reality (CLAUDE.md tenth
// 2026-05-28 row) + the live /pricing state.
export const HELP_TOPICS: ReadonlyArray<HelpTopic> = [
  {
    key: 'about-setnayan',
    label: 'About Setnayan',
    roles: ['couple', 'vendor', 'guest', 'admin'],
    articles: [
      {
        slug: 'what-is-setnayan',
        title: 'What is Setnayan?',
        body: "Setnayan (SET-na-yan, from Tagalog \"Set na 'yan.\" — \"that's all set.\") is the Philippines-first wedding and life-events software platform. Built and operated in the Philippines for Filipino weddings. Free for couples on the baseline planning tools; verified Filipino wedding vendors list with 0% commission on bookings.",
      },
      {
        slug: 'how-much-does-setnayan-cost',
        title: 'How much does Setnayan cost?',
        body: 'Free for couples on the baseline planning tools (guest list, RSVP, Pakulay mood board, vendor browse, in-app chat). Premium software services priced individually from ₱999 (Pabati) to ₱16,999 (Media Pack bundle). Vendor side: Free (₱0/month) baseline listing, Verified (free during launch), Pro (₱1,999/month), Enterprise (₱5,499/month). 0% commission on vendor bookings — Setnayan never takes a cut.',
      },
      {
        slug: 'is-setnayan-free-for-couples',
        title: 'Is Setnayan free for couples?',
        body: 'Yes for the baseline planning tools — guest list, RSVP, Pakulay (mood board), vendor browse, and in-app chat are all free with every account. Premium tools like Setnayan AI (₱1,499 one-time) and Pro Website (₱5,499) are optional. You only pay for what you choose to add.',
      },
      {
        slug: 'does-setnayan-take-commission',
        title: 'Does Setnayan take commission on vendor bookings?',
        body: 'No. 0% commission on every vendor booking, every tier. Setnayan never touches money between couples and vendors. Revenue comes from software service purchases (Setnayan AI, Pro Website, Papic, Panood, etc.) and vendor subscriptions (Pro monthly, Enterprise monthly).',
      },
      {
        slug: 'what-is-todays-focus',
        title: "What is Setnayan AI?",
        body: 'A 65-card AI-assisted wedding planning wizard built into Setnayan. ₱1,499 one-time per event. Walks couples through every decision from venue lock through thank-you cards, with religion-adaptive copy and hard-floor deadlines specific to Filipino weddings (Pre-Cana, marriage license validity windows, sponsor coordination, etc.).',
      },
      {
        slug: 'does-setnayan-support-filipino-customs',
        title: 'Does Setnayan support Filipino wedding customs?',
        body: 'Yes. Supports seven ceremony types (Catholic, Civil, INC, Christian, Muslim, Cultural, Mixed) and seven venue settings (banquet hall, garden, beach, destination, heritage, outdoor tent, civil registrar). 20 Filipino wedding role tiers in the guest list including principal sponsors, candle/veil/cord/coin sponsors, ninang, ninong, and bearers. Multi-faith vendor compatibility tagging across 192 vendor sub-categories.',
      },
      {
        slug: 'what-languages-does-setnayan-support',
        title: 'What languages does Setnayan support?',
        body: 'English (primary across the marketing site and dashboards). Tagalog (TL) on dashboard surfaces. Cebuano (CEB) localization on the marketing site is on the V1.1 roadmap.',
      },
      {
        slug: 'where-does-setnayan-operate',
        title: 'Where does Setnayan operate?',
        body: 'Philippines — Metro Manila (Quezon City, Makati, Pasig, Taguig, Manila), Cebu, Davao, Tagaytay, Iloilo, Baguio, Pampanga, Cavite, Batangas, Laguna, Bulacan, and any city where Filipino wedding vendors serve. Pilot launches 2026-06-01. Public launch 2026-12-01.',
      },
      {
        slug: 'does-setnayan-have-mobile-app',
        title: 'Does Setnayan have a mobile app?',
        body: 'Web-first responsive site that works on iOS Safari and Chrome Android. Native iOS and Android shells via Expo are on the V1.5 roadmap.',
      },
      {
        slug: 'how-are-vendors-verified',
        title: 'How are vendors verified on Setnayan?',
        body: 'Vendors complete a business-legitimacy check plus a short video call with a Setnayan admin. Verification is free during launch — no listing fee and no badge fee. Vendors verified before 2027-01-31 receive 100 complimentary tokens as a founder bonus.',
      },
      {
        slug: 'what-is-pakanta',
        title: 'What is Pakanta?',
        body: 'A custom Filipino-style song written for the couple. ₱2,499 one-time per event. Setnayan\'s music team writes original lyrics around the couple\'s love story, records the track, and delivers it for the ceremony or reception.',
      },
      {
        slug: 'what-is-papic',
        title: 'What is Papic?',
        body: 'Guest-side photo capture for your wedding. Two purchase modes: Papic Guest (₱2,999, disposable-camera mode for general guests, 24 photos plus 10 5-second videos per guest, auto-tagged via face detection) and Papic 5 Seats (₱2,999, five seats for designated paparazzi friends and family with unlimited photos plus unlimited videos for 5 hours).',
      },
      {
        slug: 'what-is-panood',
        title: 'What is Panood?',
        body: 'Live streaming for your wedding, embedded directly on your event website. ₱3,499 per day with up to four cameras. Guests and family who couldn\'t attend in person can watch the ceremony and reception live without leaving Setnayan.',
      },
      {
        slug: 'what-is-pakulay',
        title: 'What is Pakulay?',
        body: 'The visual mood board for your wedding — included free with every couple account. Three pillars: palette (colors), location feel (venue look + atmosphere), and dress codes (attire direction by role tier). Pakulay finalizes once and downstream services (catering, florals, attire, stationery) pull from the same locked vision.',
      },
      {
        slug: 'how-does-setnayan-handle-privacy',
        title: 'How does Setnayan handle my privacy?',
        body: 'RA 10173 (Data Privacy Act of the Philippines) compliant. Guest list and event details are never publicly shared without your explicit opt-in. Real-wedding editorials publish 30 days post-event only with explicit couple consent. National Privacy Commission registration in progress. DPO contact at dpo@setnayan.com.',
      },
      {
        slug: 'how-to-contact-support',
        title: 'How do I contact Setnayan support?',
        body: 'Send a message via the contact form below on this page — pick your role (couple, vendor, guest, or admin) and we\'ll route it to the right team. Response within 24 hours during business days. Privacy-related requests reach the DPO directly at dpo@setnayan.com.',
      },
      {
        slug: 'when-does-setnayan-launch',
        title: 'When does Setnayan launch?',
        body: 'Pilot 2026-06-01 with a small family + friends cohort exercising the full payment cycle on real weddings. Public launch 2026-12-01 alongside the founder\'s wedding (December 18, 2026) — the first event shipped through the platform end-to-end.',
      },
    ],
  },
  {
    key: 'getting-started',
    label: 'Getting started',
    roles: ['couple', 'vendor'],
    articles: [
      {
        slug: 'sign-up-as-couple',
        title: 'Sign up as a couple',
        body: 'On the sign-up page, pick "Couple" as your account type, enter your email, and choose a password (≥ 8 characters). You\'ll land on the dashboard immediately — V1 auto-confirms accounts so you don\'t need to wait on a confirmation email. Once Resend SMTP is wired, real email verification returns.',
      },
      {
        slug: 'sign-up-as-vendor',
        title: 'Sign up as a vendor',
        body: 'Same form, pick "Vendor" instead. You\'ll land on /vendor-dashboard with a profile editor. Fill in your business name, services, and contact email — couples find you by the contact email you set there.',
      },
      {
        slug: 'create-an-event',
        title: 'Create your event',
        body: 'From /dashboard, click "Create event". Pick the event type (Weddings only in V1), enter a display name (this is what guests + vendors see), and the date. You can edit everything later from the Invitation tab.',
      },
      {
        slug: 'event-id-vs-slug',
        title: 'Event ID vs slug',
        body: 'Every event has a Setnayan ID like S89E-AB12CD3456 (used internally) and a public slug like maria-and-juan (used in your invitation URL). The slug is editable on the Invitation tab. Old slugs auto-redirect for 90 days.',
      },
    ],
  },
  {
    key: 'guests',
    label: 'Guest list',
    roles: ['couple'],
    articles: [
      {
        slug: 'add-guest-roles',
        title: 'Filipino wedding roles',
        body: 'V1 ships 18 canonical roles: maid/matron of honor, best man, bridesmaids, groomsmen, principal sponsors, candle/veil/cord/coin sponsors, ring/bible/coin bearers, flower girl, officiant, lectors, soloists, and generic guest. Each is assignable from the Add Guest form.',
      },
      {
        slug: 'plus-ones',
        title: 'How plus-ones work',
        body: 'When you tick "Allow plus-one" on a guest, Setnayan creates a second guest row linked to the primary. The +1 has its own QR code and can RSVP independently. If the +1 is TBA, the primary names them on first scan via the welcome flow.',
      },
      {
        slug: 'import-csv',
        title: 'Import guests from CSV',
        body: 'On the Guests page, hit "Import CSV". Paste your spreadsheet (max 200 rows per import). Required columns: first_name, last_name. Optional: side, role, group_category, email, mobile, meal_preference, plus_one_allowed. Bad rows are flagged; valid rows insert atomically.',
      },
      {
        slug: 'share-invite-link',
        title: 'Share an invite link',
        body: 'Each guest gets a personal URL with their QR token. From the Invitation tab, you can either print the entire QR sheet (one per guest, A4 layout) or copy individual links from the guest table. There\'s also a generic "anyone with the link" event-join URL for ad-hoc invites.',
      },
    ],
  },
  {
    key: 'invitations',
    label: 'Invitation site',
    roles: ['couple'],
    articles: [
      {
        slug: 'invitation-site',
        title: "What's the invitation site?",
        body: 'The public URL at setnayan.com/[your-slug] is where every invitation goes. Guests land here when they tap their personal link or scan their QR. The site shows your event details, an RSVP form, countdown, venue map, dress code, and more.',
      },
      {
        slug: 'monogram',
        title: 'Customize the QR monogram',
        body: 'From the Invitation tab → Branding section. The monogram is the text in the center of every guest\'s QR code (default: first letter of each side joined by &, e.g. "M & J"). Override the text and pick an accent color. Every guest\'s QR rebuilds instantly.',
      },
      {
        slug: 'print-qr-sheet',
        title: 'Print the QR sheet',
        body: 'From the Invitation admin, click "Print sheet" — opens an A4 grid with each guest\'s branded QR + name + role. Print at 100% scale, no margins. Cut along the dashed lines or fold into card inserts.',
      },
      {
        slug: 'reissue-qr',
        title: "Re-issue a guest's QR code",
        body: 'If a guest loses their link or shares it, you can invalidate the old token. On the Invitation admin, find the guest row → "Re-issue token". Old QR stops working immediately; new QR is ready to share.',
      },
    ],
  },
  {
    key: 'vendors-budget',
    label: 'Vendors & budget',
    roles: ['couple'],
    articles: [
      {
        slug: 'track-vendor',
        title: 'Track a vendor',
        body: 'On the Vendors page, click Add a vendor. Pick a category from the 28 standard options (or pick "Miscellaneous" for anything off-list). Set a total cost + deposit if you have them. Vendors move through a 6-stage flow: considering → shortlisted → contracted → deposit paid → delivered → complete.',
      },
      {
        slug: 'budget-line-items',
        title: 'Budget line items',
        body: 'On the Budget page, each vendor card has two columns. Left: itemized line items (Deposit, Balance, Tip, etc.) with optional due dates. Right: actual payments you\'ve logged. Stats at the top roll up total budget, paid, remaining, and what\'s due in the next 30 days.',
      },
      {
        slug: 'export-calendar',
        title: 'Export budget due dates to your calendar',
        body: 'On the Budget page header, click "Export upcoming dates (.ics)". You get an RFC 5545 calendar file with one event per unpaid line-item due date. Import to Google Calendar, Apple Calendar, or Outlook — any standard ICS-aware app.',
      },
    ],
  },
  {
    key: 'mood-board',
    label: 'Mood Board',
    roles: ['couple'],
    articles: [
      {
        slug: 'palette-tiers',
        title: 'Palette tiers',
        body: 'Mood Board groups your palettes into three families: Venue (Ceremony 1-3 colors, Reception 3-6 with dominant/supporting/accent slots), Couple (Bride 1-3, Groom 1-3), and Roles (Wedding Party 3-6, Sponsors 1-3 each, Plain guests 3-6). Role palettes only show when you have guests in that role.',
      },
      {
        slug: 'palette-chip-dot',
        title: 'How the palette shows up in the guest list',
        body: "Each role chip in the Guest List grows a small colored dot when you've set a palette for that role. The dot shows the first color of the palette as a visual signal — see the full palette on the Mood Board page.",
      },
    ],
  },
  {
    key: 'messaging',
    label: 'Messaging',
    roles: ['couple', 'vendor'],
    articles: [
      {
        slug: 'start-thread-with-vendor',
        title: 'Start a thread with a vendor',
        body: "On the Messages tab, type the vendor's contact email. If they have a Setnayan vendor profile with that email, Setnayan creates a thread between you both. Re-opening a thread between the same event + vendor resumes the existing conversation — no duplicates. Only couples can open new threads — vendors reply to threads couples started.",
      },
      {
        slug: 'identity-masking',
        title: "Vendors don't see your email",
        body: "When a vendor opens a thread, they see only your event's display name and date — never your email or personal name. You control how you're identified by the display_name you set on your event. This is locked behavior in V1.",
      },
      {
        slug: 'vendor-reply-only',
        title: 'Vendors: how the reply-only inbox works',
        body: 'Your /vendor-dashboard/messages inbox lists every thread a couple has opened with you. You can reply to any thread, attach files, and share quotes. You cannot start a thread cold — couples have to reach out first. This protects them from unsolicited DMs.',
      },
    ],
  },
  {
    key: 'orders-payments',
    label: 'Orders & payments',
    roles: ['couple'],
    articles: [
      {
        slug: 'how-to-order',
        title: 'How to order a Setnayan service',
        body: 'Open the Orders tile from Home. Hit "New order", describe what you need, and propose a budget. The Setnayan team reviews and confirms the price; you receive a notification with the confirmed total and a reference code.',
      },
      {
        slug: 'payment-instructions',
        title: 'How payments work',
        body: 'Once your order is quoted, the order detail page shows payment instructions. Send the amount via BDO or GCash (merchant details emailed once your order is confirmed). Always include the reference code in transfer notes so we can match it automatically. Then log the payment on the same order page with the bank reference + a screenshot URL.',
      },
      {
        slug: 'reference-code',
        title: 'Reference codes',
        body: "Every order has a short reference code (looks like SNAB12CD34). It's how Setnayan matches your bank transfer to your order. Paste it into the transfer notes — bank statements ingest it automatically and admin reconciles within one business day.",
      },
    ],
  },
  {
    key: 'account-privacy',
    label: 'Account & privacy',
    roles: ['couple', 'vendor', 'admin'],
    articles: [
      {
        slug: 'theme',
        title: 'Switch your dashboard theme',
        body: 'On Profile, pick one of five themes — Setnayan Default (burgundy), Victorian, Classy, iOS, Forest & Champagne Gold. The whole dashboard re-skins instantly. Public invitation site stays on Setnayan Default regardless.',
      },
      {
        slug: 'data-export',
        title: 'Export your data',
        body: 'On Profile → Privacy & data → "Download .json". You get a JSON file with your profile, event memberships, vendor profile (if any), and every chat message you authored. Audit log, R2 media, and payment records aren\'t in V1 (flagged in the export).',
      },
      {
        slug: 'delete-account',
        title: 'Delete your account',
        body: 'On Profile → Privacy & data → expand the Delete my account block → type DELETE to confirm. We soft-delete the account and sign you out. Internal admins can restore within 30 days; after that, deletion becomes permanent. RA 10173 right-to-erasure compliant.',
      },
    ],
  },
  // ─── Guest-role topics ──────────────────────────────────────────────
  {
    key: 'guest-getting-started',
    label: 'Got an invite?',
    roles: ['guest'],
    articles: [
      {
        slug: 'scan-qr-code',
        title: 'How to open your Setnayan invite',
        body: "Scan the QR code on your invitation card with your phone's camera. It opens your personal page at setnayan.com/e/[the-couple-slug]/g/[your-code]. Bookmark it — that's your one place for everything about the event (schedule, venue, RSVP, your seat).",
      },
      {
        slug: 'rsvp-from-link',
        title: 'How to RSVP',
        body: "Tap the RSVP button on your personal page. Pick Yes, No, or Maybe. If your invite allows a plus-one, add their name. You can change your answer up to the couple's RSVP cutoff (usually 1-2 weeks before).",
      },
      {
        slug: 'meal-preference',
        title: 'Meal preferences and dietary notes',
        body: 'If the couple is asking about meals (regular, vegetarian, halal, etc.), pick yours when you RSVP. It feeds into the caterer\'s count so there\'s something for you on the day. There\'s a free-text note for allergies or "I cannot have shellfish".',
      },
      {
        slug: 'lost-invite-link',
        title: 'I lost my invite link',
        body: 'Reach out to the couple — they can re-issue your QR from the Invitation admin. Your old link stops working immediately and you get a fresh one. Setnayan support cannot share invite links directly; the couple controls the guest list.',
      },
    ],
  },
  {
    key: 'guest-day-of',
    label: 'On the day',
    roles: ['guest'],
    articles: [
      {
        slug: 'find-your-table',
        title: 'Find your seat',
        body: "From T-1 hour on the wedding day, your personal page shows a 'Your table' card with the table number, a small venue map, and (if uploaded) a seat photo. No need to ask the host — open the page and head straight there.",
      },
      {
        slug: 'live-schedule',
        title: "What's happening right now",
        body: 'The Live schedule card auto-advances as the day moves — ceremony, cocktails, dinner, dances, send-off. You always know what\'s next and roughly when. Available T-1 hour to T+8 hours.',
      },
      {
        slug: 'photo-wall',
        title: 'Share photos with the couple',
        body: "If the couple has Photo Wall enabled, your phone becomes a photo uploader. Upload from your camera roll or take a new shot — it lands in the couple's gallery for everyone to enjoy. Optional and you can delete anything you uploaded.",
      },
    ],
  },
  // ─── Admin-role topics ──────────────────────────────────────────────
  {
    key: 'admin-console-basics',
    label: 'Setnayan HQ basics',
    roles: ['admin'],
    articles: [
      {
        slug: 'eight-surfaces',
        title: 'The 8 admin surfaces',
        body: '/admin has 8 sections: Users, Vendors, Orders, Reviews, Funnels, Force-majeure, Website editor, Verify queue. Each is gated to internal admins (`is_internal=TRUE` on your user row). The left sidebar persists across all 8.',
      },
      {
        slug: 'find-a-user-or-vendor',
        title: 'Look up a user or vendor',
        body: 'Use the search bar on /admin/users or /admin/vendors. Search by name, email, public ID (S89U- / S89V- / S89E-), or partial slug. Click through to the full record — every action you take from there writes an audit row.',
      },
      {
        slug: 'audit-log',
        title: 'Read the audit log',
        body: 'Every meaningful admin action writes a row to `admin_audit_log` (actor user_id, target, action, before/after JSON, timestamp). View it from any user or vendor detail page → Audit tab. Use it when investigating "who did this and when".',
      },
      {
        slug: 'delete-vs-blacklist',
        title: 'Delete vs blacklist a user',
        body: 'Delete = soft-delete + 30-day restore window (RA 10173 right-to-erasure). Blacklist = permanent ban from re-signing-up with same email or device fingerprint, used for fraud. Pick delete by default; only blacklist after the abuse pattern is confirmed.',
      },
    ],
  },
  {
    key: 'admin-approvals',
    label: 'Two-admin approvals',
    roles: ['admin'],
    articles: [
      {
        slug: 'what-needs-two-admins',
        title: 'What needs two-admin approval',
        body: 'Per Vendor Agreement § 9.1: major decisions need two admins. That means ad-revenue activation, vendor verification override, refund > ₱100,000, force-majeure bulk resolution, payment-method config change, and any blanket policy update. Routine ops (review moderation, user lookup, manual help reply) stay single-admin.',
      },
      {
        slug: 'approving-an-action',
        title: "Approve another admin's request",
        body: 'When another admin proposes a major action, you see it in your Approvals queue at /admin (bell counter). Open the proposal, read the rationale + linked evidence, click Approve or Reject. Both admins\' identities are recorded permanently in the audit log.',
      },
      {
        slug: 'routine-vs-major',
        title: 'Routine vs major — the rule of thumb',
        body: 'Routine = reversible by a single admin within 1 business day. Major = affects >100 users, financial impact ≥₱100,000, or touches public trust (verification, refunds, ad activation). When in doubt, route to two-admin. The cost of double-checking is small; the cost of an unreviewed major action can be very high.',
      },
    ],
  },
  {
    key: 'admin-force-majeure',
    label: 'Force-majeure escalations',
    roles: ['admin'],
    articles: [
      {
        slug: 'escalation-queue',
        title: 'Work the escalation queue',
        body: "/admin/force-majeure lists every flagged event. Each row shows: couple display name, event date, flag type (typhoon, illness, venue closure, etc.), evidence files the couple uploaded, the affected vendors, and the 7-day auto-resolution clock.",
      },
      {
        slug: 'seven-day-window',
        title: 'The 7-day auto-resolution window',
        body: 'When a force-majeure flag is filed, vendors have 7 days to propose terms directly with the couple in chat. If a resolution lands within 7 days, the flag closes without admin involvement. If day 7 passes with no resolution, the flag escalates to admin and shows up in your queue with an "ESCALATED" tag.',
      },
      {
        slug: 'four-resolution-paths',
        title: 'Four canonical resolution paths',
        body: 'Refund (vendor returns deposit minus documented expenses), reschedule (services move to a mutually agreed new date), substitute (vendor provides equivalent service later), partial (some services delivered, some refunded). Pick one in the Resolve dialog; both parties get an email with the outcome.',
      },
    ],
  },
];

// ───────────────────────────────────────────────────────────────────────────
// Per-article lookup helpers (SEO/GEO — /help/[slug] indexable article pages,
// 2026-06-13). Article slugs are GLOBALLY UNIQUE across all topics (verified),
// so a flat slug → article resolution is unambiguous and the public URL can be
// /help/[slug] with no topic segment.
//
// `HELP_LASTMOD` is the single honest last-substantive-edit date for the help
// corpus — every article was authored/last-revised together (GEO Phase G3,
// 2026-05-28). The sitemap-help route stamps every help URL with this one date
// rather than a build-time Date() (which Google reads as freshness fraud). Bump
// it in the same edit when an article body materially changes.
// ───────────────────────────────────────────────────────────────────────────

export const HELP_LASTMOD = '2026-05-28';

export type HelpArticleWithTopic = {
  article: HelpArticle;
  topic: HelpTopic;
};

/** Flat list of every article paired with its parent topic. */
export const ALL_HELP_ARTICLES: ReadonlyArray<HelpArticleWithTopic> =
  HELP_TOPICS.flatMap((topic) =>
    topic.articles.map((article) => ({ article, topic })),
  );

/** Resolve an article (and its topic) by its globally-unique slug. */
export function findHelpArticle(
  slug: string,
): HelpArticleWithTopic | undefined {
  return ALL_HELP_ARTICLES.find((entry) => entry.article.slug === slug);
}

/** Other articles in the same topic — used for "related" cross-links. */
export function relatedHelpArticles(
  slug: string,
  limit = 6,
): HelpArticle[] {
  const found = findHelpArticle(slug);
  if (!found) return [];
  return found.topic.articles
    .filter((a) => a.slug !== slug)
    .slice(0, limit);
}

/**
 * Trim an article body to a meta-description-friendly length (~155 chars) at a
 * word boundary, never mid-word, with an ellipsis when truncated.
 */
export function helpMetaDescription(body: string, max = 155): string {
  if (body.length <= max) return body;
  const slice = body.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}…`;
}
