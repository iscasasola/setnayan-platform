import { Suspense, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { eventWordsFromProfile } from '@/app/[slug]/_lib/event-words';
import { guestLookFrom, type EventShellRow } from '@/app/[slug]/_lib/loaders';
import { profileSetup, type EventTypeProfile } from '@/lib/event-type-profile';
import { resolveWeddingOnlyParts } from '@/lib/wedding-only-parts';
import { INVITE_THEMES, normalizeThemeId, pickableInviteThemes, resolveInviteTheme } from '@/lib/invite-themes';
import { hasOwnLook } from '@/lib/theme-own-look';
import { hubButtonPage } from '@/lib/hub-buttons';
import { makerProMark } from '@/lib/paid-mark';
import { moodBoardSiteColours } from '@/lib/site-palette';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { overlayHubDraftEvent, type HubDraft } from '@/lib/hub-draft';
import { resolveReplyBy, sanitizeRsvpAskConfig } from '@/lib/rsvp-ask';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { formatPhp } from '@/lib/php';
import { logQueryError } from '@/lib/supabase/error-detect';
import { recordFieldHref, type RecordEditorKey } from '@/lib/event-details-record';
import { paletteIsSet, themeSeedPalettes } from '@/lib/theme-colours';
import { MakerThemeMenu, ThemePickProvider } from '../../launch/_components/maker-theme-picker';
import { ButtonsLookRow, ColorsPanel, MakerRsvpSettings, ProLockPanel, SpecialMessageField } from '../../launch/_components/details-lazy';
import { answerParts, coverAnswer, logoAnswer, type AnswersInput } from '../../launch/_components/details-answers-parts';
import { loadYourEvent } from '../../launch/_components/details-your-event-load';
import { yourEventFactEditors } from '../../launch/_components/details-your-event-parts';
import { loadEventSettings } from '../../launch/_components/details-settings-load';
import { LiveStoryPanel } from '../../website/our-story/_components/love-story-live';
import type { LoveStoryBlob } from '../../website/our-story/_components/story-fields';
import { proPriceLabelFrom } from '../../website/editor/_components/unlock-label';
import { updateSiteColors } from '../../website/colors/actions';
import { updateSpecialMessage } from '../../website/special-message/actions';
import RequestsPage from '../../guests/claims/page';
import { EventSettingsEditor } from './event-settings-editor';

/**
 * ✍ THE FIELD A ROW OPENS — Event Details' rows open the SAME editor the Maker
 * opens for that fact (owner 2026-10-04, DECISION_LOG "YES TO ALL": *"Event
 * Details rows are edited in place"*; study § 2 "one home per fact — one editor,
 * three doors"; § 7 PR-1). Nothing here is a new form: every node below is the
 * component the Maker mounts (`RECORD_EDITOR_COMPONENT` names each), fed the way
 * the Maker feeds it — the draft laid over the live row, the Pro question as
 * the viewer is shown it, the same writers.
 *
 * Only the ONE editor whose row is open is read and drawn (`?edit=`), so the
 * record never pays for twenty editors to show one.
 *
 * 💾 Drafted — the Hub's facts save into the Event Hub draft and count in the
 * page's Apply; guests see them at Apply. Event settings (kind, area, the guest
 * estimate, the list's closing day, how costs are shown) keep their own Save,
 * as on /details/change — they are not Hub publications (study § 2).
 *
 * 🔒 READING NEVER WRITES. Every read here is a SELECT; no editor saves on
 * mount (`every-maker-form-drafts-or-says-so.test.ts`).
 */
export type RecordEditorContext = {
  eventId: string;
  userId: string;
  supabase: SupabaseClient;
  admin: SupabaseClient;
  profile: EventTypeProfile;
  /** The event's Event Hub draft (null = none, or unread). */
  draft: HubDraft | null;
  /** Event Hub Pro, as the viewer is shown it (`printOwnsPro`). */
  ownsPro: boolean;
  storeShell: boolean;
  /** The viewer may read the guest list (the RSVP panel's Requests rows). */
  mayReadGuests: boolean;
};

/** The look columns every Look editor reads — drafted over live, as the Maker's work area reads them. */
const LOOK_COLUMNS =
  'invite_theme, role_palette, site_bg_color, site_button_color, site_button_style, site_art_direction, site_font_key, site_magic_traveller, mood_feel_key';

export async function RecordEditor({ editor, ctx }: { editor: RecordEditorKey; ctx: RecordEditorContext }): Promise<ReactNode> {
  const { eventId, supabase, admin, draft } = ctx;

  switch (editor) {
    /* ══ 🎨 HOW IT LOOKS — Look's own sections (`lib/maker-look-sections.ts`) ══ */
    case 'theme':
    case 'font':
    case 'colours':
    case 'buttons': {
      const { data, error } = await supabase.from('events').select(LOOK_COLUMNS).eq('event_id', eventId).maybeSingle();
      if (error || !data) {
        if (error) logQueryError('EventDetails.lookEditor', error, { event_id: eventId }, 'graceful_degrade');
        return <CouldNotOpen />;
      }
      const live = data as unknown as Record<string, unknown>;
      const drafted = overlayHubDraftEvent(live, draft);
      if (editor === 'theme') {
        /* The Maker's theme dropdown, in its one pick (`ThemePickProvider`):
           drafted, Pro tried here and asked at Apply (#6091). */
        const themes = pickableInviteThemes();
        const current = resolveInviteTheme({ saved: drafted.invite_theme, ownsPro: ctx.ownsPro || !ctx.storeShell });
        return (
          <ThemePickProvider
            eventId={eventId}
            current={current}
            ownLook={hasOwnLook(live, draft?.events as Record<string, unknown> | undefined)}
            /* 🎨 An empty Mood Board takes the picked theme's colours (owner 2026-10-05). */
            seeds={paletteIsSet(live.role_palette) ? null : themeSeedPalettes()}
          >
            <MakerThemeMenu
              themes={themes.map((t) => ({ id: t.id, name: t.name, tier: t.tier }))}
              ownsPro={ctx.ownsPro}
              storeShell={ctx.storeShell}
            />
          </ThemePickProvider>
        );
      }
      const themeId = normalizeThemeId(drafted.invite_theme) ?? 'house';
      const palette = sanitizeRolePalette(live.role_palette);
      if (editor === 'buttons') {
        /* 🔘 Look › Buttons — measured against the page as it paints, the
           host's own colour left out so "Theme’s" shows the page without it
           (the work area's own composition). */
        const theme = INVITE_THEMES[themeId];
        const pageLook = guestLookFrom(
          { ...drafted, role_palette: live.role_palette, site_button_color: null, site_button_style: null } as unknown as EventShellRow,
          { theme: themeId, accent: '#000000', monogram: '' },
          true,
        );
        const swatches = moodBoardSiteColours(palette)?.swatches ?? [];
        return (
          <ButtonsLookRow
            eventId={eventId}
            theme={theme}
            page={hubButtonPage(theme, pageLook.vars)}
            style={(drafted.site_button_style as string | null) ?? null}
            colour={(drafted.site_button_color as string | null) ?? null}
            palette={swatches.length > 0 ? swatches : [theme.palette.accent, theme.palette.heading, theme.palette.ink, theme.palette.muted]}
          />
        );
      }
      /* 🔤 Font · 🎨 Colours — the ONE Colors panel, drawn as its two parts. Its
         Pro half locks only in the app-store shell (tried free, paid at Apply),
         with the grandfather: a couple who already chose one keeps it. */
      const proLocked =
        ctx.storeShell &&
        !ctx.ownsPro &&
        !(live.site_font_key || live.site_magic_traveller || live.site_art_direction === 'candlelight');
      const priceLabel = ctx.storeShell ? null : proPriceLabelFrom((await formatV2Sku('COUPLE_WEBSITE_PRO').catch(() => null))?.price_php, formatPhp);
      const lockPanel = (featureName: string) =>
        ctx.storeShell ? null : (
          <ProLockPanel featureName={featureName} unlockHref={`/dashboard/${eventId}/studio/website-pro`} priceLabel={priceLabel} />
        );
      return (
        <ColorsPanel
          action={updateSiteColors.bind(null, eventId)}
          eventId={eventId}
          rowKey={editor === 'font' ? 'font' : 'colors'}
          part={editor === 'font' ? 'font' : 'colours'}
          proLocked={proLocked}
          proLock={lockPanel(editor === 'font' ? 'Typeface' : 'Candlelight and motion')}
          proMark={makerProMark({ owns: ctx.ownsPro, storeShell: ctx.storeShell })}
          themeId={themeId}
          moodBoard={editor === 'colours' ? moodBoardSiteColours(palette) : undefined}
          bgColor={(drafted.site_bg_color as string | null) ?? null}
          buttonColor={(drafted.site_button_color as string | null) ?? null}
          artDirection={(drafted.site_art_direction as 'daylight' | 'candlelight' | null) ?? null}
          fontKey={(drafted.site_font_key as string | null) ?? null}
          magicTraveller={editor === 'colours' ? ((drafted.site_magic_traveller as string | null) ?? null) : undefined}
        />
      );
    }

    /* ══ 🗳 HOW IT WORKS — the Maker's RSVP settings: who gets in · what to ask · reply by ══ */
    case 'rsvp': {
      const requestsCountRead = ctx.mayReadGuests
        ? admin
            .from('guests')
            .select('guest_id', { count: 'exact', head: true })
            .eq('event_id', eventId)
            .eq('entry_source', 'self_added_unlisted')
            .is('deleted_at', null)
        : null;
      const [eventRes, requestsRes] = await Promise.all([
        supabase
          .from('events')
          .select('rsvp_ask_config, guest_list_edit_deadline, adaptive_pricing_mode, event_date')
          .eq('event_id', eventId)
          .maybeSingle(),
        requestsCountRead,
      ]);
      if (eventRes.error || !eventRes.data) {
        if (eventRes.error) logQueryError('EventDetails.rsvpEditor', eventRes.error, { event_id: eventId }, 'graceful_degrade');
        return <CouldNotOpen />;
      }
      if (requestsRes?.error) logQueryError('EventDetails.rsvpRequests', requestsRes.error, { event_id: eventId }, 'graceful_degrade');
      const row = eventRes.data as {
        rsvp_ask_config: unknown;
        guest_list_edit_deadline: string | null;
        adaptive_pricing_mode: string | null;
        event_date: string | null;
      };
      const drafted = Boolean(draft && 'rsvp_ask_config' in draft.events);
      return (
        <MakerRsvpSettings
          eventId={eventId}
          current={sanitizeRsvpAskConfig(drafted ? draft!.events.rsvp_ask_config : row.rsvp_ask_config)}
          drafted={drafted}
          solemn={eventWordsFromProfile(ctx.profile).solemn}
          replyBy={resolveReplyBy({ deadline: row.guest_list_edit_deadline, eventDate: row.event_date })}
          replyByOwn={{ deadline: row.guest_list_edit_deadline, pricingMode: row.adaptive_pricing_mode === 'final_only' ? 'final_only' : 'realtime' }}
          requests={{
            count: !requestsRes || requestsRes.error ? null : (requestsRes.count ?? 0),
            list: ctx.mayReadGuests ? (
              <Suspense fallback={<p className="text-sm text-ink/60">Opening your requests…</p>}>
                <RequestsPage params={Promise.resolve({ eventId })} searchParams={Promise.resolve({ maker: '1' })} />
              </Suspense>
            ) : null,
          }}
        />
      );
    }

    /* ══ 🗂 The onboarding's answers — one dropdown each over its own column ══ */
    case 'papic':
    case 'gifts':
    case 'logo-answer':
    case 'cover-answer': {
      const { data, error } = await supabase
        .from('events')
        .select('papic_on, gifts_on, logo_wanted, cover_photo_wanted')
        .eq('event_id', eventId)
        .maybeSingle();
      if (error || !data) {
        if (error) logQueryError('EventDetails.answerEditor', error, { event_id: eventId }, 'graceful_degrade');
        return <CouldNotOpen />;
      }
      const live = data as Record<string, unknown>;
      const value = (c: 'papic_on' | 'gifts_on' | 'logo_wanted' | 'cover_photo_wanted'): boolean | null => {
        const v = draft && c in draft.events ? draft.events[c] : live[c];
        return typeof v === 'boolean' ? v : null;
      };
      const setupOfType = profileSetup(ctx.profile);
      const words = eventWordsFromProfile(ctx.profile);
      const answers: AnswersInput = {
        solemn: words.solemn,
        twoPeople: words.twoPeople,
        giftsMode: setupOfType.giftsMode,
        papic: { offered: setupOfType.cameraDefault !== 'off', value: value('papic_on') },
        gifts: { offered: setupOfType.giftsMode !== 'none', value: value('gifts_on') },
        logo: value('logo_wanted'),
        cover: value('cover_photo_wanted'),
      };
      if (editor === 'logo-answer') return logoAnswer(eventId, answers).node;
      if (editor === 'cover-answer') return coverAnswer(eventId, answers).node;
      return answerParts({ eventId, answers }).editors[editor] ?? <CouldNotOpen />;
    }

    /* ══ 🗓 YOUR EVENT — Names · Date (+ the ceremony time) · Venues: the ONE builder ══ */
    case 'names':
    case 'date':
    case 'venues': {
      const input = await loadYourEvent({
        supabase,
        admin,
        eventId,
        mayShowStdFilm: resolveWeddingOnlyParts(ctx.profile).save_the_date_film,
        // The counts only mark Parents & hosts done — not drawn here.
        parentCount: 0,
        hostCount: 0,
        drafted: (draft?.events ?? {}) as Record<string, unknown>,
        draftedVenue: draft?.widgets.venue_map?.venue ?? null,
      }).catch((e: unknown) => {
        console.error('[event-details] your event could not be read:', e instanceof Error ? e.message : e);
        return null;
      });
      if (!input) return <CouldNotOpen />;
      return yourEventFactEditors({ eventId, input })[editor] ?? <CouldNotOpen />;
    }

    /* ══ 💌 The Love Story's words — the Maker's instant panel, drafted as typed ══ */
    case 'love-story': {
      const { data, error } = await supabase.from('events').select('love_story').eq('event_id', eventId).maybeSingle();
      if (error) {
        logQueryError('EventDetails.loveStoryEditor', error, { event_id: eventId }, 'graceful_degrade');
        return <CouldNotOpen />;
      }
      const raw = draft && 'love_story' in draft.events ? draft.events.love_story : (data as { love_story?: unknown } | null)?.love_story;
      const story: LoveStoryBlob = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as LoveStoryBlob) : {};
      return <LiveStoryPanel eventId={eventId} story={story} ownsPro={ctx.ownsPro} />;
    }

    /* ══ ✍ The special message — drafted; a save lands back on this row ══ */
    case 'special-message': {
      const { data, error } = await supabase.from('events').select('special_message').eq('event_id', eventId).maybeSingle();
      if (error) {
        logQueryError('EventDetails.specialMessageEditor', error, { event_id: eventId }, 'graceful_degrade');
        return <CouldNotOpen />;
      }
      const live = (data as { special_message?: string | null } | null)?.special_message ?? null;
      const initial = draft && 'special_message' in draft.events ? ((draft.events.special_message as string | null) ?? null) : live;
      return (
        <SpecialMessageField
          action={updateSpecialMessage.bind(null, eventId)}
          initial={initial}
          back={recordFieldHref(eventId, 'special-message')}
        />
      );
    }

    /* ══ ⚙ Event settings — the /details/change page's own three editors, saving live ══ */
    case 'settings': {
      const settings = await loadEventSettings({ supabase, eventId, userId: ctx.userId });
      if (!settings) return <CouldNotOpen />;
      return <EventSettingsEditor eventId={eventId} form={settings.form} governed={settings.governed} pax={settings.pax} />;
    }
  }
}

/** A field that could not be read is SAID, never drawn empty — an empty form would save that emptiness. */
function CouldNotOpen() {
  return (
    <p role="alert" className="text-sm text-terracotta-700" data-record-field-failed="">
      This could not be opened just now. Nothing was changed — close it and try again in a moment.
    </p>
  );
}
