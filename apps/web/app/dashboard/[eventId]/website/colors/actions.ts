'use server';

/**
 * Server action for the Website Pro "Site colours" editor (Launch settings-first
 * design · Design_Launch_Settings_2026-07-24 §4.4 · PR-C). Writes two NET-NEW
 * columns — events.site_bg_color + events.site_button_color (#rrggbb hex or NULL
 * · migration 20270930244819) — which override the Mood-Board-derived
 * --color-cream / --color-mulberry tokens on the couple's guest site.
 *
 * Auth mirrors the Our Photos / hero-photo editors: host membership via
 * event_moderators (canonical) OR the legacy event_members couple row, through
 * the shared requireHostMembership gate.
 *
 * Pro gate: these are Website Pro perks. The EDITOR page renders a locked
 * upsell when the event doesn't own Website Pro, but the action is also the
 * enforcement point of last resort — it re-checks eventCoupleWebsiteProActive
 * and refuses to persist for a non-Pro event (defence-in-depth; a non-Pro save
 * would be inert on the guest site anyway, since the renderer gates on Pro too).
 * ⚠ NARROWED 2026-09-24 — owner, verbatim: *"changing background color is free.
 * making media a background is pro."* The BACKGROUND colour is free; button
 * colour, face, art direction and magic move stay Pro, judged against what is
 * stored (`siteLookChange`) — so a free couple can recolour their page, keep
 * whatever Pro choices they already have, and take any of them off.
 *
 * Validation: each field is either a strict `#rrggbb` hex OR empty. Empty
 * CLEARS the column (→ NULL → the site falls back to the Mood-Board palette /
 * brand default for that role). Anything malformed bounces with an error and
 * writes nothing.
 */
import { sanitizeHubFontKey } from '@/lib/hub-fonts';
import { sanitizeMagicTraveller } from '@/lib/magic-move';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireHostMembership } from '@/lib/host-gate';
import { combineChanges, siteLookChange } from '@/lib/hub-look-pro';
import { encodeSiteBackground, ombreLookChange, parseSiteBackground } from '@/lib/ombre';
import { requireLookPro } from '@/lib/hub-look-gate';
import { revalidateGuestSite, revalidateWebsiteEditor } from '@/lib/revalidate-site';
import { resolveReturnTo } from '@/lib/editor-return';
import { draftEventsAndReturn, isHubDraftWrite } from '@/lib/hub-draft-store';

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Normalise a form field to a lowercased `#rrggbb`, `null` (cleared), or the
 *  sentinel `false` for a malformed value the caller must reject. */
function parseHexField(raw: FormDataEntryValue | null): string | null | false {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if (v === '') return null; // empty = clear the column
  return HEX.test(v) ? v.toLowerCase() : false;
}

/**
 * 🌈 The BACKGROUND field takes a plain `#rrggbb` OR an encoded ombré
 * (`lib/ombre.ts` — owner 2026-09-25: *"plain color or like apples ombe
 * style"*), through the one reader of the column's two shapes. Same tri-state
 * as `parseHexField`: `null` clears, `false` is malformed and bounces.
 */
function parseBackgroundField(raw: FormDataEntryValue | null): string | null | false {
  if (typeof raw !== 'string') return null;
  if (raw.trim() === '') return null;
  const bg = parseSiteBackground(raw);
  return bg ? encodeSiteBackground(bg) : false;
}

