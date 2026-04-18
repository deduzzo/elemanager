import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="glass-strong p-6 border-l-4 border-neon-pink">
          <h3 className="text-lg font-semibold text-neon-pink">
            Qualcosa è andato storto
          </h3>
          <p className="mt-2 text-sm text-slate-300">
            {this.state.error.message}
          </p>
          {import.meta.env.DEV && this.state.error.stack && (
            <pre className="mt-3 text-xs text-slate-400 overflow-auto max-h-40 whitespace-pre-wrap">
              {this.state.error.stack}
            </pre>
          )}
          <button
            onClick={() => {
              this.setState({ error: null });
            }}
            className="btn-neon mt-4"
          >
            Ricarica
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
