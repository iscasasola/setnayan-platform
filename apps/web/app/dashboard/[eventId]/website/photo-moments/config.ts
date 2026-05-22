// Photo Moments — shared sync helpers + types + constant maps.
//
// Hotfix 2026-05-22: moved out of `actions.ts` because Next.js Server
// Actions files (with `'use server'`) require ALL top-level exports to
// be async functions. The original PR #383 mixed sync helpers
// (parsePhotoMomentsConfig, PHOTO_MOMENT_MODE_LABEL, etc.) into the
// same file, which broke the Vercel build with:
//   Server Actions must be async functions.
// Splitting fixes the production deploy without touching consumer
// imports — the editor + landing-page renderer just import from
// './config' instead of './actions' for the sync pieces.
//
// All values exported here are pure / stateless — safe to import from
// both server components AND client components.

// Fixed enum keeps the landing-page render branch-safe — three modes,
// each gets its own visual treatment (camera icon, quiet phone-down
// icon, Papic-branded chip per iteration 0012). Adding a fourth mode
// requires extending both this validator AND the renderer; do not let
// unknown strings through.
const MODE_VALUES = ['camera_ok', 'phone_down', 'papic_only'] as const;
export type PhotoMomentMode = (typeof MODE_VALUES)[number];

export type PhotoMoment = {
  time_label: string;
  title: string;
  note: string;
  mode: PhotoMomentMode;
};

export type PhotoMomentsConfig = {
  intro_copy: string;
  moments: PhotoMoment[];
};

export type UpdatePhotoMomentsResult =
  | { ok: true }
  | { ok: false; error: string };

// Server-action validator uses these too — exported so the action file
// can stay tight (just the async handler + tiny re-imports).
export const PHOTO_MOMENT_LIMITS = {
  MAX_MOMENTS: 8,
  MAX_INTRO_LEN: 240,
  MAX_TIME_LABEL_LEN: 60,
  MAX_TITLE_LEN: 80,
  MAX_NOTE_LEN: 200,
} as const;

export const PHOTO_MOMENT_MODES = MODE_VALUES;

export const PHOTO_MOMENT_MODE_LABEL: Record<PhotoMomentMode, string> = {
  camera_ok: 'Cameras welcome',
  phone_down: 'Phone-down — stay present',
  papic_only: 'Our paparazzo will capture this',
};

export const PHOTO_MOMENT_MODE_HINT: Record<PhotoMomentMode, string> = {
  camera_ok: 'Guests welcome to shoot freely.',
  phone_down: 'Ask guests to put phones down and savour the moment.',
  papic_only: 'Reserved for your Papic team — guests stay present.',
};

export function isPhotoMomentMode(value: string): value is PhotoMomentMode {
  return (MODE_VALUES as readonly string[]).includes(value);
}

/**
 * Reads the existing config off events.photo_moments_config and coerces
 * it to a known-good shape for the editor form. Unknown JSON shapes
 * (corrupted, partial, old) degrade gracefully to empty defaults so the
 * editor never crashes on a bad row.
 */
export function parsePhotoMomentsConfig(raw: unknown): PhotoMomentsConfig {
  const empty: PhotoMomentsConfig = { intro_copy: '', moments: [] };
  if (!raw || typeof raw !== 'object') return empty;

  const obj = raw as Record<string, unknown>;
  const intro = typeof obj.intro_copy === 'string' ? obj.intro_copy : '';

  const momentsRaw = Array.isArray(obj.moments) ? obj.moments : [];
  const moments: PhotoMoment[] = [];
  for (const m of momentsRaw) {
    if (!m || typeof m !== 'object') continue;
    const item = m as Record<string, unknown>;
    const timeLabel = typeof item.time_label === 'string' ? item.time_label : '';
    const title = typeof item.title === 'string' ? item.title : '';
    const note = typeof item.note === 'string' ? item.note : '';
    const mode =
      typeof item.mode === 'string' && isPhotoMomentMode(item.mode)
        ? item.mode
        : 'phone_down';
    // Skip rows with no title — they're meaningless on the landing page
    // and produce empty bullet entries that look like dev placeholders.
    if (title.trim().length === 0) continue;
    moments.push({ time_label: timeLabel, title, note, mode });
    if (moments.length >= PHOTO_MOMENT_LIMITS.MAX_MOMENTS) break;
  }

  return { intro_copy: intro, moments };
}
