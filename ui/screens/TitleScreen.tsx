import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';

/**
 * Title screen built over PC Fútbol 7's real logo bitmap
 * (`pcf7_title.png`, the "PC FÚTBOL 7" steel logo). The image is shown inside a
 * fixed 4:3 frame and our menu is overlaid on the right, where the original
 * installer text sat, so the screen reads as the game's own title screen.
 */
export function TitleScreen() {
  const goTo = useGameStore((s) => s.goTo);
  const hasCareer = useGameStore((s) => s.career != null);
  const bg = `${import.meta.env.BASE_URL}ui/pcf7/pcf7_title.png`;

  const onContinue = (): void => {
    goTo(hasCareer ? 'season' : 'slots');
  };

  return (
    <main className="screen screen--title7">
      <div className="pcf7title" style={{ backgroundImage: `url(${bg})`, aspectRatio: '640 / 480' }}>
        <div className="pcf7title__menu">
          <RetroButton variant="primary" onClick={() => goTo('newGame')}>
            Nueva partida
          </RetroButton>
          <RetroButton onClick={onContinue}>Continuar</RetroButton>
          <RetroButton onClick={() => goTo('tournament')}>Torneo</RetroButton>
        </div>
      </div>
      <h1 className="pcf7title__caption">PCFutbol Ultimate</h1>
    </main>
  );
}
