type SkeletonProps = { className?: string; lines?: number };

function cx(...parts: (string | undefined | false)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function Skeleton({ className, lines = 1 }: SkeletonProps) {
  if (lines <= 1) {
    return (
      <div
        className={cx('h-4 rounded bg-white/5 animate-pulse', className)}
        aria-hidden
      />
    );
  }
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cx('h-4 rounded bg-white/5 animate-pulse', className)}
        />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="glass p-5 rounded-2xl" aria-hidden>
      <Skeleton className="h-5 w-2/3" />
      <div className="mt-3 flex flex-col gap-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
    </div>
  );
}
