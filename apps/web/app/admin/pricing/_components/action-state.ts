import type { RowActionState, RemoveAllState } from '@/app/admin/pricing/actions';

/**
 * The `useActionState` initial values for the pricing row forms — pulled out
 * of actions.ts because that file carries `'use server'`, and a `'use server'`
 * file may export ONLY async functions (Next fails the production build on
 * anything else; see lib/use-server-exports-only-functions.test.ts). Plain
 * constants, not functions — there is nothing to compute.
 */
export const INITIAL_ROW_STATE: RowActionState = { ok: false, message: null };
export const INITIAL_REMOVE_ALL_STATE: RemoveAllState = { ok: false, message: null, removed: 0 };
