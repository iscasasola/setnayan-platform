import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isStoreShellRequest } from '@/lib/request-platform';
import { registerGatesEnabled } from '@/lib/register-gates';
import { getCurrentUser } from '@/lib/auth';
import { resolveMonogram } from '@/lib/monogram';
import { resolveProfileByEvent, surfaceEnabled } from '@/lib/event-type-profile';
import { VectorStudio } from './studio';
import { ANIM_TEMPO_TIMINGS, sanitizeStudioConfig } from '@/lib/monogram-studio-shared';
import { MonogramDraftRestore } from './draft-restore';
import { MarkToggle } from './mark-toggle';
import { AnimateRows } from './animate-rows';
import { getPrimaryColor, sanitizeRolePalette } from '@/lib/mood-board';
import { applyMarkInk } from '@/lib/monogram-ink';
import { AnimatedMonogramUpgrade } from './animated-monogram-upgrade';
import { UploadMark } from './upload-mark';
import { MarkEverywhere } from './mark-everywhere';
import {
  eventOwnsAnimatedMonogram,
  eventGetsAnimatedMonogramFromHubPro,
  animatedMonogramIncludedNote,
  ANIMATED_MONOGRAM_SERVICE_KEY,
} from '@/lib/animated-monogram';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { safeMonogramSvg } from '@/lib/monogram-svg-safe';
import { PageMasthead } from '@/app/_components/page-masthead';

export const metadata = { title: 'Monogram Maker' };

export const maxDuration = 60;

/**
 * /dashboard/[eventId]/monogram — the couple's standalone Monogram Maker.
 *
 * The wedding mark is set ONE way: the **Vector Studio** — compose it from
 * scratch with real font outlines, boolean interlock, and a mirrored pen (owner
 * 2026-06-21 "make the vector monogram the only screen for the monogram"). It
 * persists `events.monogram_custom_svg` (+ a re-editable `monogram_studio_config`),
 * the single canonical mark every surface reads — chrome switcher, QR centre,
 * landing hero, save-the-date. The free static mark is never gated.
 *
 * MERGED surface (owner 2026-06-25 · informed reversal of 2026-06-21): the free
 * Vector Studio and the paid Animated-Monogram upgrade now live on ONE screen —
 * design your mark above, activate the draw-on animation in <AnimatedMonogramUpgrade>
 * below. This also un-breaks the purchase: the Studio "Get" CTA already routes
 * here, and the buy lives here again (the standalone /studio/animated-monogram
 * page now redirects in). The prior "upload your own" path stays removed.
 */

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    /** Which door is open: 'design' (Vector Studio) · 'upload' (their own
     *  file) · absent (the chooser). In the URL so Back and a refresh both
     *  work, and so a link can drop a couple straight into one door. */
    mode?: string;
    studio?: string;
    studio_error?: string;
    upload_error?: string;
  }>;
};

// Customer-safe status lines for the vector studio's redirect flags.
const STUDIO_NOTICES: Record<string, { tone: 'ok' | 'error'; text: string }> = {
  saved: { tone: 'ok', text: 'Your studio monogram is now your mark everywhere.' },
  cleared: { tone: 'ok', text: 'Removed your studio mark — back to your Setnayan mark.' },
  invalid: { tone: 'error', text: 'That design could not be read — please try again.' },
  render: { tone: 'error', text: 'That design could not be saved — please adjust and retry.' },
  save: { tone: 'error', text: 'Something went wrong saving — please try again.' },
  'not-found': { tone: 'error', text: 'This page is for the couple’s account.' },
  'upload-saved': { tone: 'ok', text: 'Your uploaded mark is now your monogram everywhere.' },
  'ink-saved': { tone: 'ok', text: 'Saved — your mark now wears those colours everywhere.' },
  'reveal-saved': { tone: 'ok', text: 'Saved — that is how your monogram arrives for your guests.' },
  'using-upload': { tone: 'ok', text: 'Your uploaded logo is your mark again — the designed one is kept.' },
  'using-studio': { tone: 'ok', text: 'Your designed mark is live again — your uploaded logo is kept, not deleted.' },
  'no-studio-mark': { tone: 'error', text: 'Design a mark first — switching now would leave you with none.' },
  'upload-cleared': { tone: 'ok', text: 'Removed the upload — back to your studio mark.' },
};