export async function updateSiteColors(
  eventId: string,
  formData: FormData,
): Promise<void> {
  await requireHostMembership(eventId);

  // ABSENT = UNCHANGED, like every other field on this row. A free couple's
  // panel posts the background colour ONLY, and without this rule that save
  // would silently clear a button colour they already have.
  const bg = formData.has('bg_color') ? parseBackgroundField(formData.get('bg_color')) : undefined;
  const button = formData.has('button_color')
    ? parseHexField(formData.get('button_color'))
    : undefined;

  if (bg === false || button === false) {
    redirect(
      `/dashboard/${eventId}/website/colors?error=${encodeURIComponent(
        'Please use a 6-digit hex colour like #A9834B, or leave it blank to use your palette.',
      )}`,
    );
  }

  // Pahina art direction (PR-5b). Read as PRESENT-OR-ABSENT, never as a value
  // with a default: this action is posted by two different forms, and if a form
  // that doesn't carry the field were treated as posting 'daylight' it would
  // silently reset a couple's Candlelight choice on every colour save. That is
  // the same data-wipe trap the editor's shared-fields rule exists to prevent —
  // absent field ⇒ column untouched.
  const artRaw = formData.get('site_art_direction');
  /* 🔤 THE COUPLE'S OWN FACE, saved beside their colours.
     Same row, same action, same Pro gate — a face is part of the look, and a
     second form would be a second place for the two to disagree about whether
     the couple has customised anything.
     ⛔ `''` CLEARS it back to the theme's own face. An absent field means
     "leave unchanged", exactly as `site_art_direction` does, so a save from a
     surface that does not carry this control cannot silently reset it. */
  const fontRaw = formData.get('site_font_key');
  const font =
    typeof fontRaw === 'string' ? (fontRaw === '' ? null : sanitizeHubFontKey(fontRaw)) : undefined;
  /* ✈ MAGIC MOVE, saved on the same row by the same action.
     Same tri-state as the face above and for the same reason: `undefined` (the
     field was not on this form) leaves the column alone, `''` clears it back to
     "nothing travels", a known value is written. The colours sub-page posts
     this action WITHOUT this control, so without the absent-means-unchanged
     rule every colour save would silently switch a couple's motion off. */
  const magicRaw = formData.get('site_magic_traveller');
  const magic =
    typeof magicRaw === 'string'
      ? magicRaw === ''
        ? null
        : sanitizeMagicTraveller(magicRaw)
      : undefined;
  const art =
    artRaw === 'candlelight' || artRaw === 'daylight' ? (artRaw as string) : null;

  /* 💾 THE DRAFT DOOR (2026-09-25 — the Maker's live savers go into the draft).
     From the Maker (`<HubDraftField />`) the colours go into the couple's draft:
     guests keep the live page until Apply, and Apply is where Pro is asked —
     a free couple may TRY a button colour or a face and pays at Apply. Same
     absent-means-unchanged rule as the live write below. */
  if (isHubDraftWrite(formData)) await draftEventsAndReturn(
      eventId,
      {
        ...(bg !== undefined ? { site_bg_color: bg } : {}),
        ...(button !== undefined ? { site_button_color: button } : {}),
        ...(art ? { site_art_direction: art } : {}),
        ...(font !== undefined ? { site_font_key: font } : {}),
        ...(magic !== undefined ? { site_magic_traveller: magic } : {}),
      },
      formData,
      `/dashboard/${eventId}/website/editor?open=colors`,
    );

  const supabase = await createClient();

  // Defence-in-depth Pro gate over the PRO half only (admin-client SKU read
  // inside `requireLookPro`: orders RLS is purchaser-scoped, so a co-host who
  // didn't place the order still resolves the shared event ownership). The
  // background colour is free and is not an input to the decision at all.
  const { data: stored } = await supabase
    .from('events')
    .select('site_bg_color, site_button_color, site_font_key, site_magic_traveller, site_art_direction')
    .eq('event_id', eventId)
    .maybeSingle();
  const s = (stored ?? {}) as Record<string, string | null | undefined>;
  // 🌈 The ombré's OWN classification — `'none'` while `OMBRE_IS_PRO` is false
  // (it ships free), a look change like any other the day the switch flips.
  // Kept OUTSIDE `siteLookChange`, whose inputs are the Pro half only.
  const ombreChange = ombreLookChange(s.site_bg_color ?? null, bg);
  await requireLookPro(
    eventId,
    combineChanges(
      siteLookChange(
        {
          button: s.site_button_color ?? null,
          font: s.site_font_key ?? null,
          magic: s.site_magic_traveller ?? null,
          art: s.site_art_direction ?? null,
        },
        { button, font, magic, art },
      ),
      ombreChange,
    ),
  );

  const { data: event, error } = await supabase
    .from('events')
    .update({
      ...(bg !== undefined ? { site_bg_color: bg } : {}),
      ...(button !== undefined ? { site_button_color: button } : {}),
      ...(art ? { site_art_direction: art } : {}),
      ...(font !== undefined ? { site_font_key: font } : {}),
      ...(magic !== undefined ? { site_magic_traveller: magic } : {}),
    })
    .eq('event_id', eventId)
    .select('slug')
    .maybeSingle();

  if (error) {
    redirect(
      `/dashboard/${eventId}/website/colors?error=${encodeURIComponent(
        'Could not save. Please try again.',
      )}`,
    );
  }

  revalidateWebsiteEditor(eventId, 'colors');
  revalidateGuestSite(event?.slug);
  redirect(
    resolveReturnTo(formData, `/dashboard/${eventId}/website/colors?saved=1`, '?saved=1'),
  );
}
