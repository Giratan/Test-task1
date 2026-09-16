import type { ChangeEvent } from 'react';

type InputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: string;
  className?: string;
};

export default function Input({
  value,
  onChange,
  placeholder,
  disabled = false,
  type = 'text',
  className = '',
}: InputProps) {
  return (
    <input
      className={disabled ? `input-disabled ${className}` : className}
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      type={type}
    />
  );
}
