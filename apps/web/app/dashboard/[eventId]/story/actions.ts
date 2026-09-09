'use server';

// Server action for the consolidated Editorial editor (iteration 0046). Writes
// the couple's content overrides + section visibility into
// `event_editorial.draft_json` (the compose engine already prefers these fields
// over its auto-written defaults) and the draft/published status. Host
// membership is verified on the user session; the upsert itself runs through the
// admin client because event_editorial is owned by the server-side composer
// (the couple has no direct write RLS on it) — same trust model as the data
// loader. Existing draft_json keys we don't manage (e.g. seeded `reviews`) are
// preserved by merging rather than replacing.

import { revalidatePath } from 'next/cache';

import { everyCopyIsNowStale } from '@/lib/a-withdrawal-reaches-every-copy.server';
import { after } from 'next/server';
import {
  storyAudienceOf,
  storyIsShared,
  type StoryAudience,
} from '@/lib/who-can-see-your-story';
import { createAdminClient } from '@/lib/supabase/admin';
import { scanEditorial } from '@/lib/editorial-scan';
import {
  EDITORIAL_ORDERABLE_KEYS,
  readCustomColumns,
  sectionOrderToPersist,
  type CustomColumn,
  EDITORIAL_SECTION_KEYS,
  type ChapterOverride,
  type EditorialSections,
  type Review,
} from '@/app/[slug]/_components/editorial/data';
import { isEditorialProActive } from '@/lib/couple-website-pro';
import { editorialAllowsEventType } from '@/lib/editorial-event-types';
import { sanitizeStoryTheme } from '@/lib/story-theme';
import { createClient } from '@/lib/supabase/server';
import { deskIsClear, isWaitingOnTheHost } from '@/lib/story-desk';
import {
  LAST_WORD_MAX,
  publishBlockers,
  publishRefusal,
} from '@/lib/publish-once-knowing-who-reads-it';
import { stampForPublish } from '@/lib/story-edition';
import { roomSnapshotOf } from '@/lib/story-room';
import { loadLiveRoom } from '@/app/[slug]/_components/story/spine-data';
import { loadDesk } from './_lib/load-desk';
import { hostUserId } from './_lib/host-authority';

export type EditorialEditorInput = {
  headline: string;
  deck: string;
  superKicker: string;
  byline: string;
  leadParagraphs: string; // raw textarea — split on blank lines
  pullQuote: string;
  // FREE couple-uploaded imagery (no Papic required). `heroUpload` is a single
  // `r2://…` ref for the editorial cover (empty string = none). `galleryUploads`
  // is up to 30 `r2://…` refs feeding ONLY the "From the Day" gallery grid. Both
  // are compressed client-side at upload time; stored in draft_json.
  heroUpload: string;
  galleryUploads: string[];
  sections: EditorialSections;
  // "As the Day Unfolded" per-chapter curation. The ARRAY ORDER is the couple's
  // chosen chapter order; only rows that DIFFER from the auto default are sent (an
  // untouched chapter carries no override row). Each targets a chapter by leadId.
  chapterOverrides: ChapterOverride[];
  // PRO — the couple's chosen order of the reorderable content sections (a
  // string[] of EditorialOrderKey values). `null`/empty → default order.
  sectionOrder: string[] | null;
  /** The couple's own columns — title + body each. Re-validated server-side. */
  customColumns?: unknown;
  // PRO — the manual "What They Said" guest-wishes list (draft_json.reviews).
  reviews: Review[];
  /**
   * WHO MAY READ IT — 'draft' (only me) · 'event' (the people of this
   * celebration) · 'published' (everyone).
   *
   * ⚠ REPLACED A BOOLEAN `publish`. Two states could not express the middle
   * answer, and the boolean's `false` meant "only me" while ALSO being what a
   * couple got by simply pressing Save — so there was no way to say "my guests,
   * and nobody else". An unrecognised value fails CLOSED to 'draft'.
   */
  audience: StoryAudience;
  /**
   * THE STORY'S COLOURS — 'board' (follow the mood board) · 'own' (a detached
   * palette) · 'neutral' (warm paper and ink). Re-validated server-side by
   * `sanitizeStoryTheme`.
   *
   * ⚠ NOT PRO. The owner ruled 2026-09-09 that the gate stays EXACTLY as it
   * ships — moments, section order, own columns, featured wishes — and theme is
   * not one of the four. Adding it to the `isPro` block below would be a
   * repricing nobody chose, in the direction that costs a host something.
   */
  theme?: unknown;
  /**
   * THE CONSENT TICK (design `02` §8). True only when the host has this moment
   * ticked "I want this story to be public, and I understand it will carry our
   * names, our photos, and the words our guests agreed to share."
   *
   * ⚖ IT IS NOT A PERMISSION SLIP THE CLIENT HANDS US. It is recorded as
   * `publish_consent_at` and re-read on the next visit, so a host who agreed in
   * March does not have to agree again in April to go back to published — and a
   * request that simply asserts `true` still cannot publish an undecided desk.
   */
  publishConsent?: boolean;
  /**
   * THE HOST'S LAST WORD — `events.special_message`, the words the story closes
   * on. Nobody writes it for them (design `02` §8).
   *
   * ⚠ THE SAME COLUMN `/dashboard/[eventId]/website/special-message` writes, and
   * that is on purpose rather than a second store: the publish panel is where a
   * host is standing when they think about how their story ends, and sending
   * them to another screen to write it is the four-screens problem this desk
   * exists to end. `undefined` means "this client is not editing it" and the
   * column is left alone.
   */
  lastWord?: string;
};

