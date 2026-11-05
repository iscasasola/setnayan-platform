/**
 * /dev/supplier-print-lab — a supplier's calling card and tarps, drawn for ONE shop from its own row, IN THE APP'S DESIGN
 * TEMPLATES, for the For Suppliers "Free marketing tools" widget (owner: "we give the design"). DEV-ONLY: production
 * builds 404 this route first thing. These are PREVIEWS for the owner to approve, not files a supplier can order yet.
 *
 *   ?slug=<shop>&piece=calling-card|tarp|backdrop|rollup|table-front&template=<theme id>
 *
 * 🎨 THE TEMPLATES ARE THE PRINT THEMES — never plain white (owner 2026-11-05: *"do not use the plain white. use the
 * design templates"*). Each piece wears a theme the way the theme sample gallery prints it: `printLooksFor(theme, null,
 * { sampleGallery: true }).pro` (lib/print-hub-look.ts) — the theme's paper, ink, accent and heading colours, its head /
 * script / body faces (the print engine's own outline files, `printFontFile`), its ornament, and its picture where the
 * theme lays one (`still`: top · left · full, with the theme's own scrim). Nothing here picks a colour or a font.
 * The theme's picture is its poster (`INVITE_THEMES[t].media.poster`, public R2); where it cannot be reached the piece
 * shows the theme's own measured picture colours (`media.samples`) in its place and the lab's footer says so.
 *
 * Every piece carries the three ways in, together (owner rule: QR, NFC tap and direct link are promoted as one):
 *   · the QR — the shop's "My page" code, made by the SAME `renderUrlQrSvg(myPageUrl(...))` the supplier's QR codes
 *     page (`app/vendor-dashboard/invite`) draws, always on a white tile so it scans on any template;
 *   · an NFC note — a tag carries the same address as the QR (the app writes one with `NfcWriteButton`);
 *   · the direct link — `setnayan.com/<slug>`, the short shop address `app/[slug]` serves.
 * The badges are the EXISTING print route's files: `demo-shop-shots.mjs` saves `GET /api/vendor/badges?ground=light`
 * and `?ground=dark` (signed in as the shop) to `public/demo-shop-local/`, and the piece places the one that suits its
 * paper, as it came. With no file, no badges.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { notFound } from 'next/navigation';
import { Nfc } from 'lucide-react';
import { Wordmark } from '@/app/_components/brand-marks';
import { createAdminClient } from '@/lib/supabase/admin';
import { INVITE_THEMES, INVITE_THEME_IDS, type InviteThemeId } from '@/lib/invite-themes';
import { printLooksFor } from '@/lib/print-hub-look';
import { printFontFile } from '@/lib/print-layout';
import { hexRgb, lum } from '@/lib/print-ground';
import type { PrintFontKey } from '@/lib/print-pieces';
import { renderUrlQrSvg } from '@/lib/qr';
import { siteOrigin } from '@/lib/site-origin';
import { myPageUrl } from '@/lib/supplier-qr-codes';
import { displayUrlForStoredAsset } from '@/lib/uploads';

/**
 * Each piece's real size, the width it is drawn at (height follows the real aspect), and its type scale in `cqw` —
 * hundredths of the piece's own width, so a piece reads the same at any preview size.
 */
const PIECES = {
  'calling-card': { size: '90 × 54 mm', w: 1050, aspect: 90 / 54, tall: false, pad: 5, logo: 13, title: 6.4, line: 2.9, badges: 11, services: 0, qr: 18, ways: 2.6 },
  tarp: { size: '6 × 3 ft', w: 1600, aspect: 6 / 3, tall: false, pad: 4, logo: 10, title: 5, line: 2, badges: 12, services: 1.6, qr: 12, ways: 1.7 },
  backdrop: { size: '8 × 8 ft', w: 1200, aspect: 1, tall: false, pad: 6, logo: 13, title: 6.5, line: 2.6, badges: 16, services: 2, qr: 20, ways: 2.4 },
  rollup: { size: '80 × 200 cm', w: 600, aspect: 80 / 200, tall: true, pad: 8, logo: 30, title: 10, line: 4.4, badges: 30, services: 3.8, qr: 36, ways: 4.2 },
  'table-front': { size: '6 × 2.5 ft', w: 1600, aspect: 6 / 2.5, tall: false, pad: 3.5, logo: 8, title: 4.4, line: 1.7, badges: 9, services: 1.4, qr: 10, ways: 1.45 },
} as const;
type Piece = keyof typeof PIECES;
const cq = (n: number) => `${n}cqw`;

