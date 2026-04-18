import { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'btn-neon',
  ghost: 'bg-white/5 hover:bg-white/10 text-slate-100 rounded-xl transition-colors',
  danger:
    'bg-neon-pink/20 hover:bg-neon-pink/30 text-neon-pink border border-neon-pink/30 rounded-xl transition-colors',
};

const sizeClasses: Record<ButtonSize, string> = {
  md: 'px-4 py-2',
  sm: 'px-3 py-1.5 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const classes = [variantClasses[variant], sizeClasses[size], className]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
