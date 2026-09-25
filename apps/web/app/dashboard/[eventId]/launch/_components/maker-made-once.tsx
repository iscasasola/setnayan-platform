import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { readHubDraft } from '@/lib/hub-draft-store';
import { overlayHubDraftEvent, type HubDraft } from '@/lib/hub-draft';
import { resolveHero } from '@/lib/event-hero';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { renderableImageSrc } from '@/lib/event-card-art';
import { resolveEventPoster } from '@/lib/event-poster.server';
import { resolveEventMonogramSvg } from '@/lib/monogram-svg-safe';
import { bespokeSvgToDataUri } from '@/lib/bespoke-monogram-shared';
import { resolveMonogram } from '@/lib/monogram';
import { fetchRevealConfig } from '@/lib/reveal-config';
import { REVEAL_NONE } from '@/lib/reveal-access';
import { INVITE_THEMES, normalizeThemeId, type InviteThemeId } from '@/lib/invite-themes';
import { revealMaterialsFor } from '@/lib/reveal-materials';
import { sanitizeStudioConfig } from '@/lib/monogram-studio-shared';
import { safeMonogramSvg } from '@/lib/monogram-svg-safe';
import { PUBLIC_STAGE_LABELS } from '@/lib/public-site-stage-labels';
import { REVEAL_LIBRARY } from '@/app/[slug]/_components/reveal/reveal-templates';
import { EventPoster } from '@/app/_components/event-poster';
import { FileUpload } from '@/app/_components/file-upload';
import { HubDraftField } from '../../website/_components/hub-draft-bar';
import { removeHeroPhoto, uploadHeroPhoto } from '../../website/hero-photo/actions';
import { MakerRevealPicker } from './maker-reveal';
import { MakerLogoDoor } from './maker-logo';

/**
 * THE MADE-ONCE GROUP — Logo · Hero · Reveal (Event Hub Maker Phase 6).
 *
 * The left group of the bar edits the three whole-event things ONCE; every stage
 * and the poster derive from them (owner 2026-09-24/25). Each panel reads the
 * couple's DRAFT laid over the live row (`overlayHubDraftEvent`, the same overlay
 * the `?editor=1` preview uses), so what the panel says is what the canvas shows.
 *
 * 💾 NOTHING HERE WRITES LIVE. Every control posts to the draft:
 *   · Hero   — `uploadHeroPhoto` / `removeHeroPhoto` with `<HubDraftField />`
 *              (their draft door, `draftHero`);
 *   · Reveal — `hubDraftAction` intent=save (`maker-reveal.tsx`);
 *   · Logo   — `hubDraftAction` intent=save, AUTOSAVED (`maker-logo.tsx`).
 * Guests see none of it until Apply, and Apply is where Pro is checked.
 *
 * 🔒 STORE SHELL: no price anywhere; Pro-only controls are hidden, not locked —
 * the hero upload, every opening but "No reveal". A couple who already owns Pro
 * keeps what they own (the web-bought rule is enforced at Apply: "Apply on the web").
 */

const EVENT_SELECT =
  'event_id, display_name, event_date, venue_name, event_type, monogram_text, monogram_color, invite_theme, landing_page_hero_image_url, landing_page_hero_video_r2_key, std_reveal_template, monogram_custom_svg, monogram_studio_config, monogram_uploaded_svg';

type MadeOnceRow = {
  event_id: string;
  display_name: string | null;
  event_date: string | null;
  venue_name: string | null;
  event_type: string;
  monogram_text: string | null;
  monogram_color: string | null;
  invite_theme: string | null;
  landing_page_hero_image_url: string | null;
  landing_page_hero_video_r2_key: string | null;
  std_reveal_template: string | null;
  monogram_custom_svg: string | null;
  monogram_studio_config: unknown;
  monogram_uploaded_svg: string | null;
};

type MadeOnce =
  | { ok: true; live: MadeOnceRow; drafted: MadeOnceRow; draft: HubDraft | null }
  | { ok: false };

/**
 * One read for all three panels (cached per request). A failed read is `ok:false`
 * and each panel SAYS it could not load — never an empty panel that reads as
 * "you have no hero".
 */
