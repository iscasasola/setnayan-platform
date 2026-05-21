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

// Day-of apparatus (in-app services) — Panood, Papic, Patiktok, Pakulay,
// Pailaw, Pakanta, Photo Delivery, Supplies Marketplace. One card per
// service. NO PHP figures (prices live on /pricing and the in-app cart).
// Two cards removed 2026-05-22 — Pro Camera Bridge never shipped to V1;
// monogram-pack copy superseded by Bespoke Monogram (iteration 0037).
// Two cards added 2026-05-22 — Patiktok (iteration 0017) + Pakanta
// (iteration 0036) per Task #14, Sweep 5 audit rows 21 + 22.

type Service = {
  Icon: LucideIcon;
  sku: string;
  tagline: string;
  body: string;
};

const SERVICES: Service[] = [
  {
    Icon: Tv,
    sku: 'Panood',
    tagline: 'Multi-cam live broadcast',
    body: 'Up to five cameras, one broadcaster, broadcast on YouTube. Custom monogram + Broadcast Style Pack support. AI Highlight reels post-event. Family who can&rsquo;t make it sees every moment in 1080p, on whatever device they&rsquo;re on.',
  },
  {
    Icon: Camera,
    sku: 'Papic',
    tagline: 'Designated paparazzi',
    body: 'Native iOS/Android app for friends and family. Gesture shutter, QR-tag photos to specific guests or whole tables, untagged photos still land in the couple&rsquo;s gallery. Real-time delivery — guests can flip through tagged photos before the reception is over.',
  },
  {
    Icon: Video,
    sku: 'Patiktok',
    tagline: 'TikTok-format booth at the venue',
    body: 'A booth station capturing 30-second TikTok-format videos from your guests during cocktail or reception. Two tiers: post to your own TikTok handle, or to Setnayan&rsquo;s curated showcase. Compilation arrives in your gallery the next morning.',
  },
  {
    Icon: Palette,
    sku: 'Pakulay',
    tagline: 'Mood-board engine',
    body: 'Per-role + per-venue palettes with the Setnayan Guide rule engine catching contrast / temperature / cultural-default mistakes before they hit the printer. Vendors get a live link, not a screenshot — they always reference the latest palette.',
  },
  {
    Icon: Lightbulb,
    sku: 'Pailaw',
    tagline: 'LED background maker',
    body: '8K loop generators for venue LED walls. USB-deliverable for offline playback at venues with no reliable internet. Match the loop to your palette and the visual language of your day reads consistently from the entrance to the dance floor.',
  },
  {
    Icon: Music,
    sku: 'Pakanta',
    tagline: 'A wedding song written for the two of you',
    body: 'Custom song composition + recording for your wedding day. Three tiers: Basic for a 60-second pure-vocal piece, Premium for full production with your love story woven through, Wedding Suite for ceremony processional + reception entrance + first-dance song bundle. All Setnayan-AI-generated, royalty-free, yours forever.',
  },
  {
    Icon: CloudUpload,
    sku: 'Photo Delivery',
    tagline: 'Full-res handoff after the day',
    body: 'Connect your photographer&rsquo;s Google Drive — Setnayan pipes full-resolution albums into the couple&rsquo;s gallery post-event, with a 30-day grace window before automated storage tiering compresses the originals. Keep your raws as long as you need.',
  },
  {
    Icon: ShoppingBag,
    sku: 'Supplies Marketplace',
    tagline: 'Wedding-day supplies, one bill',
    body: 'Vetted Filipino vendors for prints, equipment rentals, NFC keepsakes, and reception decor &mdash; direct-to-venue, on one Setnayan invoice. Everything the software needs to land in the physical world, sourced from one place.',
  },
];

export function DayOfApparatus() {
  return (
    <section
      id="day-of-apparatus"
      aria-labelledby="day-of-apparatus-heading"
      className="scroll-mt-24 border-b border-ink/5 bg-cream"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <header className="mb-10 max-w-2xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Section 4 &middot; The day-of apparatus
          </p>
          <h2
            id="day-of-apparatus-heading"
            className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
          >
            When the day comes, we bring the gear.
          </h2>
          <p className="text-base text-ink/65">
            Live broadcast. Same-day edit. Paparazzi capture. Personal
            monogram. The on-the-day apparatus that turns a wedding into a
            story your guests can replay forever &mdash; built into the same
            app you used to plan it. Quotes per event &mdash; no PHP figures
            shown.
          </p>
        </header>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => {
            const { Icon } = s;
            return (
              <li
                key={s.sku}
                className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-5"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                  <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold tracking-tight text-ink">
                    {s.sku}
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
                  Included in your custom quote
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
