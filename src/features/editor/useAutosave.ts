import { useEffect } from 'react';

const PREFIX = 'elemanager:draft:';

export function useAutosave<T>(key: string, value: T, delayMs = 5000) {
  useEffect(() => {
    const handle = setTimeout(() => {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify({ value, ts: Date.now() }));
      } catch {
        // storage quota or disabled
      }
    }, delayMs);
    return () => clearTimeout(handle);
  }, [key, value, delayMs]);
}

export function readAutosave<T>(key: string): { value: T; ts: number } | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as { value: T; ts: number };
  } catch {
    return null;
  }
}

export function clearAutosave(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}
