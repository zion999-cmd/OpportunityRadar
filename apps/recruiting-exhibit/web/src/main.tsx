import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.js';
import { AppDataProvider } from './app-data.js';

import './styles/base.css';
import './styles/layout.css';
import './styles/cards.css';
import './styles/detail.css';
import './styles/radar.css';

const container = document.getElementById('root');
if (container === null) throw new Error('#root missing');

createRoot(container).render(
  <StrictMode>
    <AppDataProvider>
      <App />
    </AppDataProvider>
  </StrictMode>,
);