/** Cap the persisted per-moment story so a runaway paste can't bloat draft_json.
 *  The editor soft-caps at ~400 chars with a counter; this is the hard ceiling. */
const CHAPTER_WRITEUP_MAX = 600;
/** Cap the moment name. Comfortably past the longest canonical moment. */
const CHAPTER_TITLE_MAX = 80;

/**
 * Sanitize + cap the client's chapterOverrides before persisting.
 *
 * The client sends an override row per chapter ONLY when the couple has made any
 * change (rename / write-up / hide / reorder) — and because the loader front-loads
 * overridden chapters in array order, a reorder REQUIRES the full ordered set (a
 * bare `{ leadId }` row holds a chapter's position without renaming it). So this
 * KEEPS bare rows (they carry order), dedupes by leadId, and trims + caps text.
 * When the couple has made no changes at all the client sends `[]` and the key is
 * deleted (no override row → pure auto behaviour). Malformed rows are dropped.
 */
function sanitizeChapterOverrides(input: ChapterOverride[]): ChapterOverride[] {
  if (!Array.isArray(input)) return [];
  const out: ChapterOverride[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const leadId = typeof raw?.leadId === 'string' ? raw.leadId.trim() : '';
    if (!leadId || seen.has(leadId)) continue;
    const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, CHAPTER_TITLE_MAX) : '';
    const writeUp =
      typeof raw.writeUp === 'string' ? raw.writeUp.trim().slice(0, CHAPTER_WRITEUP_MAX) : '';
    const hidden = raw.hidden === true;
    seen.add(leadId);
    out.push({
      leadId,
      ...(title ? { title } : {}),
      ...(writeUp ? { writeUp } : {}),
      ...(hidden ? { hidden: true } : {}),
    });
  }
  return out;
}

/** HARD cap on couple-uploaded editorial gallery photos (FREE). Enforced here
 *  server-side (the editor also soft-caps); refs beyond this are truncated. */
const GALLERY_UPLOADS_MAX = 30;

/** A stored asset ref we persist is either an `r2://…` tag (new uploads) or a
 *  legacy http(s) URL. Reject anything else (empty, `javascript:`, a data URI,
 *  a bare filename) so a hand-crafted request can't stash junk in draft_json. */
function isStoredAssetRef(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const t = v.trim();
  if (!t) return false;
  return t.startsWith('r2://') || t.startsWith('https://') || t.startsWith('http://');
}

/** Sanitize the couple's editorial gallery uploads: keep only valid stored-asset
 *  refs, dedupe, and HARD-cap at 30. Anything non-array → []. */
