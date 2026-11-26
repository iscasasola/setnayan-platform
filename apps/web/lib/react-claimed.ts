/**
 * 💧 Has React hydrated (claimed) this DOM element yet? React tags each node it has claimed with a `__reactFiber$…`
 * key. A client piece that draws INTO a server-drawn element from outside its Suspense boundary (a portal from a
 * layout) must wait for this, or React later finds nodes the server never sent and throws a hydration mismatch
 * (React #418 — final check A2-P11, SW-HYDR). Pure, so it is held by behaviour.
 */
export function isClaimedByReact(el: object): boolean {
  return Object.keys(el).some((k) => k.startsWith('__reactFiber$'));
}
