import type { ReactNode } from 'react';

interface RetroPanelProps {
  title?: string;
  children: ReactNode;
}

export function RetroPanel({ title, children }: RetroPanelProps) {
  return (
    <section className="retro-panel">
      {title ? <h2 className="retro-panel__title">{title}</h2> : null}
      {children}
    </section>
  );
}
