/**
 * live-studio-pool-words.ts — plain words for the Live Watch channel pool
 * (A8·F-18). The OAuth start and callback routes hand the board short codes
 * (`exchange_failed`, `not_configured:<keys>`, `state_failed:<db text>`) and the
 * pool stores raw statuses (`checked_out`). Neither is shown to the admin as
 * typed: each known code is one sentence, and an unknown one is a plain generic
 * line — never the code, never database text.
 */
const CONNECT_ERRORS: Record<string, string> = {
  live_studio_disabled: 'Live Watch is switched off, so no channel can be connected right now.',
  not_configured: 'The YouTube connection is not set up yet (its keys are missing). Ask the owner to add them.',
  bad_channel_pool_id: 'That channel is not in the pool any more. Refresh and try again.',
  state_failed: 'Couldn’t start the connection just now. Try again.',
  state_expired: 'The sign-in took too long and expired. Press Connect again.',
  exchange_failed: 'YouTube did not finish the sign-in. Press Connect again.',
  no_refresh_token: 'YouTube did not grant lasting access. Press Connect again and allow access when asked.',
  channel_lookup_failed: 'Couldn’t read which YouTube channel signed in. Press Connect again.',
  channel_row_missing: 'That channel is not in the pool any more. Refresh and try again.',
  channel_mismatch: 'A different YouTube channel signed in than the one on this row. Sign in with the right channel.',
  pool_row_failed: 'Couldn’t add the channel to the pool. Try again.',
  persist_failed: 'The channel signed in, but its access could not be saved. Try again.',
};

const GENERIC_CONNECT_ERROR = 'The channel could not be connected. Try again.';

/** The sentence for a `?error=` code on the pool board. */
export function poolConnectErrorLine(code: string | null | undefined): string | null {
  if (!code) return null;
  const key = code.split(':')[0] ?? '';
  return Object.hasOwn(CONNECT_ERRORS, key) ? (CONNECT_ERRORS[key] ?? GENERIC_CONNECT_ERROR) : GENERIC_CONNECT_ERROR;
}

const STATUS_WORDS: Record<string, string> = {
  available: 'Available',
  checked_out: 'Held by an event',
  maintenance: 'Out of service',
  retired: 'Retired',
};

/** A pool row's status in words; an unknown status says so rather than printing it raw. */
export function poolStatusWord(status: string): string {
  return Object.hasOwn(STATUS_WORDS, status) ? (STATUS_WORDS[status] ?? 'Unknown status') : 'Unknown status';
}