const loadMadeOnce = cache(async (eventId: string): Promise<MadeOnce> => {
  try {
    const supabase = await createClient();
    const [{ data, error }, draft] = await Promise.all([
      supabase.from('events').select(EVENT_SELECT).eq('event_id', eventId).maybeSingle(),
      readHubDraft(supabase, eventId),
    ]);
    if (error || !data) {
      if (error) console.error('[supabase-error] launch/_components/maker-made-once.tsx · from:events.select', error);
      return { ok: false };
    }
    const live = data as unknown as MadeOnceRow;
    return { ok: true, live, drafted: overlayHubDraftEvent(live, draft), draft };
  } catch (e) {
    console.error('[maker-made-once] read failed:', e instanceof Error ? e.message : e);
    return { ok: false };
  }
});

function CouldNotLoad({ what }: { what: string }) {
  return (
    <p role="alert" className="px-1 text-[13px] text-terracotta-700">
      Your {what} could not be loaded just now. Nothing was changed — please reopen this in a moment.
    </p>
  );
}

function DraftNote({ drafted }: { drafted: boolean }) {
  if (!drafted) return null;
  return (
    <p className="text-[12px] font-semibold text-terracotta-700" data-made-once-drafted="">
      In your draft — guests see it after you Apply.
    </p>
  );
}

const themeOf = (raw: string | null): InviteThemeId => normalizeThemeId(raw) ?? 'house';

/* ═══════════════════════════════════════════════════════════════════════════
   HERO
   ═══════════════════════════════════════════════════════════════════════════ */

