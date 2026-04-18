import { useRef, useState, type ChangeEvent } from 'react';
import { Button, useToast } from '@/components/ui';
import { uploadPhoto } from '@/lib/storage';
import { useCreateFoto } from '@/lib/queries/foto';
import { useAuth } from '@/features/auth/useAuth';

interface PhotoUploaderProps {
  giornataId: string;
  sezioneId: string;
  elezioneId?: string;
}

export function PhotoUploader({ giornataId, sezioneId, elezioneId }: PhotoUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const createFoto = useCreateFoto();
  const { user } = useAuth();
  const { push: toast } = useToast();

  const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0 || !user) return;
    setBusy(true);
    setProgress({ done: 0, total: files.length });
    let ok = 0;
    let fail = 0;
    for (const file of files) {
      try {
        const meta = await uploadPhoto(file, giornataId, sezioneId);
        await createFoto.mutateAsync({
          sezione_id: sezioneId,
          elezione_id: elezioneId ?? null,
          storage_path: meta.storage_path,
          width: meta.width,
          height: meta.height,
          bytes: meta.bytes,
          uploaded_by: user.id,
        });
        ok++;
      } catch (err) {
        fail++;
        const msg = err instanceof Error ? err.message : 'Errore upload';
        toast(`Errore ${file.name}: ${msg}`, { type: 'error' });
      } finally {
        setProgress((p) => (p ? { done: p.done + 1, total: p.total } : null));
      }
    }
    setBusy(false);
    setProgress(null);
    if (fileRef.current) fileRef.current.value = '';
    if (ok > 0) toast(`${ok} foto caricata/e`, { type: 'success' });
    if (fail > 0 && ok === 0) toast('Upload fallito', { type: 'error' });
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleChange}
        disabled={busy}
      />
      <Button
        variant="ghost"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
      >
        {busy && progress ? `Caricamento ${progress.done}/${progress.total}…` : '📷 Scatta / Scegli foto'}
      </Button>
      <span className="text-xs text-slate-500">
        Max 5MB · JPEG/PNG/WebP (compressione automatica)
      </span>
    </div>
  );
}
