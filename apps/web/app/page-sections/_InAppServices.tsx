import Image from 'next/image';
import Link from 'next/link';
import {
  Camera,
  Tv,
  Palette,
  Lightbulb,
  Aperture,
  Sparkles,
  Layout,
  Wand2,
  CloudUpload,
  ShoppingBag,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';

// Section 7 — In-app services / apparatus catalog (iteration 0015 § Section 7)
// A grid of feature cards for the paid services. Each card: image banner,
// icon, name, one-paragraph description, "Free with every account" OR
// "Included in your custom quote" tag, "Get your quote →" CTA. NO PHP
// figures.
//
// Image assets: AI-generated AVIF placeholders at `public/add-ons/<slug>.avif`
// (Higgsfield z_image, 16:9, q=65, all <300 KB on the wire). Replace with
// real photography as the verified vendor cohort + first real events ship.
// See `public/add-ons/README.md` for swap procedure.

type ServiceTag = 'quote' | 'free';

const SERVICES: Array<{
  name: string;
  tagline: string;
  body: string;
  Icon: LucideIcon;
  tag: ServiceTag;
  /** Path to the tile banner image under `public/add-ons/`. */
  image: string;
}> = [
  {
    name: 'Papic',
    tagline: 'Designated Paparazzi',
    body: 'Native iOS/Android app for friends and family. Gesture shutter, QR-tag photos to specific guests or whole tables, untagged photos still land in the couple’s gallery. Real-time delivery.',
    Icon: Camera,
    tag: 'quote',
    image: '/add-ons/papic.avif',
  },
  {
    name: 'Panood',
    tagline: 'Multi-Cam Live Stream',
    body: 'Up to five cameras, one broadcaster, broadcast on YouTube. Custom monogram + Broadcast Style Pack support. AI Highlight reels post-event.',
    Icon: Tv,
    tag: 'quote',
    image: '/add-ons/panood.avif',
  },
  {
    name: 'Pakulay',
    tagline: 'Mood Board & Palette Engine',
    body: 'Per-role + per-venue palettes with the Setnayan Guide rule engine catching contrast / temperature / cultural-default mistakes before they hit the printer.',
    Icon: Palette,
    tag: 'free',
    image: '/add-ons/pakulay.avif',
  },
  {
    name: 'Pailaw',
    tagline: 'LED Background Maker',
    body: '8K loop generators for venue LED walls, USB-deliverable for offline playback.',
    Icon: Lightbulb,
    tag: 'quote',
    image: '/add-ons/pailaw.avif',
  },
  {
    name: 'Pareto',
    tagline: 'Pro Camera Bridge',
    body: 'Pair a DSLR (Canon / Nikon / Sony / Fujifilm) with the Papic phone for broadcast-grade glass without changing the operator’s workflow.',
    Icon: Aperture,
    tag: 'quote',
    image: '/add-ons/pareto.avif',
  },
  {
    name: 'Custom Monogram Pack',
    tagline: 'Your brand on every output',
    body: 'One purchase replaces the Setnayan watermark with the couple’s monogram across every media output.',
    Icon: Sparkles,
    tag: 'quote',
    image: '/add-ons/custom-monogram.avif',
  },
  {
    name: 'Pro Invitation Widgets',
    tagline: 'Hero · Story · Schedule',
    body: 'Pro tiers for Hero / Our Story / Schedule blocks on the personal invitation page.',
    Icon: Layout,
    tag: 'quote',
    image: '/add-ons/pro-invitation-widgets.avif',
  },
  {
    name: 'AI Video / Edited Highlight',
    tagline: 'Same-day reels',
    body: 'Auto-curated event highlight reels from Papic + Panood feeds.',
    Icon: Wand2,
    tag: 'quote',
    image: '/add-ons/ai-video.avif',
  },
  {
    name: 'Photo Delivery',
    tagline: 'Full-res handoff after the day',
    body: 'Connect your photographer’s Google Drive. Setnayan delivers full-resolution albums to the couple post-event with a 30-day compression grace window — keep your originals as long as you need before storage tiering kicks in.',
    Icon: CloudUpload,
    tag: 'quote',
    image: '/add-ons/photo-delivery.avif',
  },
  {
    name: 'Supplies Marketplace',
    tagline: 'Wedding-day supplies, one bill',
    body: 'Vetted Filipino vendors for prints, rentals, NFC keepsakes, and decor — direct to your venue. Everything Setnayan’s software needs to land in the physical world, on one invoice.',
    Icon: ShoppingBag,
    tag: 'quote',
    image: '/add-ons/supplies-marketplace.avif',
  },
];

function TagBadge({ tag }: { tag: ServiceTag }) {
  if (tag === 'free') {
    return (
      <span className="inline-flex items-center rounded-full bg-ink/[0.06] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/65">
        Free with every account
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-terracotta/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
      Included in your custom quote
    </span>
  );
}

export function InAppServices() {
  return (
    <section
      aria-labelledby="in-app-services-heading"
      className="border-b border-ink/5"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
        <div className="max-w-3xl space-y-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            On the day
          </p>
          <h2
            id="in-app-services-heading"
            className="text-balance font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl lg:text-6xl"
          >
            When the day comes, we bring the gear.
          </h2>
          <p className="text-base text-ink/65 sm:text-lg">
            Live broadcast. Same-day edit. Paparazzi capture. Personal
            monogram. The on-the-day apparatus that turns a wedding into a
            story your guests can replay forever — built into the same app
            you used to plan it.
          </p>
        </div>

        <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s, index) => {
            const { Icon } = s;
            // First card on each row at lg+ is "above-ish the fold" on a
            // typical 1080p viewport — let next/image fetch it eagerly so
            // the section's first paint isn't an empty grid. Below-fold
            // cards lazy-load via the default behavior.
            const isEager = index < 3;
            return (
              <li
                key={s.name}
                className="flex flex-col overflow-hidden rounded-xl border border-ink/10 bg-cream"
              >
                <div className="relative aspect-[16/9] w-full bg-ink/5">
                  <Image
                    src={s.image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    loading={isEager ? 'eager' : 'lazy'}
                    quality={70}
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                    <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold tracking-tight text-ink sm:text-lg">
                      {s.name}
                    </h3>
                    <p className="text-xs uppercase tracking-[0.12em] text-ink/55">
                      {s.tagline}
                    </p>
                  </div>
                  <p className="text-sm text-ink/65">{s.body}</p>
                  <div className="mt-auto flex flex-col gap-3 pt-2">
                    <TagBadge tag={s.tag} />
                    {s.tag === 'quote' ? (
                      <Link
                        href="/signup"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-terracotta underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
                      >
                        Get your quote
                        <ArrowRight
                          aria-hidden
                          className="h-3.5 w-3.5"
                          strokeWidth={1.75}
                        />
                      </Link>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
