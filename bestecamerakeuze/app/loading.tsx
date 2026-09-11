function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-card bg-line/60 ${className ?? ""}`} />;
}

export default function Loading() {
  return (
    <div className="flex min-h-screen pagina-vlak">
      <div className="w-[240px] shrink-0 border-r border-sidebar-line bg-sidebar" />

      <main className="min-w-0 flex-1 px-8 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-2 h-4 w-80" />
          </div>
          <Skeleton className="h-8 w-40 rounded-control" />
        </div>

        <Skeleton className="mt-6 h-14 w-full rounded-panel" />
        <Skeleton className="mt-4 h-96 w-full rounded-panel" />
      </main>
    </div>
  );
}
