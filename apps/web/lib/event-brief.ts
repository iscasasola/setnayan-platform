/**
 * event-brief.ts — the Event Brief.
 *
 * ONE deterministic, dependency-free read-model assembled from whatever an
 * event's onboarding captured. It is the single object Setnayan AI reads.
 *
 * Rule 1 (owner-locked 2026-07-12): Setnayan AI is 100% deterministic and
 * absolutely FREE — no LLM, no per-call cost. With no model to reason over thin
 * context, the ONLY lever for smarter/personalised output is rich structured
 * signals + authored rules keyed to them. So the Brief IS the intelligence:
 *
 *     output quality  =  brief richness  ×  authored-rule richness
 *
 * This module owns the first half. It normalises the scattered persistence
 * (typed `events` columns + the `style_preferences` / `love_story` /
 * `experience_axes` JSONB blobs) into four layers — Constraints (facts),
 * Priorities (what they care about), Taste (texture), Story (personalisation) —
 * so every downstream engine (the adaptive checklist, the compat scorer, the
 * nudge templates) reads ONE shape instead of re-deriving from raw columns.
 *
 * It is universal across all event types: a wedding yields a rich Brief, a
 * simple event a thin one. Every field admits-unknown (null / empty), never
 * throws on missing data — exactly mirroring the scorer's neutral baseline.
 * Pure in, pure out → trivially unit-testable, and free to run anywhere.
 */

/** The raw event row (a loose subset of `events` columns + parsed JSONB).
 *  Every field optional so a thin simple-event row is as valid as a wedding. */
export type EventBriefSource = {
  event_type?: string | null;
  display_name?: string | null;
  // ceremony / faith
  ceremony_type?: string | null;
  secondary_ceremony_type?: string | null;
  is_mixed_ceremony?: boolean | null;
  ceremony_sub_type?: string | null;
  venue_setting?: string | null;
  // couple
  bride_name?: string | null;
  groom_name?: string | null;
  // location
  region?: string | null;
  venue_latitude?: number | string | null;
  venue_longitude?: number | string | null;
  // dates
  date_mode?: string | null;
  date_candidates?: string[] | null;
  date_window_start?: string | null;
  date_window_end?: string | null;
  event_date?: string | null;
  // scale / budget
  estimated_pax?: number | string | null;
  budget_band?: string | null;
  estimated_budget_centavos?: number | string | null;
  // taste
  mood_feel_key?: string | null;
  music_playlist_seed?: string[] | null;
  // story
  love_story?: Record<string, unknown> | string | null;
  story_tone?: string | null;
  together_since?: string | null;
  special_message?: string | null;
  // priorities (experience quiz — flag-gated capture upstream)
  experience_axes?: Record<string, unknown> | string | null;
  experience_persona?: string | null;
  experience_for_whom?: string | null;
  // free-form catch-all
  style_preferences?: Record<string, unknown> | string | null;
};

export type EventBrief = {
  eventType: string | null;
  couple: { partnerA: string | null; partnerB: string | null };
  constraints: {
    date: {
      mode: 'specific' | 'window' | 'unset';
      candidates: string[];
      windowStart: string | null;
      windowEnd: string | null;
      /** Best single date to anchor deadlines on: first candidate → window start → event_date. */
      primary: string | null;
    };
    location: {
      region: string | null;
      lat: number | null;
      lng: number | null;
      hasPin: boolean;
      searchAreas: string[];
    };
    pax: number | null;
    budget: {
      band: string | null;
      amountCentavos: number | null;
      /** Deterministic per-guest budget — the single most useful planning number. */
      perHeadCentavos: number | null;
    };
    ceremony: {
      type: string | null;
      secondaryType: string | null;
      isMixed: boolean;
      subType: string | null;
      venueSetting: string | null;
      /** ceremony_type (+ secondary) collapsed to a faith list for program rules. */
      faiths: string[];
    };
  };
  priorities: {
    /** The headline axis: 'private_memory' | 'guest_experience' | 'both'. */
    forWhom: string | null;
    persona: string | null;
    axes: Record<string, string>;
    helpLevel: string | null;
    sourcing: string | null;
  };
  taste: {
    moodFeel: string | null;
    palette: string[];
    songs: string[];
    categories: string[];
    receptionSettings: string[];
    refinements: Record<string, unknown>;
  };
  story: {
    hasStory: boolean;
    anchors: Record<string, unknown>;
    tone: string | null;
    togetherSince: string | null;
    specialMessage: string | null;
  };
  /** 0..1 — how complete the Brief is. Under Rule 1 this predicts how
   *  personalised the AI's output can be (thin → generic, rich → personal). */
  richness: number;
};

// ── normalisers (admit-unknown: never throw, coerce or null) ──────────────────

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter((x) => x.length > 0);
}

/** JSONB may arrive as a parsed object OR a raw string (depends on the driver). */
function obj(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === 'string' && v.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(v);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* fall through to empty */
    }
  }
  return {};
}

