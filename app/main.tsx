import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// PCF7 look: geometric "Futura"-style headings (Jost, incl. oblique) + condensed
// data font (Oswald). Self-hosted via @fontsource so it works offline (no CDN).
import '@fontsource/jost/latin-400.css';
import '@fontsource/jost/latin-500.css';
import '@fontsource/jost/latin-600.css';
import '@fontsource/jost/latin-700.css';
import '@fontsource/jost/latin-500-italic.css';
import '@fontsource/jost/latin-600-italic.css';
import '@fontsource/jost/latin-700-italic.css';
import '@fontsource/oswald/latin-400.css';
import '@fontsource/oswald/latin-500.css';
import '@fontsource/oswald/latin-600.css';
import '@fontsource/oswald/latin-700.css';
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
