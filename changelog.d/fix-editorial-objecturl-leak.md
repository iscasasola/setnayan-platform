## 2026-06-25 · fix(editorial): revoke leaked preview blob URLs in the vendor editorial-media studio

Post-review cleanup (adversarial audit of the 2026-06-25 session). `editorial-media-studio.tsx` created `URL.createObjectURL` previews but leaked them on two paths: `removeStaged` filtered an item out of state without revoking its `previewUrl`, and `getVideoDuration`'s `v.onerror` resolved without revoking `v.src` (the success path already did). Added: a revoke in `removeStaged` before the filter; a revoke in the `onerror`; and an unmount `useEffect` (via a ref, to avoid a stale closure) that revokes any still-staged previews when the visitor navigates away without submitting. Bounded leak (MAX_PER_TYPE≈3, reclaimed on navigation) — behaviour otherwise identical.

SPEC IMPACT: None.
