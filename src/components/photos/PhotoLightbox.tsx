import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSignedPhotoUrl } from '@/lib/queries/foto';
import type { FotoSezioneRow } from '@/lib/database.types';
import { Skeleton } from '@/components/ui';

interface PhotoLightboxProps {
  foto: FotoSezioneRow[];
  index: number;
  onClose: () => void;
  onNavigate: (newIndex: number) => void;
}

function LightboxImage({ path }: { path: string }) {
  const { data: url, isLoading } = useSignedPhotoUrl(path);
  if (isLoading) return <Skeleton className="w-full h-96" />;
  if (!url) return <div className="text-slate-400">Errore caricamento</div>;
  return (
    <img
      src={url}
      className="max-w-full max-h-[85vh] object-contain"
      alt=""
    />
  );
}

export function PhotoLightbox({ foto, index, onClose, onNavigate }: PhotoLightboxProps) {
  const current = foto[index];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) onNavigate(index - 1);
      if (e.key === 'ArrowRight' && index < foto.length - 1) onNavigate(index + 1);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [index, foto.length, onClose, onNavigate]);

  if (!current) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl"
        aria-label="Chiudi"
      >
        ✕
      </button>
      {index > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(index - 1);
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-3xl"
          aria-label="Precedente"
        >
          ‹
        </button>
      )}
      {index < foto.length - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(index + 1);
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-3xl"
          aria-label="Successiva"
        >
          ›
        </button>
      )}
      <div className="text-center space-y-3" onClick={(e) => e.stopPropagation()}>
        <LightboxImage path={current.storage_path} />
        <div className="text-sm text-slate-300">
          {current.descrizione && <p className="mb-1">{current.descrizione}</p>}
          <p className="text-xs text-slate-500">
            {new Date(current.created_at).toLocaleString('it-IT')} · {index + 1}/{foto.length}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
