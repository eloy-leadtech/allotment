import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Mister look: Barlow for body text, Barlow Condensed (incl. italics) for
// headings and tabular data. Self-hosted via @fontsource so it works offline.
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-600-italic.css';
import '@fontsource/barlow-condensed/latin-700-italic.css';
import '../ui/theme/global.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
