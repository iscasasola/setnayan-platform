/**
 * The loading boundary for the /tl/features hub only — see
 * `app/(shell)/features/(hub)/loading.tsx` for why it sits in `(hub)/`:
 * `/tl/features/[slug]` calls `notFound()` and must not stream.
 */
export default function FeaturesHubLoadingTaglish() {
  return null;
}