export default async function MonogramMakerPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const sp = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  // Register-to-use gate (flag-gated · owner 2026-06-21): the monogram is a public-identity
  // surface — an anonymous (unsecured) couple must create a free account to design it. The
  // signup flow converts the SAME anon session in place, then returns here. OFF → no gate.
  if (registerGatesEnabled() && user.is_anonymous) {
    redirect(`/signup?next=${encodeURIComponent(`/dashboard/${eventId}/monogram`)}`);
  }
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select(
      'event_id, display_name, monogram_text, monogram_color, monogram_style, monogram_font_key, monogram_frame_key, monogram_motion_key, monogram_custom_svg, monogram_uploaded_svg, monogram_studio_config, role_palette',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) redirect(`/dashboard/${eventId}`);

  // Event-type backstop (0053 · 2026-06-28): the monogram maker is a wedding
  // surface. If this event type's profile doesn't enable 'monogram' (e.g. a
  // birthday), the nav + Studio hub already hide it — this guards a direct URL.
  // Wedding enables it → no redirect (byte-identical). Degrades to WEDDING_PROFILE.
  const profile = await resolveProfileByEvent(eventId);
  if (!surfaceEnabled(profile, 'monogram')) redirect(`/dashboard/${eventId}`);

  const monogram = resolveMonogram(event);

  // The EFFECTIVE custom mark (the Vector Studio mark) — drives the draft-restore
  // one-shot (it hides once a mark exists). Every downstream surface (chrome icon,
  // QR centre, website hero) reads the same `events.monogram_custom_svg`.
  // SEC-3: gated on read — events.monogram_* are host-writable via PostgREST.
  const customSvg = safeMonogramSvg(event.monogram_custom_svg);

  // ── Vector studio state (the from-scratch composer). hasStudio = a saved
  // studio mark exists (re-editable config present + a custom svg).
  const studioConfig = sanitizeStudioConfig(event.monogram_studio_config);
  const hasStudio = Boolean(studioConfig && event.monogram_custom_svg);
  // Notices are split by destination so an error lands in the section the
  // action redirects to (gap audit 2026-07-17): studio flows show inside the
  // Vector Studio; upload flows (upload success keys + upload_error) show in
  // the Upload section, where the redirect anchor #upload-mark scrolls them.
  const isUploadKey = (k?: string) => k === 'upload-saved' || k === 'upload-cleared';
  const studioNotice =
    STUDIO_NOTICES[sp.studio_error ?? ''] ??
    (isUploadKey(sp.studio) ? null : STUDIO_NOTICES[sp.studio ?? '']) ??
    null;
  const uploadNotice =
    STUDIO_NOTICES[sp.upload_error ?? ''] ??
    (isUploadKey(sp.studio) ? STUDIO_NOTICES[sp.studio ?? ''] : null) ??
    null;

  // Free/paid honesty line (council verdict 2026-07-17 §5.3): the studio's
  /* The reveal previews free; it plays for guests only with the paid Animated
   * Monogram. `ownsAnimated` drives the one owned-state confirmation left on
   * this page — the PRICE is no longer fetched here, because the single place
   * a price is now said is the unlock row inside <AnimatedMonogramUpgrade>,
   * which reads the admin catalog itself. Two components fetching one price is
   * two chances to disagree about what a customer is charged. */
  const storeShell = await isStoreShellRequest();
  const ownsAnimated = await eventOwnsAnimatedMonogram(supabase, eventId);
  /* Event Hub Pro includes the animation (owner 2026-09-24, "A then"). The
   * alias already makes `ownsAnimated` true for a Pro couple, so the ₱500 buy
   * is gone; this names WHY on the owned state. Read only when owned. */
  const includedNote = animatedMonogramIncludedNote(
    ownsAnimated,
    ownsAnimated ? await eventGetsAnimatedMonogramFromHubPro(supabase, eventId) : false,
  );

  /* Everything the ONE "Unlock & Apply" button needs, read here and nowhere
   * else. This is the single place the price is fetched now: the compact buy
   * row inside <AnimatedMonogramUpgrade> no longer renders for an unowned
   * event, because its button was merged into the reveal step. Two components
   * fetching one price is two chances to show a couple different numbers.
   *
   * Absent (null) when owned, when the store shell withholds purchases (App
   * Review 3.1.1), or when the catalog price cannot be read — and the step then
   * offers no purchase rather than a guessed one. */
  let checkout: {
    serviceKey: string;
    displayName: string;
    originalPriceCentavos: string;
    settings: Awaited<ReturnType<typeof fetchPlatformSettings>>;
  } | null = null;
  if (!ownsAnimated && !storeShell) {
    const pricePhp =
      (await formatV2Sku(ANIMATED_MONOGRAM_SERVICE_KEY).catch(() => null))?.price_php ?? null;
    if (pricePhp != null) {
      checkout = {
        serviceKey: ANIMATED_MONOGRAM_SERVICE_KEY,
        displayName: `Animated Monogram${event.display_name ? ` · ${event.display_name}` : ''}`,
        originalPriceCentavos: String(Math.round(pricePhp * 100)),
        settings: await fetchPlatformSettings(supabase),
      };
    }
  }

  // The "Your monogram, everywhere" save sequence (benchmark §5): plays once
  // right after a successful save — studio or upload — on the EFFECTIVE mark.

  /* ── ONE DOOR AT A TIME (owner 2026-09-20) ────────────────────────────────
   * This page used to stack BOTH ways of getting a mark down one column: the
   * whole Vector Studio, then a free/paid line, then "upload your own" (with a
   * SECOND, differently-worded free/paid line inside it), then the paid pitch.
   * A couple who already had a logo scrolled past an entire editor to reach the
   * thing they came for.
   *
   * Now: a chooser, then ONE door, `?mode=` holding which. In the URL so Back
   * and refresh both work and the App-Store "Get" CTA can still deep-link.
   * Researched against how Canva, Wix, Adobe Express and Looka actually split
   * "design it" from "upload yours" — none of them stack the two.
   *
   * The chooser is the default even when a mark exists, because the two doors
   * write DIFFERENT columns: landing in the wrong one silently edits the mark
   * the couple is not using. The chooser is also where they see which mark is
   * live right now — a question this page never answered before. */
  const hasUpload = typeof event.monogram_uploaded_svg === 'string' && Boolean(event.monogram_uploaded_svg);
  /* The couple's REAL reception colour drives the "follow our mood board" side
   * of the compare. Undefined when they have not chosen a palette yet, and the
   * compare then withholds that side rather than previewing against a colour
   * that is not theirs. */
  const paletteInk = getPrimaryColor(sanitizeRolePalette(event.role_palette), 'reception') ?? null;

  /* BOTH marks, resolved for display. The chooser shows them side by side when
   * a couple has two, so it needs each one independently — not just whichever
   * currently wins. `uploadIsLive` is the switch state that decides which wins
   * (lib/monogram-mark-choice.ts): an uploaded mark stamped data-mark="off" is
   * kept but not used. */
  const uploadedRaw = safeMonogramSvg(event.monogram_uploaded_svg);
  /* The composition wins; the upload stands in only until there is one. */
  const uploadIsLive = Boolean(uploadedRaw) && !customSvg;
  const uploadedSvgForDisplay = applyMarkInk(uploadedRaw, undefined, paletteInk);

  /* The mark as every surface draws it: the COMPOSITION first, the uploaded
   * file only while no composition exists (lib/monogram-svg-safe.ts carries the
   * same order, and this page must not disagree with it). Ink applied, so the
   * strip shows what guests see rather than an unpainted variant. */
  const effectiveSvg = applyMarkInk(customSvg ?? uploadedRaw, undefined, paletteInk);
  const showEverywhere =
    (sp.studio === 'saved' || sp.studio === 'upload-saved') && Boolean(effectiveSvg);
  const askedMode = sp.mode === 'design' || sp.mode === 'upload' ? sp.mode : null;
  /* Both actions redirect back here with a notice and the #upload-mark anchor.
   * Open the matching door, or a couple reads "Saved!" on a chooser showing
   * none of what they just changed. */
  /* ALWAYS a side — the toggle replaced the chooser screen, so there is no
   * "neither" state any more. With nothing asked: the upload side for a couple
   * whose mark is an uploaded logo they have not yet composed from, the studio
   * otherwise. A saved-notice redirect opens the side that saved. */
  const mode: 'design' | 'upload' =
    askedMode ??
    (uploadNotice ? 'upload' : studioNotice ? 'design' : hasUpload && !customSvg ? 'upload' : 'design');

  return (
    <section className="space-y-6">
      {showEverywhere && effectiveSvg ? <MarkEverywhere svg={effectiveSvg} /> : null}
      {/* ⛔ NO "BACK TO ADD-ONS" HERE — removed at the owner's request
          (2026-09-20), pointing at it on the live page: "remove this."

          The route /dashboard/[eventId]/studio is genuinely no longer reachable
          FROM this page, so `lint-port-no-lost-controls` is right to notice and
          its baseline is regenerated in this same commit — which is what that
          guard asks for when a removal is deliberate. Contrast the earlier
          entry in this file's history: that one regenerated NOTHING, because
          the link still existed and only the guard's static reader could not
          see it. A baseline is regenerated when a control is really gone, never
          to quiet a guard that has found something.

          The app shell's own navigation still reaches add-ons; this was a
          second, page-level way back sitting above the page title. */}

      <PageMasthead title="Your wedding monogram" />

      {/* ── Carry-through: restore a mark designed on the free public studio (pre-signup) ── */}
      <MonogramDraftRestore eventId={eventId} hasCustomMark={Boolean(customSvg)} />

      {/* ── ONE TOGGLE (owner 2026-09-20): "make a toggle. what will switch which
          editor or uploader will show under. under it is the animate."

          It replaces the chooser SCREEN (<MarkDoors>, two large door cards), the
          "Both ways to make it" link back to it, and the heading inside each
          door — four pieces of navigation for one binary choice. The page is now
          four rows, top to bottom: this toggle · the editor or the uploader ·
          the effects · Use Static Image / Unlock Animation & Apply. ── */}
      <MarkToggle eventId={eventId} mode={mode} />


      {/* The "Animate the reveal" panel lives INSIDE the Vector Studio (engine.ts
          #animbox) — owner 2026-06-23 "improve THIS animate the reveal … not a
          separate feature". */}
      {mode === 'design' ? (
        <VectorStudio
          eventId={eventId}
          initialConfig={studioConfig}
          initialNames={monogram.text}
          /* Compose FROM the logo when that is the couple's current mark and
           * they have no studio design yet. With a composition already saved,
           * `initialConfig` rebuilds it and the upload stays the archived
           * source it was made from — only the re-rendered version is used. */
          initialUploadSvg={!hasStudio && uploadIsLive ? uploadedRaw : null}
          hasStudio={hasStudio}
          notice={studioNotice}
        />
      ) : null}

      {/* ── Upload your own mark (owner 2026-07-17). Writes the long-dormant
          monogram_uploaded_svg, which outranks every other mark. ── */}
      {mode === 'upload' ? (
        <UploadMark
          eventId={eventId}
          hasUpload={hasUpload}
          monogramText={monogram.text}
          notice={uploadNotice}
          paletteInk={paletteInk}
          savedSvg={uploadedSvgForDisplay}
          savedIsLive={uploadIsLive}
        />
      ) : null}

      {/* ── ROWS 3 + 4 (owner's concept, 2026-09-20): "next row is the different
          animation effects / next row is Use Static Image (FREE) and Unlock
          Animation (500)". Tapping an effect plays it on the mark above, in
          place; the two buttons are the page's only save, for either side of
          the toggle. The money buys the animation, not the side you came
          through.

          🔒 The purchase is withheld in the store shell (App Review 3.1.1); the
          effects still preview and "Use Static Image" still saves. ── */}
      <AnimateRows
        eventId={eventId}
        initialKind={studioConfig?.anim?.kind ?? 'handwriting'}
        tempo={
          studioConfig?.anim?.preset === 'quick' || studioConfig?.anim?.preset === 'ceremonial'
            ? studioConfig.anim.preset
            : 'classic'
        }
        initialTiming={
          studioConfig?.anim
            ? { dur: studioConfig.anim.dur, delay: studioConfig.anim.delay, smooth: studioConfig.anim.smooth }
            : ANIM_TEMPO_TIMINGS.classic
        }
        owned={ownsAnimated}
        includedNote={includedNote}
        checkout={checkout}
        unlock={!storeShell && ownsAnimated ? <AnimatedMonogramUpgrade eventId={eventId} /> : null}
      />
    </section>
  );
}
