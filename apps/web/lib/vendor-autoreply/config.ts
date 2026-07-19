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
// copy columns — those stay engine-owned. This card edits only `enabled` +
// `daily_reply_cap`; the Pro columns (mode, voice_profile, auto_accept_*)
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

export type AutoReplyConfigPatch = {
  enabled?: boolean;
  daily_reply_cap?: number;
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

  const capRaw = form.get('daily_reply_cap');
  if (capRaw !== null) {
    const s = String(capRaw).trim();
    // Whole non-negative integers only — rejects blanks, decimals, negatives,
    // exponents ("1e3"), and anything non-numeric.
    if (!/^\d+$/.test(s)) {
      return { ok: false, error: 'Daily cap must be a whole number.' };
    }
    const n = Number(s);
    if (n < DAILY_REPLY_CAP_MIN || n > DAILY_REPLY_CAP_MAX) {
      return {
        ok: false,
        error: `Daily cap must be between ${DAILY_REPLY_CAP_MIN} and ${DAILY_REPLY_CAP_MAX}.`,
      };
    }
    patch.daily_reply_cap = n;
  }

  if (patch.enabled === undefined && patch.daily_reply_cap === undefined) {
    return { ok: false, error: 'Nothing to save.' };
  }
  return { ok: true, patch };
}
