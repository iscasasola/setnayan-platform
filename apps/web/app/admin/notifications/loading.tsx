/* Loading shell for admin/notifications — instant animated skeleton (list).
   Closes the one gap found by the 2026-06-07 app-wide loader sweep: this async
   page (fetches the admin's notifications) had no loading.tsx → blank on fetch. */
export { ListPageSkeleton as default } from '@/components/skeletons';
