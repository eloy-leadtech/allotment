import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AudioProvider } from '@ui/audio';
import { useGameStore } from '@ui/store/gameStore';
// Piel "Mister": titulares grotescos humanistas (Barlow, incl. oblicua) + datos
// condensados (Barlow Condensed). Self-hosted vía @fontsource: funciona offline (sin CDN).
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import '@fontsource/barlow/latin-800.css';
import '@fontsource/barlow/latin-600-italic.css';
import '@fontsource/barlow/latin-700-italic.css';
import '@fontsource/barlow/latin-800-italic.css';
import '@fontsource/barlow-condensed/latin-400.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '../ui/theme/global.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <AudioProvider store={useGameStore}>
      <App />
    </AudioProvider>
  </StrictMode>,
);
