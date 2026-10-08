/**
 * apps/web/lib/hub-look-pro.ts
 *
 * THE LINE BETWEEN THE PAGE WE WRITE AND HOW IT LOOKS — one pure decision.
 *
 * Owner, 2026-09-24 (DECISION_LOG, verbatim "A"): on the Event Hub, uploading
 * the couple's OWN photos, snippets and films to the page's look is PRO. Free
 * couples get the complete page we write — our pictures, their words. His rule:
 * *"Free is the page we write. Pro is changing how it looks."*
 *
 *   LOOK  (Pro)  — hero photo / hero video / living hero, their own gallery,
 *                  background music, a section's background PHOTO or SNIPPET,
 *                  its crop and zoom, how it moves, the invitation backdrop
 *                  (moving media), face, art direction, magic move, the
 *                  Save-the-Date's own background / film, a part's own FONT
 *                  and its own MOTION.
 *   COLOUR (free) — owner, 2026-09-24, verbatim: *"changing background color is
 *                  free. making media a background is pro."* The page's main
 *                  background colour (`site_bg_color`) and a section's COLOUR
 *                  background are free; media behind a section is not.
 *   REDRAWN 2026-09-28 — owner, verbatim: *"free to change design, change text,
 *                  size, color, background color, only when you start adding
 *                  themes will it be pro. adding media for background."* So the
 *                  BUTTON colour (`site_button_color`) and a part's own colour ·
 *                  size · weight · B/I/U · alignment · spacing are free too
 *                  (`HUB_ELEMENT_FREE_FIELDS`). Font choice and motion were not
 *                  in his line and stay Pro until he says otherwise.
 *   WORDS (free) — their story, dress-code wording, schedule, venue, the special
 *                  message, what to bring, every fact about the day.
 *   NOT HERE     — guest photos in Papic and the gallery. The ruling does not
 *                  touch them and nothing in this file may be called there.
 *
 * ── THE GRANDFATHER RULE (the same one custom sections use) ────────────────
 * A couple who already HAS a look keeps it: it stays on their page, and they may
 * take it OFF without Pro. What they may not do without Pro is ADD a look or
 * CHANGE the one they have. So every look writer classifies its own write as one
 * of four changes, and this file answers once whether that change is allowed:
 *
 *   'none'   — the write puts back exactly what is stored (a re-save, a toggle
 *              of an existing song). Always allowed: it adds nothing.
 *   'remove' — the look comes off / resets to ours. Always allowed.
 *   'add'    — a look where there was none.      Pro only.
 *   'change' — a different look than the stored one. Pro only.
 *
 * 🔑 PURE ON PURPOSE. `ownsPro` enters as a boolean the CALLER measured (the
 * server gate reads it with the admin client, as `website/colors/actions.ts`
 * does, so a co-host who did not place the order still resolves the event's
 * Pro). The tests construct an OWNING couple and assert the write is allowed —
 * a gate that can only answer one way renders exactly like a gate that works.
 */

/** What one look write does to what is already stored. */
export type LookChange = 'none' | 'remove' | 'add' | 'change';

/** THE decision. Everything else in this file only classifies a write. */
export function lookWriteAllowed(ownsPro: boolean, change: LookChange): boolean {
  if (ownsPro) return true;
  return change === 'none' || change === 'remove';
}

const blank = (v: string | null | undefined): v is null | undefined | '' =>
  v === null || v === undefined || v.trim() === '';

/**
 * One stored reference (a hero photo, a hero video, a song, a section's
 * background, a backdrop key) against the one about to be written.
 */
export function refChange(
  current: string | null | undefined,
  next: string | null | undefined,
): LookChange {
  const had = !blank(current);
  if (blank(next)) return had ? 'remove' : 'none';
  if (had && current === next) return 'none';
  return had ? 'change' : 'add';
}

/**
 * One save that writes several look fields at once (the living hero writes a
 * still AND a clip). The save is only as free as its most demanding part: any
 * addition or change makes the whole write Pro.
 */
export function combineChanges(...changes: readonly LookChange[]): LookChange {
  if (changes.includes('add')) return 'add';
  if (changes.includes('change')) return 'change';
  if (changes.includes('remove')) return 'remove';
  return 'none';
}

/**
 * The couple's own gallery. Taking photos OUT — in the order they already
 * stand — is a removal. A photo the gallery did not hold is an addition. The
 * same photos in a different order is a change: the page looks different.
 */
export function galleryChange(
  current: readonly string[],
  next: readonly string[],
): LookChange {
  if (next.some((ref) => !current.includes(ref))) return 'add';
  if (next.length === current.length && next.every((ref, i) => ref === current[i])) return 'none';
  // Every ref is an existing one. Is it `current` with some left out, in order?
  let i = 0;
  for (const ref of current) {
    if (i < next.length && next[i] === ref) i += 1;
  }
  return i === next.length ? 'remove' : 'change';
}

