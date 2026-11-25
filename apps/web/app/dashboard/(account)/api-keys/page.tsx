import { permanentRedirect } from 'next/navigation';
import { routes } from '@/lib/routes';

/**
 * 🗑 RETIRED (final check 25 Nov, lane R · R8; LAUNCH-GATE L6): the public API is switched off (`public-api-flag`), yet
 * every couple was offered keys. The page is gone; an old link people may hold forwards — permanently — to the
 * dashboard. Held by `lib/retired-pages-are-gone.test.ts`.
 */
export default function RetiredApiKeysPage(): never {
  permanentRedirect(routes.dashboard.index());
}
