import {
  Tv,
  Camera,
  Film,
  Palette,
  Lightbulb,
  Aperture,
  Sparkles,
  CloudUpload,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react';

// Day-of apparatus (in-app services) — Panood, Papic, Pamahiya, Pakulay,
// Pailaw, Pareto, Custom Monogram. One card per service. NO PHP figures
// (per spec: prices hidden on public site, route to /apply for quotes).

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
    Icon: Film,
    sku: 'Pamahiya',
    tagline: 'Personal souvenir reels',
    body: 'Every guest renders their own 1&ndash;30 second reel from a template library, scored to Setnayan-owned music. Their reel pulls only photos they&rsquo;re tagged in, so it feels like their wedding too. Shareable to socials with one tap.',
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
    Icon: Aperture,
    sku: 'Pareto',
    tagline: 'Pro camera bridge',
    body: 'Pair a DSLR (Canon / Nikon / Sony / Fujifilm) with the Papic phone for broadcast-grade glass without changing the operator&rsquo;s workflow. The phone handles connectivity, tagging, and delivery; the DSLR handles the image.',
  },
  {
    Icon: Sparkles,
    sku: 'Custom Monogram Pack',
    tagline: 'Your mark, everywhere',
    body: 'One purchase replaces the Setnayan watermark with the couple&rsquo;s monogram across every media output — invitations, broadcast lower-thirds, photo overlays, gallery downloads, souvenir reels. Designed for you by the Setnayan Team during onboarding.',
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