const LOCAL = '/demo-shop-local';

/** A print face as a web font, from the very file the print engine outlines (`printFontFile`). */
function fontFace(key: PrintFontKey): string | null {
  try {
    const data = readFileSync(join(process.cwd(), printFontFile(key))).toString('base64');
    return `@font-face{font-family:"sp-${key}";src:url(data:font/ttf;base64,${data}) format("truetype");font-display:block}`;
  } catch {
    return null;
  }
}

export default async function SupplierPrintLabPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; piece?: string; template?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const piece: Piece = sp.piece && sp.piece in PIECES ? (sp.piece as Piece) : 'calling-card';
  const template: InviteThemeId = (INVITE_THEME_IDS as readonly string[]).includes(sp.template ?? '') ? (sp.template as InviteThemeId) : 'house';
  const spec = PIECES[piece];
  const slug = (sp.slug ?? 'setnayan-productions').toLowerCase();

  const admin = createAdminClient();
  const { data: shop } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name, business_slug, tagline, location_city, logo_url')
    .ilike('business_slug', slug)
    .maybeSingle();
  if (!shop) notFound();
  const { data: cards } = await admin
    .from('vendor_services')
    .select('title, created_at')
    .eq('vendor_profile_id', shop.vendor_profile_id)
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  const services = (cards ?? []).map((c) => c.title).filter((t): t is string => !!t);

  // ── the template ───────────────────────────────────────────────────────
  const theme = INVITE_THEMES[template];
  const look = printLooksFor(template, null, { sampleGallery: true }).pro;
  const darkPaper = lum(hexRgb(look.paper)) < 0.25;
  const faces = [look.headFont, look.bodyFont, look.scriptFont].filter((k): k is PrintFontKey => !!k);
  const fontCss = [...new Set(faces)].map(fontFace).filter(Boolean).join('');
  const head = `"sp-${look.headFont}", serif`;
  const body = `"sp-${look.bodyFont}", serif`;
  const script = look.scriptFont ? `"sp-${look.scriptFont}", cursive` : head;
  const poster = theme.media && look.still !== 'none' ? await displayUrlForStoredAsset(theme.media.poster).catch(() => null) : null;
  const samples = theme.media?.samples ?? null;
  const pictureBg = poster
    ? `center / cover no-repeat url("${poster}")`
    : samples
      ? `linear-gradient(135deg, ${samples.light}, ${samples.dark})`
      : null;
  const still = pictureBg ? look.still : 'none';

  // ── the shop ───────────────────────────────────────────────────────────
  const url = myPageUrl(siteOrigin(), shop.business_slug);
  const qr = await renderUrlQrSvg(url, 600).catch(() => null);
  const link = `setnayan.com/${shop.business_slug}`;
  const logoUrl = await displayUrlForStoredAsset(shop.logo_url).catch(() => null);
  const onPicture = still === 'full';
  const scrimDark = onPicture && look.scrim ? lum(hexRgb(look.scrim.color)) < 0.25 : false;
  const ink = onPicture && scrimDark ? '#ffffff' : look.ink;
  const badgeFile = darkPaper || scrimDark ? 'sp-badges-dark.svg' : 'sp-badges-light.svg';
  const badges = existsSync(join(process.cwd(), 'public', 'demo-shop-local', badgeFile)) ? `${LOCAL}/${badgeFile}` : null;
  const height = Math.round(spec.w / spec.aspect);
  const tall = spec.tall;
  /* A theme that gives part of the piece to its picture (a band on top, a column on the left) sets the words a step
     smaller, so they still fit inside the trim; a full picture or none keeps the full size. */
  const k = still === 'top' ? (tall ? 0.92 : 0.8) : still === 'left' ? 0.85 : 1;
  const z = (n: number) => cq(n * k);

  const badgeImg = badges ? (
    // eslint-disable-next-line @next/next/no-img-element -- the print route's own vector, placed as it came
    <img src={badges} alt="" style={{ width: z(spec.badges) }} />
  ) : null;

  const ornament = (
    <p aria-hidden className="leading-none" style={{ color: look.accent, fontSize: z(spec.line * 1.1), fontFamily: body }}>
      ——&nbsp;{look.ornament}&nbsp;——
    </p>
  );

  const identity = (
    <div className={`flex ${tall ? 'flex-col items-center text-center' : 'items-center'}`} style={{ gap: z(tall ? 3 : 2.4) }}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a print preview: the file as it is, no optimiser
        <img
          src={logoUrl}
          alt=""
          className="aspect-square shrink-0 object-cover"
          style={{ width: z(spec.logo), borderRadius: theme.radius * 2, boxShadow: `0 0 0 ${z(0.25)} ${look.accent}` }}
        />
      ) : null}
      <div className={`min-w-0 ${tall ? 'justify-items-center' : ''}`} style={{ display: 'grid', gap: z(0.8) }}>
        <h1
          className="leading-[1.02]"
          style={{
            fontFamily: head,
            color: onPicture ? ink : look.heading,
            // Capitals run wider than the same name in lower case (the deco and neon faces).
            fontSize: z(spec.title * (look.capsNames ? 0.78 : 1)),
            textTransform: look.capsNames ? 'uppercase' : 'none',
            letterSpacing: look.capsNames ? '0.06em' : '-0.01em',
          }}
        >
          {shop.business_name}
        </h1>
        {shop.tagline ? (
          <p style={{ fontFamily: look.scriptFont ? script : body, color: onPicture ? ink : look.accent, fontSize: z(spec.line * (look.scriptFont ? 1.45 : 1)) }}>
            {shop.tagline}
          </p>
        ) : null}
        {shop.location_city && spec.services > 0 ? (
          <p style={{ fontFamily: body, color: onPicture ? ink : look.muted, fontSize: z(spec.line * 0.85) }}>Based in {shop.location_city}</p>
        ) : null}
      </div>
    </div>
  );

  const ways = (
    <div className={`flex ${tall ? 'flex-col items-center text-center' : 'items-center'}`} style={{ gap: z(tall ? 3 : 2.4) }}>
      {qr ? (
        <div
          className="shrink-0 bg-white [&>svg]:h-full [&>svg]:w-full"
          style={{ width: z(spec.qr), padding: z(spec.qr / 30), borderRadius: theme.radius * 2, boxShadow: `0 0 0 ${z(0.2)} ${look.accent}` }}
          dangerouslySetInnerHTML={{ __html: qr }}
        />
      ) : null}
      <div className={`grid ${tall ? 'justify-items-center' : ''}`} style={{ gap: z(spec.ways * 0.45), fontFamily: body, color: ink }}>
        <p style={{ fontFamily: head, fontSize: z(spec.ways * 1.3), textTransform: look.capsNames ? 'uppercase' : 'none' }}>Scan · tap · or type</p>
        <p className="inline-flex items-center" style={{ fontSize: z(spec.ways), gap: '0.4em', opacity: 0.85 }}>
          <Nfc aria-hidden strokeWidth={1.75} style={{ width: '1.25em', height: '1.25em', color: look.accent }} />
          Tap your phone here (NFC)
        </p>
        <p className="whitespace-nowrap" style={{ fontSize: z(spec.ways * 1.1), color: onPicture ? ink : look.accent, letterSpacing: '0.02em' }}>
          {link}
        </p>
      </div>
    </div>
  );

  const credit = (
    <span className="inline-flex items-center whitespace-nowrap" style={{ fontSize: z(spec.ways * 0.85), gap: '0.5em', color: ink, opacity: 0.75, fontFamily: body }}>
      Find us on <Wordmark size={Math.round((spec.w * spec.ways * k) / 100)} color={ink} />
    </span>
  );

  const chips =
    spec.services > 0 && services.length > 0 ? (
      <ul className={`flex flex-wrap ${tall ? 'justify-center' : ''}`} style={{ fontSize: z(spec.services), gap: z(spec.services * 0.6), fontFamily: body }}>
        {services.map((t) => (
          <li
            key={t}
            className="whitespace-nowrap px-[1.2em] py-[0.4em]"
            style={{ border: `1px solid ${look.accent}`, borderRadius: theme.radius >= 8 ? 999 : theme.radius, color: ink }}
          >
            {t}
          </li>
        ))}
      </ul>
    ) : null;

  const words = tall ? (
    <div className="flex h-full flex-col items-center justify-between text-center" style={{ padding: z(spec.pad) }}>
      {identity}
      {ornament}
      {chips}
      {ways}
      <div className="grid justify-items-center" style={{ gap: z(2) }}>
        {badgeImg}
        {credit}
      </div>
    </div>
  ) : (
    <div className="flex h-full flex-col justify-between" style={{ padding: z(spec.pad), gap: z(spec.pad * 0.4) }}>
      <div className="flex items-start justify-between" style={{ gap: z(3) }}>
        {identity}
        <div className="grid shrink-0 justify-items-end" style={{ gap: z(1.2) }}>
          {badgeImg}
          {credit}
        </div>
      </div>
      {spec.services > 0 ? ornament : null}
      {chips}
      {ways}
    </div>
  );

  /* The theme's picture, where the theme lays one: a band on top · a column on the left · the whole ground under its scrim. */
  const bandPct = piece === 'calling-card' ? 9 : tall ? 10 : 15;
  return (
    <main className="min-h-dvh bg-ink/[0.04] p-8">
      <style dangerouslySetInnerHTML={{ __html: fontCss }} />
      <div
        data-print-piece={piece}
        data-print-template={template}
        data-print-size={spec.size}
        data-print-picture={poster ? 'poster' : pictureBg ? 'theme-colours' : 'none'}
        className="relative mx-auto overflow-hidden [container-type:inline-size]"
        style={{ width: spec.w, height, background: look.paper, color: ink, filter: look.sepia ? 'sepia(0.35)' : undefined }}
      >
        {still === 'full' ? (
          <>
            <div aria-hidden className="absolute inset-0" style={{ background: pictureBg ?? undefined }} />
            {look.scrim ? (
              <div aria-hidden className="absolute inset-0" style={{ background: look.scrim.color, opacity: Math.max(look.scrim.opacity, 0.55) }} />
            ) : null}
            <div className="relative h-full">{words}</div>
          </>
        ) : still === 'left' && !tall ? (
          <div className="flex h-full">
            <div aria-hidden className="shrink-0" style={{ width: '16%', background: pictureBg ?? undefined }} />
            <div className="min-w-0 flex-1">{words}</div>
          </div>
        ) : still === 'top' || still === 'left' ? (
          <div className="flex h-full flex-col">
            <div aria-hidden className="shrink-0" style={{ height: `${bandPct}%`, background: pictureBg ?? undefined }} />
            <div className="min-h-0 flex-1">{words}</div>
          </div>
        ) : (
          /* No picture (Classic): the theme's gold hairline inside the trim. */
          <div className="h-full" style={{ padding: z(1.4) }}>
            <div className="h-full" style={{ border: `${z(0.18)} solid ${look.accent}`, borderRadius: theme.radius }}>
              {words}
            </div>
          </div>
        )}
      </div>
      <p className="mx-auto mt-4 max-w-xl text-center font-mono text-[11px] uppercase tracking-[0.2em] text-ink/45">
        Lab · {piece} · {spec.size} · {theme.name} · preview, not a print file
        {theme.media && !poster ? ' · theme picture not reachable here — its own colours stand in' : ''}
      </p>
    </main>
  );
}
