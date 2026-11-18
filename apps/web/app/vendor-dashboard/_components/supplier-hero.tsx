import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { HERO_PLACEHOLDER_FILE } from '@/lib/supplier-hero';

/**
 * 🖼 THE SUPPLIER HERO — ONE head for Today, Shop and Portfolio (Build 3 Lane E, item 10; prototype
 * `supplier_shop_portfolio_2026-11-09` § 0, approved v3). Owner: *"Today shop and portfolio initial header should have
 * the same height"*.
 *
 *   · ONE height (208 px, growing — never overlapping — when a sub row needs more), the eyebrow at the top left, the ⚙
 *     at the top right, the title and the subtitle at the bottom, 16 px gutters — on all three tabs, because all three
 *     mount THIS part (guard below).
 *   · A photo under a legibility scrim: Today = the most-viewed portfolio photo · Shop = the cover photo · Portfolio =
 *     the latest upload (`lib/supplier-hero.ts` decides which).
 *   · No photo → the PLACEHOLDER picture (the category's from Admin › Categories → its group's → the shipped
 *     `/placeholders/vendor.webp`), captioned "Sample photo · Upload yours" with an Upload door, so it never passes as
 *     the supplier's own work.
 *
 * Server-safe (no state): the client heads (Shop's cover, Portfolio's band) and the server one (Today) draw it alike.
 * 🔒 app/vendor-dashboard/_components/one-supplier-hero.test.ts
 */
export const SUPPLIER_HERO_HEIGHT_PX = 208;

export type SupplierHeroPicture = { url: string; kind: 'photo' | 'placeholder' };

/** The placeholder's Upload pill — drawn here as a link, or worn by a picker door (`portfolio-upload.tsx`). */
export const HERO_UPLOAD_PILL =
  'inline-flex h-10 items-center gap-1.5 rounded-full bg-white/[0.92] px-3.5 text-[13.5px] font-semibold text-[color:var(--m-espresso)]';

/** Where Upload goes: a link (Portfolio's own in-page `#gallery-media`), or a DOOR — the device's picker in place. */
export type SupplierHeroUpload = { href: string } | { door: ReactNode };

export function SupplierHero({
  eyebrow,
  gear = null,
  title,
  titleData,
  sub = null,
  picture,
  caption = null,
  upload = null,
  data,
}: {
  eyebrow: ReactNode;
  /** The tab's ONE ⚙ — its own shipped settings button. */
  gear?: ReactNode;
  /** The big line. Rendered as a paragraph: each tab keeps its own (often sr-only) `<h1>`. */
  title: ReactNode;
  /** The data attribute the tab's guards read the title by (e.g. `today-greeted`). */
  titleData?: string;
  sub?: ReactNode;
  /** null/undefined = no read yet → the shipped placeholder file, with no door. */
  picture?: SupplierHeroPicture | null;
  /** The photo's caption chip ("Most viewed · 412 views", "Cover · Your page", "Latest"). Placeholder ignores it. */
  caption?: ReactNode;
  /** Where Upload goes while the hero is a placeholder (omit for no door). */
  upload?: SupplierHeroUpload | null;
  /** The tab's own marker on the root (`{ 'portfolio-top': '' }`). */
  data?: Record<string, string>;
}) {
  const pic = picture ?? { url: HERO_PLACEHOLDER_FILE, kind: 'placeholder' as const };
  const sample = pic.kind === 'placeholder';
  const attrs = Object.fromEntries(Object.entries(data ?? {}).map(([k, v]) => [`data-${k}`, v]));
  // 🔒 NOTHING OVERLAPS (W1 F3, 18 Nov — "Shop · setnayan.com/…" drawn over the shop name, "Sample photo · Upload yours"
  // over "Get verified · 0 of 3 papers"): the rows are IN FLOW — eyebrow + ⚙ · the chip row · the title block pinned to
  // the bottom (`mt-auto`) — so a long sub row pushes the hero taller instead of drawing over the rows above it. The
  // hero is 208 px whenever its lines fit (all three tabs, the owner's "same height"), never shorter. The Upload pill
  // sits in the chip row beside "Sample photo · Upload yours", so the title block keeps the full width.
  return (
    <div
      className="relative isolate flex min-h-[208px] flex-none flex-col overflow-hidden rounded-b-3xl px-4 pb-4 pt-3.5 text-white"
      style={{ background: 'var(--m-espresso)' }}
      data-supplier-hero={sample ? 'placeholder' : 'photo'}
      {...attrs}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a presigned display URL or the shipped file */}
      <img src={pic.url} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover" data-supplier-hero-pic="" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{ background: 'linear-gradient(to top, rgba(20,18,14,.86) 0%, rgba(20,18,14,.45) 48%, rgba(20,18,14,.12) 100%)' }}
      />
      <div className="flex min-h-10 items-center justify-between gap-3 text-[12.5px]" data-supplier-hero-top="">
        <span className="min-w-0 truncate opacity-95" data-supplier-hero-eyebrow="">
          {eyebrow}
        </span>
        {gear ? <span className="shrink-0" data-supplier-hero-gear="">{gear}</span> : null}
      </div>
      {sample ? (
        <div className="mt-2 flex items-center justify-between gap-2" data-supplier-hero-chips="">
          <span className="min-w-0 truncate rounded-full bg-black/45 px-2.5 py-1 font-mono text-[11px] tracking-[0.06em] backdrop-blur" data-supplier-hero-sample="">
            Sample photo · Upload yours
          </span>
          {upload ? (
            'door' in upload ? (
              <span className="shrink-0">{upload.door}</span>
            ) : (
              <a href={upload.href} className={`shrink-0 ${HERO_UPLOAD_PILL}`} data-supplier-hero-upload="">
                <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
                Upload
              </a>
            )
          ) : null}
        </div>
      ) : caption ? (
        <div className="mt-2 flex justify-end" data-supplier-hero-chips="">
          <span className="max-w-[60%] truncate rounded-full bg-black/45 px-2.5 py-1 font-mono text-[11px] tracking-[0.06em] backdrop-blur" data-supplier-hero-caption="">
            {caption}
          </span>
        </div>
      ) : null}
      <div className="mt-auto pt-2" data-supplier-hero-foot="">
        <p className="line-clamp-2 font-[family-name:var(--font-display)] text-[28px] font-semibold leading-[1.1]" {...(titleData ? { [`data-${titleData}`]: '' } : {})}>
          {title}
        </p>
        {sub ? <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-white/90">{sub}</div> : null}
      </div>
    </div>
  );
}
