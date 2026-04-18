import { useEffect, useRef, useState } from 'react';

interface AudioPlayerProps {
  src: string;
  /** Duration in ms, if known from metadata. */
  duration?: number | null;
}

function formatMs(ms: number): string {
  const secs = Math.max(0, Math.round(ms / 1000));
  const mm = Math.floor(secs / 60).toString().padStart(2, '0');
  const ss = (secs % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

export function AudioPlayer({ src, duration }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [elapsedMs, setElapsedMs] = useState(0);
  const [totalMs, setTotalMs] = useState<number>(duration ?? 0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      const cur = a.currentTime || 0;
      const dur = a.duration && isFinite(a.duration) ? a.duration : (duration ?? 0) / 1000;
      setElapsedMs(cur * 1000);
      setProgress(dur > 0 ? cur / dur : 0);
    };
    const onMeta = () => {
      if (a.duration && isFinite(a.duration)) setTotalMs(a.duration * 1000);
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
      setElapsedMs(0);
    };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnd);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('ended', onEnd);
    };
  }, [duration]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      void a.play();
      setPlaying(true);
    }
  };

  const shown = playing || elapsedMs > 0 ? elapsedMs : totalMs;

  return (
    <div className="flex items-center gap-3 min-w-[200px]">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pausa' : 'Riproduci'}
        className="w-10 h-10 rounded-full bg-neon-cyan/30 border border-neon-cyan/50 flex items-center justify-center text-neon-cyan hover:bg-neon-cyan/40 transition-colors"
      >
        {playing ? '⏸' : '▶'}
      </button>
      <div className="flex-1">
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-neon-cyan transition-all"
            style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
          />
        </div>
        <div className="text-xs text-slate-400 mt-1">{formatMs(shown)}</div>
      </div>
      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  );
}
