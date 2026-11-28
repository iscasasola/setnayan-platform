// The one-form simple-event setup — form shell while the server answers. Sign-in and "type not live" are decided by
// ./layout.tsx before this streams. The heading depends on the setup engine, so it is grey, not guessed.
import { FormPageSkeleton } from '@/components/skeletons';

export default function Loading() {
  return <FormPageSkeleton title fields={3} />;
}
