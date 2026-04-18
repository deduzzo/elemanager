import { useRef, useState } from 'react';

export type RecorderState = 'idle' | 'recording' | 'stopped' | 'denied' | 'error';

export type UseAudioRecorder = ReturnType<typeof useAudioRecorder>;

function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  return 'audio/webm';
}

export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>('idle');
  const [duration, setDuration] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);

  const chunksRef = useRef<Blob[]>([]);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTsRef = useRef<number>(0);
  const intervalRef = useRef<number | null>(null);
  const mimeRef = useRef<string>('audio/webm');

  const stopTicker = () => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const start = async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setState('error');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      mimeRef.current = mime;
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const b = new Blob(chunksRef.current, { type: mimeRef.current });
        setBlob(b);
        stopStream();
        stopTicker();
        setState('stopped');
      };
      recRef.current = rec;
      startTsRef.current = Date.now();
      setDuration(0);
      setBlob(null);
      intervalRef.current = window.setInterval(() => {
        setDuration(Date.now() - startTsRef.current);
      }, 100);
      rec.start();
      setState('recording');
    } catch (e) {
      stopStream();
      stopTicker();
      const name = (e as DOMException | undefined)?.name;
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error');
    }
  };

  const stop = () => {
    const rec = recRef.current;
    if (rec && rec.state === 'recording') {
      rec.stop();
    }
  };

  /** Abort the recording without producing a blob. */
  const cancel = () => {
    const rec = recRef.current;
    if (rec && rec.state === 'recording') {
      rec.onstop = null;
      try {
        rec.stop();
      } catch {
        // ignore
      }
    }
    chunksRef.current = [];
    stopStream();
    stopTicker();
    setBlob(null);
    setDuration(0);
    setState('idle');
  };

  /** Clear blob state to allow a new recording. */
  const reset = () => {
    chunksRef.current = [];
    setBlob(null);
    setDuration(0);
    setState('idle');
  };

  return { state, duration, blob, mime: mimeRef.current, start, stop, cancel, reset };
}
