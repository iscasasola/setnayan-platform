'use client';

import { useState, type ReactNode } from 'react';

/**
 * Shop logo for the launcher space card. Renders the uploaded logo, but falls
 * back to the store glyph if the image fails to load (a broken/expired R2 URL
 * would otherwise show the browser's broken-image icon). Client-only because it
 * needs the `onError` handler; the parent SpaceCard stays a server component.
 *
 * `fallback` is a pre-rendered element, NOT a component function: a Server
 * Component cannot pass a function (a Lucide icon is a `forwardRef` object) to a
 * Client Component — doing so throws "Functions cannot be passed directly to
 * Client Components" and crashed the whole launcher for any vendor with a shop
 * logo. A rendered React element serializes across the RSC boundary fine.
 */
export function ShopLogo({
  src,
  fallback,
}: {
  src: string;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}
