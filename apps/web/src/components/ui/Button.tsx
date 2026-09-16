import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
};

export default function Button({
  children,
  onClick,
  disabled,
  variant = 'primary',
  loading = false,
  className = '',
  ...props
}: ButtonProps) {
  const cls = `btn ${variant === 'secondary' ? 'secondary' : ''} ${className}`.trim();
  return (
    <button {...props} className={cls} onClick={onClick} disabled={disabled}>
      {loading ? <span className={`spinner ${variant === 'secondary' ? 'dark' : ''}`} /> : null}
      {children}
    </button>
  );
}
