import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { isStoreShellRequest } from '@/lib/request-platform';
import { registerGatesEnabled } from '@/lib/register-gates';
import { getCurrentUser } from '@/lib/auth';
import { resolveMonogram } from '@/lib/monogram';
import { resolveProfileByEvent, surfaceEnabled } from '@/lib/event-type-profile';
import { VectorStudio } from './studio';
import { sanitizeStudioConfig } from '@/lib/monogram-studio-shared';
import { MonogramDraftRestore } from './draft-restore';
import { MarkDoors } from './mark-doors';
import { RevealStep } from './reveal-step';
import { getPrimaryColor, sanitizeRolePalette } from '@/lib/mood-board';
import { applyMarkInk } from '@/lib/monogram-ink';
import { AnimatedMonogramUpgrade } from './animated-monogram-upgrade';
import { UploadMark } from './upload-mark';
import { MarkEverywhere } from './mark-everywhere';
import { eventOwnsAnimatedMonogram } from '@/lib/animated-monogram';
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
  const mode = askedMode ?? (uploadNotice ? 'upload' : studioNotice ? 'design' : null);

  return (
    <section className="space-y-6">
      {showEverywhere && effectiveSvg ? <MarkEverywhere svg={effectiveSvg} /> : null}
      {/* TWO controls, each with ONE destination — not one control with a
          ternary href. `lint-port-no-lost-controls` reads routes statically and
          could not see the `/studio` branch inside a conditional, so the page
          registered as having LOST its way back to add-ons. It had not; but a
          route a static reader cannot find is a route the next refactor can
          delete without anything going red, and the guard was right to object.
          Regenerating its baseline would have recorded a removal that never
          happened. Two plain links also read better: from inside a door you
          want "the other way", and add-ons is a level further out. */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/dashboard/${eventId}/studio`}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Back to add-ons
        </Link>
        {mode ? (
          <Link
            href={`/dashboard/${eventId}/monogram`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
          >
            Both ways to make it
          </Link>
        ) : null}
      </div>

      <PageMasthead title="Your wedding monogram" />

      {/* ── Carry-through: restore a mark designed on the free public studio (pre-signup) ── */}
      <MonogramDraftRestore eventId={eventId} hasCustomMark={Boolean(customSvg)} />

      {mode === null ? (
        <MarkDoors
          eventId={eventId}
          liveSvg={effectiveSvg}
          liveIsComposition={Boolean(customSvg)}
          hasStudio={hasStudio}
          hasUpload={hasUpload}
        />
      ) : null}

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
          ownsAnimated={ownsAnimated}
          paletteInk={paletteInk}
          savedSvg={uploadedSvgForDisplay}
          savedIsLive={uploadIsLive}
        />
      ) : null}

      {/* ── ONE REVEAL, for a mark made either way (owner 2026-09-20,
          overruling the 2026-06-23 "the reveal lives inside the studio" lock).
          It sits AFTER the mark exists rather than inside either door, and the
          ₱500 unlock renders beneath it — the money buys the animation, not the
          door. Nothing to reveal without a mark, so it waits for one.

          🔒 The unlock is withheld in the store shell (App Review 3.1.1); the
          reveal itself previews free and stays. ── */}
      {effectiveSvg ? (
        <RevealStep
          eventId={eventId}
          markSvg={effectiveSvg}
          monogramText={monogram.text}
          initialKind={studioConfig?.anim?.kind ?? 'handwriting'}
          initialTempo={
            studioConfig?.anim?.preset === 'quick' || studioConfig?.anim?.preset === 'ceremonial'
              ? studioConfig.anim.preset
              : 'classic'
          }
          owned={ownsAnimated}
          unlock={!storeShell ? <AnimatedMonogramUpgrade eventId={eventId} /> : null}
        />
      ) : null}
    </section>
  );
}
