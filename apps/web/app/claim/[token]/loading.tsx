// Claim-your-profile door — form shell while the token resolves (host/accept/[token] precedent). The flag's
// "switched off" redirect is decided by ./layout.tsx before this streams.
import { FormPageSkeleton } from '@/components/skeletons';

export default function Loading() {
  return <FormPageSkeleton title />;
}