/**
 * The Pro half of `updateSiteColors` — face, art direction and magic move —
 * against what is stored. `undefined` = the form did not carry that control
 * (left alone, so it adds nothing).
 *
 * ⛔ NEITHER COLOUR IS AN INPUT. The background colour is free (owner
 * 2026-09-24) and the button colour joined it (owner 2026-09-28, *"change …
 * color … only when you start adding themes will it be pro"*), so neither can
 * make this write Pro — there is no field here for a future edit to fold one
 * back in by accident.
 *
 * Daylight is the page we write, so `'daylight'` and a stored `null` are the
 * same look: choosing Daylight is a reset, only Candlelight is a choice.
 */
export function siteLookChange(
  stored: {
    font: string | null;
    magic: string | null;
    art: string | null;
  },
  next: {
    font: string | null | undefined;
    magic: string | null | undefined;
    /** An art direction the form asked to store. `null` = none posted. */
    art: string | null;
  },
): LookChange {
  const candle = (v: string | null) => (v === 'candlelight' ? v : null);
  const changes: LookChange[] = [];
  // 🔤 The font is FREE since 2026-10-05 ("Colors, and Fonts are all free") —
  // carried in the signature so every caller keeps passing it, never compared.
  void stored.font;
  void next.font;
  if (next.magic !== undefined) changes.push(refChange(stored.magic, next.magic));
  if (next.art !== null) changes.push(refChange(candle(stored.art), candle(next.art)));
  return combineChanges(...changes);
}

/**
 * The kinds of section background (`HUB_BACKGROUND_KINDS` in
 * `lib/hub-canvas.ts`). A colour — flat or either glass — and "No background"
 * are free; media behind a section (photo · snippet) is Pro (owner 2026-09-24,
 * "changing background color is free. making media a background is pro.").
 * `setWidgetBackground` passes the kind the form actually posted — never a
 * hard-coded one — so a colour write reaches the colour arm below.
 */
export type SectionBackgroundKind = 'photo' | 'snippet' | 'color' | 'glass' | 'frost' | 'none';

/**
 * One section-background write. A COLOUR is never Pro, in any direction — so a
 * colour write is `'none'`, whatever it replaces or clears. Putting a photo or a
 * snippet up is classified like any other ref; taking one down is a removal.
 *
 * 🔑 Swapping media FOR a colour takes the media down, which is a removal.
 */
export function sectionBackgroundChange(input: {
  /** The media ref stored now (photo or snippet), or null. */
  currentMedia: string | null;
  kind: SectionBackgroundKind;
  /** The media ref to store (photo / snippet), or null / '' for none. */
  nextMedia: string | null;
}): LookChange {
  if (input.kind !== 'photo' && input.kind !== 'snippet') return input.currentMedia ? 'remove' : 'none';
  return refChange(input.currentMedia, input.nextMedia);
}

/**
 * The canvas keys that are a section's LOOK (`lib/hub-canvas.ts`
 * `HubSectionCanvas`). Everything the canvas stores is look — the photo behind
 * it, where it is cropped, how close, how it is laid out, how it moves.
 */
export const HUB_CANVAS_LOOK_KEYS = [
  'media',
  'focal',
  'zoom',
  'arrangement',
  'preset',
  'in',
  'inFrom',
  'out',
  'outTo',
  // 🎛 The four effects a scene's In / Out can combine (2026-10-04) — stored
  // only where `in`/`inFrom` · `out`/`outTo` cannot say them.
  'inFx',
  'outFx',
  'during',
  'timeline',
  'sequence',
  'stagger',
  'duration',
  // Scroll · Scrub · Auto-scroll into the next scene (#5951, `lib/hub-scenes.ts`).
  'transition',
  'autoSpeed',
  // 🌄 How a photo background moves (Still · Parallax) and 🎞 a clip's still —
  // both exist only beside media, which is Pro (owner 2026-09-28: *"adding
  // media for background"*), so a free couple drafts them and Apply asks.
  'mediaMotion',
  'poster',
  // One element's own look (`lib/element-style.ts`). Only PART of it is Pro —
  // its font and its motion (`HUB_ELEMENT_PRO_FIELDS`); its colour, size and
  // the Text tab's other rows are free (owner 2026-09-28). `canvasLookChange`
  // compares it field by field for exactly that reason.
  'elements',
] as const;

/**
 * 🔤 ONE PART'S OWN LOOK, SPLIT (owner 2026-09-28, verbatim: *"free to change
 * design, change text, size, color, background color, only when you start
 * adding themes will it be pro. adding media for background."*).
 *
 *   PRO  — the part's own FONT (the typeface) and its own MOTION (In · During ·
 *          Out · timeline). Neither was in his line, so both stay as they were
 *          (DECISION_LOG 2026-09-28, "WHAT IS FREE VS PRO … REDRAWN").
 *   FREE — everything else a part carries: colour, size, weight, bold · italic
 *          · underline, alignment, line and letter spacing (the Text tab), and
 *          its Show / its joiner word, which were always free.
 *
 * A text RUN (a word or letter styled inside a part) carries font · colour ·
 * size of its own; only the run's FONT is Pro, by the same line.
 *
 * ⚖ The two lists together must name every `HubElementStyle` field — held by
 * `lib/free-vs-pro-redrawn.test.ts`, so a new field has to be placed on one side
 * on purpose rather than drifting to whichever the comparison forgot.
 */
