import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ReloadPrompt } from './ReloadPrompt';
import { InstallPrompt } from './InstallPrompt';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
    <ReloadPrompt />
    <InstallPrompt />
  </StrictMode>
);
