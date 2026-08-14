/**
 * Loading boundary — required because this route is now `force-dynamic`.
 *
 * A dynamic route with NO loading boundary prefetches an EMPTY tree (measured:
 * 72,197 bytes for a static page vs 162 without a boundary vs 58,473 with one),
 * so the press from the rail stops being instant and waits on a blank frame.
 *
 * Renders nothing on purpose: the shared shell is what a person is looking at,
 * and a skeleton here would flash a second set of furniture inside the first.
 */
export default function Loading() {
  return null;
}
