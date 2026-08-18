import Link from 'next/link';
import {
  Tv,
  Camera,
  Video,
  Palette,
  Music,
  CloudUpload,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react';
import type { MarketingLocale } from '@/lib/marketing-i18n';

// Day-of apparatus (in-app services) — Panood, Papic, Patiktok, Pakulay,
// Pakanta, Photo Delivery, Supplies Marketplace. One card per service. NO PHP
// figures (prices live on /pricing and the in-app cart).
//
// Bilingual (EN + Taglish). META (icon + SKU brand name) is language-neutral
// — SKU names are NOT translated — and zips with COPY[locale].services BY
// INDEX. Keep all THREE arrays in lockstep: META, COPY.en.services and
// COPY.tl.services. Dropping a service from one and not the others does not
// error — it silently prints the next service's words under this one's icon
// and brand name. `LOCKSTEP` below fails the build instead.
//
// Pailaw (LED background) was slot 4 and was REMOVED 2026-08-11 from all three
// (owner: "remove wall backdrop") — it promised an 8K file and a posted USB
// that nothing produced.

const META: { Icon: LucideIcon; sku: string }[] = [
  { Icon: Tv, sku: 'Live Studio' },
  { Icon: Camera, sku: 'Papic' },
  { Icon: Video, sku: 'Patiktok' },
  { Icon: Palette, sku: 'Pakulay' },
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
      'Live broadcast. Paparazzi capture. Personal monogram. The on-the-day apparatus that turns a wedding into a story your guests can replay, built into the same app you used to plan it. Fixed PHP prices live on ',
    introB: '; this page is the feature catalog.',
    pricingPrefix: 'Pricing on',
    services: [
      {
        tagline: 'Livestream · free single-cam, paid multicam',
        body: 'Go live to YouTube, free, embedded right on your event page and auto-archived. Setnayan sets the broadcast up; you run the stream from a laptop using free streaming software like OBS. Family who can’t make it sees every moment in 1080p, on whatever device they’re on. Upgrade to the multicam control room when you want several cameras, one-tap moment switching, and your monogram and lower-third on the broadcast.',
      },
      {
        tagline: 'Designated paparazzi',
        body: 'One shared pot of shots, in the browser — no app to install. Any guest’s phone can spend from it after scanning the event QR, and the couple can set some aside for one camera’s QR so the person they trust never runs out; when those run out that camera carries on from the pot. Cameras are free and unlimited. QR-tag photos to specific guests or whole tables, untagged photos still land in the couple’s gallery. Real-time delivery, guests can flip through tagged photos before the reception is over.',
      },
      {
        tagline: 'TikTok-format booth at the venue',
        body: 'A booth station capturing 30-second TikTok-format videos from your guests during cocktail or reception. Two tiers: post to your own TikTok handle, or to Setnayan’s curated showcase. Compilation arrives in your gallery the next morning.',
      },
      {
        tagline: 'Mood-board engine',
        body: 'Per-role + per-venue palettes with the Setnayan Guide rule engine catching contrast / temperature / cultural-default mistakes before they hit the printer. Vendors get a live link, not a screenshot. They always reference the latest palette.',
        pricingLabel: 'Free baseline · Pro renders V1.1+',
      },
      {
        tagline: 'A wedding song written for the two of you',
        body: 'Custom song composition + recording for your wedding day. Tell Setnayan your story, one original, full-production, AI-generated song, royalty-free and yours forever. Pakanta becomes the soundtrack for every Setnayan-rendered video at your wedding.',
      },
      {
        tagline: 'Full-res handoff after the day',
        // ⚠ Ended "Keep your raws as long as you need." — a public promise we do
        // not keep: full-resolution originals are dropped six months after the
        // event's first capture. The Drive folder is what makes "as long as you
        // need" true, so the sentence now points at the thing that delivers it.
        body: 'Connect your photographer’s Google Drive. Setnayan pipes full-resolution albums into the couple’s gallery post-event. We hold the full-resolution originals for 6 months and keep the compressed gallery online, free, for life — connect Drive and every original also lands in a folder you own, to keep.',
      },
      {
        tagline: 'Wedding-day supplies, one bill',
        body: 'Vetted Filipino vendors for prints, equipment rentals, NFC keepsakes, and reception decor, direct-to-venue, on one Setnayan invoice. Everything the software needs to land in the physical world, sourced from one place.',
      },
    ],
  },
  tl: {
    eyebrow: 'Section 4 · The day-of apparatus',
    heading: 'Pagdating ng araw, kami ang magdadala ng gear.',
    introA:
      'Live broadcast. Paparazzi capture. Personal monogram. Ang on-the-day apparatus na gumagawa sa kasal na maging kwentong pwedeng i-replay ng mga guest mo habambuhay, naka-build sa parehong app na ginamit mo sa pagpaplano. Fixed PHP prices, nasa ',
    introB: '; ang page na ito ang feature catalog.',
    pricingPrefix: 'Pricing nasa',
    services: [
      {
        tagline: 'Livestream · libre single-cam, bayad multicam',
        body: 'Mag-live sa YouTube, libre, naka-embed mismo sa event page mo, auto-archived. Ang Setnayan ang bahala sa pag-set up ng broadcast; ikaw ang magpapatakbo ng stream mula sa laptop gamit ang libreng streaming software tulad ng OBS. Ang pamilyang hindi makakapunta, makikita ang bawat sandali in 1080p, kahit anong device ang gamit nila. Mag-upgrade sa multicam control room kapag gusto mo ng maraming camera, one-tap moment switching, at ang monogram at lower-third mo sa broadcast.',
      },
      {
        tagline: 'Designated paparazzi',
        body: 'Isang shared na shots, sa browser — walang app na i-install. Pwedeng gamitin ng kahit sinong guest pagka-scan ng event QR, at pwedeng magtabi ang couple ng shots para sa isang camera lang para hindi maubusan ang pinagkakatiwalaan nila; pag naubos iyon, tuloy pa rin ang camera na iyon mula sa shared na shots. Libre at walang limitasyon ang cameras. QR-tag ang photos sa specific guests o buong tables, ang untagged photos ay lalapag pa rin sa gallery ng couple. Real-time delivery, pwede nang tingnan ng guests ang tagged photos nila bago pa matapos ang reception.',
      },
      {
        tagline: 'TikTok-format booth sa venue',
        body: 'Isang booth station na kumukuha ng 30-second TikTok-format videos mula sa guests mo tuwing cocktail o reception. Dalawang tier: i-post sa sarili mong TikTok handle, o sa curated showcase ng Setnayan. Dumarating ang compilation sa gallery mo kinabukasan ng umaga.',
      },
      {
        tagline: 'Mood-board engine',
        body: 'Per-role + per-venue palettes kasama ang Setnayan Guide rule engine na nakakahuli ng contrast / temperature / cultural-default na mga mali bago pa mapunta sa printer. May live link ang vendors, hindi screenshot. Laging ang pinakabagong palette ang reference nila.',
        pricingLabel: 'Free baseline · Pro renders V1.1+',
      },
      {
        tagline: 'Isang kasal na kanta, ginawa para sa inyong dalawa',
        body: 'Custom song composition + recording para sa wedding day mo. Ibahagi ang inyong kwento kay Setnayan, isang original, full-production, AI-generated na kanta, royalty-free at sa inyo habambuhay. Nagiging soundtrack ng bawat Setnayan-rendered video sa kasal ninyo ang Pakanta.',
      },
      {
        tagline: 'Full-res handoff pagkatapos ng araw',
        // ⚠ THE ENGLISH TWIN WAS CORRECTED AND THIS ONE WAS NOT — for months,
        // on the live public /tl/features page. It kept BOTH halves of the
        // retracted promise: a "30-day grace window" that exists nowhere in the
        // product, and "Itago ang raws mo hangga't kailangan mo" — the literal
        // translation of "Keep your raws as long as you need", which the comment
        // 40 lines above records as "a public promise we do not keep".
        //
        // 🔑 A COPY FIX IS NOT DONE UNTIL EVERY LANGUAGE IS FIXED. The English
        // correction read as complete because the file it lived in looked fixed.
        // Whenever you edit user-facing prose here, grep the other locale block
        // in the SAME file before you commit.
        body: 'I-connect ang Google Drive ng photographer mo. Ipa-pipe ng Setnayan ang full-resolution albums papunta sa gallery ng couple pagkatapos ng event. Hawak namin ang full-resolution originals nang 6 na buwan, at mananatiling online ang compressed gallery nang libre sa loob ng 5 taon — i-connect ang Drive at mapupunta rin ang bawat original sa folder na sa iyo, para itago.',
      },
      {
        tagline: 'Wedding-day supplies, isang bill',
        body: 'Vetted na Filipino vendors para sa prints, equipment rentals, NFC keepsakes, at reception decor, direct-to-venue, sa isang Setnayan invoice. Lahat ng kailangan ng software para mapunta sa physical world, galing sa isang lugar.',
      },
    ],
  },
};

// THE LOCKSTEP, as a mechanism rather than the sentence above it. META is
// zipped with COPY[locale].services by index, so a service dropped from one
// array and not the others does NOT error — it prints the next service's
// words under this one's icon and brand name, which reads as a real (wrong)
// product. This is static data, so a mismatch can only be introduced while
// editing: it fails `next build` (a required check) and can never throw for a
// visitor. Added 2026-08-11 when removing Pailaw from all three at once.
for (const [locale, copy] of Object.entries(COPY)) {
  if (copy.services.length !== META.length) {
    throw new Error(
      `_DayOfApparatus: COPY.${locale}.services has ${copy.services.length} entries but ` +
        `META has ${META.length}. They are zipped by index — fix both, or the page ` +
        `prints one service's copy under another's name.`,
    );
  }
}

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
