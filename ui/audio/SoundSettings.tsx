import { useSound } from './useSound';

const SLIDER_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);

/**
 * Volume slider + mute switch. The floating `SoundControl` shows it in a popover,
 * and a future options screen can embed it as-is. Without a provider (or on a
 * platform with no audio) it says so instead of showing dead controls.
 */
export function SoundSettings() {
  const { settings, setVolume, setMuted, play, supported } = useSound();
  const percent = Math.round(settings.volume * 100);

  if (!supported) {
    return <p className="sound-settings__note">Este dispositivo no admite sonido.</p>;
  }

  return (
    <div className="sound-settings" data-sound="off">
      <label className="sound-settings__row sound-settings__row--switch">
        <input
          type="checkbox"
          checked={settings.muted}
          onChange={(e) => {
            setMuted(e.target.checked);
            // Unmuting is the one change worth confirming with a sound.
            if (!e.target.checked) play('confirm');
          }}
        />
        <span>Silenciar</span>
      </label>
      <label className="sound-settings__row">
        <span>Volumen</span>
        <input
          className="sound-settings__range"
          type="range"
          min={0}
          max={100}
          step={5}
          value={percent}
          aria-valuetext={`${percent}%`}
          onChange={(e) => {
            const volume = Number(e.target.value) / 100;
            setVolume(volume);
            if (settings.muted && volume > 0) setMuted(false);
          }}
          // Let go of the slider and hear the level you picked.
          onPointerUp={() => play('click')}
          onKeyUp={(e) => {
            if (SLIDER_KEYS.has(e.key)) play('click');
          }}
        />
        <output className="sound-settings__value">{percent}%</output>
      </label>
    </div>
  );
}
