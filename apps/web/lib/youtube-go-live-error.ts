/**
 * WHY DID GOING LIVE FAIL? — turning YouTube's answer into a sentence the host can act on.
 *
 * ── THE HOLE THIS FILLS ─────────────────────────────────────────────────────
 * `goLivePanood` wrapped all three YouTube calls in a BARE `} catch {`. The thrown
 * Error already carried YouTube's status and the first 300 characters of its JSON
 * body — `youtubeFetch` builds exactly that — and the bare catch discarded the
 * binding, so the reason was destroyed at the moment it was most needed.
 *
 * That is not hypothetical. Production has **zero** `panood_broadcasts` rows: no
 * broadcast has ever been created, by anyone. A grant existed on 2026-07-25 for
 * channel `UC_npqywLsskk_m81lllOjxQ` (verified: that id resolves to `/@Setnayan`)
 * with the right scopes and a refresh token, and it was revoked ~14 hours later
 * with nothing to show. **We cannot say why, because the sentence that said why was
 * thrown away.** The owner's own screenshot points at the likely cause — YouTube's
 * live-streaming entitlement was only requested on 2026-08-12 — but "likely" is all
 * anyone can say, and that is the defect.
 *
 * 🔑 A FAILURE THAT EXPLAINS NOTHING COSTS THE SAME AS A FAILURE THAT NEVER
 * HAPPENED — you learn the same amount from both. The old copy hedged across three
 * unrelated causes ("needs reconnecting, or live streaming is not yet enabled") and
 * pointed at reconnecting, which is the WRONG move for two of the three: it burns a
 * working connection and changes nothing.
 *
 * ── WHAT THIS DOES ──────────────────────────────────────────────────────────
 * YouTube's Data API returns a machine-readable `reason` inside the error body
 * (`error.errors[].reason`, mirrored at `error.status` for some classes). This maps
 * the ones that actually occur on the go-live path to copy that names the ONE next
 * action, and falls back to an honest generic when the reason is unrecognised —
 * never to a confident wrong guess.
 *
 * Pure and total, so it can be tested without touching the network.
 */

/** The classes we can say something specific and correct about. */
export type GoLiveFailureKind =
  | 'live-not-enabled'
  | 'live-permission-blocked'
  | 'quota'
  | 'auth'
  | 'unknown';

export type GoLiveFailure = {
  kind: GoLiveFailureKind;
  /** What the host is told. One cause, one next action. */
  message: string;
  /**
   * The raw text worth writing to the server log. Never shown to a host — it can
   * carry URLs and API detail — but it is the difference between diagnosing
   * tomorrow's attempt and guessing at it the way we are guessing at July's.
   */
  detail: string;
};

/**
 * YouTube reason strings, lowercased for matching.
 *
 * ⚠ A DENY-LIST IS A BILL YOU KEEP PAYING, so this is deliberately an ALLOW-list of
 * things we can speak to, with everything else falling through to `unknown` and the
 * honest generic. Adding a row is a decision that we can say something TRUE about
 * that reason — not a way to make an unfamiliar error look handled.
 */
const REASONS: ReadonlyArray<{ match: readonly string[]; kind: GoLiveFailureKind }> = [
  {
    // The channel has never been granted live streaming, or the 24-hour wait after
    // requesting it has not elapsed. This is the single most likely cause of a
    // first-ever go-live failure and it is entirely on the channel's side.
    match: ['livestreamingnotenabled', 'livestreamnotenabled'],
    kind: 'live-not-enabled',
  },
  {
    // Live streaming exists but is restricted right now — an active strike, or a
    // channel-level restriction. Reconnecting cannot help.
    match: ['livepermissionblocked', 'livestreamingnotallowed'],
    kind: 'live-permission-blocked',
  },
  {
    match: ['quotaexceeded', 'ratelimitexceeded', 'userratelimitexceeded', 'dailylimitexceeded'],
    kind: 'quota',
  },
  {
    // The token is genuinely no longer good. This is the ONLY class where
    // "reconnect" is the right instruction.
    match: [
      'authenticationerror',
      'insufficientpermissions',
      'insufficientlivepermissions',
      'forbidden',
      'unauthorized',
      'invalid_grant',
      'invalid_token',
    ],
    kind: 'auth',
  },
];

const MESSAGES: Record<GoLiveFailureKind, string> = {
  'live-not-enabled':
    'YouTube has not switched live streaming on for this channel yet. Open YouTube Studio and check whether it is still counting down — after you ask for it, YouTube makes you wait 24 hours. Reconnecting here will not speed it up.',
  'live-permission-blocked':
    'YouTube is blocking live streaming on this channel right now. That is set on YouTube’s side — check YouTube Studio for a restriction or strike on the channel. Reconnecting here will not change it.',
  quota: 'YouTube is temporarily rate-limiting us. Wait a few minutes and press Go live again.',
  auth: 'Your YouTube connection is no longer valid. Reconnect the channel in step 1, then press Go live again.',
  unknown:
    'YouTube refused to create the broadcast and did not say why in a way we recognise. The exact reason has been recorded — send this to Setnayan rather than reconnecting, because reconnecting a working channel will not help.',
};

/**
 * Classify a thrown go-live error.
 *
 * ⚠ Matches on the raw text rather than parsing JSON, on purpose. `youtubeFetch`
 * truncates the body to 300 characters, so the JSON is frequently INVALID by the
 * time it reaches here — a parse would throw, and a parse wrapped in a try/catch
 * would silently degrade every classification to `unknown`. Substring matching over
 * a truncated body still finds the reason, which sits near the front of Google's
 * error envelope.
 */
export function classifyGoLiveFailure(err: unknown): GoLiveFailure {
  const detail =
    err instanceof Error ? err.message : typeof err === 'string' ? err : String(err ?? '');
  const hay = detail.toLowerCase();

  for (const row of REASONS) {
    if (row.match.some((m) => hay.includes(m))) {
      return { kind: row.kind, message: MESSAGES[row.kind], detail };
    }
  }
  return { kind: 'unknown', message: MESSAGES.unknown, detail };
}
