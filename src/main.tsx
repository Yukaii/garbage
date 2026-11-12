import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ReloadPrompt } from './ReloadPrompt';
import { InstallPrompt } from './InstallPrompt';
import { migrateLegacyPointIds } from './utils/legacyPointIds';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

function render() {
  createRoot(root!).render(
    <StrictMode>
      <App />
      <ReloadPrompt />
      <InstallPrompt />
    </StrictMode>
  );
}

// Upgrade saved stars / shared links before App reads them; resolves immediately for most visitors
migrateLegacyPointIds().catch(error => console.warn('Point ID migration failed:', error)).finally(render);
