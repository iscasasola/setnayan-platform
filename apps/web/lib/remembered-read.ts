import 'server-only';

import { unstable_cache } from 'next/cache';
import { rememberWith, type RememberOptions, type RememberStore } from '@/lib/remembered-read-core';
import { HOME_SHELF_HARD_SECONDS, HOME_SHELF_SOFT_SECONDS } from '@/lib/home-shelf-tags';

/**
 * remembered-read.ts — the repo's cached-read shape (`unstable_cache` under a
 * tag, read with the service client, cleared by the writer), plus the one thing
 * that shape lacked: an age past which a value is never shown. The rule and its
 * reasons are in `lib/remembered-read-core.ts`.
 *
 * ⛔ WHAT MAY BE WRAPPED: a read that is the same for every visitor and takes
 * no viewer. Inside `unstable_cache` Next refuses `cookies()` and `headers()`
 * outright — but several readers in this app CATCH that refusal and answer with
 * a default (`resolveProfile`, the view-as-free switch), so a wrapped function
 * that reached one would not fail: it would quietly remember the default for
 * everybody. `lib/home-reads-remember-nobody.test.ts` therefore holds the
 * modules that call this to an import graph with no session in it.
 */
const nextStore: RememberStore = (load, key, opts) => unstable_cache(load, [key], opts);

export function rememberPublicRead<A extends unknown[], T>(
  load: (...args: A) => Promise<T>,
  opts: Pick<RememberOptions, 'key' | 'tags'> & Partial<Pick<RememberOptions, 'softSeconds' | 'hardSeconds'>>,
): (...args: A) => Promise<T> {
  return rememberWith(nextStore, load, {
    softSeconds: HOME_SHELF_SOFT_SECONDS,
    hardSeconds: HOME_SHELF_HARD_SECONDS,
    ...opts,
  });
}
