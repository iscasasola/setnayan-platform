/**
 * THE SIX-STATE SYSTEM — archetype 03 (design#1, ported from
 * prototypes/archetype_shell_command_states_2026-08-01.html).
 *
 * Every data surface is in exactly one of six states:
 *
 *   ideal · loading · empty · locked · denied · error
 *
 * The three "you can't have this yet" states use three different frames on
 * purpose — Empty is centred and teaches, Locked ghosts the feature behind a
 * gold lock, Denied is left-anchored slate and names the role — so the
 * distinction survives even a user who reads none of the words.
 *
 * THE RULE THIS FILE ENFORCES: an RLS denial and an empty read are the SAME
 * VALUE — `count: 0`, no error. A production desk once printed "no requests
 * yet" over three real pending rows. So Empty may only ever render after the
 * reader's permission was POSITIVELY proven; anything short of a literal
 * `true` resolves to Denied, never Empty.
 */

export type SurfaceStateKind =
  | 'ideal'
  | 'loading'
  | 'empty'
  | 'locked'
  | 'denied'
  | 'error';

export type SurfaceStateInput = {
  /** The read is still in flight. Render the shape-matched skeleton. */
  loading?: boolean;
  /** The read (or a refresh) failed. Error reports broke → survived → do. */
  error?: boolean;
  /** The surface is behind a paid entitlement the account does not hold. */
  locked?: boolean;
  /**
   * TRUE only when the reader's permission was POSITIVELY proven — e.g. the
   * membership/role row itself was read back, or the query ran as a client
   * that cannot be silently filtered. `undefined`, `null`, and `false` all
   * resolve to Denied: a permitted-but-empty read and a denied read return
   * the same `count: 0`, and guessing Empty is the live defect this system
   * exists to close.
   */
  readPermitted: boolean | null | undefined;
  /** Row count the surface would render. Only consulted once permitted. */
  count: number;
};

/**
 * Precedence, first match wins:
 *
 *   1. loading  — nothing is known yet; skeleton, never a spinner
 *   2. error    — something broke; report what survived before what to do
 *   3. locked   — entitlement is known regardless of rows
 *   4. denied   — permission not PROVEN (strictly `readPermitted !== true`)
 *   5. empty    — permitted and zero rows; teach the one filling action
 *   6. ideal
 */
export function resolveSurfaceState(input: SurfaceStateInput): SurfaceStateKind {
  if (input.loading) return 'loading';
  if (input.error) return 'error';
  if (input.locked) return 'locked';
  if (input.readPermitted !== true) return 'denied';
  if (input.count === 0) return 'empty';
  return 'ideal';
}
