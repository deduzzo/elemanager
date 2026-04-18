import { useState } from 'react';
import { useFotoBySezione, useDeleteFoto } from '@/lib/queries/foto';
import { useAuth } from '@/features/auth/useAuth';
import { useRole } from '@/features/auth/useRole';
import { ConfirmDialog, useToast } from '@/components/ui';
import type { FotoSezioneRow } from '@/lib/database.types';
import { PhotoThumbnail } from './PhotoThumbnail';
import { PhotoLightbox } from './PhotoLightbox';
import { PhotoUploader } from './PhotoUploader';

interface PhotoGalleryProps {
  giornataId: string;
  sezioneId: string;
  elezioneId?: string;
  readOnly?: boolean;
}

export function PhotoGallery({ giornataId, sezioneId, elezioneId, readOnly }: PhotoGalleryProps) {
  const { data: foto = [], isLoading } = useFotoBySezione(sezioneId, elezioneId);
  const deleteFoto = useDeleteFoto();
  const { user } = useAuth();
  const { data: profile } = useRole();
  const { push: toast } = useToast();
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const canDelete = (row: FotoSezioneRow) =>
    profile?.ruolo === 'admin' || row.uploaded_by === user?.id;

  const handleConfirmDelete = async () => {
    if (!confirmDel) return;
    const row = foto.find((f) => f.id === confirmDel);
    if (!row) {
      setConfirmDel(null);
      return;
    }
    try {
      await deleteFoto.mutateAsync({
        id: row.id,
        storage_path: row.storage_path,
        sezione_id: row.sezione_id,
      });
      toast('Foto eliminata', { type: 'success' });
    } catch (e) {
      toast(`Errore: ${e instanceof Error ? e.message : ''}`, { type: 'error' });
    } finally {
      setConfirmDel(null);
    }
  };

  return (
    <div className="space-y-3">
      {!readOnly && (
        <PhotoUploader
          giornataId={giornataId}
          sezioneId={sezioneId}
          elezioneId={elezioneId}
        />
      )}
      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="w-full aspect-square bg-white/5 animate-pulse rounded-lg"
            />
          ))}
        </div>
      ) : foto.length === 0 ? (
        <p className="text-sm text-slate-500">Nessuna foto caricata.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {foto.map((f, i) => (
            <div key={f.id} className="relative">
              <PhotoThumbnail
                storagePath={f.storage_path}
                onClick={() => setLightboxIdx(i)}
                alt={f.descrizione ?? ''}
              />
              {canDelete(f) && !readOnly && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDel(f.id);
                  }}
                  className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-full bg-black/60 text-white/80 hover:text-neon-pink"
                  aria-label="Elimina"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {lightboxIdx !== null && (
        <PhotoLightbox
          foto={foto}
          index={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onNavigate={setLightboxIdx}
        />
      )}
      <ConfirmDialog
        open={confirmDel !== null}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDel(null)}
        title="Elimina foto"
        message="La foto verrà eliminata definitivamente. Continuare?"
        confirmLabel="Elimina"
        danger
      />
    </div>
  );
}
