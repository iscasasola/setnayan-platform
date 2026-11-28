import type { ReactNode } from 'react';
import { gateOpenShopLogo } from './gate';

/** Decides sign-in / "no shop" / "no name yet" before `loading.tsx` streams — see `./gate.ts`. */
export default async function OpenShopLogoLayout({ children }: { children: ReactNode }) {
  await gateOpenShopLogo();
  return children;
}
