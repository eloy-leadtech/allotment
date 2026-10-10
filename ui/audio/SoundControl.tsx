import { useEffect, useRef, useState } from 'react';
import { SoundSettings } from './SoundSettings';
import { useSound } from './useSound';

function SpeakerIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9.5v5h3.5L13 19V5L7.5 9.5H4Z" fill="currentColor" stroke="none" />
      {off ? (
        <path d="M16.5 9.5 21 14.5M21 9.5l-4.5 5" />
      ) : (
        <>
          <path d="M16.2 9.4a3.7 3.7 0 0 1 0 5.2" />
          <path d="M18.6 6.9a7.2 7.2 0 0 1 0 10.2" />
        </>
      )}
    </svg>
  );
}

function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
    </svg>
  );
}

export type SoundControlCorner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

/**
 * The default way to reach the sound settings: a small floating pill in a corner
 * of the viewport (bottom-right unless `corner` says otherwise). The speaker mutes
 * in one tap; the chevron opens the volume slider. It sits outside every screen's
 * layout (position: fixed, translucent until hovered) so no screen has to make
 * room for it; if one ever collides with a screen's own controls, move it with
 * `corner` (or hide it and host `<SoundSettings />` in an options screen).
 */
export function SoundControl({ corner = 'bottom-right' }: { corner?: SoundControlCorner } = {}) {
  const { settings, toggleMuted, play, supported } = useSound();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Click outside the panel, or Escape, closes it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: Event): void => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  if (!supported) return null;

  const silent = settings.muted || settings.volume === 0;

  return (
    <div
      ref={root}
      className={`sound-control sound-control--${corner}${open ? ' sound-control--open' : ''}`}
      data-sound="off"
    >
      {open ? (
        <div className="sound-control__panel" id="sound-control-panel" role="group" aria-label="Ajustes de sonido">
          <SoundSettings />
        </div>
      ) : null}
      <div className="sound-control__pill">
        <button
          type="button"
          className="sound-control__btn"
          aria-pressed={settings.muted}
          aria-label="Silenciar"
          title={settings.muted ? 'Activar sonido' : 'Silenciar'}
          onClick={() => {
            const wasMuted = settings.muted;
            toggleMuted();
            if (wasMuted) play('confirm');
          }}
        >
          <SpeakerIcon off={silent} />
        </button>
        <button
          type="button"
          className="sound-control__btn sound-control__btn--more"
          aria-expanded={open}
          aria-controls="sound-control-panel"
          aria-label="Ajustes de sonido"
          title="Ajustes de sonido"
          onClick={() => setOpen((o) => !o)}
        >
          <ChevronIcon up={open} />
        </button>
      </div>
    </div>
  );
}
