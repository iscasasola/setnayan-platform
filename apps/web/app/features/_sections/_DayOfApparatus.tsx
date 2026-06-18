import Link from 'next/link';
import {
  Tv,
  Camera,
  Video,
  Palette,
  Lightbulb,
  Music,
  CloudUpload,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react';
import type { MarketingLocale } from '@/lib/marketing-i18n';

// Day-of apparatus (in-app services) — Panood, Papic, Patiktok, Pakulay,
// Pailaw, Pakanta, Photo Delivery, Supplies Marketplace. One card per
// service. NO PHP figures (prices live on /pricing and the in-app cart).
//
// Bilingual (EN + Taglish). META (icon + SKU brand name) is language-neutral
// — SKU names are NOT translated — and zips with COPY[locale].services by
// index. Keep both arrays in lockstep.

const META: { Icon: LucideIcon; sku: string }[] = [
  { Icon: Tv, sku: 'Panood' },
  { Icon: Camera, sku: 'Papic' },
  { Icon: Video, sku: 'Patiktok' },
  { Icon: Palette, sku: 'Pakulay' },
  { Icon: Lightbulb, sku: 'Pailaw' },
  { Icon: Music, sku: 'Pakanta' },
  { Icon: CloudUpload, sku: 'Photo Delivery' },
  { Icon: ShoppingBag, sku: 'Supplies Marketplace' },
];

type ServiceCopy = { tagline: string; body: string; pricingLabel?: string };

const COPY: Record<
  MarketingLocale,
  {
    eyebrow: string;
    heading: string;
    introA: string;
    introB: string;
    pricingPrefix: string;
    services: ServiceCopy[];
  }
> = {
  en: {
    eyebrow: 'Section 4 · The day-of apparatus',
    heading: 'When the day comes, we bring the gear.',
    introA:
      'Live broadcast. Same-day edit. Paparazzi capture. Personal monogram. The on-the-day apparatus that turns a wedding into a story your guests can replay forever — built into the same app you used to plan it. Fixed PHP prices live on ',
    introB: '; this page is the feature catalog.',
    pricingPrefix: 'Pricing on',
    services: [
      {
        tagline: 'Multi-cam live broadcast',
        body: 'Up to six cameras, one broadcaster, broadcast on your own YouTube channel via BYO OAuth. AI Highlight reels post-event. Family who can’t make it sees every moment in 1080p, on whatever device they’re on.',
      },
      {
        tagline: 'Designated paparazzi',
        body: 'Native iOS/Android app for friends and family. Gesture shutter, QR-tag photos to specific guests or whole tables, untagged photos still land in the couple’s gallery. Real-time delivery — guests can flip through tagged photos before the reception is over.',
      },
      {
        tagline: 'TikTok-format booth at the venue',
        body: 'A booth station capturing 30-second TikTok-format videos from your guests during cocktail or reception. Two tiers: post to your own TikTok handle, or to Setnayan’s curated showcase. Compilation arrives in your gallery the next morning.',
      },
      {
        tagline: 'Mood-board engine',
        body: 'Per-role + per-venue palettes with the Setnayan Guide rule engine catching contrast / temperature / cultural-default mistakes before they hit the printer. Vendors get a live link, not a screenshot — they always reference the latest palette.',
        pricingLabel: 'Free baseline · Pro renders V1.1+',
      },
      {
        tagline: 'LED background maker',
        body: '8K loop generators for venue LED walls. USB-deliverable for offline playback at venues with no reliable internet. Match the loop to your palette and the visual language of your day reads consistently from the entrance to the dance floor.',
      },
      {
        tagline: 'A wedding song written for the two of you',
        body: 'Custom song composition + recording for your wedding day. Tell Setnayan your story — one original, full-production, AI-generated song, royalty-free and yours forever. Pakanta becomes the soundtrack for every Setnayan-rendered video at your wedding.',
      },
      {
        tagline: 'Full-res handoff after the day',
        body: 'Connect your photographer’s Google Drive — Setnayan pipes full-resolution albums into the couple’s gallery post-event, with a 30-day grace window before automated storage tiering compresses the originals. Keep your raws as long as you need.',
      },
      {
        tagline: 'Wedding-day supplies, one bill',
        body: 'Vetted Filipino vendors for prints, equipment rentals, NFC keepsakes, and reception decor — direct-to-venue, on one Setnayan invoice. Everything the software needs to land in the physical world, sourced from one place.',
      },
    ],
  },
  tl: {
    eyebrow: 'Section 4 · The day-of apparatus',
    heading: 'Pagdating ng araw, kami ang magdadala ng gear.',
    introA:
      'Live broadcast. Same-day edit. Paparazzi capture. Personal monogram. Ang on-the-day apparatus na gumagawa sa kasal na maging kwentong pwedeng i-replay ng mga guest mo habambuhay — naka-build sa parehong app na ginamit mo sa pagpaplano. Fixed PHP prices, nasa ',
    introB: '; ang page na ito ang feature catalog.',
    pricingPrefix: 'Pricing nasa',
    services: [
      {
        tagline: 'Multi-cam live broadcast',
        body: 'Hanggang anim na camera, isang broadcaster, i-broadcast sa sarili mong YouTube channel via BYO OAuth. AI Highlight reels pagkatapos ng event. Ang pamilyang hindi makakapunta, makikita ang bawat sandali in 1080p, kahit anong device ang gamit nila.',
      },
      {
        tagline: 'Designated paparazzi',
        body: 'Native iOS/Android app para sa mga kaibigan at pamilya. Gesture shutter, QR-tag ang photos sa specific guests o buong tables, ang untagged photos ay lalapag pa rin sa gallery ng couple. Real-time delivery — pwede nang tingnan ng guests ang tagged photos nila bago pa matapos ang reception.',
      },
      {
        tagline: 'TikTok-format booth sa venue',
        body: 'Isang booth station na kumukuha ng 30-second TikTok-format videos mula sa guests mo tuwing cocktail o reception. Dalawang tier: i-post sa sarili mong TikTok handle, o sa curated showcase ng Setnayan. Dumarating ang compilation sa gallery mo kinabukasan ng umaga.',
      },
      {
        tagline: 'Mood-board engine',
        body: 'Per-role + per-venue palettes kasama ang Setnayan Guide rule engine na nakakahuli ng contrast / temperature / cultural-default na mga mali bago pa mapunta sa printer. May live link ang vendors, hindi screenshot — laging ang pinakabagong palette ang reference nila.',
        pricingLabel: 'Free baseline · Pro renders V1.1+',
      },
      {
        tagline: 'LED background maker',
        body: '8K loop generators para sa venue LED walls. USB-deliverable para sa offline playback sa mga venue na walang maaasahang internet. I-match ang loop sa palette mo at magiging consistent ang visual language ng araw mo mula entrance hanggang dance floor.',
      },
      {
        tagline: 'Isang kasal na kanta, ginawa para sa inyong dalawa',
        body: 'Custom song composition + recording para sa wedding day mo. Ibahagi ang inyong kwento kay Setnayan — isang original, full-production, AI-generated na kanta, royalty-free at sa inyo habambuhay. Nagiging soundtrack ng bawat Setnayan-rendered video sa kasal ninyo ang Pakanta.',
      },
      {
        tagline: 'Full-res handoff pagkatapos ng araw',
        body: 'I-connect ang Google Drive ng photographer mo — ipa-pipe ng Setnayan ang full-resolution albums papunta sa gallery ng couple pagkatapos ng event, may 30-day grace window bago i-compress ng automated storage tiering ang originals. Itago ang raws mo hangga’t kailangan mo.',
      },
      {
        tagline: 'Wedding-day supplies, isang bill',
        body: 'Vetted na Filipino vendors para sa prints, equipment rentals, NFC keepsakes, at reception decor — direct-to-venue, sa isang Setnayan invoice. Lahat ng kailangan ng software para mapunta sa physical world, galing sa isang lugar.',
      },
    ],
  },
};

export function DayOfApparatus({ locale }: { locale: MarketingLocale }) {
  const c = COPY[locale];
  return (
    <section
      id="day-of-apparatus"
      aria-labelledby="day-of-apparatus-heading"
      className="scroll-mt-24 border-b border-ink/5 bg-cream"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <header className="mb-10 max-w-2xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            {c.eyebrow}
          </p>
          <h2
            id="day-of-apparatus-heading"
            className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
          >
            {c.heading}
          </h2>
          <p className="text-base text-ink/65">
            {c.introA}
            <Link
              href="/pricing"
              className="underline decoration-ink/30 underline-offset-2 hover:text-terracotta hover:decoration-terracotta"
            >
              /pricing
            </Link>
            {c.introB}
          </p>
        </header>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {c.services.map((s, i) => {
            const { Icon, sku } = META[i]!;
            return (
              <li
                key={sku}
                className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-5"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                  <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold tracking-tight text-ink">
                    {sku}
                  </h3>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
                    {s.tagline}
                  </p>
                </div>
                <p
                  className="text-sm text-ink/65"
                  dangerouslySetInnerHTML={{ __html: s.body }}
                />
                <p className="mt-auto pt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
                  {s.pricingLabel ?? (
                    <>
                      {c.pricingPrefix}{' '}
                      <Link
                        href="/pricing"
                        className="underline decoration-ink/30 underline-offset-2 hover:text-terracotta hover:decoration-terracotta"
                      >
                        /pricing
                      </Link>
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
