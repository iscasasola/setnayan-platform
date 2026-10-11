import 'server-only';

import { loadFeaturedChaptersResult } from '@/lib/storytellers';
import { rememberPublicRead } from '@/lib/remembered-read';
import { makeHomePublicReads } from '@/lib/home-public-reads-core';

/**
 * home-public-reads.ts — the app's own instance of the home page's remembered
 * reads: Next's cache as the store and the real chapters loader (the service
 * client is built inside each read, where the guards can see it). Every read, its key, its tags and the rules it keeps are written in
 * `lib/home-public-reads-core.ts`; this file adds nothing to them.
 *
 * ⛔ Nothing imported here may reach a session — see the core's docblock and
 * `lib/home-reads-remember-nobody.test.ts`, which walks this file's imports.
 */
export const {
  rememberedWorldCandidates,
  rememberedHostRows,
  rememberedCoverRows,
  rememberedPublicPeople,
  rememberedLiveShopRows,
  rememberedFeaturedChapters,
  rememberedEventTypeRows,
} = makeHomePublicReads({
  remember: rememberPublicRead,
  featuredChapters: loadFeaturedChaptersResult,
});

export {
  candidateEvents,
  coverColumns,
  shopColumns,
  type CoverFacts,
  type CoverRow,
  type CoverRows,
  type EventTypeRows,
  type HostRows,
  type LiveShopRefusal,
} from '@/lib/home-public-reads-core';
