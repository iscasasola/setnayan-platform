/**
 * The in-place sign-in's starting state.
 *
 * It lives here rather than beside its action because `../actions.ts` is a
 * `'use server'` module, and such a file may export ONLY async functions — a
 * plain `export const` there fails the production build ("Only async functions
 * are allowed to be exported in a 'use server' file") while typechecking
 * perfectly green. This is an ordinary module, so the constant is fine.
 */
import type { SignInInPlaceState } from '../actions';

export const SIGN_IN_IN_PLACE_INITIAL: SignInInPlaceState = {
  error: null,
  ok: false,
  attempt: 0,
};
