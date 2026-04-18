import { SelectHTMLAttributes, useId } from 'react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Select({
  label,
  error,
  hint,
  id: idProp,
  className = '',
  children,
  ...rest
}: SelectProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;

  return (
    <div className="w-full">
      <label htmlFor={id} className="block text-sm font-medium text-slate-300">
        {label}
      </label>
      <select
        id={id}
        className={[
          'mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2',
          'text-slate-100',
          'focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/40',
          'transition',
          'appearance-none cursor-pointer',
          error ? 'border-neon-pink/60' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        aria-invalid={error ? true : undefined}
        {...rest}
      >
        {children}
      </select>
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
