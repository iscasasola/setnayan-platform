'use client';

// 🔌 The guest's own error page for "MY camera" (reads-are-honest, 2026-11-05).
//
// This route is opened from a guest's personal QR. When its guest read is
// refused, the page now throws instead of saying "This link isn't active… it may
// have been replaced" — and without a boundary of its own that throw would reach
// the ROOT one, which is written for a customer on the marketing site ("Take me
// home"). The invitation's boundary is the right words for a guest: *"Your link
// is fine — something on our end is having trouble"*, a Try again that re-asks
// the server, and one automatic retry. Re-used, not re-drawn.
export { default } from '@/app/[slug]/error';
