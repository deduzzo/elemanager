import { useSignedPhotoUrl } from '@/lib/queries/foto';
import { Skeleton } from '@/components/ui';

interface PhotoThumbnailProps {
  storagePath: string;
  onClick?: () => void;
  alt?: string;
}

export function PhotoThumbnail({ storagePath, onClick, alt }: PhotoThumbnailProps) {
  const { data: url, isLoading } = useSignedPhotoUrl(storagePath);
  if (isLoading) return <Skeleton className="w-full aspect-square rounded-lg" />;
  if (!url) {
    return (
      <div className="w-full aspect-square rounded-lg glass flex items-center justify-center text-xs text-slate-500">
        errore
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-full aspect-square rounded-lg overflow-hidden group"
    >
      <img
        src={url}
        alt={alt ?? ''}
        loading="lazy"
        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
      />
    </button>
  );
}
