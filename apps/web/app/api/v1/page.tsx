import { permanentRedirect } from 'next/navigation';
import { routes } from '@/lib/routes';

/**
 * 🗑 RETIRED (final check 25 Nov, lane R · R8; LAUNCH-GATE L6): the public API reference page. The public API is switched
 * off (`public-api-flag`; live, /api/v1 answered 404 to search engines), so its reference is gone and an old link
 * forwards — permanently — to the dashboard, as the API keys page does. The /api/v1/* ROUTES (health, the admin and
 * checkout helpers) are untouched. Held by `lib/retired-pages-are-gone.test.ts`.
 */
export default function RetiredApiReferencePage() {
  permanentRedirect(routes.dashboard.index());
}
