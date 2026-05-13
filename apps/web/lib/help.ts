export type HelpArticle = {
  slug: string;
  title: string;
  body: string;
};

export type HelpTopic = {
  key: string;
  label: string;
  articles: HelpArticle[];
};

export const HELP_TOPICS: ReadonlyArray<HelpTopic> = [
  {
    key: 'getting-started',
    label: 'Getting started',
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
    articles: [
      {
        slug: 'invitation-site',
        title: 'What\'s the invitation site?',
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
        title: 'Re-issue a guest\'s QR code',
        body: 'If a guest loses their link or shares it, you can invalidate the old token. On the Invitation admin, find the guest row → "Re-issue token". Old QR stops working immediately; new QR is ready to share.',
      },
    ],
  },
  {
    key: 'vendors-budget',
    label: 'Vendors & budget',
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
    articles: [
      {
        slug: 'palette-tiers',
        title: 'Palette tiers',
        body: 'Mood Board groups your palettes into three families: Venue (Ceremony 1-3 colors, Reception 3-6 with dominant/supporting/accent slots), Couple (Bride 1-3, Groom 1-3), and Roles (Wedding Party 3-6, Sponsors 1-3 each, Plain guests 3-6). Role palettes only show when you have guests in that role.',
      },
      {
        slug: 'palette-chip-dot',
        title: 'How the palette shows up in the guest list',
        body: 'Each role chip in the Guest List grows a small colored dot when you\'ve set a palette for that role. The dot shows the first color of the palette as a visual signal — see the full palette on the Mood Board page.',
      },
    ],
  },
  {
    key: 'messaging',
    label: 'Messaging',
    articles: [
      {
        slug: 'start-thread-with-vendor',
        title: 'Start a thread with a vendor',
        body: 'On the Messages tab, type the vendor\'s contact email. If they have a Setnayan vendor profile with that email, Setnayan creates a thread between you both. Re-opening a thread between the same event + vendor resumes the existing conversation — no duplicates.',
      },
      {
        slug: 'identity-masking',
        title: 'Vendors don\'t see your email',
        body: 'When a vendor opens a thread, they see only your event\'s display name and date — never your email or personal name. You control how you\'re identified by the display_name you set on your event. This is locked behavior in V1.',
      },
    ],
  },
  {
    key: 'orders-payments',
    label: 'Orders & payments',
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
        body: 'Every order has a short reference code (looks like SNAB12CD34). It\'s how Setnayan matches your bank transfer to your order. Paste it into the transfer notes — bank statements ingest it automatically and admin reconciles within one business day.',
      },
    ],
  },
  {
    key: 'account-privacy',
    label: 'Account & privacy',
    articles: [
      {
        slug: 'theme',
        title: 'Switch your dashboard theme',
        body: 'On Profile, pick one of four themes — Setnayan Default, Victorian, Classy, iOS. The whole dashboard re-skins instantly. Public invitation site stays on Setnayan Default regardless.',
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
];
