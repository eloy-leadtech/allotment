import type { ReactNode } from 'react';

interface RetroButtonProps {
  onClick: () => void;
  children: ReactNode;
  variant?: 'primary' | 'default';
}

export function RetroButton({ onClick, children, variant = 'default' }: RetroButtonProps) {
  return (
    <button type="button" className={`retro-btn retro-btn--${variant}`} onClick={onClick}>
      {children}
    </button>
  );
}
