import { notFound } from 'next/navigation';

/**
 * Any /sample address no page claims — `/sample/<a real event's id>`,
 * `/sample/maria-and-jose`, `/sample/hub` before slice S3 builds it — is a 404.
 *
 * 🔑 WHY THIS FILE EXISTS: without it, `/sample/hub` would fall through to
 * `app/[slug]/hub` with slug = "sample" — a real event's route tree. A static
 * `sample` folder only wins a URL if something under it matches; this catch-all
 * makes sure something always does, and that it is always the 404. Later slices
 * add their own pages beside it (`/sample/hub/[guestKey]` …), which outrank a
 * catch-all.
 */
export default function SampleUnknownAddress(): never {
  notFound();
}
