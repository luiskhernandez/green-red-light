import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import './styles/globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('No se encontro el contenedor #root');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// El service worker se actualiza solo. No mostramos prompt: el juego es de un
// solo toque y una recarga silenciosa es menos confusa para el adulto.
registerSW({ immediate: true });
