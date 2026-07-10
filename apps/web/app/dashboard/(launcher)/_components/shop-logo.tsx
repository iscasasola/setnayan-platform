'use client';

import { useState, type ComponentType } from 'react';

/**
 * Shop logo for the launcher space card. Renders the uploaded logo, but falls
 * back to the store glyph if the image fails to load (a broken/expired R2 URL
 * would otherwise show the browser's broken-image icon). Client-only because it
 * needs the `onError` handler; the parent SpaceCard stays a server component.
 */
export function ShopLogo({
  src,
  fallbackIcon: Icon,
}: {
  src: string;
  fallbackIcon: ComponentType<{ className?: string }>;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Icon className="h-[18px] w-[18px]" />;
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