export async function MakerHeroPanel({
  eventId,
  ownsPro,
  storeShell,
}: {
  eventId: string;
  ownsPro: boolean;
  storeShell: boolean;
}) {
  const m = await loadMadeOnce(eventId);
  if (!m.ok) return <CouldNotLoad what="hero" />;
  const { live, drafted } = m;
  const hero = resolveHero(drafted);
  const liveHero = resolveHero(live);
  const heroSrc = renderableImageSrc(await displayUrlForStoredAsset(hero.photoRef).catch(() => null));
  const poster = await resolveEventPoster(
    {
      event_id: drafted.event_id,
      display_name: drafted.display_name ?? '',
      event_date: drafted.event_date,
      venue_name: drafted.venue_name,
      event_type: drafted.event_type,
      monogram_text: drafted.monogram_text,
      monogram_color: drafted.monogram_color,
      invite_theme: drafted.invite_theme,
    },
    heroSrc,
  ).catch(() => null);
  const markSvg = resolveEventMonogramSvg(drafted);
  const returnTo = `/dashboard/${eventId}/launch?tool=hero`;
  const canUpload = ownsPro || !storeShell;

  return (
    <section className="flex flex-col gap-3 px-1" data-made-once="hero">
      <p className="text-[13.5px] text-ink/75">
        Made once, shown everywhere: {PUBLIC_STAGE_LABELS.save_the_date}, {PUBLIC_STAGE_LABELS.rsvp},{' '}
        {PUBLIC_STAGE_LABELS.event} and your poster. {PUBLIC_STAGE_LABELS.editorial} starts from it until you choose
        a cover from the day.
      </p>

      <div className="flex items-start gap-3">
        <div className="w-32 shrink-0 overflow-hidden rounded-md shadow-sm" data-made-once-poster="">
          {poster ? (
            <EventPoster
              poster={poster}
              markText={resolveMonogram(drafted).text}
              markSvgUri={markSvg ? bespokeSvgToDataUri(markSvg) : null}
            />
          ) : (
            <p className="p-2 text-[11px] text-ink/60">The poster preview could not be drawn.</p>
          )}
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-[14px] font-semibold text-ink" data-made-once-hero-kind={hero.kind}>
            {hero.kind === 'photo' ? 'Your photo' : 'Your invitation card'}
          </p>
          <p className="text-[12.5px] text-ink/65">
            {hero.kind === 'photo'
              ? 'Your photo sits behind your names at the top of every stage.'
              : 'Your names, date and monogram, set in your theme — no photo needed.'}
          </p>
          <DraftNote drafted={hero.photoRef !== liveHero.photoRef} />
        </div>
      </div>

      {canUpload ? (
        <form action={uploadHeroPhoto} className="flex flex-col gap-2 rounded-md bg-white/70 px-3 py-3">
          <HubDraftField />
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="return_to" value={returnTo} />
          <FileUpload
            bucket="media"
            pathPrefix={`events/${eventId}/landing-page-hero`}
            name="hero_image_url"
            unsavedHint="press Use this photo below"
            multiple={false}
            maxSizeMB={10}
            acceptedTypes={['image/jpeg', 'image/jpg', 'image/png', 'image/webp']}
            currentValue={hero.photoRef}
            initialDisplayUrls={hero.photoRef && heroSrc ? { [hero.photoRef]: heroSrc } : undefined}
            label="Hero photo"
            help="JPG, PNG or WebP up to 10 MB."
          />
          <button
            type="submit"
            className="sn-press inline-flex min-h-10 items-center justify-center self-start rounded-full bg-ink px-4 text-[13px] font-semibold text-cream hover:bg-ink/90"
          >
            Use this photo
          </button>
          {!ownsPro && !storeShell ? (
            <p className="text-[12px] text-ink/60">
              Your own photo is part of Event Hub Pro. Try it here — guests see it only after you Apply with Pro.
            </p>
          ) : null}
        </form>
      ) : null}

      {hero.kind === 'photo' ? (
        <form action={removeHeroPhoto}>
          <HubDraftField />
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="return_to" value={returnTo} />
          <button
            type="submit"
            className="sn-press inline-flex min-h-10 items-center rounded-full bg-ink/5 px-4 text-[13px] font-semibold text-ink hover:bg-ink/10"
          >
            Use the invitation card instead
          </button>
        </form>
      ) : null}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   REVEAL
   ═══════════════════════════════════════════════════════════════════════════ */

export async function MakerRevealPanel({
  eventId,
  ownsPro,
  storeShell,
}: {
  eventId: string;
  ownsPro: boolean;
  storeShell: boolean;
}) {
  const m = await loadMadeOnce(eventId);
  if (!m.ok) return <CouldNotLoad what="reveal" />;
  const config = await fetchRevealConfig().catch(() => null);
  const theme = themeOf(m.drafted.invite_theme);
  const materials = revealMaterialsFor(theme);
  const themeOpening = INVITE_THEMES[theme].opening;
  const allowed: Partial<Record<string, boolean>> = config?.templates ?? {};
  const openings = REVEAL_LIBRARY.filter((t) => allowed[t.id] !== false).map((t) => ({
    id: t.id,
    label: t.label,
    blurb: t.blurb,
  }));
  const current = typeof m.drafted.std_reveal_template === 'string' ? m.drafted.std_reveal_template : null;
  return (
    <MakerRevealPicker
      eventId={eventId}
      current={current}
      drafted={m.drafted.std_reveal_template !== m.live.std_reveal_template}
      themeName={INVITE_THEMES[theme].name}
      /* What plays when nothing is chosen — the guest page's own rule
         (`site-body.tsx`): the theme's opening, or for Classic the Reveal
         Studio's house default (`revealAllowedFor`: chosen ?? admin default ?? four-flap). */
      defaultOpening={themeOpening === REVEAL_NONE ? (config?.defaultTemplate ?? 'four-flap') : themeOpening}
      defaultIsTheme={themeOpening !== REVEAL_NONE}
      dressing={materials?.name ?? null}
      openings={
        /* 🔒 Store shell, not owning Pro: every opening is a Pro control, so it
           is HIDDEN — the panel offers "No reveal" alone. */
        storeShell && !ownsPro ? [] : openings
      }
      ownsPro={ownsPro}
      storeShell={storeShell}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOGO
   ═══════════════════════════════════════════════════════════════════════════ */

export async function MakerLogoPanel({ eventId }: { eventId: string }) {
  const m = await loadMadeOnce(eventId);
  if (!m.ok) return <CouldNotLoad what="logo" />;
  const { live, drafted } = m;
  const config = sanitizeStudioConfig(drafted.monogram_studio_config);
  const uploaded = safeMonogramSvg(drafted.monogram_uploaded_svg);
  // Whether a composition exists at all — only a yes/no; the mark itself is
  // drawn through `resolveEventMonogramSvg` below, never read raw.
  const hasComposition = typeof drafted.monogram_custom_svg === 'string' && drafted.monogram_custom_svg.length > 0;
  const mark = resolveEventMonogramSvg(drafted);
  return (
    <MakerLogoDoor
      eventId={eventId}
      initialConfig={config}
      initialNames={resolveMonogram(drafted).text}
      /* Compose FROM the uploaded logo when that is the couple's mark and no
         design exists yet — the Monogram Maker page's own rule. */
      initialUploadSvg={!config && uploaded && !hasComposition ? uploaded : null}
      markUri={mark ? bespokeSvgToDataUri(mark) : null}
      drafted={
        drafted.monogram_custom_svg !== live.monogram_custom_svg ||
        JSON.stringify(drafted.monogram_studio_config ?? null) !== JSON.stringify(live.monogram_studio_config ?? null)
      }
    />
  );
}
