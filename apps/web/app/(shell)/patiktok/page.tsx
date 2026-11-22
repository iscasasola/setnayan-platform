import { redirect } from 'next/navigation';

/**
 * /patiktok — RETIRED (owner 2026-11-20, verbatim: *"Retire Patiktok and Music
 * Maker ( we do not want to serve this anymore)"*). The product is no longer
 * offered, so its public page is gone and an old link lands on /features (a plain
 * `redirect`, the house legacy-stub form the Root map recognises).
 * The list of retired products is `lib/retired-products.ts`.
 */
export default function RetiredProductPage(): never {
  redirect('/features');
}
