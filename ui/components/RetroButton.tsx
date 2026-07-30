import type { ReactNode } from 'react';

interface RetroButtonProps {
  onClick: () => void;
  children: ReactNode;
  variant?: 'primary' | 'default';
  disabled?: boolean;
}

export function RetroButton({ onClick, children, variant = 'default', disabled = false }: RetroButtonProps) {
  return (
    <button
      type="button"
      className={`retro-btn retro-btn--${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
