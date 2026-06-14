import {
  Mail,
  QrCode,
  Globe,
  Send,
  Bell,
  type LucideIcon,
} from 'lucide-react';
import type { MarketingLocale } from '@/lib/marketing-i18n';

// Communications — invitations (0002), QR codes (0002), guest microsite,
// RSVP tracking, email notifications (0028). Not vendor↔couple chat
// (that's 0019, queued; appears on the homepage forward-reference list,
// not the V1 features page).
//
// Bilingual (EN + Taglish). META (icon + iteration tag) is language-neutral
// and zips with COPY[locale].items by index — keep both arrays in lockstep.
// 2026-06-13: guest-microsite "EN / TL / CEB toggle" corrected to "EN / TL"
// (Cebuano was dropped from the public locale set the same day).

const META: { Icon: LucideIcon; iteration: string }[] = [
  { Icon: Mail, iteration: 'Iteration 0002' },
  { Icon: QrCode, iteration: 'Iteration 0002' },
  { Icon: Globe, iteration: 'Iteration 0002' },
  { Icon: Send, iteration: 'Iteration 0001' },
  { Icon: Bell, iteration: 'Iteration 0028' },
];

const COPY: Record<
  MarketingLocale,
  {
    eyebrow: string;
    heading: string;
    intro: string;
    items: { title: string; body: string }[];
  }
> = {
  en: {
    eyebrow: 'Section 2 · Talking to your guests',
    heading: 'One link replaces every group chat.',
    intro:
      'Personal QR invitations, a guest-side microsite that updates in real time, RSVP tracking, and email notifications that respect your guests’ inbox. No more “wait, when’s the wedding again?” in your DMs at 11pm.',
    items: [
      {
        title: 'Personal QR invitations',
        body: 'Each guest gets a personal invitation site with a branded QR — your monogram in the center, your colors, your URL. Print sheet ready, share-by-link ready, MMS-ready. We render every invite at three aspect ratios so you can post the same invite to a story, a feed, or a print sheet without re-cropping.',
      },
      {
        title: 'QR codes that do more than open a URL',
        body: 'Each guest’s QR carries their identity. Scanned at the door, it checks them in. Scanned by the photo crew (Papic), it tags candid photos to that guest. Scanned at the photo booth, it pulls their preferred email so the gallery shows up where they actually check.',
      },
      {
        title: 'Guest microsite — one URL, every detail',
        body: 'Your /event-slug page is the source of truth for guests: directions to the venue, dress code, the timeline, the gift registry, the live stream link on the day. Multilingual EN / TL toggle. No signup required for guests — they just open the link.',
      },
      {
        title: 'RSVP that just works',
        body: 'Three buttons: I’ll be there, I can’t make it, maybe. Plus-one count, dietary preferences, optional song request. Couples see live counts; guests skip the spreadsheet. Closes automatically at your RSVP cutoff so you can finalize seating without chasing latecomers.',
      },
      {
        title: 'Email notifications that don’t feel like spam',
        body: 'Just the things you actually need to know about: an RSVP came in, a vendor sent a message, a payment is due in 7 days. No marketing blasts, no daily digests, no cross-promotion. Per-event delivery preferences (per channel, per category). Unsubscribe is one click and per-channel.',
      },
    ],
  },
  tl: {
    eyebrow: 'Section 2 · Pakikipag-usap sa mga guest mo',
    heading: 'Isang link, kapalit ng lahat ng group chat.',
    intro:
      'Personal QR invitations, isang guest-side microsite na nag-a-update real-time, RSVP tracking, at email notifications na gumagalang sa inbox ng mga guest mo. Wala nang “teka, kailan nga ulit ang kasal?” sa DMs mo nang alas-onse ng gabi.',
    items: [
      {
        title: 'Personal QR invitations',
        body: 'Bawat guest ay may sariling invitation site na may branded QR — ang monogram mo sa gitna, ang colors mo, ang URL mo. Print sheet ready, share-by-link ready, MMS-ready. Nire-render namin ang bawat invite sa tatlong aspect ratio para ma-post mo ang parehong invite sa story, feed, o print sheet nang hindi nire-crop ulit.',
      },
      {
        title: 'QR codes na hindi lang basta nagbubukas ng URL',
        body: 'Ang QR ng bawat guest ay may dalang identity nila. Pag na-scan sa pinto, naka-check in na sila. Pag na-scan ng photo crew (Papic), nata-tag ang candid photos sa guest na ‘yun. Pag na-scan sa photo booth, kinukuha nito ang preferred email nila para lumabas ang gallery sa talagang chineck nila.',
      },
      {
        title: 'Guest microsite — isang URL, lahat ng detalye',
        body: 'Ang /event-slug page mo ang source of truth para sa mga guest: direksyon papunta sa venue, dress code, ang timeline, ang gift registry, ang live stream link sa mismong araw. Multilingual EN / TL toggle. Walang signup na kailangan ang mga guest — binubuksan lang nila ang link.',
      },
      {
        title: 'RSVP na gumagana talaga',
        body: 'Tatlong button: pupunta ako, hindi ako makakapunta, baka. Plus-one count, dietary preferences, optional song request. Nakikita ng couples ang live counts; ang guests, hindi na kailangan ng spreadsheet. Awtomatikong nagsasara sa RSVP cutoff mo para ma-finalize mo ang seating nang hindi hinahabol ang mga huli.',
      },
      {
        title: 'Email notifications na hindi parang spam',
        body: '‘Yung mga bagay lang talaga na kailangan mong malaman: may dumating na RSVP, may nagpadala ng message na vendor, may bayarin na due sa loob ng 7 araw. Walang marketing blasts, walang daily digests, walang cross-promotion. Per-event delivery preferences (per channel, per category). One click lang ang unsubscribe, at per-channel.',
      },
    ],
  },
};

export function Communications({ locale }: { locale: MarketingLocale }) {
  const c = COPY[locale];
  return (
    <section
      id="communications"
      aria-labelledby="communications-heading"
      className="scroll-mt-24 border-b border-ink/5 bg-cream"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <header className="mb-10 max-w-2xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            {c.eyebrow}
          </p>
          <h2
            id="communications-heading"
            className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
          >
            {c.heading}
          </h2>
          <p className="text-base text-ink/65">{c.intro}</p>
        </header>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {c.items.map((item, i) => {
            const { Icon, iteration } = META[i]!;
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
                    {iteration}
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
