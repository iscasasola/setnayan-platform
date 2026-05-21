import {
  Mail,
  QrCode,
  Globe,
  Send,
  Bell,
  type LucideIcon,
} from 'lucide-react';

// Communications — invitations (0002), QR codes (0002), guest microsite,
// RSVP tracking, email notifications (0028). Not vendor↔couple chat
// (that's 0019, queued; appears on the homepage forward-reference list,
// not the V1 features page).

type Item = {
  Icon: LucideIcon;
  title: string;
  body: string;
  iteration: string;
};

const ITEMS: Item[] = [
  {
    Icon: Mail,
    title: 'Personal QR invitations',
    body: 'Each guest gets a personal invitation site with a branded QR — your monogram in the center, your colors, your URL. Print sheet ready, share-by-link ready, MMS-ready. We render every invite at three aspect ratios so you can post the same invite to a story, a feed, or a print sheet without re-cropping.',
    iteration: 'Iteration 0002',
  },
  {
    Icon: QrCode,
    title: 'QR codes that do more than open a URL',
    body: 'Each guest&rsquo;s QR carries their identity. Scanned at the door, it checks them in. Scanned by the photo crew (Papic), it tags candid photos to that guest. Scanned at the photo booth, it pulls their preferred email so the gallery shows up where they actually check.',
    iteration: 'Iteration 0002',
  },
  {
    Icon: Globe,
    title: 'Guest microsite — one URL, every detail',
    body: 'Your /event-slug page is the source of truth for guests: directions to the venue, dress code, the timeline, the gift registry, the live stream link on the day. Multilingual EN / TL / CEB toggle. No signup required for guests — they just open the link.',
    iteration: 'Iteration 0002',
  },
  {
    Icon: Send,
    title: 'RSVP that just works',
    body: 'Three buttons: I&rsquo;ll be there, I can&rsquo;t make it, maybe. Plus-one count, dietary preferences, optional song request. Couples see live counts; guests skip the spreadsheet. Closes automatically at your RSVP cutoff so you can finalize seating without chasing latecomers.',
    iteration: 'Iteration 0001',
  },
  {
    Icon: Bell,
    title: 'Email notifications that don&rsquo;t feel like spam',
    body: 'Just the things you actually need to know about: an RSVP came in, a vendor sent a message, a payment is due in 7 days. No marketing blasts, no daily digests, no cross-promotion. Per-event delivery preferences (per channel, per category). Unsubscribe is one click and per-channel.',
    iteration: 'Iteration 0028',
  },
];

export function Communications() {
  return (
    <section
      id="communications"
      aria-labelledby="communications-heading"
      className="scroll-mt-24 border-b border-ink/5 bg-cream"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <header className="mb-10 max-w-2xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Section 2 &middot; Talking to your guests
          </p>
          <h2
            id="communications-heading"
            className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
          >
            One link replaces every group chat.
          </h2>
          <p className="text-base text-ink/65">
            Personal QR invitations, a guest-side microsite that updates in
            real time, RSVP tracking, and email notifications that respect
            your guests&rsquo; inbox. No more &ldquo;wait, when&rsquo;s the
            wedding again?&rdquo; in your DMs at 11pm.
          </p>
        </header>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ITEMS.map((item) => {
            const { Icon } = item;
            return (
              <li
                key={item.title}
                className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                    <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">
                    {item.iteration}
                  </span>
                </div>
                <h3
                  className="text-base font-semibold tracking-tight text-ink"
                  dangerouslySetInnerHTML={{ __html: item.title }}
                />
                <p
                  className="text-sm text-ink/65"
                  dangerouslySetInnerHTML={{ __html: item.body }}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
