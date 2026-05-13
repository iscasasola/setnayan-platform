export default function VendorLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 space-y-2">
        <div className="h-7 w-40 animate-pulse rounded bg-ink/[0.07]" />
        <div className="h-4 w-3/4 max-w-md animate-pulse rounded bg-ink/[0.05]" />
      </div>
      <ul className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <li
            key={i}
            className="h-20 animate-pulse rounded-xl border border-ink/10 bg-ink/[0.03]"
          />
        ))}
      </ul>
    </div>
  );
}
