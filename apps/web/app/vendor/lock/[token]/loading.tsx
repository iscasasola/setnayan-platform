export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6">
      <div className="h-40 animate-pulse rounded-3xl bg-ink/5" />
      <div className="mt-4 h-32 animate-pulse rounded-2xl bg-ink/5" />
      <div className="mt-6 h-28 animate-pulse rounded-2xl bg-ink/5" />
    </div>
  );
}