function fullName(first: string | null, whole: string | null): string | null {
  return str(whole) ?? str(first);
}

// ── the assembler ────────────────────────────────────────────────────────────

export function buildEventBrief(source: EventBriefSource | null | undefined): EventBrief {
  const src = source ?? {};
  const style = obj(src.style_preferences);
  const axesRaw = obj(src.experience_axes);
  const love = obj(src.love_story);

  // dates
  const candidates = strArr(src.date_candidates);
  const windowStart = str(src.date_window_start);
  const eventDate = str(src.event_date);
  const primaryDate = candidates[0] ?? windowStart ?? eventDate;
  const mode: 'specific' | 'window' | 'unset' =
    src.date_mode === 'window'
      ? 'window'
      : candidates.length > 0 || src.date_mode === 'specific' || eventDate
        ? 'specific'
        : 'unset';

  // location
  const lat = num(src.venue_latitude);
  const lng = num(src.venue_longitude);

  // budget
  const pax = num(src.estimated_pax);
  const amount = num(src.estimated_budget_centavos);
  const perHead = amount != null && pax != null && pax > 0 ? Math.round(amount / pax) : null;

  // ceremony → faiths
  const ceremonyType = str(src.ceremony_type);
  const secondary = str(src.secondary_ceremony_type);
  const faiths = [ceremonyType, secondary].filter((f): f is string => !!f);

  // priorities — axes may hold help/source dials too
  const axes: Record<string, string> = {};
  for (const [k, v] of Object.entries(axesRaw)) {
    const s = str(v);
    if (s) axes[k] = s;
  }

  const brief: EventBrief = {
    eventType: str(src.event_type),
    couple: {
      partnerA: fullName(null, src.bride_name ?? null),
      partnerB: fullName(null, src.groom_name ?? null),
    },
    constraints: {
      date: { mode, candidates, windowStart, windowEnd: str(src.date_window_end), primary: primaryDate ?? null },
      location: {
        region: str(src.region),
        lat,
        lng,
        hasPin: lat != null && lng != null,
        searchAreas: strArr(style.search_areas),
      },
      pax,
      budget: { band: str(src.budget_band), amountCentavos: amount, perHeadCentavos: perHead },
      ceremony: {
        type: ceremonyType,
        secondaryType: secondary,
        isMixed: src.is_mixed_ceremony === true,
        subType: str(src.ceremony_sub_type),
        venueSetting: str(src.venue_setting),
        faiths,
      },
    },
    priorities: {
      forWhom: str(src.experience_for_whom) ?? (str(axes.for_whom) as string | null),
      persona: str(src.experience_persona),
      axes,
      helpLevel: str(axes.help),
      sourcing: str(axes.source),
    },
    taste: {
      moodFeel: str(src.mood_feel_key),
      palette: strArr(style.basic_moodboard),
      songs: strArr(src.music_playlist_seed),
      categories: strArr(style.interested_categories),
      receptionSettings: strArr(style.reception),
      refinements: obj(style.refinements),
    },
    story: {
      hasStory: Object.keys(love).length > 0,
      anchors: obj(love.anchors) ?? {},
      tone: str(src.story_tone),
      togetherSince: str(src.together_since),
      specialMessage: str(src.special_message),
    },
    richness: 0,
  };

  brief.richness = computeRichness(brief);
  return brief;
}

/**
 * 0..1 completeness of the Brief, weighted by how much each signal moves the
 * quality of deterministic output. Constraints are table-stakes; the Priorities
 * and Story layers are the personalisation multiplier, so they carry weight
 * even though they're the layers most often switched off today.
 */
export function computeRichness(brief: EventBrief): number {
  const c = brief.constraints;
  const checks: Array<[boolean, number]> = [
    // Constraints (facts) — 0.50
    [c.date.mode !== 'unset', 0.1],
    [c.location.hasPin || c.location.region != null, 0.1],
    [c.pax != null, 0.08],
    [c.budget.amountCentavos != null || c.budget.band != null, 0.12],
    [c.ceremony.type != null, 0.1],
    // Taste (texture) — 0.22
    [brief.taste.categories.length > 0, 0.08],
    [brief.taste.moodFeel != null || brief.taste.palette.length > 0, 0.07],
    [brief.taste.songs.length > 0, 0.07],
    // Priorities (the boost) — 0.18
    [brief.priorities.forWhom != null, 0.1],
    [brief.priorities.persona != null, 0.08],
    // Story (personalisation) — 0.10
    [brief.story.hasStory, 0.1],
  ];
  const total = checks.reduce((sum, [, w]) => sum + w, 0);
  const got = checks.reduce((sum, [ok, w]) => sum + (ok ? w : 0), 0);
  return Math.round((got / total) * 100) / 100;
}

/** The single date deterministic deadlines should anchor on (or null). */
export function briefPrimaryDate(brief: EventBrief): string | null {
  return brief.constraints.date.primary;
}
