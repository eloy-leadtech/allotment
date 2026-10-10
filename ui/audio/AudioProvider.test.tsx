import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { AudioManager } from './AudioManager';
import { AudioProvider } from './AudioProvider';
import { NullBackend } from './backend';
import { AUDIO_STORAGE_KEY } from './settings';
import { SOUND_IDS } from './catalog';
import type { DirectorState } from './director';
import { FakeBackend } from './fakes';
import { SoundSettings } from './SoundSettings';
import { useSound } from './useSound';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

function makeStore() {
  return createStore<DirectorState>(() => ({
    screen: 'title',
    lastResults: [],
    viewingMatch: null,
    career: null,
  }));
}

/** A manager over a fake engine with a frozen clock (each test plays any one sound at most once). */
function makeManager(initialStorage: Record<string, string> = {}) {
  const backend = new FakeBackend();
  const storage = memoryStorage(initialStorage);
  const manager = new AudioManager({ backend, storage, baseUrl: '/', now: () => 0 });
  return { backend, storage, manager };
}

/** First user gesture, as a browser would deliver it. */
async function gesture(): Promise<void> {
  await act(async () => {
    fireEvent.pointerDown(document.body);
  });
}

describe('<AudioProvider>', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders its children next to the floating control', () => {
    const { manager } = makeManager();
    render(
      <AudioProvider store={makeStore()} manager={manager}>
        <p>Contenido</p>
      </AudioProvider>,
    );
    expect(screen.getByText('Contenido')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Silenciar' })).toBeInTheDocument();
  });

  it('ticks any button in the tree once the first gesture has woken the engine', async () => {
    const { manager, backend } = makeManager();
    render(
      <AudioProvider store={makeStore()} manager={manager}>
        <button type="button">Plantilla</button>
        <button type="button" className="retro-btn retro-btn--primary">
          Jugar jornada
        </button>
      </AudioProvider>,
    );
    await gesture();
    fireEvent.click(screen.getByText('Plantilla'));
    fireEvent.click(screen.getByText('Jugar jornada'));
    expect(backend.played).toEqual(['click', 'confirm']);
  });

  it('fetches the tiny UI sounds at once and the rest of the pack a moment later', async () => {
    vi.useFakeTimers();
    try {
      const { manager, backend } = makeManager();
      render(<AudioProvider store={makeStore()} manager={manager} />);
      expect(backend.prefetched.map((p) => p.key).sort()).toEqual(['click', 'confirm']);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500);
      });
      expect(backend.prefetched.map((p) => p.key).sort()).toEqual([...SOUND_IDS].sort());
    } finally {
      vi.useRealTimers();
    }
  });

  it('listens to the game store: the crowd comes in with the match screen', async () => {
    const { manager, backend } = makeManager();
    const store = makeStore();
    render(<AudioProvider store={store} manager={manager} />);
    await gesture();
    act(() => store.setState({ screen: 'match', viewingMatch: { homeId: 'a', awayId: 'b', homeGoals: 0, awayGoals: 0, events: [] } }));
    expect(backend.plays.map((p) => [p.key, p.loop])).toEqual([['crowd', true]]);
  });

  it('goes quiet when unmounted', async () => {
    const { manager, backend } = makeManager();
    const { unmount } = render(<AudioProvider store={makeStore()} manager={manager} />);
    await gesture();
    unmount();
    document.body.innerHTML = '<button id="b">x</button>';
    document.getElementById('b')!.click();
    expect(backend.played).toEqual([]);
  });

  describe('while the tab is hidden', () => {
    let hidden = false;
    beforeEach(() => {
      hidden = false;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    });
    afterEach(() => {
      delete (document as unknown as { hidden?: boolean }).hidden;
    });

    it('parks the engine and wakes it again when the tab returns', async () => {
      const { manager, backend } = makeManager();
      render(<AudioProvider store={makeStore()} manager={manager} />);
      await gesture();
      hidden = true;
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(backend.suspendCalls).toBe(1);
      hidden = false;
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(backend.resumeCalls).toBe(2);
    });
  });

  describe('floating control', () => {
    it('mutes in one tap, shows it, and remembers it', () => {
      const { manager, backend, storage } = makeManager();
      render(<AudioProvider store={makeStore()} manager={manager} />);
      const speaker = screen.getByRole('button', { name: 'Silenciar' });
      expect(speaker).toHaveAttribute('aria-pressed', 'false');
      fireEvent.click(speaker);
      expect(manager.getSettings().muted).toBe(true);
      expect(backend.master).toBe(0);
      expect(JSON.parse(storage.data.get(AUDIO_STORAGE_KEY)!).muted).toBe(true);
      // Same button, now "pressed": screen readers hear a mute toggle that is on.
      expect(speaker).toHaveAttribute('aria-pressed', 'true');
      expect(speaker).toHaveAttribute('title', 'Activar sonido');
    });

    it('confirms with a blip when sound comes back on', async () => {
      const { manager, backend } = makeManager({ [AUDIO_STORAGE_KEY]: JSON.stringify({ volume: 0.7, muted: true }) });
      render(<AudioProvider store={makeStore()} manager={manager} />);
      await gesture();
      const speaker = screen.getByRole('button', { name: 'Silenciar' });
      expect(speaker).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(speaker);
      expect(manager.getSettings().muted).toBe(false);
      // The pack was held back while muted; the blip plays as soon as it has been fetched.
      await act(async () => {});
      expect(backend.played).toEqual(['confirm']);
    });

    it('does not tick for its own buttons (the director is told to stay out of it)', async () => {
      const { manager, backend } = makeManager();
      render(<AudioProvider store={makeStore()} manager={manager} />);
      await gesture();
      fireEvent.click(screen.getByRole('button', { name: 'Ajustes de sonido' }));
      fireEvent.click(screen.getByRole('button', { name: 'Silenciar' }));
      expect(backend.played).toEqual([]);
    });

    it('opens a panel with the volume slider and the mute switch', () => {
      const { manager } = makeManager();
      render(<AudioProvider store={makeStore()} manager={manager} />);
      expect(screen.queryByRole('slider')).toBeNull();
      const more = screen.getByRole('button', { name: 'Ajustes de sonido' });
      fireEvent.click(more);
      expect(more).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('slider', { name: /volumen/i })).toHaveValue('70');
      expect(screen.getByRole('checkbox', { name: 'Silenciar' })).not.toBeChecked();
    });

    it('drives the volume from the slider, persists it, and lets you hear the level', async () => {
      const { manager, backend, storage } = makeManager();
      render(<AudioProvider store={makeStore()} manager={manager} />);
      await gesture();
      fireEvent.click(screen.getByRole('button', { name: 'Ajustes de sonido' }));
      const slider = screen.getByRole('slider', { name: /volumen/i });
      fireEvent.change(slider, { target: { value: '30' } });
      expect(manager.getSettings().volume).toBeCloseTo(0.3);
      expect(backend.master).toBeCloseTo(0.3);
      expect(JSON.parse(storage.data.get(AUDIO_STORAGE_KEY)!).volume).toBeCloseTo(0.3);
      expect(screen.getByText('30%')).toBeInTheDocument();
      fireEvent.pointerUp(slider);
      expect(backend.played).toEqual(['click']);
    });

    it('plays the sample on arrow keys but not when merely tabbing into the slider', async () => {
      const { manager, backend } = makeManager();
      render(<AudioProvider store={makeStore()} manager={manager} />);
      await gesture();
      fireEvent.click(screen.getByRole('button', { name: 'Ajustes de sonido' }));
      const slider = screen.getByRole('slider', { name: /volumen/i });
      fireEvent.keyUp(slider, { key: 'Tab' });
      expect(backend.played).toEqual([]);
      fireEvent.keyUp(slider, { key: 'ArrowRight' });
      expect(backend.played).toEqual(['click']);
    });

    it('unmutes when you drag the volume up', () => {
      const { manager } = makeManager({ [AUDIO_STORAGE_KEY]: JSON.stringify({ volume: 0.5, muted: true }) });
      render(<AudioProvider store={makeStore()} manager={manager} />);
      fireEvent.click(screen.getByRole('button', { name: 'Ajustes de sonido' }));
      fireEvent.change(screen.getByRole('slider', { name: /volumen/i }), { target: { value: '60' } });
      expect(manager.getSettings()).toEqual({ volume: 0.6, muted: false });
    });

    it('mutes from the panel switch too', () => {
      const { manager } = makeManager();
      render(<AudioProvider store={makeStore()} manager={manager} />);
      fireEvent.click(screen.getByRole('button', { name: 'Ajustes de sonido' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Silenciar' }));
      expect(manager.getSettings().muted).toBe(true);
    });

    it('closes on Escape and on a press outside', () => {
      const { manager } = makeManager();
      render(
        <AudioProvider store={makeStore()} manager={manager}>
          <p>fuera</p>
        </AudioProvider>,
      );
      const open = () => fireEvent.click(screen.getByRole('button', { name: 'Ajustes de sonido' }));
      open();
      fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(screen.queryByRole('slider')).toBeNull();
      open();
      fireEvent.pointerDown(screen.getByText('fuera'));
      expect(screen.queryByRole('slider')).toBeNull();
      open();
      fireEvent.pointerDown(screen.getByRole('slider', { name: /volumen/i }));
      expect(screen.getByRole('slider', { name: /volumen/i })).toBeInTheDocument();
    });

    it('sits bottom-right by default and moves to any corner on request', () => {
      const { manager } = makeManager();
      const { container, rerender } = render(<AudioProvider store={makeStore()} manager={manager} />);
      expect(container.querySelector('.sound-control')).toHaveClass('sound-control--bottom-right');
      rerender(<AudioProvider store={makeStore()} manager={manager} corner="top-left" />);
      expect(container.querySelector('.sound-control')).toHaveClass('sound-control--top-left');
    });

    it('can be left out when a settings screen hosts the controls itself', () => {
      const { manager } = makeManager();
      render(<AudioProvider store={makeStore()} manager={manager} floatingControl={false} />);
      expect(screen.queryByRole('button', { name: 'Silenciar' })).toBeNull();
    });

    it('is not shown on a platform with no audio', () => {
      const manager = new AudioManager({ backend: new NullBackend(), storage: null });
      render(<AudioProvider store={makeStore()} manager={manager} />);
      expect(screen.queryByRole('button', { name: 'Silenciar' })).toBeNull();
    });
  });
});

