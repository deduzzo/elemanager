import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import ReactDOM from 'react-dom';

export type ToastType = 'info' | 'success' | 'error';

export interface PushToastOptions {
  type?: ToastType;
  duration?: number;
}

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  /** Whether the item has fully appeared (for enter animation) */
  visible: boolean;
}

interface ToastContextValue {
  pushToast: (message: string, options?: PushToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 5;

const borderColors: Record<ToastType, string> = {
  info: 'border-l-neon-cyan',
  success: 'border-l-green-400',
  error: 'border-l-neon-pink',
};

let counter = 0;
function nextId() {
  return `toast-${++counter}`;
}

function ToastItemEl({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger enter animation on next frame
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), item.duration);
    return () => clearTimeout(timer);
  }, [item.id, item.duration, onDismiss]);

  return (
    <div
      className={[
        'glass border-l-4 px-4 py-3 rounded-xl shadow-lg min-w-[260px] max-w-xs',
        borderColors[item.type],
        'transition-all duration-300 ease-out',
        mounted ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0',
      ].join(' ')}
      role="alert"
      aria-live="polite"
    >
      <p className="text-sm text-slate-100">{item.message}</p>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback((message: string, options: PushToastOptions = {}) => {
    const item: ToastItem = {
      id: nextId(),
      message,
      type: options.type ?? 'info',
      duration: options.duration ?? 4000,
      visible: false,
    };
    setToasts((prev) => {
      const next = [...prev, item];
      // Keep at most MAX_TOASTS, removing oldest
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
    });
  }, []);

  const contextValue = useRef<ToastContextValue>({ pushToast });
  contextValue.current.pushToast = pushToast;

  return (
    <ToastContext.Provider value={contextValue.current}>
      {children}
      {ReactDOM.createPortal(
        <div
          className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end"
          aria-label="Notifiche"
        >
          {toasts.map((t) => (
            <ToastItemEl key={t.id} item={t} onDismiss={dismiss} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return { push: ctx.pushToast };
}
