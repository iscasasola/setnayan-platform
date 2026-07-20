// lib/vendor-autoreply/config.ts
//
// Pure form-validation for the My Shop "Auto-Reply Assistant" config card
// (Phase 4). Parses the client form into a partial vendor_bot_config patch —
// ONLY the fields present in the form are patched, so the instant toggle save
// never clobbers the daily cap and vice versa. The server action
// (app/vendor-dashboard/shop/autoreply-actions.ts) upserts the patch under RLS
// (current_vendor_ids('admin')).
//
// Scope note: the Phase-1 schema (20270822679405) carries NO greeting/handoff
// copy columns — those stay engine-owned. This card edits `enabled` +
// `daily_reply_cap` plus — Phase 4A — the three auto_accept_* columns the
// Phase-1 schema already carries (auto_accept_enabled / auto_accept_threshold /
// daily_auto_accept_cap). The remaining Pro columns (mode, voice_profile)
// wait for Phase 5/7 so we ship no fake doors.

/** Schema default for vendor_bot_config.daily_reply_cap. */
export const DAILY_REPLY_CAP_DEFAULT = 30;
/** DB check is `>= 0`; 0 = "pause for the day" without flipping the toggle. */
export const DAILY_REPLY_CAP_MIN = 0;
/**
 * UI ceiling. The DB is unbounded above, but an unbounded client int is a
 * footgun (typo'd 3000 = the cap never bites). 200/day is ~an always-on bot.
 */
export const DAILY_REPLY_CAP_MAX = 200;

/** Schema default for vendor_bot_config.auto_accept_threshold. */
export const AUTO_ACCEPT_THRESHOLD_DEFAULT = 78;
/** DB CHECK is BETWEEN 0 AND 100 — the parse mirrors it exactly. */
export const AUTO_ACCEPT_THRESHOLD_MIN = 0;
export const AUTO_ACCEPT_THRESHOLD_MAX = 100;

/** Schema default for vendor_bot_config.daily_auto_accept_cap. */
export const DAILY_AUTO_ACCEPT_CAP_DEFAULT = 10;
/** DB check is `>= 0`; 0 = "no auto-accepts today" without flipping it off. */
export const DAILY_AUTO_ACCEPT_CAP_MIN = 0;
/** UI ceiling — every auto-accept can hold a token, so keep the typo ceiling
 *  far below the reply cap's. */
export const DAILY_AUTO_ACCEPT_CAP_MAX = 50;

export type AutoReplyConfigPatch = {
  enabled?: boolean;
  daily_reply_cap?: number;
  auto_accept_enabled?: boolean;
  auto_accept_threshold?: number;
  daily_auto_accept_cap?: number;
};

export type AutoReplyConfigParse =
  | { ok: true; patch: AutoReplyConfigPatch }
  | { ok: false; error: string };

/**
 * Parse the config form into a column patch. Defensive: every failure is a
 * friendly message (the card toasts it), never a throw. Absent fields are
 * simply not patched; an all-absent form is "nothing to save".
 */
export function parseAutoReplyConfigForm(form: FormData): AutoReplyConfigParse {
  const patch: AutoReplyConfigPatch = {};

  const enabledRaw = form.get('enabled');
  if (enabledRaw !== null) {
    const v = String(enabledRaw).trim().toLowerCase();
    if (v !== 'true' && v !== 'false') {
      return { ok: false, error: 'Could not read the on/off switch — try again.' };
    }
    patch.enabled = v === 'true';
  }

  const autoAcceptRaw = form.get('auto_accept_enabled');
  if (autoAcceptRaw !== null) {
    const v = String(autoAcceptRaw).trim().toLowerCase();
    if (v !== 'true' && v !== 'false') {
      return { ok: false, error: 'Could not read the auto-accept switch — try again.' };
    }
    patch.auto_accept_enabled = v === 'true';
  }

  // Whole non-negative integers only — rejects blanks, decimals, negatives,
  // exponents ("1e3"), and anything non-numeric.
  const intField = (
    key: 'daily_reply_cap' | 'auto_accept_threshold' | 'daily_auto_accept_cap',
    label: string,
    min: number,
    max: number,
  ): string | null => {
    const raw = form.get(key);
    if (raw === null) return null;
    const s = String(raw).trim();
    if (!/^\d+$/.test(s)) return `${label} must be a whole number.`;
    const n = Number(s);
    if (n < min || n > max) return `${label} must be between ${min} and ${max}.`;
    patch[key] = n;
    return null;
  };

  const intError =
    intField('daily_reply_cap', 'Daily cap', DAILY_REPLY_CAP_MIN, DAILY_REPLY_CAP_MAX) ??
    intField(
      'auto_accept_threshold',
      'Auto-accept threshold',
      AUTO_ACCEPT_THRESHOLD_MIN,
      AUTO_ACCEPT_THRESHOLD_MAX,
    ) ??
    intField(
      'daily_auto_accept_cap',
      'Daily auto-accept cap',
      DAILY_AUTO_ACCEPT_CAP_MIN,
      DAILY_AUTO_ACCEPT_CAP_MAX,
    );
  if (intError) return { ok: false, error: intError };

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: 'Nothing to save.' };
  }
  return { ok: true, patch };
}