describe('useSound', () => {
  function Probe() {
    const { settings, play, supported } = useSound();
    return (
      <div>
        <output data-testid="volume">{Math.round(settings.volume * 100)}</output>
        <output data-testid="supported">{String(supported)}</output>
        <button type="button" data-sound="off" onClick={() => play('goal')}>
          gol
        </button>
      </div>
    );
  }

  it('follows the live settings', () => {
    const { manager } = makeManager();
    render(
      <AudioProvider store={makeStore()} manager={manager} floatingControl={false}>
        <Probe />
      </AudioProvider>,
    );
    expect(screen.getByTestId('volume')).toHaveTextContent('70');
    act(() => manager.setVolume(0.2));
    expect(screen.getByTestId('volume')).toHaveTextContent('20');
  });

  it('lets a component play a sound of its own', async () => {
    const { manager, backend } = makeManager();
    render(
      <AudioProvider store={makeStore()} manager={manager} floatingControl={false}>
        <Probe />
      </AudioProvider>,
    );
    await gesture();
    fireEvent.click(screen.getByText('gol'));
    expect(backend.played).toEqual(['goal']);
  });

  it('is a harmless no-op outside a provider (screens render alone in tests)', () => {
    render(<Probe />);
    expect(screen.getByTestId('supported')).toHaveTextContent('false');
    expect(() => fireEvent.click(screen.getByText('gol'))).not.toThrow();
  });
});

describe('<SoundSettings> outside a provider', () => {
  it('says there is no sound instead of showing dead controls', () => {
    render(<SoundSettings />);
    expect(screen.getByText(/no admite sonido/i)).toBeInTheDocument();
    expect(screen.queryByRole('slider')).toBeNull();
  });
});
