import { GridPageSkeleton } from '@/components/skeletons';

/** The control centre: one wide stage, then rows. Its own boundary so it does
 *  not borrow the event-home shimmer's title bar (see launch/loading.tsx). */
export default function Loading() {
  return <GridPageSkeleton tiles={4} cols="sm:grid-cols-2" tileClass="h-28" />;
}
