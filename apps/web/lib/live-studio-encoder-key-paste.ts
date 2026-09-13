/**
 * S8 — the pure "what happens on submit" core of the own-channel stream-key
 * paste field (rendered only inside the desktop shell — see
 * app/_components/encoder-key-panel.tsx).
 *
 * Factored out of the component on purpose: the guard this session most cares
 * about — "the pasted key never sits in React state a moment longer than the
 * submit" — has to be something a plain, mutation-tested unit test can pin
 * down. The repo has no React-rendering test harness (no `.test.tsx` anywhere,
 * no jsdom/RTL wired up), so the guarantee lives here as a pure function
 * instead of an assertion against a rendered DOM: `nextFieldValue` is ALWAYS
 * `''`, never the value that was just submitted, and the component's submit
 * handler MUST apply it to the controlled input synchronously, before
 * `await`-ing the Tauri invoke. See the component for the wiring.
 *
 * ── DSK-1: IT NOW DECIDES AN ADDRESS TOO ────────────────────────────────────
 * A key alone could never publish. Rust held it against `rtmps_url: ""`, which
 * fails `RtmpEndpoint::parse`, so `destinations()` was `None` and every
 * own-channel broadcast refused with `no_stream_key` — see
 * `set_pasted_inner`'s docblock in src-tauri/src/stream_key.rs. The address is
 * now carried WITH the key, and deciding which address is a pure question about
 * what the couple typed, so it belongs here beside the clearing guarantee
 * rather than in the component.
 *
 * THE SHAPE THIS EXISTS FOR: every OBS tutorial writes the ingest as one line,
 * `rtmps://a.rtmps.youtube.com/live2/xxxx-xxxx-xxxx`, so that is what a couple
 * pastes into a box labelled "key" — while YouTube Studio's own screen shows
 * them as two separate fields. Both arrive. Splitting the one-line form here
 * means Rust receives the same two values either way. Rust refuses a key
 * containing `://` as a backstop, so a miss in this function is a named refusal
 * at paste time, never a broadcast published with a URL as its key.
 */

/** Marks a value as an ingest address rather than a key. */
function looksLikeIngestAddress(value: string): boolean {
  return /^rtmps?:\/\//i.test(value);
}

export type PasteSubmitResult = {
  /** The trimmed key to hand to `setPastedStreamKey`. */
  send: string;
  /**
   * The ingest address to hand to `setPastedStreamKey` alongside the key, or
   * `null` to let Rust hold the key against YouTube's documented primary.
   *
   * Non-null ONLY when the couple actually supplied one — either in the address
   * field or as the host part of a one-line paste. This function never invents
   * an address: the default lives in Rust as `YOUTUBE_RTMPS_PRIMARY`, one place,
   * so the web and the encoder cannot come to disagree about what "no address
   * given" resolves to.
   */
  rtmpsUrl: string | null;
  /**
   * What the paste field's controlled value must become. Always the empty
   * string — typed as the literal `''`, not `string`, so a future edit that
   * tries to return anything else is a compile error, not just a lint nit.
   */
  nextFieldValue: '';
};

/**
 * Returns `null` for a blank/whitespace-only field (nothing to submit — the
 * caller should leave the field as-is and not call the Tauri command at all).
 *
 * `addressFieldValue` is the optional, NON-SECRET server box. It is not subject
 * to the clearing guarantee and deliberately has no `next…` value: it is the
 * same string YouTube Studio prints on screen, and a couple who mistypes it
 * needs to see what they typed in order to fix it.
 */
export function pasteSubmit(
  currentFieldValue: string,
  addressFieldValue = '',
): PasteSubmitResult | null {
  const trimmed = currentFieldValue.trim();
  if (!trimmed) return null;

  const typedAddress = addressFieldValue.trim();

  // ONE-LINE PASTE — the OBS-tutorial form, in the key box. The last path
  // segment is the key and everything before it is the address. An explicitly
  // typed address still wins: it is the more deliberate of the two inputs.
  if (looksLikeIngestAddress(trimmed)) {
    const lastSlash = trimmed.lastIndexOf('/');
    const head = lastSlash === -1 ? '' : trimmed.slice(0, lastSlash);
    const tail = lastSlash === -1 ? '' : trimmed.slice(lastSlash + 1).trim();
    // `head` must still be an address once the key is taken off it — otherwise
    // this was `rtmps://host` with no application path and no key in it at all.
    // Send it on unsplit and let Rust name the refusal rather than guessing.
    if (tail && looksLikeIngestAddress(head)) {
      return {
        send: tail,
        rtmpsUrl: typedAddress || head,
        nextFieldValue: '',
      };
    }
  }

  return {
    send: trimmed,
    rtmpsUrl: typedAddress || null,
    nextFieldValue: '',
  };
}

/**
 * Turn Rust's refusal reason into a sentence the couple can act on.
 *
 * ── WHY THIS IS NOT A GENERIC "TRY AGAIN" ───────────────────────────────────
 * The panel used to say "Couldn't save it — check the key and try again." for
 * every failure, which was the only thing it COULD say, because every failure
 * looked the same from here. Now Rust refuses for reasons that have different
 * fixes: a whole URL in the key box is a different mistake from a mistyped
 * server address, and "check the key" is wrong advice for both. A refusal the
 * couple cannot act on is the same as no refusal at all.
 *
 * `reason` is Rust's own error string, arriving as the rejection's message.
 * Anything unrecognised falls back to the original sentence rather than showing
 * a raw identifier — an unknown reason is still a real failure and must still
 * say so.
 */
export function pasteRefusalSentence(reason: unknown): string {
  const text = reason instanceof Error ? reason.message : String(reason ?? '');
  if (text.includes('key_looks_like_ingest_address')) {
    return 'That looks like the whole server address. Paste just the stream key here, and put the address in the server box.';
  }
  if (text.includes('unusable_ingest_address')) {
    return 'That server address can’t be used. It should start with rtmps:// and include the path after the host.';
  }
  if (text.includes('empty_key')) {
    return 'Paste your stream key first.';
  }
  if (text.includes('not_desktop')) {
    return 'This only works in the Setnayan desktop app.';
  }
  return 'Couldn’t save it — check the key and try again.';
}
