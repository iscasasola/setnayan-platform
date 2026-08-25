// Samahan-invite accept flow — form shell while the token resolves
// (host/accept/[token] precedent).
import { FormPageSkeleton } from '@/components/skeletons';

export default function Loading() {
  return <FormPageSkeleton title />;
}