/* 🔤 FONT ON A SINGLE PART IS FREE (owner 2026-10-06, DECISION_LOG "EVENT DETAILS
   IS REBUILT": *"font on a single part is FREE too"*) — like the page's own font
   (2026-10-05). Only a part's MOTION stays Pro. */
export const HUB_ELEMENT_PRO_FIELDS = ['motion'] as const;
export const HUB_ELEMENT_FREE_FIELDS = [
  'font',
  'color',
  'size',
  'weight',
  'italic',
  'underline',
  'align',
  'leading',
  'tracking',
  'hidden',
  'word',
  // 🗓 How the date and the time are written (Format ▾, tap-to-type) — words, free.
  'format',
] as const;
/** A run's own fields: none is Pro since 2026-10-06 (a run's font is free, like the part's). */
export const HUB_RUN_PRO_FIELDS = [] as const;

/** The motion subset — what "Reset how it moves" takes off. */
export const HUB_CANVAS_MOTION_KEYS = [
  'preset',
  'in',
  'inFrom',
  'out',
  'outTo',
  // 🎛 The four effects a scene's In / Out can combine (2026-10-04) — stored
  // only where `in`/`inFrom` · `out`/`outTo` cannot say them.
  'inFx',
  'outFx',
  'during',
  'timeline',
  'sequence',
  'stagger',
  'duration',
  // How this scene hands over to the next one (#5951). Scroll is an absence,
  // so a stored value here is always a choice — and Reset takes it off.
  'transition',
  'autoSpeed',
] as const;

/** Does this section's canvas carry any motion the couple chose? */
export function canvasHasMotion(canvas: Record<string, unknown>): boolean {
  return HUB_CANVAS_MOTION_KEYS.some((k) => canvas[k] !== undefined);
}

/**
 * The `events` columns that are the page's LOOK. A server action that writes
 * any of these (with a non-null value) must ask `lookWriteAllowed` first —
 * `hub-look-is-pro.test.ts` walks every action file and holds that property.
 */
export const HUB_LOOK_EVENT_COLUMNS = [
  'landing_page_hero_image_url',
  'landing_page_hero_video_r2_key',
  'our_photos',
  'site_bg_music_r2_key',
  'rsvp_backdrop',
  'site_magic_traveller',
  'site_art_direction',
  'std_background',
  'std_media',
] as const;

/**
 * The `events` columns that are the couple's WORDS and FACTS. Never gated —
 * fixing their own words is free. Listed so the test can prove the two sets
 * never overlap: a column cannot be both.
 */
export const HUB_WORDS_EVENT_COLUMNS = [
  'love_story',
  'special_message',
  'what_to_bring',
  'dress_code_config',
  'photo_moments_config',
  'rsvp_ask_config',
  'venue_name',
  'venue_address',
  'event_date',
  'display_name',
  'std_film_date',
  'std_film_venue_name',
  'std_film_venue_city',
  'std_film_ceremony_name',
  'std_film_story',
] as const;

/**
 * Look columns that are FREE (owner 2026-09-24: *"changing background color is
 * free"*; 2026-09-28: *"change … color … only when you start adding themes will
 * it be pro"* — the button colour joins it). A colour is not media — it is the
 * page we write, recoloured. 🔘 And Look › Buttons' shape + fill (2026-10-04,
 * `site_button_style`): a button's shape is design, which that same line frees.
 * 🔤 And the FONT (owner 2026-10-05, DECISION_LOG "THEMES ARE REPLACED BY
 * THREE DIRECT GLOBAL SETTINGS": *"Colors, and Fonts are all free"*): the
 * paid tier is media and our moving backgrounds, never type.
 */
export const HUB_FREE_LOOK_EVENT_COLUMNS = ['site_bg_color', 'site_button_color', 'site_button_style', 'site_font_key', 'site_roles'] as const;

/** Is this `events` column the page's look (Pro), a free colour, or words? */
export function hubColumnKind(column: string): 'look' | 'free-look' | 'words' | 'other' {
  if ((HUB_LOOK_EVENT_COLUMNS as readonly string[]).includes(column)) return 'look';
  if ((HUB_FREE_LOOK_EVENT_COLUMNS as readonly string[]).includes(column)) return 'free-look';
  if ((HUB_WORDS_EVENT_COLUMNS as readonly string[]).includes(column)) return 'words';
  return 'other';
}

/** The message a refused Save-the-Date save carries back to the builder. */
export const LOOK_PRO_REQUIRED = 'pro-required';
