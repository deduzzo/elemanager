import { InputHTMLAttributes, useId } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, id: idProp, className = '', ...rest }: InputProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;

  return (
    <div className="w-full">
      <label htmlFor={id} className="block text-sm font-medium text-slate-300">
        {label}
      </label>
      <input
        id={id}
        className={[
          'mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2',
          'text-slate-100 placeholder-slate-500',
          'focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/40',
          'transition',
          error ? 'border-neon-pink/60' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {error && (
        <p id={`${id}-error`} className="text-xs text-neon-pink mt-1">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-slate-400 mt-1">
          {hint}
        </p>
      )}
    </div>
  );
}
