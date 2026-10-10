import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
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
// Piel "Mister" del despacho, portada 1:1 de la maqueta del laboratorio y
// scopeada bajo `.mister` para convivir con global.css (ver ui/theme/mister.css).
import '../ui/theme/mister.css';
import '../ui/theme/mister-shell.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
