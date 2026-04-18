import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import imageCompression from 'browser-image-compression';
import { supabase } from '@/lib/supabase';
import { useCreateUserPost } from '@/lib/queries/livePost';
import { useAudioRecorder } from './useAudioRecorder';
import { Button, useToast } from '@/components/ui';

interface Props {
  giornataId: string;
  userId: string;
  userNome: string;
  onType: () => void;
  onSendOrCancel: () => void;
}

const MAX_TEXT_ROWS = 4;

async function uploadLiveMedia(
  giornataId: string,
  userId: string,
  file: Blob,
  ext: string,
  contentType: string,
): Promise<string> {
  const path = `${giornataId}/${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('live-media')
    .upload(path, file, { contentType, cacheControl: '3600', upsert: false });
  if (error) throw error;
  return path;
}

function mimeToExt(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('mpeg')) return 'mp3';
  if (mime.includes('ogg')) return 'ogg';
  return 'bin';
}

function formatMs(ms: number): string {
  const secs = Math.max(0, Math.round(ms / 1000));
  const mm = Math.floor(secs / 60).toString().padStart(2, '0');
  const ss = (secs % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

export function LiveComposer({
  giornataId,
  userId,
  userNome,
  onType,
  onSendOrCancel,
}: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancelRec, setCancelRec] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const pointerStartYRef = useRef<number>(0);
  const createPost = useCreateUserPost();
  const recorder = useAudioRecorder();
  const { push: toast } = useToast();

  // Auto-grow textarea up to MAX_TEXT_ROWS
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = 20;
    const maxHeight = lineHeight * MAX_TEXT_ROWS + 16;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [text]);

  // When recording stops with a blob, send it (unless user cancelled)
  useEffect(() => {
    if (recorder.state === 'stopped' && recorder.blob) {
      if (cancelRec) {
        recorder.reset();
        setCancelRec(false);
        return;
      }
      void sendAudio(recorder.blob, recorder.duration);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.state, recorder.blob]);

  async function sendText() {
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    try {
      await createPost.mutateAsync({
        giornataId,
        kind: 'user_text',
        content,
        author_id: userId,
        author_nome: userNome,
      });
      setText('');
      onSendOrCancel();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore invio';
      toast(msg, { type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function sendAudio(blob: Blob, durationMs: number) {
    setBusy(true);
    try {
      const mime = blob.type || 'audio/webm';
      const ext = mimeToExt(mime);
      const path = await uploadLiveMedia(giornataId, userId, blob, ext, mime);
      await createPost.mutateAsync({
        giornataId,
        kind: 'user_audio',
        media_path: path,
        media_mime: mime,
        media_duration: Math.round(durationMs),
        author_id: userId,
        author_nome: userNome,
      });
      recorder.reset();
      onSendOrCancel();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore invio audio';
      toast(msg, { type: 'error' });
      recorder.reset();
    } finally {
      setBusy(false);
    }
  }

  async function handlePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 2000,
        useWebWorker: true,
        fileType: 'image/webp',
      });
      const mime = compressed.type || 'image/webp';
      const ext =
        mime === 'image/webp' ? 'webp' : mime === 'image/png' ? 'png' : 'jpg';
      const path = await uploadLiveMedia(giornataId, userId, compressed, ext, mime);
      await createPost.mutateAsync({
        giornataId,
        kind: 'user_photo',
        media_path: path,
        media_mime: mime,
        author_id: userId,
        author_nome: userNome,
      });
      onSendOrCancel();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore invio foto';
      toast(msg, { type: 'error' });
    } finally {
      setBusy(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void sendText();
    }
  };

  // Press-and-hold audio recording
  const onAudioPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (busy) return;
    e.preventDefault();
    pointerStartYRef.current = e.clientY;
    setCancelRec(false);
    void recorder.start();
  };

  const onAudioPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (recorder.state !== 'recording') return;
    const dy = pointerStartYRef.current - e.clientY;
    if (dy > 60) setCancelRec(true);
    else setCancelRec(false);
  };

  const onAudioPointerUp = () => {
    if (recorder.state !== 'recording') return;
    if (cancelRec) {
      recorder.cancel();
      setCancelRec(false);
    } else {
      recorder.stop();
    }
  };

  const onAudioPointerCancel = () => {
    if (recorder.state === 'recording') {
      recorder.cancel();
    }
    setCancelRec(false);
  };

  const recording = recorder.state === 'recording';

  return (
    <div className="border-t border-white/10 bg-slate-900/70 backdrop-blur px-3 py-2">
      {recorder.state === 'denied' && (
        <div className="text-xs text-neon-pink mb-1">
          Permesso microfono negato
        </div>
      )}
      {recorder.state === 'error' && (
        <div className="text-xs text-neon-pink mb-1">
          Registrazione non disponibile su questo dispositivo
        </div>
      )}
      {recording && (
        <div className="text-xs text-slate-300 mb-1 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-neon-pink animate-pulse" />
          <span>Registrazione {formatMs(recorder.duration)}</span>
          <span className="text-slate-500">
            {cancelRec ? '— rilascia per annullare' : '— trascina su per annullare'}
          </span>
        </div>
      )}
      <div className="flex items-end gap-2">
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhoto}
          disabled={busy || recording}
        />
        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          disabled={busy || recording}
          aria-label="Allega foto"
          className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-lg disabled:opacity-40 transition-colors"
        >
          📷
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onType();
          }}
          onKeyDown={onKeyDown}
          placeholder="Scrivi un messaggio…"
          rows={1}
          disabled={busy || recording}
          className="flex-1 resize-none bg-white/5 border border-white/10 rounded-2xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-neon-cyan/50 transition-colors disabled:opacity-60"
        />
        {text.trim() ? (
          <Button
            onClick={() => void sendText()}
            disabled={busy}
            size="sm"
            aria-label="Invia"
          >
            Invia
          </Button>
        ) : (
          <button
            type="button"
            onPointerDown={onAudioPointerDown}
            onPointerMove={onAudioPointerMove}
            onPointerUp={onAudioPointerUp}
            onPointerCancel={onAudioPointerCancel}
            onPointerLeave={onAudioPointerCancel}
            disabled={busy}
            aria-label="Registra audio"
            className={`w-10 h-10 rounded-full border flex items-center justify-center text-lg transition-colors select-none disabled:opacity-40 ${
              recording
                ? cancelRec
                  ? 'bg-neon-pink/40 border-neon-pink text-neon-pink'
                  : 'bg-neon-cyan/40 border-neon-cyan text-neon-cyan'
                : 'bg-white/5 hover:bg-white/10 border-white/10'
            }`}
            style={{ touchAction: 'none' }}
          >
            🎤
          </button>
        )}
      </div>
    </div>
  );
}
