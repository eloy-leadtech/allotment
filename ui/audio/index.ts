// Sound layer: mount <AudioProvider> once at the root (app/main.tsx); everything
// else is optional. See ./README.md for how clicks, match events (scoreboard clock) and the
// `data-sound` attribute work.
export { AudioProvider, type AudioProviderProps } from './AudioProvider';
export { SoundControl, type SoundControlCorner } from './SoundControl';
export { SoundSettings } from './SoundSettings';
export { useSound, type UseSound } from './useSound';
export { SOUNDS, SOUND_IDS, type SoundId } from './catalog';
