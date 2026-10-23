// lib/vendor-autoreply/config.ts
//
// Pure form-validation for the supplier's "Auto-Reply Assistant" settings
// (Your page › Auto-reply). Parses the client form into a partial
// vendor_bot_config patch — ONLY the fields present in the form are patched,
// so one switch's save never clobbers another. The server action
// (app/vendor-dashboard/shop/autoreply-actions.ts) upserts the patch under RLS
// (current_vendor_ids('admin')).
//
// 🚫 NO PER-DAY LIMIT, ANYWHERE (owner 2026-10-23, verbatim: "why do we limit
// the auto reply?"). The supplier used to set a "Daily reply cap" (30) and a
// "Daily auto-accept cap" (10). Both are gone: this parser no longer reads
// `daily_reply_cap` / `daily_auto_accept_cap`, the card no longer shows them,
// and the inbox hook no longer counts against them. The two columns are LEFT
// in vendor_bot_config (dropping a column is a production migration for no
// gain) — nothing reads or writes them any more. There is no hidden platform
// ceiling either: a reply is string substitution over the shop's own rows
// (phrasings.ts — a model call per reply is forbidden), so it costs ₱0, and
// it cannot loop (only a COUPLE message triggers it; the bot posts as the
// supplier). Held by `lib/vendor-autoreply/no-daily-limit.test.ts`.

/** Schema default for vendor_bot_config.auto_accept_threshold. */
export const AUTO_ACCEPT_THRESHOLD_DEFAULT = 78;
/** DB CHECK is BETWEEN 0 AND 100 — the parse mirrors it exactly. */
export const AUTO_ACCEPT_THRESHOLD_MIN = 0;
export const AUTO_ACCEPT_THRESHOLD_MAX = 100;

export type AutoReplyConfigPatch = {
  enabled?: boolean;
  auto_accept_enabled?: boolean;
  auto_accept_threshold?: number;
};

export type AutoReplyConfigParse =
  | { ok: true; patch: AutoReplyConfigPatch }
  | { ok: false; error: string };

/**
 * Parse the config form into a column patch. Defensive: every failure is a
 * friendly message (the card toasts it), never a throw. Absent fields are
 * simply not patched; an all-absent form is "nothing to save". A field this
 * parser does not know (an old tab still posting a daily cap) is ignored.
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

  // Whole numbers only — rejects blanks, decimals, negatives, exponents
  // ("1e3"), and anything non-numeric.
  const thresholdRaw = form.get('auto_accept_threshold');
  if (thresholdRaw !== null) {
    const s = String(thresholdRaw).trim();
    if (!/^\d+$/.test(s)) return { ok: false, error: 'Match threshold must be a whole number.' };
    const n = Number(s);
    if (n < AUTO_ACCEPT_THRESHOLD_MIN || n > AUTO_ACCEPT_THRESHOLD_MAX) {
      return {
        ok: false,
        error: `Match threshold must be between ${AUTO_ACCEPT_THRESHOLD_MIN} and ${AUTO_ACCEPT_THRESHOLD_MAX}.`,
      };
    }
    patch.auto_accept_threshold = n;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: 'Nothing to save.' };
  }
  return { ok: true, patch };
}

/* ─── Advanced voice-match switches (flag-dark) ───────────────────────────── */

/** `vendor_bot_config.mode` — the DB CHECK is exactly these two values. */
export const BOT_MODES = ['free', 'smart'] as const;
export type BotMode = (typeof BOT_MODES)[number];

export type VoiceSwitchesPatch = {
  /**
   * ⚠ A PREFERENCE, NOT AN ENTITLEMENT. `mode` is vendor-writable under policy
   * `vendor_bot_config_write`, so a vendor can set 'smart' at any time. Serving
   * gates on the ADVANCED level first (`lib/vendor-autoreply/voice-serve.ts`);
   * this column can only ever DECLINE voice-match, never grant it.
   */
  mode?: BotMode;
  /** § 7B "Don't learn from my messages" — the voice-derivation opt-out. */
  learn_from_past_messages?: boolean;
};

export type VoiceSwitchesParse =
  | { ok: true; patch: VoiceSwitchesPatch }
  | { ok: false; error: string };

/** Parse the voice card's two switches. PURE. Absent fields are not patched. */
export function parseVoiceSwitchesForm(form: {
  get(key: string): FormDataEntryValue | null;
}): VoiceSwitchesParse {
  const patch: VoiceSwitchesPatch = {};

  const modeRaw = form.get('mode');
  if (modeRaw !== null) {
    const v = String(modeRaw).trim();
    if (!(BOT_MODES as readonly string[]).includes(v)) {
      return { ok: false, error: 'Could not read the voice-match switch — try again.' };
    }
    patch.mode = v as BotMode;
  }

  const learnRaw = form.get('learn_from_past_messages');
  if (learnRaw !== null) {
    const v = String(learnRaw).trim().toLowerCase();
    if (v !== 'true' && v !== 'false') {
      return { ok: false, error: 'Could not read the “learn from my replies” switch — try again.' };
    }
    patch.learn_from_past_messages = v === 'true';
  }

  return { ok: true, patch };
}
