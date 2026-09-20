/**
 * lib/pay-stages.ts — the three stages of /pay/[reference], as rules that can
 * be RUN rather than behaviour buried in a component.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚖ OWNER RULING, 2026-09-20: the payment page is step by step, not one long
 * scroll. Measured that day: three `section.sn-tile` blocks rendered at once,
 * ~2,039px tall — numbered like steps and shown together, including the
 * proof-upload form for a payment nobody had made yet.
 *
 *   1 · What you're paying — the item, the exact amount, the reference, and
 *       who it goes to.
 *   2 · Pay — the code, the manual account details, the copy controls, and the
 *       honest line about what the code carries.
 *   3 · Send your proof — the screenshot and the reference digits.
 *
 * 🔑 THE STAGE LIVES IN THE URL, so browser Back works without anyone writing
 * Back-button code, each stage is linkable, and a person with JavaScript off
 * or still loading gets the right stage from the server. The shop sign-up
 * wizard (`app/open-shop`) established `?step=` here; this follows it rather
 * than inventing a second spelling.
 *
 * ⚠ AND A STAGE THAT HAS BEEN REACHED IS NOT UNMOUNTED — `shouldMountProof`.
 * Going back from the proof stage to look at the code again and returning must
 * not empty the fields; unmounting the form is exactly what would do that.
 * The same rule keeps the upload OUT of the document until its stage, so it
 * cannot be reached early.
 * ────────────────────────────────────────────────────────────────────────────
 */

export type PayStage = 1 | 2 | 3;

export const PAY_STAGES: ReadonlyArray<{
  n: PayStage;
  /** The heading a person reads at the top of the stage. */
  title: string;
  /** The control that leaves this stage, or null on the last one. */
  advance: string | null;
}> = [
  { n: 1, title: 'You’re paying for', advance: 'Continue' },
  { n: 2, title: 'Pay this exact amount', advance: 'I’ve sent the payment' },
  { n: 3, title: 'Send your proof', advance: null },
];

export const FIRST_STAGE: PayStage = 1;
export const PROOF_STAGE: PayStage = 3;

/**
 * `?step=` → a stage, with anything unrecognised reading as the first one.
 *
 * ⚠ IT NEVER THROWS AND NEVER 404s. A stale link, a typo or a truncated share
 * must land somebody at the start of paying, not on an error — the whole point
 * of this page is that money can reach us.
 */
export function parseStage(raw: string | string[] | undefined): PayStage {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === '2') return 2;
  if (v === '3') return 3;
  return FIRST_STAGE;
}

export function nextStage(s: PayStage): PayStage {
  return (s < PROOF_STAGE ? s + 1 : s) as PayStage;
}

export function prevStage(s: PayStage): PayStage {
  return (s > FIRST_STAGE ? s - 1 : s) as PayStage;
}

/**
 * The address of one stage, keeping every other query parameter this page was
 * opened with.
 *
 * 🔑 THE REST OF THE QUERY IS NOT DECORATION. `?setup=1` is what tells the page
 * it is the last step of setting a celebration up — dropping it on a Continue
 * link would silently remove the "remove these extras" door and the set-up
 * discount framing. `?recheck=` and `?error=` are the only copy telling
 * somebody what to fix.
 */
export function stageHref(
  reference: string,
  stage: PayStage,
  carry?: Record<string, string | undefined> | URLSearchParams,
): string {
  const params = new URLSearchParams();
  if (carry instanceof URLSearchParams) {
    for (const [k, v] of carry) if (k !== 'step') params.set(k, v);
  } else if (carry) {
    for (const [k, v] of Object.entries(carry)) {
      if (k !== 'step' && v != null && v !== '') params.set(k, v);
    }
  }
  if (stage !== FIRST_STAGE) params.set('step', String(stage));
  const qs = params.toString();
  return `/pay/${encodeURIComponent(reference)}${qs ? `?${qs}` : ''}`;
}

/**
 * The words on the control that leaves a stage.
 *
 * 🪤 IT IS A FUNCTION BECAUSE THE LABEL WAS WRITTEN TWICE AND THE TWO COPIES
 * DIFFERED BY ONE CHARACTER — this list spells it "I’ve sent the payment" with
 * a typographic apostrophe and the JSX spelled it `I&rsquo;ve sent the
 * payment`. Identical on screen, different strings, and a guard matching one
 * against the other went red for a reason that was invisible in both files.
 * The entity is gone; React escapes the apostrophe itself.
 */
export function advanceLabel(stage: PayStage): string | null {
  return PAY_STAGES.find((s) => s.n === stage)?.advance ?? null;
}

/**
 * Is the proof form in the document?
 *
 * Two rules in one answer, and they pull in opposite directions:
 *
 *  · **Not before its stage.** Owner: the upload for a payment nobody has made
 *    yet should not be on screen. So a page that opens on stage 1 or 2 does not
 *    render it at all — absent, not merely hidden.
 *  · **Not unmounted once reached.** Going back to look at the code again and
 *    returning must not empty the picked file and the typed digits. React state
 *    and a file input both die on unmount, and nothing would say so.
 *
 * Hence: mounted from the moment the proof stage is first reached, and mounted
 * from the first render when the page is OPENED at it (a shared link, a server
 * rejection sending somebody back to fix their reference).
 */
export function shouldMountProof(current: PayStage, everReached: boolean): boolean {
  return current === PROOF_STAGE || everReached;
}