function sanitizeGalleryUploads(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (out.length >= GALLERY_UPLOADS_MAX) break;
    if (!isStoredAssetRef(raw)) continue;
    const ref = raw.trim();
    if (seen.has(ref)) continue;
    seen.add(ref);
    out.push(ref);
  }
  return out;
}

/** Cap the manual guest-wishes list. */
const REVIEWS_MAX = 12;
/** Cap a single wish quote (mirrors the editor's soft cap; hard ceiling here). */
const REVIEW_QUOTE_MAX = 280;
const REVIEW_AUTHOR_MAX = 80;
const REVIEW_ROLE_MAX = 40;

/**
 * Sanitize + cap the client's section ORDER before persisting (PRO). Keep only
 * KNOWN orderable keys (EDITORIAL_ORDERABLE_KEYS), deduped, in the client's order.
 * The two locked-close keys (fromTheCouple/song) are NOT orderable keys, so they
 * are dropped defensively even if a client sends them. Anything non-array or an
 * order identical-after-clean to the canonical default → `null` (delete the key,
 * revert to default). Never trusts the client.
 */
/**
 * Validate the couple's own columns before they are stored.
 *
 * Delegates to the SAME reader the render path uses, by handing it the shape it
 * expects. One definition of "what is a legal column", not two — a second copy
 * here would be a second answer, and the two would drift the first time a limit
 * moved.
 */
function sanitizeCustomColumns(input: unknown): CustomColumn[] {
  return readCustomColumns({ customColumns: input });
}

/**
 * The order to persist. Delegates to the pure `sectionOrderToPersist` so the
 * rule lives in ONE place and can be tested — a `'use server'` module exports
 * only async functions, so a copy here would be untestable by construction.
 */
function sanitizeSectionOrder(
  input: string[] | null,
  customIds: readonly string[] = [],
): string[] | null {
  return sectionOrderToPersist(input, EDITORIAL_ORDERABLE_KEYS, customIds);
}

/**
 * Sanitize + cap the client's manual guest-wishes (PRO). Trim each field, cap
 * lengths, DROP rows with an empty quote (a wish with no words), coerce stars to
 * 1–5 or null, and cap the list at REVIEWS_MAX. Anything non-array → []. Author is
 * kept even if blank-ish? No — a wish needs a quote; author may be blank (the
 * public render already requires BOTH quote+author, so a blank author simply
 * won't render, but we persist what the couple typed rather than silently drop).
 */
function sanitizeReviews(input: Review[]): Review[] {
  if (!Array.isArray(input)) return [];
  const out: Review[] = [];
  for (const raw of input) {
    if (out.length >= REVIEWS_MAX) break;
    const quote = typeof raw?.quote === 'string' ? raw.quote.trim().slice(0, REVIEW_QUOTE_MAX) : '';
    if (!quote) continue; // a wish with no words is dropped
    const author =
      typeof raw.author === 'string' ? raw.author.trim().slice(0, REVIEW_AUTHOR_MAX) : '';
    const roleRaw = typeof raw.role === 'string' ? raw.role.trim().slice(0, REVIEW_ROLE_MAX) : '';
    const starsNum = Number(raw.stars);
    const stars =
      Number.isFinite(starsNum) && starsNum >= 1 ? Math.min(5, Math.round(starsNum)) : null;
    out.push({ author, role: roleRaw || null, quote, stars });
  }
  return out;
}

