import 'server-only';
import { displayUrlForPrivateStoredAsset, displayUrlForStoredAsset, parseStoredAsset } from '@/lib/uploads';

/**
 * Sign one stored ref for drawing: a portfolio photo through the public signer; a private stored copy ONLY when it sits
 * in THIS shop's own `supplier-files/<shop>/` folder (the policy-checked private signer — never a raw one).
 */
export async function signStoredRef(ref: string | null | undefined, shop: string): Promise<string | null> {
  if (!ref) return null;
  const parsed = parseStoredAsset(ref);
  if (!parsed || parsed.kind === 'legacy_url') return null;
  if (parsed.bucket === 'setnayan-media') return displayUrlForStoredAsset(ref);
  return displayUrlForPrivateStoredAsset(ref, { bucket: 'setnayan-thread-files', prefixes: [`supplier-files/${shop}/`] }, { ttlSeconds: 60 * 60 });
}