/** A stored timestamp/date read back as itself, or null. Never a coerced ''. */
function asIso(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

/**
 * The floor plan as it stands, AND the seating that ties photographs to it
 * (`03` §2.8), ready to store.
 *
 * Returns `null` — and the story then keeps reading the live plan, exactly as
 * every story does today — when the kind of day has no seating, when nothing
 * was drawn, or when the read is refused. **A freeze that failed must cost the
 * freeze, never the room**: writing an empty snapshot would blank a floor plan
 * that exists, permanently, on the one press that is supposed to preserve it.
 *
 * 🔴 BOTH HALVES OR NEITHER, AND THAT IS THE WHOLE POINT. Freezing the geometry
 * while `loadTableHeat` still resolved a photograph to a table through the LIVE
 * `event_seat_assignments` — the same table the seat arranger wipes and
 * re-solves on every run — would make the two disagree: a re-seated guest
 * lights the WRONG table on a plan that is otherwise a true record of the night.
 * **A half-freeze is worse than no freeze**, because before it geometry and
 * attribution moved together and the plan was at least wrong consistently.
 * Raised by S10 against the first cut and verified in the loader before it was
 * believed.
 *
 * ⚠ THE SEATING IS STORED BESIDE THE ROOM, NEVER INSIDE IT. It carries guest
 * ids, and `StoryRoom` goes straight to the components that draw the plan — its
 * field list is the privacy boundary (`04` rule 2). `roomSnapshotOf` puts it on
 * the document; only `readFrozenSeats` takes it back out, and only the heat
 * loader calls that.
 */
async function freezeTheRoom(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
): Promise<unknown | null> {
  try {
    const { data, error } = await admin
      .from('events')
      .select('event_type')
      .eq('event_id', eventId)
      .maybeSingle();
    if (error || !data) return null;
    // The LIVE plan, deliberately — `loadStoryRoom` prefers a snapshot, and a
    // freeze must never photograph an older photograph of itself.
    const room = await loadLiveRoom(admin, eventId, asIso(data.event_type));
    if (room.tables.length === 0) return null;
    return roomSnapshotOf(room, await freezeTheSeating(admin, eventId, room));
  } catch {
    return null;
  }
}

/**
 * Where each guest sat, as the night was actually seated — `guest_id` →
 * `event_tables.public_id`.
 *
 * ⚠ ONLY TABLES THE FROZEN PLAN ACTUALLY DRAWS. A guest at a table with no
 * saved position is left out, because `loadTableHeat` would drop that
 * attribution anyway (`known.has(table)`) and storing it would be a row that
 * promises heat the lens can never show.
 *
 * `null` on a refusal or an empty plan, which leaves the heat resolving live —
 * the behaviour every story has today. A rejected query is an ABSENCE.
 */
async function freezeTheSeating(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  room: { tables: ReadonlyArray<{ id: string }> },
): Promise<Map<string, string> | null> {
  const drawn = new Set(room.tables.map((t) => t.id));
  if (drawn.size === 0) return null;
  try {
    const { data, error } = await admin
      .from('event_seat_assignments')
      .select('guest_id, event_tables!inner(public_id)')
      .eq('event_id', eventId);
    if (error || !data) return null;
    const seats = new Map<string, string>();
    for (const r of data as Array<Record<string, unknown>>) {
      const guest = asIso(r.guest_id);
      const joined = r.event_tables as Record<string, unknown> | null;
      const table = asIso(joined?.public_id);
      if (guest && table && drawn.has(table)) seats.set(guest, table);
    }
    return seats.size > 0 ? seats : null;
  } catch {
    return null;
  }
}

export async function saveEditorial(
  eventId: string,
  input: EditorialEditorInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await hostUserId(eventId);
  if (!userId) return { ok: false, error: 'You don’t have access to this wedding.' };

  const admin = createAdminClient();

  // Merge into whatever draft_json already exists (preserve unmanaged keys).
  const { data: existing } = await admin
    .from('event_editorial')
    .select(
      'draft_json, published_at, status, edition_no, edition_volume, room_snapshot, publish_consent_at',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  const base =
    existing?.draft_json && typeof existing.draft_json === 'object'
      ? (existing.draft_json as Record<string, unknown>)
      : {};

  /*
    ⚠ THE EVENT HUB PRO GATE IS RETIRED HERE (owner 2026-08-21):
    "make this feature part of free and not part of the event hub pro."

    It used to refuse a save from a non-PRO couple who had never authored an
    editorial, with "Editing your editorial is part of Event Hub PRO."

    🔑 THE REASON THE OWNER GAVE IS WORTH KEEPING: Setnayan auto-crafts this
    story for them. An auto-written story its own subject cannot correct reads
    worse than no story at all — and the first name a generator gets wrong is
    the couple's own. Charging to fix our sentence about their wedding is the
    wrong side of the line. PRO sells premium touches, not the right to correct
    yourself.

    ⛔ Do NOT reinstate this as a "cheap upsell". It was ruled on directly.
  */
  // Still resolved: the genuinely-premium EXTRAS below (chapter curation,
  // section order, manual guest wishes) remain PRO. What is now free is the
  // couple's own WORDS — starting an editorial, and correcting it.
  const isPro = await isEditorialProActive(admin, eventId);


  const t = (s: string) => s.trim();
  const draft: Record<string, unknown> = { ...base };
  // Only persist non-empty overrides — blank fields let the engine auto-write.
  const setOrDrop = (key: string, value: string) => {
    const v = t(value);
    if (v) draft[key] = v;
    else delete draft[key];
  };
  setOrDrop('headline', input.headline);
  setOrDrop('deck', input.deck);
  setOrDrop('super', input.superKicker);
  setOrDrop('byline', input.byline);
  setOrDrop('pull_quote', input.pullQuote);

  const paras = input.leadParagraphs
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paras.length) draft.lead_paragraphs = paras;
  else delete draft.lead_paragraphs;

  // FREE couple-uploaded imagery (no Papic required, no PRO gate). Hero cover
  // (single ref) + editorial gallery (≤30 refs, capped server-side). Empty →
  // delete the key so a no-Papic editorial reverts cleanly to the auto paths.
  const heroUpload = isStoredAssetRef(input.heroUpload) ? input.heroUpload.trim() : '';
  if (heroUpload) draft.heroUpload = heroUpload;
  else delete draft.heroUpload;

  const galleryUploads = sanitizeGalleryUploads(input.galleryUploads);
  if (galleryUploads.length) draft.galleryUploads = galleryUploads;
  else delete draft.galleryUploads;

  // The story's colours. FREE — see the note on `theme` above. Stored as the
  // sanitized {mode, colors} pair; 'board' carries no colours at all, because
  // the whole promise of that mode is that it re-reads the board on every
  // render rather than holding a copy that can go stale.
  draft.storyTheme = sanitizeStoryTheme(input.theme);

  // Section visibility map (only `false` hides; default-on otherwise).
  const sections: Record<string, boolean> = {};
  for (const key of EDITORIAL_SECTION_KEYS) sections[key] = input.sections[key] !== false;
  draft.sections = sections;

  // ── Editorial PRO authorship (server-side enforcement — never trust client) ──
  // The "Editor's Desk" — per-chapter curation (chapterOverrides), section order,
  // and the manual guest-wishes list — is PRO. Word fields + section toggles above
  // stay FREE (today's editor). When the couple is NOT PRO we STRIP these three
  // keys from the incoming input BEFORE merge, so a hand-crafted request can't
  // author them — but we do NOT delete any values already saved on `base` (a
  // formerly-PRO couple keeps their existing overrides/order/wishes; we just
  // decline NEW ones). `draft` starts as a spread of `base`, so leaving a key
  // untouched preserves it. (isPro resolved once at the top of this action.)
  if (isPro) {
    // "As the Day Unfolded" per-chapter curation. Persist the ordered, sanitized
    // set; an empty result deletes the key so the chapters revert to pure auto.
    const chapterOverrides = sanitizeChapterOverrides(input.chapterOverrides);
    if (chapterOverrides.length) draft.chapterOverrides = chapterOverrides;
    else delete draft.chapterOverrides;

    // Section order (PRO reorder). null → delete (revert to default order).
    const customColumns = sanitizeCustomColumns(input.customColumns);
    if (customColumns.length) draft.customColumns = customColumns;
    else delete draft.customColumns;
    const sectionOrder = sanitizeSectionOrder(
      input.sectionOrder,
      customColumns.map((c) => c.id),
    );
    if (sectionOrder) draft.sectionOrder = sectionOrder;
    else delete draft.sectionOrder;

    // Manual guest-wishes (PRO). Empty → delete the key.
    const reviews = sanitizeReviews(input.reviews);
    if (reviews.length) draft.reviews = reviews;
    else delete draft.reviews;
  }
  // else: not PRO — leave draft.chapterOverrides / draft.sectionOrder /
  // draft.reviews exactly as they were on `base` (spread into `draft` already).

  // Fails closed: anything this build does not recognise reads as 'only me'.
  const audience = storyAudienceOf(input.audience);
  const shared = storyIsShared(audience);
  const wasPublished = storyAudienceOf(existing?.status) === 'published';

  /*
    ══ THE PUBLISH GATE (design `02` §8 · 08 step 1.6) ═══════════════════════

    A DISABLED BUTTON IS NOT A FENCE. The editor greys the Published rung out,
    and this is the same question asked where it counts — an old tab, a
    hand-made request, or a client build from before this shipped all arrive
    here. `publishBlockers` is the ONE definition, shared with the button, so
    the two can never drift into different ideas of "ready".

    🔑 ONLY THE WAY UP IS GATED. `draft` and `event` pass untouched, and that is
    load-bearing rather than a kindness: the consent copy promises the host they
    can go back to guests-only whenever, so a gate on the way DOWN would break
    a promise printed on the same screen and strand a host at `published` with a
    half-decided desk.
  */
  let consentedAt: string | null = asIso(existing?.publish_consent_at);
  if (input.publishConsent === true) consentedAt = consentedAt ?? new Date().toISOString();

  let openCount = 0;
  if (audience === 'published') {
    /*
      The desk, read for the gate. `loadDesk` proves nothing about authority on
      its own — `hostUserId` above is that proof — and it is called HERE rather
      than trusted from the client because "everything is decided" is a claim
      about four other tables.

      ⚠ AN UNREADABLE DESK REFUSES. A source that could not be read and a source
      with nothing in it look identical; the desk's own banner says so. It has
      not PROVED it is clear, so it is not clear, with its own sentence rather
      than a lie about what is waiting.
    */
    let deskLoaded = false;
    let deskClear = false;
    try {
      const desk = await loadDesk(eventId);
      deskLoaded = desk.unreadable.length === 0;
      deskClear = deskIsClear(desk.items);
      openCount = desk.items.filter(isWaitingOnTheHost).length;
    } catch {
      deskLoaded = false;
    }
    const blockers = publishBlockers({
      deskLoaded,
      deskClear,
      consented: consentedAt !== null,
    });
    if (blockers.length > 0) {
      return { ok: false, error: publishRefusal(blockers, openCount) };
    }
  }

  /*
    ══ THE EDITION, AND THE ROOM — both stamped on the FIRST 'published' ══════

    ⚠ NOT ON `published_at`, which is stamped at the first GUESTS-ONLY share
    (`03` §2.4). A story that sits at guests-only for a month carries no number.

    Both are written only when they are still empty, so a host who takes the
    story back and publishes it again keeps the number they were given — that is
    what "theirs forever" means — and the database refuses to move it anyway.
  */
  const stamp: Record<string, unknown> = {};
  if (audience === 'published' && !wasPublished) {
    if (existing?.edition_no == null) {
      const { data: dated } = await admin
        .from('events')
        .select('event_date')
        .eq('event_id', eventId)
        .maybeSingle();
      const edition = await stampForPublish(admin, asIso(dated?.event_date));
      // Never half a stamp: a volume with no number would print "No. null" to
      // any reader that trusted one field without the other.
      if (edition) {
        stamp.edition_volume = edition.volume;
        stamp.edition_no = edition.no;
      }
    }
    if (existing?.room_snapshot == null) {
      const frozen = await freezeTheRoom(admin, eventId);
      if (frozen) stamp.room_snapshot = frozen;
    }
  }

  const nowIso = new Date().toISOString();
  const { error } = await admin.from('event_editorial').upsert(
    {
      event_id: eventId,
      draft_json: draft,
      status: audience,
      edited_by_couple: true,
      // Stamped the first time it is shared with ANYBODY — the celebration
      // counts. It is the "when did this stop being private" date, not the
      // "when did it go public" date, and it is never cleared: a story taken
      // back to only-me still happened.
      published_at: shared ? (existing?.published_at ?? nowIso) : existing?.published_at ?? null,
      // The RA 10173 record of the tick. Never cleared on the way back down:
      // they did agree, on that date, and re-asking to restore what they had
      // punishes them for using a control the consent copy itself offers.
      publish_consent_at: consentedAt,
      ...stamp,
      updated_at: nowIso,
    },
    { onConflict: 'event_id' },
  );
  if (error) return { ok: false, error: 'Could not save. Please try again.' };

  /*
    THE HOST'S LAST WORD — through the CALLER'S OWN SESSION, not the admin
    client sitting in scope two lines up. `event_editorial` has no couple-facing
    write RLS, which is why the upsert above is admin; `events` does, and using
    admin here would quietly drop that second fence for no reason at all.
  */
  if (typeof input.lastWord === 'string') {
    const lastWord = input.lastWord.trim().slice(0, LAST_WORD_MAX);
    const session = await createClient();
    await session
      .from('events')
      .update({ special_message: lastWord || null })
      .eq('event_id', eventId);
  }

  revalidatePath(`/dashboard/${eventId}/story`);
  revalidatePath(`/dashboard/${eventId}/website`);

  /*
    ══ EVERY PUBLIC COPY OF THE STORY, THROWN AWAY TOGETHER ══════════════════

    🔑 GOING BACK DOWN THE LADDER HAS TO ACTUALLY TAKE THE PAGE BACK FROM A
    STRANGER, AND `/${slug}` ALONE DID NOT DO IT. `/[slug]/print` is its own
    cached route (`revalidate = 300`) and it asks `storyAudienceAdmits` — so a
    host who narrowed the audience stayed readable there for up to five minutes,
    on the one surface a stranger can keep. That fix shipped with S8 as three
    spelled-out paths.

    ⏭ S14 SHIPPED THE REST OF IT, AND THIS NOW CALLS THE ONE LIST. The share
    card was the surface S8 could not reach: its `Cache-Control` is honoured by
    browsers, the CDN and every platform that already fetched it, and nothing on
    the server can revalidate that. `everyCopyIsNowStale` stamps
    `story_version_at`, which MOVES the card's URL — the only bust a URL-keyed
    cache has — and then throws away the story, the recap, the keepsake and the
    nested account URL if the cutover flag is ever turned on.

    🔑 IT IS THE SAME CALL A GUEST'S WITHDRAWAL MAKES, deliberately. A host
    taking a story back and a guest taking their photograph out of it are the
    same event from a reader's side, and one list is the only way the next
    surface cannot be forgotten by whichever of the two is written first.

    🔴 A CLAIM THIS COMMENT USED TO MAKE ABOUT THE RECAP IS FALSE, AND THE WAY
    IT WENT WRONG IS WORTH MORE THAN THE FIX. It read: *"it does not read
    `event_editorial` at all — measured, 0 references in `recap/page.tsx` and
    `lib/auto-recap.ts`."*

    **THE NUMBER IS RIGHT AND THE SENTENCE IS WRONG.** Re-measured on
    `origin/main`: both files do contain 0 occurrences of the string
    `event_editorial` — and `lib/auto-recap.ts` calls `loadEditorialData` at TWO
    call sites (lines 201 and 347), which reads `event_editorial` itself
    (`editorial/data.ts`, the `.select('status, draft_json, …')`). **The recap
    reads the story's row; it just does it one hop away, where a grep for the
    table name cannot see it.** Correct fact, invented consequence — the same
    shape as the migration-prefix belief this repo killed twice.

    ⚖ WHAT SURVIVES, and it is what the original reasoning actually needed:
    `lib/auto-recap.ts` has **0** references to `audience`, so narrowing the
    story's audience genuinely does NOT hide the recap — the Auto-Recap is its
    own keepsake with its own switch (`event_recaps.status`). That conclusion is
    sound. It just had to be measured on the word `audience`, not on the name of
    a table.

    🔑 AND THE HALF THAT WAS WRONG IS THE HALF THIS SESSION TURNS ON: a guest's
    WITHDRAWAL absolutely reaches the recap. `loadEditorialData` applies the
    consent veto to the very hero the recap leads with — `!consentVeto.ids.has(
    heroPhotoId)`, under a docblock that says consent wins over curation — so the
    recap belongs in the list for a reason far stronger than "cheap insurance".
  */
  await everyCopyIsNowStale(eventId);

  // Fire quality scan in the background after the response is sent.
  // Only triggers when the editorial is in the default 'pending' state
  // (first save). Re-scans are triggered from the admin review queue.
  const { data: saved } = await admin
    .from('event_editorial')
    .select('editorial_id, scan_status')
    .eq('event_id', eventId)
    .maybeSingle();
  if (saved?.scan_status === 'pending') {
    const eid = saved.editorial_id;
    after(() => scanEditorial(eid));
  }

  return { ok: true };
}

/**
 * Real Stories showcase consent, co-located on the editorial editor so the
 * couple can publish AND choose to be featured in one place (instead of hunting
 * for the separate privacy-page toggle). Mirrors `setShowcaseConsent` in
 * website/privacy/actions.ts — sets/clears the caller's OWN
 * `users.public_summary_consent_at` via the admin client (the users self-update
 * path isn't exposed to the auth client), gated on host membership.
 *
 * RA 10173: consent stays an EXPLICIT, reversible opt-in — this only flips the
 * couple's own flag when they ask. It deliberately does NOT touch
 * `landing_page_visibility`; a page that is not public still won't surface (the
 * loadPublishedShowcases `landing_page_visibility = 'public'` gate), and the
 * editor surfaces that caveat rather than silently publishing the page.
 *
 * 🔴 THE KIND GATE WAS WEDDING-ONLY AND OUTLIVED THE RULE IT ENFORCED. It
 * refused every non-wedding celebration on opt-IN, citing "loadPublishedShowcases
 * filters event_type='wedding'" — five filters DELETED on 2026-08-15 when the
 * owner ruled that all sixteen kinds may be written up ("each event they create
 * will have an editorial not just wedding"), `date` and `hangout` named out loud
 * ("making it public will be the user's decision … so yes"). The gallery, the
 * sitemap and the credited-vendor portfolio all moved; this door did not. So a
 * birthday, a christening or a date night could write and publish a story here
 * and then never be allowed to say yes to it.
 *
 * 🔑 AND THE GATE WAS NEVER A BOUNDARY — ITS OWN SIBLING DEFEATED IT. The
 * privacy page's `setShowcaseConsent` writes the IDENTICAL
 * `users.public_summary_consent_at` flag through the identical admin client with
 * NO kind check at all. Two doors to one fact, one of them bolted. The docblock's
 * stated fear — "a direct action call would set consent affecting the user's
 * OTHER wedding events" — was already reachable, unguarded, one screen away, so
 * this only ever obstructed the honest path.
 *
 * The kind question now has exactly ONE home (`editorialAllowsEventType`), which
 * is what this asks. Opt-OUT is always allowed.
 */
export async function setStoryShowcase(
  eventId: string,
  optIn: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await hostUserId(eventId);
  if (!userId)
    return { ok: false, error: 'You don’t have access to this celebration.' };

  const admin = createAdminClient();

  if (optIn) {
    // Fails CLOSED on an unreadable event: an unknown kind is not a consented
    // one. The old read dropped its error and let `?? 'wedding'` answer for it,
    // so a failed lookup was indistinguishable from a real wedding.
    const { data: ev, error: evError } = await admin
      .from('events')
      .select('event_type')
      .eq('event_id', eventId)
      .maybeSingle();
    if (evError || !ev) {
      return { ok: false, error: 'Could not update. Please try again.' };
    }
    if (!editorialAllowsEventType((ev.event_type as string | null) ?? 'wedding')) {
      return { ok: false, error: 'This kind of day can’t be featured in Stories.' };
    }
  }

  const { error } = await admin
    .from('users')
    .update({ public_summary_consent_at: optIn ? new Date().toISOString() : null })
    .eq('user_id', userId);
  if (error) return { ok: false, error: 'Could not update. Please try again.' };

  revalidatePath(`/dashboard/${eventId}/story`);
  revalidatePath(`/dashboard/${eventId}/website/privacy`);
  return { ok: true };
}
